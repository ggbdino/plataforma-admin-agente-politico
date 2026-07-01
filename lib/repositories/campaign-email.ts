import net from "node:net";
import tls from "node:tls";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { ensureElectorEnrichmentColumns } from "@/lib/repositories/elector-schema";

export type CampaignEmailAudience =
  | "todos_com_email"
  | "eleitor_individual"
  | "evento_todos"
  | "evento_confirmados"
  | "evento_presentes";

export type CampaignEmailAttachment = {
  filename: string;
  content: string;
  contentType: string;
};

export type CampaignEmailContext = {
  id_candidato: string;
  nome_urna: string;
  email_remetente: string | null;
  nome_remetente: string;
  qr_code_url: string | null;
  total_eleitores_com_email: number;
  eventos: { id: string; nome_evento: string; data_evento: string }[];
  eleitores: { eleitor_uid: string; nome: string | null; email: string; telefone: string | null }[];
  ultimas_remessas: CampaignEmailDispatchSummary[];
  provedor_configurado: boolean;
  provedor_envio: string;
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

  const [totalResult, eventsResult, electorsResult, dispatchesResult] = await Promise.all([
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
    db.query<{ eleitor_uid: string; nome: string | null; email: string; telefone: string | null }>(
      `
        select eleitor_uid, nome, lower(trim(email)) as email, telefone
        from eleitores
        where id_candidato = $1
          and nullif(trim(coalesce(email, '')), '') is not null
          and email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
          and coalesce(opt_out, false) = false
        order by coalesce(nullif(trim(nome), ''), email)
        limit 250
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
    eleitores: electorsResult.rows,
    ultimas_remessas: dispatchesResult.rows,
    provedor_configurado: resolveEmailProvider() !== "sem_provedor",
    provedor_envio: resolveEmailProvider()
  };
}

export async function planAndSendCampaignEmail(input: {
  idCandidato: string;
  atorUsuarioId: string;
  atorEmail: string;
  publico: CampaignEmailAudience;
  eventoId?: string | null;
  eleitorUid?: string | null;
  emailRemetente?: string | null;
  assunto: string;
  mensagem: string;
  imagemUrl?: string | null;
  imagemArquivo?: CampaignEmailAttachment | null;
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
    eventoId: input.eventoId,
    eleitorUid: input.eleitorUid
  });

  if (recipients.length === 0) {
    throw new Error("Nenhum eleitor com e-mail válido foi localizado para o público selecionado.");
  }

  const maxRecipients = normalizeMaxRecipients(env.emailMaxRecipientsPerDispatch);
  const limitedRecipients = recipients.slice(0, maxRecipients);
  const provider = resolveEmailProvider();
  const initialStatus = provider !== "sem_provedor" ? "em_processamento" : "planejada_sem_provedor";

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
      JSON.stringify({
        total_original_destinatarios: recipients.length,
        limite_aplicado: maxRecipients,
        eleitor_individual: input.publico === "eleitor_individual" ? input.eleitorUid : null,
        imagem_arquivo: input.imagemArquivo
          ? { filename: input.imagemArquivo.filename, contentType: input.imagemArquivo.contentType }
          : null
      })
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
    [dispatchId, provider !== "sem_provedor" ? "pendente" : "planejado", JSON.stringify(limitedRecipients)]
  );

  if (provider === "sem_provedor") {
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
  let firstFailureMessage: string | null = null;

  for (const recipient of limitedRecipients) {
    try {
      await sendWithConfiguredProvider({
        provider,
        fromEmail: emailRemetente,
        fromName: identity.nome_remetente,
        recipient,
        subject: assunto,
        html: buildEmailHtml({
          nomeEleitor: recipient.nome,
          nomeCandidato: identity.nome_remetente,
          mensagem,
          imagemUrl,
          qrCodeUrl: input.incluirQrCode ? identity.qr_code_url : null,
          imagemAnexadaNome: input.imagemArquivo?.filename ?? null
        }),
        text: buildEmailText({
          nomeEleitor: recipient.nome,
          nomeCandidato: identity.nome_remetente,
          mensagem,
          qrCodeUrl: input.incluirQrCode ? identity.qr_code_url : null,
          imagemAnexadaNome: input.imagemArquivo?.filename ?? null
        }),
        attachment: input.imagemArquivo ?? null
      });
      totalEnviados += 1;
      await updateRecipientStatus(dispatchId, recipient.eleitor_uid, "enviado", null);
    } catch (error) {
      totalFalhas += 1;
      const failureMessage = error instanceof Error ? error.message : "Falha desconhecida no envio.";
      firstFailureMessage ??= summarizeProviderFailure(failureMessage);
      await updateRecipientStatus(
        dispatchId,
        recipient.eleitor_uid,
        "erro",
        failureMessage
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
    provider,
    firstFailureMessage
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
  eleitorUid?: string | null;
}) {
  const values: unknown[] = [input.idCandidato];
  let joinClause = "";
  let whereClause = "";

  if (input.publico === "eleitor_individual") {
    if (!input.eleitorUid) {
      throw new Error("Selecione um eleitor para a remessa individual.");
    }
    values.push(input.eleitorUid);
    whereClause = "and e.eleitor_uid = $2";
  } else if (input.publico !== "todos_com_email") {
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
        and e.email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
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

async function sendWithConfiguredProvider(input: {
  provider: string;
  fromEmail: string;
  fromName: string;
  recipient: Recipient;
  subject: string;
  html: string;
  text: string;
  attachment: CampaignEmailAttachment | null;
}) {
  if (input.provider === "smtp") {
    await sendWithSmtp(input);
    return;
  }

  await sendWithResend({
    apiKey: env.resendApiKey,
    fromEmail: input.fromEmail,
    fromName: input.fromName,
    recipient: input.recipient,
    subject: input.subject,
    html: input.html,
    text: input.text,
    attachment: input.attachment
  });
}

async function sendWithResend(input: {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  recipient: Recipient;
  subject: string;
  html: string;
  text: string;
  attachment: CampaignEmailAttachment | null;
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
      text: input.text,
      attachments: input.attachment
        ? [{ filename: input.attachment.filename, content: input.attachment.content }]
        : undefined
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend recusou o envio (${response.status}): ${body.slice(0, 300)}`);
  }
}

async function sendWithSmtp(input: {
  fromEmail: string;
  fromName: string;
  recipient: Recipient;
  subject: string;
  html: string;
  text: string;
  attachment: CampaignEmailAttachment | null;
}) {
  if (!env.smtpHost || !env.smtpUser || !env.smtpPass) {
    throw new Error("SMTP não configurado. Informe SMTP_HOST, SMTP_USER e SMTP_PASS.");
  }

  const client = await SmtpClient.connect({
    host: env.smtpHost,
    port: normalizeSmtpPort(env.smtpPort, env.smtpSecure),
    secure: env.smtpSecure,
    heloDomain: env.emailHeloDomain || "agente-politico.local"
  });

  try {
    await client.authenticate(env.smtpUser, env.smtpPass);
    await client.sendMail({
      fromEmail: input.fromEmail,
      fromName: input.fromName,
      toEmail: input.recipient.email,
      subject: input.subject,
      html: input.html,
      text: input.text,
      attachment: input.attachment
    });
    await client.quit();
  } catch (error) {
    client.close();
    throw error;
  }
}

function buildEmailHtml(input: {
  nomeEleitor: string | null;
  nomeCandidato: string;
  mensagem: string;
  imagemUrl: string | null;
  qrCodeUrl: string | null;
  imagemAnexadaNome: string | null;
}) {
  const greeting = input.nomeEleitor ? `<p>Olá, ${escapeHtml(input.nomeEleitor)}.</p>` : "<p>Olá.</p>";
  const message = escapeHtml(input.mensagem).replace(/\n/g, "<br />");
  const image = input.imagemUrl
    ? `<p><img src="${escapeHtml(input.imagemUrl)}" alt="Imagem da campanha" style="max-width:100%;height:auto;border-radius:8px" /></p>`
    : "";
  const attachment = input.imagemAnexadaNome
    ? `<p><strong>Imagem da campanha anexada:</strong> ${escapeHtml(input.imagemAnexadaNome)}</p>`
    : "";
  const qr = input.qrCodeUrl
    ? `<p><strong>QR Code oficial da campanha</strong><br /><img src="${escapeHtml(input.qrCodeUrl)}" alt="QR Code oficial da campanha" width="220" height="220" /></p>`
    : "";

  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#123;line-height:1.5">${greeting}<p>${message}</p>${image}${attachment}${qr}<p>Atenciosamente,<br />${escapeHtml(input.nomeCandidato)}</p></body></html>`;
}

function buildEmailText(input: {
  nomeEleitor: string | null;
  nomeCandidato: string;
  mensagem: string;
  qrCodeUrl: string | null;
  imagemAnexadaNome: string | null;
}) {
  return [
    input.nomeEleitor ? `Olá, ${input.nomeEleitor}.` : "Olá.",
    "",
    input.mensagem,
    input.imagemAnexadaNome ? `\nImagem da campanha anexada: ${input.imagemAnexadaNome}` : "",
    input.qrCodeUrl ? `\nQR Code oficial da campanha: ${input.qrCodeUrl}` : "",
    "",
    `Atenciosamente, ${input.nomeCandidato}`
  ].join("\n");
}

function summarizeProviderFailure(message: string) {
  const normalized = message.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "Falha desconhecida no envio.";
  }

  const jsonStart = normalized.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(normalized.slice(jsonStart));
      const detail = [parsed.message, parsed.name, parsed.error].filter(Boolean).join(" ");
      if (detail) {
        return detail.slice(0, 240);
      }
    } catch {
      // Mantém a mensagem textual do provedor quando o corpo não vier em JSON válido.
    }
  }

  return normalized.slice(0, 240);
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

