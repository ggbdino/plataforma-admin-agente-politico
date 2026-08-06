import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { ensureElectorEnrichmentColumns } from "@/lib/repositories/elector-schema";

export type CampaignSmsAudience =
  | "todos_com_telefone"
  | "eleitor_individual"
  | "evento_todos"
  | "evento_confirmados"
  | "evento_presentes";

export type CampaignSmsContext = {
  id_candidato: string;
  nome_urna: string;
  numero_campanha: string | null;
  total_eleitores_com_telefone: number;
  eventos: { id: string; nome_evento: string; data_evento: string }[];
  eleitores: { eleitor_uid: string; nome: string | null; telefone: string | null; email: string | null }[];
  ultimas_remessas: CampaignSmsDispatchSummary[];
  provedor_configurado: boolean;
  provedor_envio: string;
  gateway_url: string | null;
  gateway_api_key_configurada: boolean;
  sender_id: string | null;
  max_recipients_per_dispatch: number;
  usa_fallback_global: boolean;
  gateway_origem: string;
  gateway_url_sugerida: string | null;
};

export type CampaignSmsDispatchSummary = {
  id: string;
  mensagem: string;
  publico: string;
  provider: string;
  status: string;
  total_destinatarios: number;
  total_enviados: number;
  total_falhas: number;
  criado_em: string;
};

type CandidateSmsIdentity = {
  id_candidato: string;
  nome_urna: string;
  numero_campanha: string | null;
  sms_provider: string | null;
  sms_gateway_url: string | null;
  sms_gateway_api_key: string | null;
  sms_sender_id: string | null;
  sms_max_recipients_per_dispatch: number | null;
  sms_status: string | null;
};

type SmsConfig = {
  provider: string;
  gatewayUrl: string | null;
  gatewayApiKey: string | null;
  senderId: string | null;
  maxRecipients: number;
  configured: boolean;
  usesGlobalFallback: boolean;
  source: "configuracao_candidato" | "env_candidato" | "fallback_global" | "nao_configurado";
};

type Recipient = {
  eleitor_uid: string;
  nome: string | null;
  telefone: string;
};

export async function getCampaignSmsContext(idCandidato: string): Promise<CampaignSmsContext | null> {
  await ensureCampaignSmsTables();
  await ensureElectorEnrichmentColumns();

  const identity = await getCandidateSmsIdentity(idCandidato);
  if (!identity) return null;

  const [totalResult, eventsResult, electorsResult, dispatchesResult] = await Promise.all([
    db.query<{ total: number }>(
      `
        select count(*)::int as total
        from eleitores
        where id_candidato = $1
          and nullif(trim(coalesce(telefone, '')), '') is not null
          and coalesce(opt_out, false) = false
      `,
      [idCandidato]
    ),
    db.query<{ id: string; nome_evento: string; data_evento: string }>(
      `
        select id::text as id, nome_evento, data_evento::text as data_evento
        from eventos_campanha
        where id_candidato = $1
        order by data_evento desc
        limit 20
      `,
      [idCandidato]
    ),
    db.query<{ eleitor_uid: string; nome: string | null; telefone: string | null; email: string | null }>(
      `
        select eleitor_uid, nome, telefone, email
        from eleitores
        where id_candidato = $1
          and nullif(trim(coalesce(telefone, '')), '') is not null
          and coalesce(opt_out, false) = false
        order by coalesce(nullif(trim(nome), ''), telefone)
      `,
      [idCandidato]
    ),
    db.query<CampaignSmsDispatchSummary>(
      `
        select id::text as id, mensagem, publico, provider, status,
               total_destinatarios, total_enviados, total_falhas, criado_em::text as criado_em
        from remessas_sms_campanha
        where id_candidato = $1
        order by criado_em desc
        limit 10
      `,
      [idCandidato]
    )
  ]);

  const config = resolveSmsConfig(identity);

  return {
    id_candidato: identity.id_candidato,
    nome_urna: identity.nome_urna,
    numero_campanha: identity.numero_campanha,
    total_eleitores_com_telefone: totalResult.rows[0]?.total ?? 0,
    eventos: eventsResult.rows,
    eleitores: electorsResult.rows,
    ultimas_remessas: dispatchesResult.rows,
    provedor_configurado: config.configured,
    provedor_envio: config.provider,
    gateway_url: config.gatewayUrl,
    gateway_api_key_configurada: Boolean(config.gatewayApiKey),
    sender_id: config.senderId,
    max_recipients_per_dispatch: config.maxRecipients,
    usa_fallback_global: config.usesGlobalFallback,
    gateway_origem: config.source,
    gateway_url_sugerida: buildAutomaticCandidateSmsWebhookUrl(identity.id_candidato)
  };
}

