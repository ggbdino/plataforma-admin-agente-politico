import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { ensureElectorEnrichmentColumns } from "@/lib/repositories/elector-schema";

export type CampaignWhatsAppAudience =
  | "todos_com_telefone"
  | "eleitor_individual"
  | "evento_todos"
  | "evento_confirmados"
  | "evento_presentes";

export type CampaignWhatsAppTemplatePreset = {
  id: string;
  nome: string;
  descricao: string;
  template_sugerido: string;
  variaveis: string[];
};

export type CampaignWhatsAppContext = {
  id_candidato: string;
  nome_urna: string;
  numero_campanha: string | null;
  phone_number_id: string | null;
  business_account_id: string | null;
  template_padrao: string | null;
  language_code: string;
  total_eleitores_com_telefone: number;
  eventos: { id: string; nome_evento: string; data_evento: string }[];
  eleitores: { eleitor_uid: string; nome: string | null; telefone: string | null; email: string | null }[];
  ultimas_remessas: CampaignWhatsAppDispatchSummary[];
  meta_configurada: boolean;
  modelos_padrao: CampaignWhatsAppTemplatePreset[];
};

export type CampaignWhatsAppDispatchSummary = {
  id: string;
  template_name: string;
  publico: string;
  status: string;
  total_destinatarios: number;
  total_enviados: number;
  total_falhas: number;
  criado_em: string;
};

type Recipient = {
  eleitor_uid: string;
  nome: string | null;
  telefone: string;
};

type CandidateWhatsAppIdentity = {
  id_candidato: string;
  nome_urna: string;
  numero_campanha: string | null;
  phone_number_id: string | null;
  business_account_id: string | null;
  access_token: string | null;
  template_padrao: string | null;
  language_code: string | null;
};

const WHATSAPP_TEMPLATE_PRESETS: CampaignWhatsAppTemplatePreset[] = [
  {
    id: "apresentacao_candidato",
    nome: "Apresentação do candidato",
    descricao: "Primeiro contato com eleitor cadastrado na base do candidato.",
    template_sugerido: "apresentacao_do_candidato",
    variaveis: ["nome do eleitor", "nome do candidato"]
  },
  {
    id: "convite_evento",
    nome: "Convite para evento",
    descricao: "Chamada para agenda, reunião, caminhada ou encontro da campanha.",
    template_sugerido: "convite_evento_campanha",
    variaveis: ["nome do eleitor", "nome do evento", "data ou local"]
  },
  {
    id: "lembrete_evento",
    nome: "Lembrete de evento",
    descricao: "Reforço para eleitor já convidado ou confirmado em um evento.",
    template_sugerido: "lembrete_evento_campanha",
    variaveis: ["nome do eleitor", "nome do evento", "horário"]
  },
  {
    id: "mobilizacao_whatsapp",
    nome: "Mobilização pelo WhatsApp",
    descricao: "Mensagem geral de mobilização para base com telefone e opt-in.",
    template_sugerido: "mobilizacao_whatsapp_campanha",
    variaveis: ["nome do eleitor", "chamada principal"]
  },
  {
    id: "hello_world",
    nome: "Teste técnico hello_world",
    descricao: "Modelo padrão da Meta para teste controlado de envio.",
    template_sugerido: "hello_world",
    variaveis: []
  }
];

export async function getCampaignWhatsAppContext(idCandidato: string): Promise<CampaignWhatsAppContext | null> {
  await ensureCampaignWhatsAppTables();
  await ensureElectorEnrichmentColumns();

  const identity = await getCandidateWhatsAppIdentity(idCandidato);
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
    db.query<CampaignWhatsAppDispatchSummary>(
      `
        select id::text as id, template_name, publico, status,
               total_destinatarios, total_enviados, total_falhas, criado_em::text as criado_em
        from remessas_whatsapp_campanha
        where id_candidato = $1
        order by criado_em desc
        limit 10
      `,
      [idCandidato]
    )
  ]);

  const config = resolveMetaConfig(identity);

  return {
    id_candidato: identity.id_candidato,
    nome_urna: identity.nome_urna,
    numero_campanha: identity.numero_campanha,
    phone_number_id: config.phoneNumberId || null,
    business_account_id: config.businessAccountId || null,
    template_padrao: identity.template_padrao,
    language_code: identity.language_code || "pt_BR",
    total_eleitores_com_telefone: totalResult.rows[0]?.total ?? 0,
    eventos: eventsResult.rows,
    eleitores: electorsResult.rows,
    ultimas_remessas: dispatchesResult.rows,
    meta_configurada: Boolean(config.enabled && config.accessToken && config.phoneNumberId),
    modelos_padrao: buildTemplatePresets(identity.template_padrao)
  };
}

