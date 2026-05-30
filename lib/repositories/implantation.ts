import { db } from "@/lib/db";
import type {
  CampaignChannelOption,
  CampaignManagerContext,
  ImplantationHeader,
  ImplantationStep,
  ManagerUpdateSummary
} from "@/lib/types";

const DEFAULT_IMPLANTATION_STEPS: Array<{
  codigo_etapa: string;
  nome_etapa: string;
  ordem: number;
  workflow_nome: string | null;
  webhook_path: string | null;
}> = [
  {
    codigo_etapa: "cadastro_candidato",
    nome_etapa: "Cadastrar candidato",
    ordem: 1,
    workflow_nome: "n8n_sync_candidato_v2_governanca",
    webhook_path: "/webhook/candidato-sync"
  },
  {
    codigo_etapa: "configurar_canais",
    nome_etapa: "Configurar canais da campanha",
    ordem: 2,
    workflow_nome: null,
    webhook_path: null
  },
  {
    codigo_etapa: "gerar_qrcode",
    nome_etapa: "Gerar QR Code e canais",
    ordem: 3,
    workflow_nome: "n8n_qrcode_canais_v1",
    webhook_path: "/webhook/agente-politico/[id_candidato]/qrcode/canais"
  },
  {
    codigo_etapa: "configurar_evolution",
    nome_etapa: "Configurar Evolution API",
    ordem: 4,
    workflow_nome: null,
    webhook_path: null
  },
  {
    codigo_etapa: "validar_inbound",
    nome_etapa: "Validar inbound do eleitor",
    ordem: 5,
    workflow_nome: "n8n_funil_entrada_v1",
    webhook_path: "/webhook/agente-politico/[id_candidato]/entrada-eleitor"
  },
  {
    codigo_etapa: "validar_outbound",
    nome_etapa: "Validar outbound e cadencia",
    ordem: 6,
    workflow_nome: null,
    webhook_path: null
  },
  {
    codigo_etapa: "ativar_campanha",
    nome_etapa: "Ativar campanha",
    ordem: 7,
    workflow_nome: null,
    webhook_path: null
  }
];