export async function planAndSendCampaignSms(input: {
  idCandidato: string;
  atorUsuarioId: string;
  atorEmail: string;
  publico: CampaignSmsAudience;
  eventoId?: string | null;
  eleitorUid?: string | null;
  mensagem: string;
}) {
  await ensureCampaignSmsTables();
  await ensureElectorEnrichmentColumns();

  const identity = await getCandidateSmsIdentity(input.idCandidato);
  if (!identity) throw new Error("Candidato não encontrado para a remessa SMS.");

  const mensagem = normalizeSmsMessage(input.mensagem);
  if (!mensagem) throw new Error("Informe o texto da mensagem SMS antes de preparar a remessa.");

  const updatedIdentity = await getCandidateSmsIdentity(input.idCandidato);
  if (!updatedIdentity) throw new Error("Configuração SMS do candidato não localizada.");

  const config = resolveSmsConfig(updatedIdentity);
  const recipients = await listRecipients({
    idCandidato: input.idCandidato,
    publico: input.publico,
    eventoId: input.eventoId,
    eleitorUid: input.eleitorUid
  });
  if (recipients.length === 0) throw new Error("Nenhum eleitor com telefone válido foi localizado para o público selecionado.");

  const limitedRecipients = recipients.slice(0, config.maxRecipients);
  const provider = config.configured ? config.provider : "sem_provedor";
  const initialStatus = config.configured ? "em_processamento" : "planejada_sem_provedor";

  const dispatchResult = await db.query<{ id: string }>(
    `
      insert into remessas_sms_campanha (
        id_candidato, ator_usuario_id, ator_email, sender_id, numero_campanha,
        mensagem, publico, evento_id, provider, status, total_destinatarios,
        total_enviados, total_falhas, metadata, criado_em, atualizado_em
      ) values (
        $1, $2::uuid, $3, $4, $5, $6, $7, $8::uuid, $9, $10, $11,
        0, 0, $12::jsonb, now(), now()
      ) returning id::text as id
    `,
    [
      input.idCandidato,
      input.atorUsuarioId,
      input.atorEmail,
      config.senderId,
      updatedIdentity.numero_campanha,
      mensagem,
      input.publico,
      input.eventoId || null,
      provider,
      initialStatus,
      limitedRecipients.length,
      JSON.stringify({
        total_original_destinatarios: recipients.length,
        limite_aplicado: config.maxRecipients,
        eleitor_individual: input.publico === "eleitor_individual" ? input.eleitorUid : null,
        fonte_destinatarios: "base_eleitores_candidato",
        canal: "sms",
        configuracao_por_candidato: !config.usesGlobalFallback,
        gateway_url: config.gatewayUrl ? maskUrl(config.gatewayUrl) : null
      })
    ]
  );

  const dispatchId = dispatchResult.rows[0].id;
  await db.query(
    `
      insert into remessas_sms_destinatarios (remessa_id, eleitor_uid, nome, telefone, status, criado_em, atualizado_em)
      select $1::uuid, x.eleitor_uid, x.nome, x.telefone, $2, now(), now()
      from jsonb_to_recordset($3::jsonb) as x(eleitor_uid text, nome text, telefone text)
    `,
    [dispatchId, config.configured ? "pendente" : "planejado", JSON.stringify(limitedRecipients)]
  );

  if (!config.configured) {
    return { dispatchId, status: initialStatus, totalDestinatarios: limitedRecipients.length, totalEnviados: 0, totalFalhas: 0, provider, firstFailureMessage: null };
  }

  let totalEnviados = 0;
  let totalFalhas = 0;
  let firstFailureMessage: string | null = null;

  for (const recipient of limitedRecipients) {
    try {
      await sendWithConfiguredProvider({
        dispatchId,
        idCandidato: input.idCandidato,
        config,
        recipient,
        mensagem
      });
      totalEnviados += 1;
      await updateRecipientStatus(dispatchId, recipient.eleitor_uid, "enviado", null);
    } catch (error) {
      totalFalhas += 1;
      const failureMessage = error instanceof Error ? error.message : "Falha desconhecida no envio SMS.";
      firstFailureMessage ??= summarizeProviderFailure(failureMessage);
      await updateRecipientStatus(dispatchId, recipient.eleitor_uid, "erro", failureMessage);
    }
  }

  const finalStatus = totalFalhas === 0 ? "enviada" : totalEnviados > 0 ? "enviada_com_falhas" : "erro";
  await db.query(
    `update remessas_sms_campanha set status = $2, total_enviados = $3, total_falhas = $4, atualizado_em = now() where id = $1::uuid`,
    [dispatchId, finalStatus, totalEnviados, totalFalhas]
  );

  return { dispatchId, status: finalStatus, totalDestinatarios: limitedRecipients.length, totalEnviados, totalFalhas, provider, firstFailureMessage };
}

