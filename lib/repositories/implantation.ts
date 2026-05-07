import { db } from "@/lib/db";
import type {
  CampaignChannelOption,
  CampaignManagerContext,
  ImplantationHeader,
  ImplantationStep
} from "@/lib/types";

export async function getCandidateImplantation(idCandidato: string) {
  const headerResult = await db.query<ImplantationHeader>(
    `
      select
        c.id_candidato,
        c.nome_urna,
        c.nome_completo,
        c.partido,
        c.cargo_disputado,
        c.estado,
        ic.status_implantacao,
        ic.ambiente,
        ic.instancia_evolution,
        ic.numero_agente_oficial,
        ic.webhook_inbound_url,
        ic.webhook_outbound_url,
        ic.qr_code_url,
        ic.observacoes,
        ic.atualizado_em::text as atualizado_em
      from candidatos c
      join implantacoes_candidato ic
        on ic.id_candidato = c.id_candidato
      where c.id_candidato = $1
    `,
    [idCandidato]
  );

  if (!headerResult.rows[0]) {
    return null;
  }

  const stepsResult = await db.query<ImplantationStep>(
    `
      select
        codigo_etapa,
        nome_etapa,
        ordem,
        status_etapa,
        workflow_nome,
        webhook_path,
        executado_em::text as executado_em,
        finalizado_em::text as finalizado_em,
        mensagem_status,
        detalhes
      from implantacao_etapas_candidato
      where id_candidato = $1
      order by ordem
    `,
    [idCandidato]
  );

  const reconciledSteps = await reconcileImplantationSteps(
    idCandidato,
    headerResult.rows[0],
    stepsResult.rows
  );

  return {
    cabecalho: headerResult.rows[0],
    etapas: reconciledSteps
  };
}

export async function getCampaignManagerContext(
  idCandidato: string
): Promise<CampaignManagerContext | null> {
  const candidateResult = await db.query<{
    id_candidato: string;
    nome_urna: string;
    telefone_responsavel: string | null;
    responsavel_preenchimento: string | null;
    email_responsavel: string | null;
    numero_agente_oficial: string | null;
    url_canal_oficial: string | null;
    dados_brutos: Record<string, unknown> | null;
    configuracao: Record<string, unknown> | null;
    canais_divulgacao_whatsapp: string | null;
  }>(
    `
      select
        c.id_candidato,
        c.nome_urna,
        c.telefone_responsavel,
        c.responsavel_preenchimento,
        c.email_responsavel,
        ic.numero_agente_oficial,
        official.url_canal as url_canal_oficial,
        c.dados_brutos,
        camp.configuracao,
        camp.canais_divulgacao_whatsapp
      from candidatos c
      left join implantacoes_candidato ic
        on ic.id_candidato = c.id_candidato
      left join campanhas camp
        on camp.id_candidato = c.id_candidato
      left join lateral (
        select url_canal
        from canais_integracao ci
        where ci.id_candidato = c.id_candidato
          and ci.tipo_canal = 'whatsapp_agente'
        order by ci.atualizado_em desc
        limit 1
      ) official on true
      where c.id_candidato = $1
    `,
    [idCandidato]
  );

  const candidate = candidateResult.rows[0];

  if (!candidate) {
    return null;
  }

  const channelsResult = await db.query<{
    nome_canal: string;
    tipo_canal: string;
    url_canal: string | null;
    identificador_externo: string | null;
  }>(
    `
      select nome_canal, tipo_canal, url_canal, identificador_externo
      from canais_integracao
      where id_candidato = $1
        and tipo_canal <> 'whatsapp_agente'
      order by
        case tipo_canal
          when 'site_campanha' then 1
          when 'rede_social' then 2
          else 3
        end,
        nome_canal
    `,
    [idCandidato]
  );

  const rawChannels = buildChannelOptions(candidate, channelsResult.rows);

  return {
    id_candidato: candidate.id_candidato,
    nome_urna: candidate.nome_urna,
    telefone_responsavel: candidate.telefone_responsavel,
    responsavel_preenchimento: candidate.responsavel_preenchimento,
    email_responsavel: candidate.email_responsavel,
    numero_agente_oficial: candidate.numero_agente_oficial,
    url_canal_oficial: candidate.url_canal_oficial,
    canais_divulgacao_origem: candidate.canais_divulgacao_whatsapp,
    observacao_padrao:
      "Dados apresentados a seguir foram importados do formulario de entrada e podem ser ajustados sob o controle do Gestor da Campanha.",
    canais_divulgacao: rawChannels
  };
}

export async function getManagerAccessData(idCandidato: string) {
  const result = await db.query<{
    telefone_responsavel: string | null;
  }>(
    `
      select telefone_responsavel
      from candidatos
      where id_candidato = $1
    `,
    [idCandidato]
  );

  return result.rows[0] ?? null;
}