export async function planAndSendCampaignWhatsApp(input: {
  idCandidato: string;
  atorUsuarioId: string;
  atorEmail: string;
  publico: CampaignWhatsAppAudience;
  eventoId?: string | null;
  eleitorUid?: string | null;
  phoneNumberId?: string | null;
  businessAccountId?: string | null;
  accessToken?: string | null;
  numeroCampanha?: string | null;
  padraoMensagem?: string | null;
  templateName: string;
  languageCode: string;
  variaveis: string[];
}) {
  await ensureCampaignWhatsAppTables();
  await ensureElectorEnrichmentColumns();

  const identity = await getCandidateWhatsAppIdentity(input.idCandidato);
  if (!identity) throw new Error("Candidato não encontrado para a remessa de WhatsApp.");

  const templateName = normalizeTemplateName(input.templateName || identity.template_padrao);
  const languageCode = normalizeText(input.languageCode || identity.language_code || "pt_BR") || "pt_BR";
  const variables = input.variaveis.map((value) => normalizeText(value)).filter(Boolean) as string[];
  if (!templateName) throw new Error("Informe o nome de um modelo de mensagem aprovado na Meta.");

  await saveCampaignWhatsAppConfig({
    idCandidato: input.idCandidato,
    phoneNumberId: input.phoneNumberId || identity.phone_number_id,
    businessAccountId: input.businessAccountId || identity.business_account_id,
    accessToken: input.accessToken || identity.access_token,
    numeroCampanha: input.numeroCampanha || identity.numero_campanha,
    templatePadrao: templateName,
    languageCode
  });

  const updatedIdentity = await getCandidateWhatsAppIdentity(input.idCandidato);
  if (!updatedIdentity) throw new Error("Configuração de WhatsApp do candidato não localizada.");

  const config = resolveMetaConfig(updatedIdentity);
  const recipients = await listRecipients({
    idCandidato: input.idCandidato,
    publico: input.publico,
    eventoId: input.eventoId,
    eleitorUid: input.eleitorUid
  });
  if (recipients.length === 0) throw new Error("Nenhum eleitor com telefone válido foi localizado para o público selecionado.");

  const maxRecipients = normalizeMaxRecipients(env.whatsAppMaxRecipientsPerDispatch);
  const limitedRecipients = recipients.slice(0, maxRecipients);
  const provider = config.enabled && config.accessToken && config.phoneNumberId ? "meta_cloud_api" : "sem_provedor";
  const initialStatus = provider === "meta_cloud_api" ? "em_processamento" : "planejada_sem_provedor";

  const dispatchResult = await db.query<{ id: string }>(
    `
      insert into remessas_whatsapp_campanha (
        id_candidato, ator_usuario_id, ator_email, phone_number_id, business_account_id,
        numero_campanha, template_name, language_code, variaveis, publico, evento_id,
        provider, status, total_destinatarios, total_enviados, total_falhas, metadata,
        criado_em, atualizado_em
      ) values (
        $1, $2::uuid, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11::uuid,
        $12, $13, $14, 0, 0, $15::jsonb, now(), now()
      ) returning id::text as id
    `,
    [
      input.idCandidato, input.atorUsuarioId, input.atorEmail, config.phoneNumberId || null,
      config.businessAccountId || null, updatedIdentity.numero_campanha, templateName, languageCode,
      JSON.stringify(variables), input.publico, input.eventoId || null, provider, initialStatus,
      limitedRecipients.length,
      JSON.stringify({
        total_original_destinatarios: recipients.length,
        limite_aplicado: maxRecipients,
        eleitor_individual: input.publico === "eleitor_individual" ? input.eleitorUid : null,
        regra_meta: "mensagem_iniciada_pela_empresa_deve_usar_template_aprovado",
        padrao_mensagem: normalizeText(input.padraoMensagem),
        fonte_destinatarios: "base_eleitores_candidato"
      })
    ]
  );

  const dispatchId = dispatchResult.rows[0].id;
  await db.query(
    `
      insert into remessas_whatsapp_destinatarios (remessa_id, eleitor_uid, nome, telefone, status, criado_em, atualizado_em)
      select $1::uuid, x.eleitor_uid, x.nome, x.telefone, $2, now(), now()
      from jsonb_to_recordset($3::jsonb) as x(eleitor_uid text, nome text, telefone text)
    `,
    [dispatchId, provider === "meta_cloud_api" ? "pendente" : "planejado", JSON.stringify(limitedRecipients)]
  );

  if (provider !== "meta_cloud_api") {
    return { dispatchId, status: initialStatus, totalDestinatarios: limitedRecipients.length, totalEnviados: 0, totalFalhas: 0, provider, firstFailureMessage: null };
  }

  let totalEnviados = 0;
  let totalFalhas = 0;
  let firstFailureMessage: string | null = null;

  for (const recipient of limitedRecipients) {
    try {
      await sendMetaTemplateMessage({
        accessToken: config.accessToken,
        phoneNumberId: config.phoneNumberId,
        to: recipient.telefone,
        templateName,
        languageCode,
        variables
      });
      totalEnviados += 1;
      await updateRecipientStatus(dispatchId, recipient.eleitor_uid, "enviado", null);
    } catch (error) {
      totalFalhas += 1;
      const failureMessage = error instanceof Error ? error.message : "Falha desconhecida no envio.";
      firstFailureMessage ??= summarizeProviderFailure(failureMessage);
      await updateRecipientStatus(dispatchId, recipient.eleitor_uid, "erro", failureMessage);
    }
  }

  const finalStatus = totalFalhas === 0 ? "enviada" : totalEnviados > 0 ? "enviada_com_falhas" : "erro";
  await db.query(
    `update remessas_whatsapp_campanha set status = $2, total_enviados = $3, total_falhas = $4, atualizado_em = now() where id = $1::uuid`,
    [dispatchId, finalStatus, totalEnviados, totalFalhas]
  );

  return { dispatchId, status: finalStatus, totalDestinatarios: limitedRecipients.length, totalEnviados, totalFalhas, provider, firstFailureMessage };
}