async function getCandidateSmsIdentity(idCandidato: string): Promise<CandidateSmsIdentity | null> {
  const result = await db.query<CandidateSmsIdentity>(
    `
      select
        c.id_candidato,
        coalesce(c.nome_urna, c.nome_completo, c.id_candidato) as nome_urna,
        coalesce(c.telefone_candidato, official.identificador_externo) as numero_campanha,
        cfg.provider as sms_provider,
        cfg.gateway_url as sms_gateway_url,
        cfg.gateway_api_key as sms_gateway_api_key,
        cfg.sender_id as sms_sender_id,
        cfg.max_recipients_per_dispatch as sms_max_recipients_per_dispatch,
        cfg.status as sms_status
      from candidatos c
      left join campanha_sms_config cfg on cfg.id_candidato = c.id_candidato
      left join lateral (
        select identificador_externo
        from canais_integracao ci
        where ci.id_candidato = c.id_candidato and ci.tipo_canal = 'whatsapp_agente'
        order by ci.atualizado_em desc
        limit 1
      ) official on true
      where c.id_candidato = $1
      limit 1
    `,
    [idCandidato]
  );

  return result.rows[0] ?? null;
}

export async function saveCampaignSmsConfig(input: {
  idCandidato: string;
  provider?: string | null;
  gatewayUrl?: string | null;
  gatewayApiKey?: string | null;
  senderId?: string | null;
  maxRecipientsPerDispatch?: string | number | null;
}) {
  const provider = normalizeProvider(input.provider);
  const gatewayUrl = normalizeOptionalUrl(input.gatewayUrl);
  const gatewayApiKey = normalizeText(input.gatewayApiKey);
  const senderId = normalizeText(input.senderId);
  const maxRecipients = normalizeMaxRecipients(input.maxRecipientsPerDispatch ?? undefined);

  await db.query(
    `
      insert into campanha_sms_config (
        id_candidato, provider, gateway_url, gateway_api_key, sender_id,
        max_recipients_per_dispatch, status, atualizado_em
      ) values ($1, $2, $3, $4, $5, $6, 'ativo', now())
      on conflict (id_candidato)
      do update set
        provider = coalesce(nullif(excluded.provider, ''), campanha_sms_config.provider),
        gateway_url = coalesce(nullif(excluded.gateway_url, ''), campanha_sms_config.gateway_url),
        gateway_api_key = coalesce(nullif(excluded.gateway_api_key, ''), campanha_sms_config.gateway_api_key),
        sender_id = coalesce(nullif(excluded.sender_id, ''), campanha_sms_config.sender_id),
        max_recipients_per_dispatch = coalesce(excluded.max_recipients_per_dispatch, campanha_sms_config.max_recipients_per_dispatch),
        status = 'ativo',
        atualizado_em = now()
    `,
    [input.idCandidato, provider, gatewayUrl, gatewayApiKey, senderId, maxRecipients]
  );
}