function buildChannelOptions(
  candidate: {
    dados_brutos: Record<string, unknown> | null;
    configuracao: Record<string, unknown> | null;
    canais_divulgacao_whatsapp: string | null;
  },
  existingChannels: Array<{
    nome_canal: string;
    tipo_canal: string;
    url_canal: string | null;
    identificador_externo: string | null;
  }>
): CampaignChannelOption[] {
  const options: CampaignChannelOption[] = existingChannels.map((channel) => ({
    ...channel,
    selecionado_por_padrao: true
  }));

  const seen = new Set(options.map((item) => `${item.tipo_canal}:${item.nome_canal}`));
  const raw = candidate.dados_brutos ?? {};
  const config = candidate.configuracao ?? {};

  const extras: Array<CampaignChannelOption | null> = [
    typeof raw.site_campanha === "string" && raw.site_campanha
      ? {
          nome_canal: "Site da campanha",
          tipo_canal: "site_campanha",
          url_canal: normalizeUrl(raw.site_campanha),
          identificador_externo: String(raw.site_campanha),
          selecionado_por_padrao: true
        }
      : null,
    typeof raw.redes_sociais === "string" && raw.redes_sociais
      ? {
          nome_canal: "Redes sociais da campanha",
          tipo_canal: "rede_social",
          url_canal: normalizeUrl(raw.redes_sociais),
          identificador_externo: String(raw.redes_sociais),
          selecionado_por_padrao: true
        }
      : null,
    typeof config.site_campanha === "string" && config.site_campanha
      ? {
          nome_canal: "Site da campanha",
          tipo_canal: "site_campanha",
          url_canal: normalizeUrl(config.site_campanha),
          identificador_externo: String(config.site_campanha),
          selecionado_por_padrao: true
        }
      : null,
    typeof config.redes_sociais === "string" && config.redes_sociais
      ? {
          nome_canal: "Redes sociais da campanha",
          tipo_canal: "rede_social",
          url_canal: normalizeUrl(config.redes_sociais),
          identificador_externo: String(config.redes_sociais),
          selecionado_por_padrao: true
        }
      : null
  ];

  for (const extra of extras) {
    if (!extra) {
      continue;
    }

    const key = `${extra.tipo_canal}:${extra.nome_canal}`;

    if (!seen.has(key)) {
      options.push(extra);
      seen.add(key);
    }
  }

  return options;
}

function normalizeUrl(value: unknown) {
  const text = String(value ?? "").trim();

  if (!text) {
    return null;
  }

  if (text.startsWith("http://") || text.startsWith("https://")) {
    return text;
  }

  return `https://${text}`;
}

async function reconcileImplantationSteps(
  idCandidato: string,
  header: ImplantationHeader,
  steps: ImplantationStep[]
) {
  const updates: Array<{
    codigo_etapa: string;
    mensagem: string;
  }> = [];

  const hasCandidateBase =
    Boolean(header.nome_urna) &&
    Boolean(header.nome_completo) &&
    Boolean(header.partido) &&
    Boolean(header.cargo_disputado);

  if (hasCandidateBase) {
    const cadastroStep = steps.find((step) => step.codigo_etapa === "cadastro_candidato");

    if (cadastroStep && cadastroStep.status_etapa !== "concluida") {
      updates.push({
        codigo_etapa: "cadastro_candidato",
        mensagem: "Etapa conciliada automaticamente: candidato ja existente na base de dados."
      });
    }
  }

  if (header.qr_code_url) {
    const qrStep = steps.find((step) => step.codigo_etapa === "gerar_qrcode");

    if (qrStep && qrStep.status_etapa !== "concluida") {
      updates.push({
        codigo_etapa: "gerar_qrcode",
        mensagem: "Etapa conciliada automaticamente: QR Code ja existente para o candidato."
      });
    }
  }

  if (updates.length === 0) {
    return steps;
  }

  for (const update of updates) {
    await db.query(
      `
        update implantacao_etapas_candidato
        set
          status_etapa = 'concluida',
          finalizado_em = coalesce(finalizado_em, now()),
          executado_em = coalesce(executado_em, now()),
          mensagem_status = $3,
          atualizado_em = now()
        where id_candidato = $1
          and codigo_etapa = $2
      `,
      [idCandidato, update.codigo_etapa, update.mensagem]
    );
  }

  return steps.map((step) => {
    const matchedUpdate = updates.find((update) => update.codigo_etapa === step.codigo_etapa);

    if (!matchedUpdate) {
      return step;
    }

    const now = new Date().toISOString();

    return {
      ...step,
      status_etapa: "concluida",
      executado_em: step.executado_em ?? now,
      finalizado_em: step.finalizado_em ?? now,
      mensagem_status: matchedUpdate.mensagem
    };
  });
}