async function getCandidateWhatsAppIdentity(idCandidato: string): Promise<CandidateWhatsAppIdentity | null> {
  const result = await db.query<CandidateWhatsAppIdentity>(
    `
      select
        c.id_candidato,
        coalesce(c.nome_urna, c.nome_completo, c.id_candidato) as nome_urna,
        coalesce(cfg.numero_campanha, c.telefone_candidato, official.identificador_externo) as numero_campanha,
        cfg.phone_number_id,
        cfg.business_account_id,
        cfg.access_token,
        cfg.template_padrao,
        cfg.language_code
      from candidatos c
      left join campanha_whatsapp_config cfg on cfg.id_candidato = c.id_candidato
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

async function saveCampaignWhatsAppConfig(input: {
  idCandidato: string;
  phoneNumberId?: string | null;
  businessAccountId?: string | null;
  accessToken?: string | null;
  numeroCampanha?: string | null;
  templatePadrao?: string | null;
  languageCode?: string | null;
}) {
  await db.query(
    `
      insert into campanha_whatsapp_config (
        id_candidato, phone_number_id, business_account_id, access_token, numero_campanha,
        template_padrao, language_code, atualizado_em
      )
      values ($1, $2, $3, $4, $5, $6, $7, now())
      on conflict (id_candidato)
      do update set
        phone_number_id = coalesce(nullif(excluded.phone_number_id, ''), campanha_whatsapp_config.phone_number_id),
        business_account_id = coalesce(nullif(excluded.business_account_id, ''), campanha_whatsapp_config.business_account_id),
        access_token = coalesce(nullif(excluded.access_token, ''), campanha_whatsapp_config.access_token),
        numero_campanha = coalesce(nullif(excluded.numero_campanha, ''), campanha_whatsapp_config.numero_campanha),
        template_padrao = coalesce(nullif(excluded.template_padrao, ''), campanha_whatsapp_config.template_padrao),
        language_code = coalesce(nullif(excluded.language_code, ''), campanha_whatsapp_config.language_code),
        atualizado_em = now()
    `,
    [
      input.idCandidato,
      normalizeText(input.phoneNumberId),
      normalizeText(input.businessAccountId),
      normalizeText(input.accessToken),
      normalizePhone(input.numeroCampanha),
      normalizeTemplateName(input.templatePadrao),
      normalizeText(input.languageCode) || "pt_BR"
    ]
  );
}

async function listRecipients(input: {
  idCandidato: string;
  publico: CampaignWhatsAppAudience;
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
    if (!input.eventoId) throw new Error("Selecione um evento para remeter WhatsApp por público de evento.");
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
      update remessas_whatsapp_destinatarios
      set status = $3,
          erro = $4,
          enviado_em = case when $3 = 'enviado' then now() else enviado_em end,
          atualizado_em = now()
      where remessa_id = $1::uuid and eleitor_uid = $2
    `,
    [dispatchId, eleitorUid, status, errorMessage]
  );
}