export async function getCandidateImplantation(idCandidato: string) {
  await ensureImplantationQrColumns();
  await ensureCandidateImplantationSkeleton(idCandidato);

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
        coalesce(
          official.metadata ->> 'qr_code_url',
          case
            when official.url_canal is not null and btrim(official.url_canal) <> ''
              then 'https://api.qrserver.com/v1/create-qr-code/?size=800x800&data=' || replace(official.url_canal, '&', '%26')
            else ic.qr_code_url
          end
        ) as qr_code_url,
        ic.pairing_qr_code_url,
        ic.evolution_connection_code,
        ic.evolution_pairing_code,
        ic.evolution_connection_status,
        ic.observacoes,
        ic.atualizado_em::text as atualizado_em
      from candidatos c
      join implantacoes_candidato ic
        on ic.id_candidato = c.id_candidato
      left join lateral (
        select
          ci.url_canal,
          ci.metadata
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

  if (!headerResult.rows[0]) {
    const candidateFallback = await db.query<{
      id_candidato: string;
      nome_urna: string;
      nome_completo: string;
      partido: string | null;
      cargo_disputado: string | null;
      estado: string | null;
    }>(
      `
        select
          id_candidato,
          nome_urna,
          nome_completo,
          partido,
          cargo_disputado,
          estado
        from candidatos
        where id_candidato = $1
      `,
      [idCandidato]
    );

    const candidate = candidateFallback.rows[0];

    if (!candidate) {
      return null;
    }

    const fallbackHeader: ImplantationHeader = {
      id_candidato: candidate.id_candidato,
      nome_urna: candidate.nome_urna,
      nome_completo: candidate.nome_completo,
      partido: candidate.partido,
      cargo_disputado: candidate.cargo_disputado,
      estado: candidate.estado,
      status_implantacao: "em_preparacao",
      ambiente: "producao",
      instancia_evolution: null,
      numero_agente_oficial: null,
      webhook_inbound_url: null,
      webhook_outbound_url: null,
      qr_code_url: null,
      pairing_qr_code_url: null,
      evolution_connection_code: null,
      evolution_pairing_code: null,
      evolution_connection_status: null,
      observacoes: "Implantação inicial ainda não consolidada no ambiente.",
      atualizado_em: null
    };

    return {
      cabecalho: fallbackHeader,
      etapas: DEFAULT_IMPLANTATION_STEPS.map((step) => ({
        ...step,
        status_etapa: "nao_iniciado",
        executado_em: null,
        finalizado_em: null,
        mensagem_status: null,
        detalhes: null
      })),
      atualizacaoGestora: null
    };
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

  const managerUpdateResult = await db.query<ManagerUpdateSummary>(
    `
      select
        ei.origem,
        ei.status_execucao,
        ei.iniciado_em::text as executado_em,
        ei.finalizado_em::text as finalizado_em,
        ei.payload_enviado ->> 'observacao' as observacao,
        coalesce(
          ei.payload_enviado ->> 'observacao',
          iec.mensagem_status,
          'Atualizacao registrada pela gestora da campanha.'
        ) as resumo
      from execucoes_implantacao ei
      join implantacao_etapas_candidato iec
        on iec.id = ei.etapa_id
      where ei.id_candidato = $1
        and iec.codigo_etapa = 'configurar_canais'
        and ei.origem = 'gestor_campanha'
      order by ei.iniciado_em desc
      limit 1
    `,
    [idCandidato]
  );

  return {
    cabecalho: headerResult.rows[0],
    etapas: reconciledSteps,
    atualizacaoGestora: managerUpdateResult.rows[0] ?? null
  };
}

async function ensureImplantationQrColumns() {
  await db.query(`
    alter table implantacoes_candidato
      add column if not exists pairing_qr_code_url text,
      add column if not exists evolution_connection_code text,
      add column if not exists evolution_pairing_code text,
      add column if not exists evolution_connection_status text
  `);
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
    qr_code_url: string | null;
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
        coalesce(
          official.metadata ->> 'qr_code_url',
          case
            when official.url_canal is not null and btrim(official.url_canal) <> ''
              then 'https://api.qrserver.com/v1/create-qr-code/?size=800x800&data=' || replace(official.url_canal, '&', '%26')
            else ic.qr_code_url
          end
        ) as qr_code_url,
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
    status: string;
  }>(
    `
      select nome_canal, tipo_canal, url_canal, identificador_externo, status
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
    qr_code_url: candidate.qr_code_url,
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

async function ensureCandidateImplantationSkeleton(idCandidato: string) {
  const client = await db.connect();

  try {
    await client.query("begin");

    const candidateResult = await client.query<{
      id_candidato: string;
    }>(
      `
        select id_candidato
        from candidatos
        where id_candidato = $1
      `,
      [idCandidato]
    );

    if (!candidateResult.rows[0]) {
      await client.query("rollback");
      return;
    }

    await client.query(
      `
        insert into implantacoes_candidato (
          id_candidato,
          status_implantacao,
          ambiente,
          observacoes,
          atualizado_em
        )
        values (
          $1::varchar,
          'em_preparacao',
          'producao',
          'Registro inicial de implantacao criado automaticamente pela plataforma.',
          now()
        )
        on conflict (id_candidato) do nothing
      `,
      [idCandidato]
    );

    for (const step of DEFAULT_IMPLANTATION_STEPS) {
      await client.query(
        `
          insert into implantacao_etapas_candidato (
            implantacao_id,
            id_candidato,
            codigo_etapa,
            nome_etapa,
            ordem,
            status_etapa,
            workflow_nome,
            webhook_path,
            atualizado_em
          )
          select
            ic.id,
            $1::varchar,
            $2::text,
            $3::text,
            $4::int,
            'nao_iniciado',
            $5::text,
            $6::text,
            now()
          from implantacoes_candidato ic
          where ic.id_candidato = $1::varchar
          on conflict do nothing
        `,
        [
          idCandidato,
          step.codigo_etapa,
          step.nome_etapa,
          step.ordem,
          step.workflow_nome,
          step.webhook_path
        ]
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
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
    status: string;
  }>
): CampaignChannelOption[] {
  const options: CampaignChannelOption[] = existingChannels.map((channel) => ({
    nome_canal: inferChannelDisplayName(channel.nome_canal, channel.tipo_canal, channel.identificador_externo, channel.url_canal),
    tipo_canal: channel.tipo_canal,
    url_canal: channel.url_canal,
    identificador_externo: channel.identificador_externo,
    status: channel.status,
    selecionado_por_padrao: channel.status !== "inativo"
  }));

  const raw = candidate.dados_brutos ?? {};
  const config = candidate.configuracao ?? {};

  const extras: Array<CampaignChannelOption | null> = [
    typeof raw.site_campanha === "string" && raw.site_campanha
      ? {
          nome_canal: "Site da campanha",
          tipo_canal: "site_campanha",
          url_canal: normalizeUrl(raw.site_campanha),
          identificador_externo: String(raw.site_campanha),
          status: "ativo",
          selecionado_por_padrao: true
        }
      : null,
    typeof raw.redes_sociais === "string" && raw.redes_sociais
      ? {
          nome_canal: "Redes sociais da campanha",
          tipo_canal: "rede_social",
          url_canal: normalizeUrl(raw.redes_sociais),
          identificador_externo: String(raw.redes_sociais),
          status: "ativo",
          selecionado_por_padrao: true
        }
      : null,
    typeof config.site_campanha === "string" && config.site_campanha
      ? {
          nome_canal: "Site da campanha",
          tipo_canal: "site_campanha",
          url_canal: normalizeUrl(config.site_campanha),
          identificador_externo: String(config.site_campanha),
          status: "ativo",
          selecionado_por_padrao: true
        }
      : null,
    typeof config.redes_sociais === "string" && config.redes_sociais
      ? {
          nome_canal: "Redes sociais da campanha",
          tipo_canal: "rede_social",
          url_canal: normalizeUrl(config.redes_sociais),
          identificador_externo: String(config.redes_sociais),
          status: "ativo",
          selecionado_por_padrao: true
        }
      : null
  ];

  return dedupeChannelOptions([
    ...options,
    ...extras.filter((extra): extra is CampaignChannelOption => Boolean(extra))
  ]);
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

function dedupeChannelOptions(options: CampaignChannelOption[]) {
  const deduped = new Map<string, CampaignChannelOption>();

  for (const option of options) {
    const key = buildChannelKey(option);
    const existing = deduped.get(key);

    if (!existing) {
      deduped.set(key, option);
      continue;
    }

    deduped.set(key, choosePreferredChannel(existing, option));
  }

  return Array.from(deduped.values()).sort((left, right) => {
    const orderLeft = getChannelSortOrder(left.tipo_canal);
    const orderRight = getChannelSortOrder(right.tipo_canal);

    if (orderLeft !== orderRight) {
      return orderLeft - orderRight;
    }

    return left.nome_canal.localeCompare(right.nome_canal, "pt-BR");
  });
}

function buildChannelKey(option: CampaignChannelOption) {
  const reference = normalizeComparableChannelValue(
    option.url_canal ?? option.identificador_externo ?? option.nome_canal
  );

  return `${normalizeChannelFamily(option.tipo_canal)}|${reference}`;
}

function choosePreferredChannel(current: CampaignChannelOption, candidate: CampaignChannelOption) {
  const currentScore = scoreChannel(current);
  const candidateScore = scoreChannel(candidate);

  return candidateScore > currentScore ? candidate : current;
}

function scoreChannel(option: CampaignChannelOption) {
  let score = 0;

  if (option.status !== "inativo") {
    score += 4;
  }

  if (option.url_canal) {
    score += 3;
  }

  if (option.identificador_externo) {
    score += 2;
  }

  if (
    option.nome_canal === "Site Oficial Brunex" ||
    option.nome_canal === "Rede Social Principal Brunex" ||
    option.nome_canal === "Site da campanha" ||
    option.nome_canal === "Redes sociais da campanha"
  ) {
    score += 1;
  }

  return score;
}

function normalizeChannelFamily(tipoCanal: string) {
  if (tipoCanal === "site_campanha") {
    return "site";
  }

  if (tipoCanal === "rede_social" || tipoCanal === "canal_divulgacao") {
    return "social";
  }

  return tipoCanal;
}

function normalizeComparableChannelValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

function inferChannelDisplayName(
  nomeCanal: string,
  tipoCanal: string,
  identificadorExterno: string | null,
  urlCanal: string | null
) {
  if (tipoCanal === "site_campanha") {
    return "Site oficial da campanha";
  }

  if (tipoCanal === "rede_social") {
    return "Rede social principal da campanha";
  }

  const reference = identificadorExterno ?? urlCanal ?? nomeCanal;

  if (tipoCanal === "canal_divulgacao" && reference.startsWith("@")) {
    return `Perfil social sugerido ${reference}`;
  }

  if (tipoCanal === "canal_divulgacao") {
    return nomeCanal || "Canal de divulgacao complementar";
  }

  return nomeCanal;
}

function getChannelSortOrder(tipoCanal: string) {
  switch (tipoCanal) {
    case "site_campanha":
      return 1;
    case "rede_social":
      return 2;
    case "canal_divulgacao":
      return 3;
    default:
      return 4;
  }
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
