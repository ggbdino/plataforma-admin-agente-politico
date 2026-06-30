import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { ensureElectorEnrichmentColumns } from "@/lib/repositories/elector-schema";

export type CampaignEmailAudience =
  | "todos_com_email"
  | "evento_todos"
  | "evento_confirmados"
  | "evento_presentes";

export type CampaignEmailContext = {
  id_candidato: string;
  nome_urna: string;
  email_remetente: string | null;
  nome_remetente: string;
  qr_code_url: string | null;
  total_eleitores_com_email: number;
  eventos: { id: string; nome_evento: string; data_evento: string }[];
  ultimas_remessas: CampaignEmailDispatchSummary[];
  provedor_configurado: boolean;
};

export type CampaignEmailDispatchSummary = {
  id: string;
  assunto: string;
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
  email: string;
};

type CandidateEmailIdentity = {
  id_candidato: string;
  nome_urna: string;
  email_remetente: string | null;
  nome_remetente: string;
  qr_code_url: string | null;
};

export async function getCampaignEmailContext(idCandidato: string): Promise<CampaignEmailContext | null> {
  await ensureCampaignEmailTables();
  await ensureElectorEnrichmentColumns();

  const identity = await getCandidateEmailIdentity(idCandidato);
  if (!identity) {
    return null;
  }

  const [totalResult, eventsResult, dispatchesResult] = await Promise.all([
    db.query<{ total: number }>(
      `
        select count(*)::int as total
        from eleitores
        where id_candidato = $1
          and nullif(trim(coalesce(email, '')), '') is not null
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
    db.query<CampaignEmailDispatchSummary>(
      `
        select
          id::text as id,
          assunto,
          publico,
          status,
          total_destinatarios,
          total_enviados,
          total_falhas,
          criado_em::text as criado_em
        from remessas_email_campanha
        where id_candidato = $1
        order by criado_em desc
        limit 10
      `,
      [idCandidato]
    )
  ]);

  return {
    ...identity,
    total_eleitores_com_email: totalResult.rows[0]?.total ?? 0,
    eventos: eventsResult.rows,
    ultimas_remessas: dispatchesResult.rows,
    provedor_configurado: Boolean(env.resendApiKey)
  };
}

export async function planAndSendCampaignEmail(input: {
  idCandidato: string;
  atorUsuarioId: string;
  atorEmail: string;
  publico: CampaignEmailAudience;
  eventoId?: string | null;
  emailRemetente?: string | null;
  assunto: string;
  mensagem: string;
  imagemUrl?: string | null;
  incluirQrCode: boolean;
}) {
  await ensureCampaignEmailTables();
  await ensureElectorEnrichmentColumns();

  const identity = await getCandidateEmailIdentity(input.idCandidato);
  if (!identity) {
    throw new Error("Candidato não encontrado para a remessa de e-mail.");
  }

  const assunto = normalizeText(input.assunto);
  const mensagem = normalizeText(input.mensagem);
  const emailRemetente = normalizeEmail(input.emailRemetente || identity.email_remetente);
  const imagemUrl = normalizeOptionalUrl(input.imagemUrl);

  if (!assunto || !mensagem) {
    throw new Error("Informe assunto e mensagem antes de preparar a remessa.");
  }

  if (!emailRemetente) {
    throw new Error("Informe o e-mail remetente do candidato antes de enviar mensagens.");
  }

  if (emailRemetente !== identity.email_remetente) {
    await saveCandidateSenderEmail({
      idCandidato: input.idCandidato,
      emailRemetente,
      nomeRemetente: identity.nome_remetente
    });
  }

  const recipients = await listRecipients({
    idCandidato: input.idCandidato,
    publico: input.publico,
    eventoId: input.eventoId
  });

  if (recipients.length === 0) {
    throw new Error("Nenhum eleitor com e-mail válido foi localizado para o público selecionado.");
  }

  const maxRecipients = normalizeMaxRecipients(env.emailMaxRecipientsPerDispatch);
  const limitedRecipients = recipients.slice(0, maxRecipients);
  const provider = env.resendApiKey ? "resend" : "sem_provedor";
  const initialStatus = provider === "resend" ? "em_processamento" : "planejada_sem_provedor";

  const dispatchResult = await db.query<{ id: string }>(
    `
      insert into remessas_email_campanha (
        id_candidato, ator_usuario_id, ator_email, email_remetente, nome_remetente,
        assunto, mensagem, imagem_url, incluir_qrcode, qr_code_url, publico, evento_id,
        provider, status, total_destinatarios, total_enviados, total_falhas, metadata,
        criado_em, atualizado_em
      )
      values (
        $1, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::uuid,
        $13, $14, $15, 0, 0, $16::jsonb, now(), now()
      )
      returning id::text as id
    `,
    [
      input.idCandidato,
      input.atorUsuarioId,
      input.atorEmail,
      emailRemetente,
      identity.nome_remetente,
      assunto,
      mensagem,
      imagemUrl,
      input.incluirQrCode,
      input.incluirQrCode ? identity.qr_code_url : null,
      input.publico,
      input.eventoId || null,
      provider,
      initialStatus,
      limitedRecipients.length,
      JSON.stringify({ total_original_destinatarios: recipients.length, limite_aplicado: maxRecipients })
    ]
  );

  const dispatchId = dispatchResult.rows[0].id;

  await db.query(
    `
      insert into remessas_email_destinatarios (
        remessa_id, eleitor_uid, nome, email, status, criado_em, atualizado_em
      )
      select $1::uuid, x.eleitor_uid, x.nome, x.email, $2, now(), now()
      from jsonb_to_recordset($3::jsonb) as x(eleitor_uid text, nome text, email text)
    `,
    [dispatchId, provider === "resend" ? "pendente" : "planejado", JSON.stringify(limitedRecipients)]
  );

  if (provider !== "resend") {
    return {
      dispatchId,
      status: initialStatus,
      totalDestinatarios: limitedRecipients.length,
      totalEnviados: 0,
      totalFalhas: 0,
      provider
    };
  }

  let totalEnviados = 0;
  let totalFalhas = 0;

  for (const recipient of limitedRecipients) {
    try {
      await sendWithResend({
        apiKey: env.resendApiKey,
        fromEmail: emailRemetente,
        fromName: identity.nome_remetente,
        recipient,
        subject: assunto,
        html: buildEmailHtml({
          nomeEleitor: recipient.nome,
          nomeCandidato: identity.nome_remetente,
          mensagem,
          imagemUrl,
          qrCodeUrl: input.incluirQrCode ? identity.qr_code_url : null
        }),
        text: buildEmailText({
          nomeEleitor: recipient.nome,
          nomeCandidato: identity.nome_remetente,
          mensagem,
          qrCodeUrl: input.incluirQrCode ? identity.qr_code_url : null
        })
      });
      totalEnviados += 1;
      await updateRecipientStatus(dispatchId, recipient.eleitor_uid, "enviado", null);
    } catch (error) {
      totalFalhas += 1;
      await updateRecipientStatus(
        dispatchId,
        recipient.eleitor_uid,
        "erro",
        error instanceof Error ? error.message : "Falha desconhecida no envio."
      );
    }
  }

  const finalStatus = totalFalhas === 0 ? "enviada" : totalEnviados > 0 ? "enviada_com_falhas" : "erro";
  await db.query(
    `
      update remessas_email_campanha
      set status = $2, total_enviados = $3, total_falhas = $4, atualizado_em = now()
      where id = $1::uuid
    `,
    [dispatchId, finalStatus, totalEnviados, totalFalhas]
  );

  return {
    dispatchId,
    status: finalStatus,
    totalDestinatarios: limitedRecipients.length,
    totalEnviados,
    totalFalhas,
    provider
  };
}

export async function saveCandidateSenderEmail(input: {
  idCandidato: string;
  emailRemetente: string;
  nomeRemetente?: string | null;
}) {
  await ensureCampaignEmailTables();
  const email = normalizeEmail(input.emailRemetente);
  if (!email) {
    throw new Error("Informe um e-mail remetente válido para o candidato.");
  }

  await db.query(
    `
      insert into campanha_email_config (id_candidato, email_remetente, nome_remetente, atualizado_em)
      values ($1, $2, $3, now())
      on conflict (id_candidato)
      do update set
        email_remetente = excluded.email_remetente,
        nome_remetente = coalesce(excluded.nome_remetente, campanha_email_config.nome_remetente),
        atualizado_em = now()
    `,
    [input.idCandidato, email, normalizeText(input.nomeRemetente)]
  );
}

async function getCandidateEmailIdentity(idCandidato: string): Promise<CandidateEmailIdentity | null> {
  const result = await db.query<CandidateEmailIdentity>(
    `
      select
        c.id_candidato,
        c.nome_urna,
        cfg.email_remetente,
        coalesce(nullif(cfg.nome_remetente, ''), c.nome_urna, c.nome_completo, c.id_candidato) as nome_remetente,
        coalesce(
          official.metadata ->> 'qr_code_url',
          case
            when official.url_canal is not null and btrim(official.url_canal) <> ''
              then 'https://api.qrserver.com/v1/create-qr-code/?size=800x800&data=' || replace(official.url_canal, '&', '%26')
            else ic.qr_code_url
          end
        ) as qr_code_url
      from candidatos c
      left join campanha_email_config cfg on cfg.id_candidato = c.id_candidato
      left join implantacoes_candidato ic on ic.id_candidato = c.id_candidato
      left join lateral (
        select url_canal, metadata
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

async function listRecipients(input: {
  idCandidato: string;
  publico: CampaignEmailAudience;
  eventoId?: string | null;
}) {
  const values: unknown[] = [input.idCandidato];
  let joinClause = "";
  let whereClause = "";

  if (input.publico !== "todos_com_email") {
    if (!input.eventoId) {
      throw new Error("Selecione um evento para remeter e-mail por público de evento.");
    }
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

  const result = await db.query<Recipient>(
    `
      select distinct on (lower(trim(e.email)))
        e.eleitor_uid,
        e.nome,
        lower(trim(e.email)) as email
      from eleitores e
      ${joinClause}
      where e.id_candidato = $1
        and nullif(trim(coalesce(e.email, '')), '') is not null
        and e.email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$'
        and coalesce(e.opt_out, false) = false
        ${whereClause}
      order by lower(trim(e.email)), coalesce(e.ultimo_contato_em, e.atualizado_em, e.criado_em) desc
    `,
    values
  );

  return result.rows;
}

async function updateRecipientStatus(dispatchId: string, eleitorUid: string, status: string, errorMessage: string | null) {
  await db.query(
    `
      update remessas_email_destinatarios
      set status = $3,
          erro = $4,
          enviado_em = case when $3 = 'enviado' then now() else enviado_em end,
          atualizado_em = now()
      where remessa_id = $1::uuid and eleitor_uid = $2
    `,
    [dispatchId, eleitorUid, status, errorMessage]
  );
}

async function ensureCampaignEmailTables() {
  await db.query(`
    create table if not exists campanha_email_config (
      id_candidato varchar(120) primary key references candidatos(id_candidato) on delete cascade,
      email_remetente text,
      nome_remetente text,
      criado_em timestamptz default now(),
      atualizado_em timestamptz default now()
    )
  `);

  await db.query(`
    create table if not exists remessas_email_campanha (
      id uuid primary key default gen_random_uuid(),
      id_candidato varchar(120) not null references candidatos(id_candidato) on delete cascade,
      ator_usuario_id uuid references paines_admin_usuario(id),
      ator_email text,
      email_remetente text not null,
      nome_remetente text,
      assunto text not null,
      mensagem text not null,
      imagem_url text,
      incluir_qrcode boolean default false,
      qr_code_url text,
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
    create table if not exists remessas_email_destinatarios (
      id uuid primary key default gen_random_uuid(),
      remessa_id uuid not null references remessas_email_campanha(id) on delete cascade,
      eleitor_uid text not null,
      nome text,
      email text not null,
      status text not null default 'pendente',
      erro text,
      enviado_em timestamptz,
      criado_em timestamptz default now(),
      atualizado_em timestamptz default now(),
      unique(remessa_id, eleitor_uid)
    )
  `);
}

async function sendWithResend(input: {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  recipient: Recipient;
  subject: string;
  html: string;
  text: string;
}) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: `${escapeEmailName(input.fromName)} <${input.fromEmail}>`,
      to: [input.recipient.email],
      subject: input.subject,
      html: input.html,
      text: input.text
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend recusou o envio (${response.status}): ${body.slice(0, 300)}`);
  }
}

function buildEmailHtml(input: {
  nomeEleitor: string | null;
  nomeCandidato: string;
  mensagem: string;
  imagemUrl: string | null;
  qrCodeUrl: string | null;
}) {
  const greeting = input.nomeEleitor ? `<p>Olá, ${escapeHtml(input.nomeEleitor)}.</p>` : "<p>Olá.</p>";
  const message = escapeHtml(input.mensagem).replace(/\n/g, "<br />");
  const image = input.imagemUrl
    ? `<p><img src="${escapeHtml(input.imagemUrl)}" alt="Imagem da campanha" style="max-width:100%;height:auto;border-radius:8px" /></p>`
    : "";
  const qr = input.qrCodeUrl
    ? `<p><strong>QR Code oficial da campanha</strong><br /><img src="${escapeHtml(input.qrCodeUrl)}" alt="QR Code oficial da campanha" width="220" height="220" /></p>`
    : "";

  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#123;line-height:1.5">${greeting}<p>${message}</p>${image}${qr}<p>Atenciosamente,<br />${escapeHtml(input.nomeCandidato)}</p></body></html>`;
}

function buildEmailText(input: {
  nomeEleitor: string | null;
  nomeCandidato: string;
  mensagem: string;
  qrCodeUrl: string | null;
}) {
  return [
    input.nomeEleitor ? `Olá, ${input.nomeEleitor}.` : "Olá.",
    "",
    input.mensagem,
    input.qrCodeUrl ? `\nQR Code oficial da campanha: ${input.qrCodeUrl}` : "",
    "",
    `Atenciosamente, ${input.nomeCandidato}`
  ].join("\n");
}

function normalizeText(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function normalizeEmail(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

function normalizeOptionalUrl(value: string | null | undefined) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }
  try {
    const parsed = new URL(normalized);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function normalizeMaxRecipients(value: string | number | undefined) {
  const parsed = Number(value ?? 100);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 100;
  }
  return Math.min(Math.trunc(parsed), 500);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeEmailName(value: string) {
  return value.replace(/["<>]/g, "").trim() || "Campanha";
}