async function ensureCampaignWhatsAppTables() {
  await db.query(`
    create table if not exists campanha_whatsapp_config (
      id_candidato varchar(120) primary key references candidatos(id_candidato) on delete cascade,
      phone_number_id text,
      business_account_id text,
      access_token text,
      numero_campanha text,
      template_padrao text,
      language_code text default 'pt_BR',
      criado_em timestamptz default now(),
      atualizado_em timestamptz default now()
    )
  `);

  await db.query(`
    create table if not exists remessas_whatsapp_campanha (
      id uuid primary key default gen_random_uuid(),
      id_candidato varchar(120) not null references candidatos(id_candidato) on delete cascade,
      ator_usuario_id uuid references paines_admin_usuario(id),
      ator_email text,
      phone_number_id text,
      business_account_id text,
      numero_campanha text,
      template_name text not null,
      language_code text not null default 'pt_BR',
      variaveis jsonb default '[]'::jsonb,
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
    create table if not exists remessas_whatsapp_destinatarios (
      id uuid primary key default gen_random_uuid(),
      remessa_id uuid not null references remessas_whatsapp_campanha(id) on delete cascade,
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

async function sendMetaTemplateMessage(input: {
  accessToken: string;
  phoneNumberId: string;
  to: string;
  templateName: string;
  languageCode: string;
  variables: string[];
}) {
  const url = `${env.metaWhatsAppBaseUrl.replace(/\/$/, "")}/${env.metaWhatsAppGraphApiVersion}/${input.phoneNumberId}/messages`;
  const components = input.variables.length > 0
    ? [{ type: "body", parameters: input.variables.map((value) => ({ type: "text", text: value })) }]
    : undefined;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.to,
      type: "template",
      template: {
        name: input.templateName,
        language: { code: input.languageCode },
        components
      }
    }),
    cache: "no-store"
  });

  const bodyText = await response.text();
  let body: unknown = bodyText;
  try { body = JSON.parse(bodyText); } catch { body = bodyText; }

  if (!response.ok) {
    throw new Error(`Meta recusou o envio (${response.status}): ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }

  return body;
}

function resolveMetaConfig(identity: CandidateWhatsAppIdentity) {
  return {
    enabled: env.metaWhatsAppEnabled || Boolean(identity.phone_number_id || env.metaWhatsAppPhoneNumberId),
    accessToken: identity.access_token || env.metaWhatsAppAccessToken,
    phoneNumberId: identity.phone_number_id || env.metaWhatsAppPhoneNumberId,
    businessAccountId: identity.business_account_id || env.metaWhatsAppBusinessAccountId
  };
}

function summarizeProviderFailure(message: string) {
  const normalized = message.replace(/\s+/g, " ").trim();
  if (!normalized) return "Falha desconhecida no envio.";
  const jsonStart = normalized.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(normalized.slice(jsonStart));
      const error = parsed.error;
      const detail = [error?.message, error?.code ? `código ${error.code}` : null, error?.error_subcode ? `subcódigo ${error.error_subcode}` : null]
        .filter(Boolean)
        .join(" | ");
      if (detail) return detail.slice(0, 260);
    } catch {
      // Mantém a mensagem textual quando o corpo não vier em JSON válido.
    }
  }
  return normalized.slice(0, 260);
}

function buildTemplatePresets(templatePadrao: string | null) {
  const customTemplate = normalizeTemplateName(templatePadrao);
  if (!customTemplate || WHATSAPP_TEMPLATE_PRESETS.some((preset) => preset.template_sugerido === customTemplate)) {
    return WHATSAPP_TEMPLATE_PRESETS;
  }

  return [
    {
      id: "template_salvo_candidato",
      nome: "Template salvo do candidato",
      descricao: "Modelo ja registrado para esta campanha.",
      template_sugerido: customTemplate,
      variaveis: ["conforme configurado na Meta"]
    },
    ...WHATSAPP_TEMPLATE_PRESETS
  ];
}

function normalizeText(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function normalizeTemplateName(value: string | null | undefined) {
  const normalized = normalizeText(value)?.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return normalized || null;
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