async function listRecipients(input: {
  idCandidato: string;
  publico: CampaignSmsAudience;
  eventoId?: string | null;
  eleitorUid?: string | null;
}) {
  const values: unknown[] = [input.idCandidato];
  let joinClause = "";
  let whereClause = "";

  if (input.publico === "eleitor_individual") {
    if (!input.eleitorUid) throw new Error("Selecione um eleitor para a remessa individual.");
    values.push(input.eleitorUid);
    whereClause = "and e.eleitor_uid = $2";
  } else if (input.publico !== "todos_com_telefone") {
    if (!input.eventoId) throw new Error("Selecione um evento para remeter SMS por público de evento.");
    values.push(input.eventoId);
    joinClause = `
      join participacoes_eventos p
        on p.eleitor_uid = e.eleitor_uid
       and p.id_candidato = e.id_candidato
       and p.evento_id = $2::uuid
    `;
    if (input.publico === "evento_confirmados") {
      whereClause = "and p.status_participacao in ('confirmado', 'confirmada')";
    } else if (input.publico === "evento_presentes") {
      whereClause = "and p.status_participacao in ('presente', 'compareceu')";
    }
  }

  const result = await db.query<{ eleitor_uid: string; nome: string | null; telefone: string }>(
    `
      select distinct on (regexp_replace(e.telefone, '[^0-9]', '', 'g'))
        e.eleitor_uid,
        e.nome,
        regexp_replace(e.telefone, '[^0-9]', '', 'g') as telefone
      from eleitores e
      ${joinClause}
      where e.id_candidato = $1
        and nullif(trim(coalesce(e.telefone, '')), '') is not null
        and coalesce(e.opt_out, false) = false
        ${whereClause}
      order by regexp_replace(e.telefone, '[^0-9]', '', 'g'), coalesce(e.ultimo_contato_em, e.atualizado_em, e.criado_em) desc
    `,
    values
  );

  return result.rows
    .map((row) => ({ ...row, telefone: normalizePhone(row.telefone) }))
    .filter((row): row is Recipient => Boolean(row.telefone));
}

async function updateRecipientStatus(dispatchId: string, eleitorUid: string, status: string, errorMessage: string | null) {
  await db.query(
    `
      update remessas_sms_destinatarios
      set status = $3,
          erro = $4,
          enviado_em = case when $3 = 'enviado' then now() else enviado_em end,
          atualizado_em = now()
      where remessa_id = $1::uuid and eleitor_uid = $2
    `,
    [dispatchId, eleitorUid, status, errorMessage]
  );
}

async function ensureCampaignSmsTables() {
  await db.query(`
    create table if not exists campanha_sms_config (
      id_candidato varchar(120) primary key references candidatos(id_candidato) on delete cascade,
      provider text,
      gateway_url text,
      gateway_api_key text,
      sender_id text,
      max_recipients_per_dispatch integer,
      status text not null default 'ativo',
      criado_em timestamptz default now(),
      atualizado_em timestamptz default now()
    )
  `);

  await db.query(`
    create table if not exists remessas_sms_campanha (
      id uuid primary key default gen_random_uuid(),
      id_candidato varchar(120) not null references candidatos(id_candidato) on delete cascade,
      ator_usuario_id uuid references paines_admin_usuario(id),
      ator_email text,
      sender_id text,
      numero_campanha text,
      mensagem text not null,
      publico text not null,
      evento_id uuid references eventos_campanha(id) on delete set null,
      provider text,
      status text not null default 'planejada',
      total_destinatarios integer not null default 0,
      total_enviados integer not null default 0,
      total_falhas integer not null default 0,
      metadata jsonb default '{}'::jsonb,
      criado_em timestamptz default now(),
      atualizado_em timestamptz default now()
    )
  `);

  await db.query(`
    create table if not exists remessas_sms_destinatarios (
      id uuid primary key default gen_random_uuid(),
      remessa_id uuid not null references remessas_sms_campanha(id) on delete cascade,
      eleitor_uid text not null,
      nome text,
      telefone text not null,
      status text not null default 'pendente',
      erro text,
      enviado_em timestamptz,
      criado_em timestamptz default now(),
      atualizado_em timestamptz default now(),
      unique(remessa_id, eleitor_uid)
    )
  `);
}