function resolveEmailProvider() {
  const provider = env.emailProvider;
  const hasSmtp = Boolean(env.smtpHost && env.smtpUser && env.smtpPass);
  const hasResend = Boolean(env.resendApiKey);

  if (provider === "smtp") {
    return hasSmtp ? "smtp" : "sem_provedor";
  }

  if (provider === "resend") {
    return hasResend ? "resend" : "sem_provedor";
  }

  if (hasSmtp) {
    return "smtp";
  }

  if (hasResend) {
    return "resend";
  }

  return "sem_provedor";
}

function normalizeSmtpPort(value: string | undefined, secure: boolean) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.trunc(parsed);
  }
  return secure ? 465 : 587;
}

type SmtpEnvelope = {
  fromEmail: string;
  fromName: string;
  toEmail: string;
  subject: string;
  html: string;
  text: string;
  attachment: CampaignEmailAttachment | null;
};

class SmtpClient {
  private socket: net.Socket | tls.TLSSocket;
  private buffer = "";
  private readonly host: string;
  private readonly heloDomain: string;

  private constructor(socket: net.Socket | tls.TLSSocket, host: string, heloDomain: string) {
    this.socket = socket;
    this.host = host;
    this.heloDomain = heloDomain;
  }

  static async connect(input: { host: string; port: number; secure: boolean; heloDomain: string }) {
    const socket = input.secure
      ? tls.connect({ host: input.host, port: input.port, servername: input.host })
      : net.connect({ host: input.host, port: input.port });

    await waitForSocket(socket, input.secure ? "secureConnect" : "connect");
    const client = new SmtpClient(socket, input.host, input.heloDomain);
    await client.expect([220]);
    const ehlo = await client.command(`EHLO ${input.heloDomain}`, [250]);

    if (!input.secure && ehlo.some((line) => /STARTTLS/i.test(line))) {
      await client.command("STARTTLS", [220]);
      client.socket = tls.connect({ socket: client.socket, servername: input.host });
      client.buffer = "";
      await waitForSocket(client.socket, "secureConnect");
      await client.command(`EHLO ${input.heloDomain}`, [250]);
    }

    return client;
  }