async function sendWithConfiguredProvider(input: {
  dispatchId: string;
  idCandidato: string;
  config: SmsConfig;
  recipient: Recipient;
  mensagem: string;
}) {
  if (!input.config.gatewayUrl) {
    throw new Error("Gateway SMS não configurado para este candidato.");
  }

  const response = await fetch(input.config.gatewayUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(input.config.gatewayApiKey ? { Authorization: `Bearer ${input.config.gatewayApiKey}` } : {})
    },
    body: JSON.stringify({
      provider: input.config.provider,
      dispatchId: input.dispatchId,
      idCandidato: input.idCandidato,
      from: input.config.senderId,
      to: input.recipient.telefone,
      nome: input.recipient.nome,
      message: input.mensagem
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gateway SMS recusou o envio (${response.status}): ${body.slice(0, 300)}`);
  }
}

function resolveSmsConfig(identity: CandidateSmsIdentity): SmsConfig {
  const statusAtivo = (identity.sms_status || "ativo") === "ativo";
  const envSuffix = normalizeEnvSuffix(`${identity.nome_urna}_${identity.id_candidato}`);
  const candidateGatewayUrl = statusAtivo ? normalizeOptionalUrl(identity.sms_gateway_url) : null;
  const envCandidateGatewayUrl = normalizeOptionalUrl(readProcessEnv(`SMS_WEBHOOK_URL_${envSuffix}`));
  const fallbackGatewayUrl = normalizeOptionalUrl(env.smsWebhookUrl);
  const gatewayUrl = candidateGatewayUrl || envCandidateGatewayUrl || fallbackGatewayUrl;
  const source = candidateGatewayUrl
    ? "configuracao_candidato"
    : envCandidateGatewayUrl
      ? "env_candidato"
      : fallbackGatewayUrl
        ? "fallback_global"
        : "nao_configurado";
  const gatewayApiKey = normalizeText(
    identity.sms_gateway_api_key || readProcessEnv(`SMS_API_KEY_${envSuffix}`) || env.smsApiKey
  );
  const provider = gatewayUrl ? normalizeProvider(identity.sms_provider || env.smsProvider) : "sem_provedor";
  const senderId = normalizeText(
    identity.sms_sender_id || readProcessEnv(`SMS_SENDER_ID_${envSuffix}`) || env.smsSenderId || identity.numero_campanha
  );
  const maxRecipients = normalizeMaxRecipients(
    identity.sms_max_recipients_per_dispatch || readProcessEnv(`SMS_MAX_RECIPIENTS_PER_DISPATCH_${envSuffix}`) || env.smsMaxRecipientsPerDispatch
  );

  return {
    provider,
    gatewayUrl,
    gatewayApiKey,
    senderId,
    maxRecipients,
    configured: Boolean(gatewayUrl),
    usesGlobalFallback: source === "fallback_global",
    source
  };
}

function buildAutomaticCandidateSmsWebhookUrl(idCandidato: string) {
  const webhookBaseUrl = normalizeText(env.n8nWebhookBaseUrl);
  if (!webhookBaseUrl) return null;
  try {
    return new URL(`/webhook/agente-politico/${encodeURIComponent(idCandidato)}/sms-campanha`, webhookBaseUrl).toString();
  } catch {
    return null;
  }
}

function normalizeEnvSuffix(value: string) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function readProcessEnv(name: string) {
  return process.env[name] ?? "";
}
function summarizeProviderFailure(message: string) {
  const normalized = message.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, 240) : "Falha desconhecida no envio SMS.";
}

function normalizeText(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function normalizeSmsMessage(value: string | null | undefined) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  return normalized.slice(0, 320);
}

function normalizeOptionalUrl(value: string | null | undefined) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  try {
    const parsed = new URL(normalized);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function normalizeProvider(value: string | null | undefined) {
  return normalizeText(value)?.toLowerCase().replace(/[^a-z0-9_-]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") || "webhook";
}

function normalizeMaxRecipients(value: string | number | undefined) {
  const parsed = Number(value ?? 20);
  if (!Number.isFinite(parsed) || parsed <= 0) return 20;
  return Math.min(Math.trunc(parsed), 250);
}

function normalizePhone(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55") && digits.length >= 12 && digits.length <= 13) return digits;
  if (digits.length >= 10 && digits.length <= 11) return `55${digits}`;
  return digits.length >= 8 ? digits : null;
}

function maskUrl(value: string) {
  try {
    const parsed = new URL(value);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return "gateway_configurado";
  }
}