  async authenticate(user: string, pass: string) {
    const token = Buffer.concat([Buffer.from([0]), Buffer.from(user), Buffer.from([0]), Buffer.from(pass)]).toString("base64");
    await this.command(`AUTH PLAIN ${token}`, [235]);
  }

  async sendMail(input: SmtpEnvelope) {
    await this.command(`MAIL FROM:<${input.fromEmail}>`, [250]);
    await this.command(`RCPT TO:<${input.toEmail}>`, [250, 251]);
    await this.command("DATA", [354]);
    this.socket.write(`${dotStuff(buildMimeMessage(input))}\r\n.\r\n`);
    await this.expect([250]);
  }

  async quit() {
    await this.command("QUIT", [221]);
    this.close();
  }

  close() {
    this.socket.destroy();
  }

  private async command(command: string, expected: number[]) {
    this.socket.write(`${command}\r\n`);
    return this.expect(expected);
  }

  private async expect(expected: number[]) {
    const lines = await this.readResponse();
    const last = lines[lines.length - 1] ?? "";
    const code = Number(last.slice(0, 3));
    if (!expected.includes(code)) {
      throw new Error(`SMTP recusou comando (${code || "sem código"}): ${lines.join(" ").slice(0, 300)}`);
    }
    return lines;
  }

  private async readResponse() {
    const lines: string[] = [];
    while (true) {
      const line = await this.readLine();
      lines.push(line);
      if (/^\d{3} /.test(line)) {
        return lines;
      }
    }
  }

  private async readLine(): Promise<string> {
    const existing = this.takeLine();
    if (existing) {
      return existing;
    }

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        this.socket.off("data", onData);
        this.socket.off("error", onError);
      };
      const fail = (error: Error) => {
        cleanup();
        reject(error);
      };
      const done = (line: string) => {
        cleanup();
        resolve(line);
      };
      const timer = setTimeout(() => fail(new Error("Tempo esgotado aguardando resposta SMTP.")), 30000);
      const onData = (chunk: Buffer) => {
        this.buffer += chunk.toString("utf8");
        const line = this.takeLine();
        if (line) {
          done(line);
        }
      };
      const onError = (error: Error) => fail(error);
      this.socket.on("data", onData);
      this.socket.on("error", onError);
    });
  }

  private takeLine() {
    const index = this.buffer.indexOf("\n");
    if (index < 0) {
      return null;
    }
    const line = this.buffer.slice(0, index + 1).replace(/\r?\n$/, "");
    this.buffer = this.buffer.slice(index + 1);
    return line;
  }
}

function waitForSocket(socket: net.Socket | tls.TLSSocket, event: "connect" | "secureConnect") {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      socket.off(event, onReady);
      socket.off("error", onError);
    };
    const fail = (error: Error) => {
      cleanup();
      reject(error);
    };
    const done = () => {
      cleanup();
      resolve();
    };
    const timer = setTimeout(() => fail(new Error("Tempo esgotado conectando ao SMTP.")), 30000);
    const onReady = () => done();
    const onError = (error: Error) => fail(error);
    socket.once(event, onReady);
    socket.once("error", onError);
  });
}

function buildMimeMessage(input: SmtpEnvelope) {
  const mixedBoundary = `mixed_${cryptoRandom()}`;
  const altBoundary = `alt_${cryptoRandom()}`;
  const headers = [
    `From: ${formatAddress(input.fromName, input.fromEmail)}`,
    `To: <${input.toEmail}>`,
    `Subject: ${encodeMimeHeader(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`
  ];

  const parts = [
    ...headers,
    "",
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    "",
    `--${altBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    input.text,
    "",
    `--${altBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    input.html,
    "",
    `--${altBoundary}--`
  ];

  if (input.attachment) {
    parts.push(
      "",
      `--${mixedBoundary}`,
      `Content-Type: ${sanitizeMimeType(input.attachment.contentType)}; name="${sanitizeFilename(input.attachment.filename)}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${sanitizeFilename(input.attachment.filename)}"`,
      "",
      foldBase64(input.attachment.content)
    );
  }

  parts.push("", `--${mixedBoundary}--`, "");
  return parts.join("\r\n");
}

function dotStuff(message: string) {
  return message.replace(/^\./gm, "..");
}

function formatAddress(name: string, email: string) {
  return `${encodeMimeHeader(escapeEmailName(name))} <${email}>`;
}

function encodeMimeHeader(value: string) {
  return /^[\x20-\x7e]*$/.test(value)
    ? value.replace(/[\r\n]/g, " ")
    : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function sanitizeFilename(value: string) {
  return value.replace(/["\r\n]/g, "").slice(0, 120) || "imagem-campanha";
}

function sanitizeMimeType(value: string) {
  return /^image\/[a-z0-9.+-]+$/i.test(value) ? value : "application/octet-stream";
}

function foldBase64(value: string) {
  return value.replace(/(.{1,76})/g, "$1\r\n").trim();
}

function cryptoRandom() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
