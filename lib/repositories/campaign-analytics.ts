import { db } from "@/lib/db";
import type {
  AdminCampaignStatItem,
  AdminCampaignStatsSnapshot,
  AdminRankingItem,
  CampaignConversationExplorer,
  CampaignConversationFilters,
  CampaignConversationTimelineItem,
  CampaignAnalyticsHeader,
  CampaignAnalyticsSnapshot,
  CampaignGoalProgress,
  CampaignPeriodSummary,
  CampaignAnalyticsSummary,
  CampaignDailyMetric,
  CampaignOriginMetric,
  CampaignRecentConversation,
  CampaignStageMetric
} from "@/lib/types";

export async function getCampaignAnalyticsSnapshot(
  idCandidato: string,
  periodDays = 14
): Promise<CampaignAnalyticsSnapshot | null> {
  const normalizedPeriodDays = normalizePeriodDays(periodDays);
  const headerResult = await db.query<CampaignAnalyticsHeader>(
    `
      select
        c.id_candidato,
        c.nome_urna,
        camp.nome_campanha,
        camp.status as status_campanha,
        camp.cargo_disputado,
        camp.partido,
        camp.uf,
        ic.numero_agente_oficial,
        camp.meta_contatos_whatsapp,
        camp.meta_conversao_votos
      from candidatos c
      left join campanhas camp
        on camp.id_candidato = c.id_candidato
      left join implantacoes_candidato ic
        on ic.id_candidato = c.id_candidato
      where c.id_candidato = $1
    `,
    [idCandidato]
  );

  const cabecalho = headerResult.rows[0];

  if (!cabecalho) {
    return null;
  }

  const summaryResult = await db.query<CampaignAnalyticsSummary>(
    `
      with eleitor_base as (
        select *
        from eleitores
        where id_candidato = $1
      ),
      interaction_base as (
        select *
        from interacoes
        where id_candidato = $1
      ),
      participation_base as (
        select *
        from participacoes_eventos
        where id_candidato = $1
      )
      select
        coalesce((select count(*)::int from eleitor_base), 0) as total_eleitores,
        coalesce((select count(*)::int from eleitor_base where etapa_funil = 'novo_lead'), 0) as leads_novos,
        coalesce((select count(*)::int from eleitor_base where etapa_funil in ('qualificado', 'qualificado_quente')), 0) as leads_qualificados,
        coalesce((select count(*)::int from eleitor_base where etapa_funil in ('engajado', 'relacionamento', 'nutricao')), 0) as leads_engajados,
        coalesce((select count(*)::int from eleitor_base where intencao_voto = 'apoiador'), 0) as apoiadores,
        coalesce((select count(*)::int from eleitor_base where intencao_voto = 'indeciso'), 0) as indecisos,
        coalesce((select count(*)::int from eleitor_base where opt_out = true), 0) as opt_outs,
        coalesce((select count(*)::int from interaction_base), 0) as interacoes_total,
        coalesce((select count(*)::int from interaction_base where criado_em >= now() - interval '24 hours'), 0) as interacoes_24h,
        coalesce((select count(*)::int from interaction_base where direcao = 'inbound'), 0) as inbound_total,
        coalesce((select count(*)::int from interaction_base where direcao = 'outbound'), 0) as outbound_total,
        coalesce((select count(*)::int from eventos_campanha where id_candidato = $1 and status = 'ativo'), 0) as eventos_ativos,
        coalesce((select count(*)::int from participation_base where status_participacao in ('confirmado', 'confirmada')), 0) as confirmacoes_evento,
        coalesce((select count(*)::int from participation_base where status_participacao in ('presente', 'compareceu')), 0) as comparecimentos_evento,
        coalesce((select round(avg(score_engajamento)::numeric, 2) from eleitor_base), 0) as score_engajamento_medio,
        coalesce((select round(avg(score_propensao_voto)::numeric, 2) from eleitor_base), 0) as score_propensao_medio,
        case
          when coalesce((select count(*) from eleitor_base), 0) = 0 then 0
          else round(
            (
              coalesce((select count(*) from eleitor_base where intencao_voto = 'apoiador'), 0)::numeric /
              greatest((select count(*) from eleitor_base), 1)::numeric
            ) * 100,
            2
          )
        end as taxa_conversao_percentual,
        case
          when coalesce($2, 0) = 0 then 0
          else round(
            (
              coalesce((select count(*) from eleitor_base), 0)::numeric /
              greatest($2, 1)::numeric
            ) * 100,
            2
          )
        end as meta_contatos_percentual
    `,
    [idCandidato, cabecalho.meta_contatos_whatsapp ?? 0]
  );

  const periodSummaryResult = await db.query<CampaignPeriodSummary>(
    `
      with interaction_period as (
        select *
        from interacoes
        where id_candidato = $1
          and criado_em >= now() - make_interval(days => $2::int)
      ),
      lead_period as (
        select *
        from eleitores
        where id_candidato = $1
          and criado_em >= now() - make_interval(days => $2::int)
      )
      select
        $2::int as periodo_dias,
        coalesce((select count(*)::int from lead_period), 0) as novos_leads_periodo,
        coalesce((select count(*)::int from interaction_period), 0) as interacoes_periodo,
        coalesce((select count(*)::int from interaction_period where direcao = 'inbound'), 0) as inbound_periodo,
        coalesce((select count(*)::int from interaction_period where direcao = 'outbound'), 0) as outbound_periodo,
        coalesce((select count(*)::int from lead_period where intencao_voto = 'apoiador'), 0) as apoiadores_periodo,
        case
          when coalesce((select count(*) from lead_period), 0) = 0 then 0
          else round(
            (
              coalesce((select count(*) from lead_period where intencao_voto = 'apoiador'), 0)::numeric /
              greatest((select count(*) from lead_period), 1)::numeric
            ) * 100,
            2
          )
        end as conversao_periodo_percentual
    `,
    [idCandidato, normalizedPeriodDays]
  );

  const goalProgressResult = await db.query<CampaignGoalProgress>(
    `
      with eleitor_base as (
        select *
        from eleitores
        where id_candidato = $1
      )
      select
        coalesce($2, 0)::int as meta_contatos_whatsapp,
        coalesce((select count(*)::int from eleitor_base), 0) as base_total_atual,
        greatest(coalesce($2, 0)::int - coalesce((select count(*)::int from eleitor_base), 0), 0) as gap_contatos,
        case
          when coalesce($2, 0) = 0 then 0
          else round(
            (
              coalesce((select count(*)::int from eleitor_base), 0)::numeric /
              greatest($2::numeric, 1)
            ) * 100,
            2
          )
        end as realizado_contatos_percentual,
        coalesce($3, 0)::int as meta_conversao_votos,
        coalesce((select count(*)::int from eleitor_base where intencao_voto = 'apoiador'), 0) as apoiadores_atuais,
        greatest(coalesce($3, 0)::int - coalesce((select count(*)::int from eleitor_base where intencao_voto = 'apoiador'), 0), 0) as gap_conversao,
        case
          when coalesce($3, 0) = 0 then 0
          else round(
            (
              coalesce((select count(*)::int from eleitor_base where intencao_voto = 'apoiador'), 0)::numeric /
              greatest($3::numeric, 1)
            ) * 100,
            2
          )
        end as realizado_conversao_percentual
    `,
    [
      idCandidato,
      cabecalho.meta_contatos_whatsapp ?? 0,
      cabecalho.meta_conversao_votos ?? 0
    ]
  );

  const funilResult = await db.query<CampaignStageMetric>(
    `
      select
        coalesce(etapa_funil, 'nao_classificado') as etapa_funil,
        count(*)::int as total
      from eleitores
      where id_candidato = $1
      group by coalesce(etapa_funil, 'nao_classificado')
      order by total desc, etapa_funil asc
    `,
    [idCandidato]
  );

  const originsResult = await db.query<CampaignOriginMetric>(
    `
      select
        coalesce(origem_captacao, 'nao_informada') as origem_captacao,
        count(*)::int as total
      from eleitores
      where id_candidato = $1
      group by coalesce(origem_captacao, 'nao_informada')
      order by total desc, origem_captacao asc
    `,
    [idCandidato]
  );

  const themesResult = await db.query<{ tema: string; total: number }>(
    `
      select
        tema,
        count(*)::int as total
      from (
        select coalesce(nullif(i.tema_classificado, ''), nullif(e.tema_interesse, ''), 'nao_classificado') as tema
        from eleitores e
        left join lateral (
          select tema_classificado
          from interacoes
          where id_candidato = $1
            and eleitor_uid = e.eleitor_uid
            and nullif(tema_classificado, '') is not null
          order by criado_em desc
          limit 1
        ) i on true
        where e.id_candidato = $1
      ) themes
      group by tema
      order by total desc, tema asc
      limit 8
    `,
    [idCandidato]
  );

  const dailyResult = await db.query<CampaignDailyMetric>(
    `
      with days as (
        select generate_series(
          current_date - interval '13 days',
          current_date,
          interval '1 day'
        )::date as ref
      ),
      leads as (
        select date_trunc('day', criado_em)::date as ref, count(*)::int as total
        from eleitores
        where id_candidato = $1
          and criado_em >= current_date - interval '13 days'
        group by 1
      ),
      interacoes_dia as (
        select date_trunc('day', criado_em)::date as ref, count(*)::int as total
        from interacoes
        where id_candidato = $1
          and criado_em >= current_date - interval '13 days'
        group by 1
      )
      select
        days.ref::text as data_referencia,
        coalesce(leads.total, 0) as novos_leads,
        coalesce(interacoes_dia.total, 0) as interacoes
      from days
      left join leads on leads.ref = days.ref
      left join interacoes_dia on interacoes_dia.ref = days.ref
      order by days.ref
    `,
    [idCandidato]
  );

  const recentConversationsResult = await db.query<CampaignRecentConversation>(
    `
      with interaction_rank as (
        select
          i.*,
          row_number() over (
            partition by i.eleitor_uid
            order by i.criado_em desc
          ) as rn
        from interacoes i
        where i.id_candidato = $1
      ),
      interaction_totals as (
        select eleitor_uid, count(*)::int as total_interacoes
        from interacoes
        where id_candidato = $1
        group by eleitor_uid
      )
      select
        e.eleitor_uid,
        e.eleitor_id,
        e.nome,
        e.telefone,
        e.origem_captacao,
        e.etapa_funil,
        e.sentimento,
        e.intencao_voto,
        e.score_engajamento,
        e.score_propensao_voto,
        e.ultimo_contato_em::text as ultimo_contato_em,
        ir.canal as canal_ultimo_contato,
        ir.direcao as direcao_ultimo_contato,
        coalesce(nullif(ir.mensagem, ''), ir.resposta_eleitor) as ultima_mensagem,
        coalesce(it.total_interacoes, 0) as total_interacoes
      from eleitores e
      left join interaction_rank ir
        on ir.eleitor_uid = e.eleitor_uid
       and ir.rn = 1
      left join interaction_totals it
        on it.eleitor_uid = e.eleitor_uid
      where e.id_candidato = $1
      order by coalesce(e.ultimo_contato_em, e.ultima_resposta_em, e.atualizado_em, e.criado_em) desc
      limit 20
    `,
    [idCandidato]
  );

  return {
    cabecalho,
    resumo: summaryResult.rows[0],
    resumoPeriodo: periodSummaryResult.rows[0],
    metas: goalProgressResult.rows[0],
    periodoSelecionadoDias: normalizedPeriodDays,
    funil: funilResult.rows,
    origens: originsResult.rows,
    temas: themesResult.rows,
    evolucaoDiaria: dailyResult.rows,
    conversasRecentes: recentConversationsResult.rows
  };
}

export async function getCampaignConversationExplorer(
  idCandidato: string,
  filters?: Partial<CampaignConversationFilters> & { eleitorUid?: string }
): Promise<CampaignConversationExplorer | null> {
  const headerResult = await db.query<CampaignAnalyticsHeader>(
    `
      select
        c.id_candidato,
        c.nome_urna,
        camp.nome_campanha,
        camp.status as status_campanha,
        camp.cargo_disputado,
        camp.partido,
        camp.uf,
        ic.numero_agente_oficial,
        camp.meta_contatos_whatsapp,
        camp.meta_conversao_votos
      from candidatos c
      left join campanhas camp
        on camp.id_candidato = c.id_candidato
      left join implantacoes_candidato ic
        on ic.id_candidato = c.id_candidato
      where c.id_candidato = $1
    `,
    [idCandidato]
  );

  const cabecalho = headerResult.rows[0];

  if (!cabecalho) {
    return null;
  }

  const normalizedFilters: CampaignConversationFilters = {
    busca: String(filters?.busca ?? "").trim(),
    etapa: String(filters?.etapa ?? "").trim(),
    origem: String(filters?.origem ?? "").trim(),
    sentimento: String(filters?.sentimento ?? "").trim()
  };

  const values: unknown[] = [idCandidato];
  const conditions = ["e.id_candidato = $1"];

  if (normalizedFilters.busca) {
    values.push(`%${normalizedFilters.busca.toLowerCase()}%`);
    const idx = values.length;
    conditions.push(
      `(lower(coalesce(e.nome, '')) like $${idx} or lower(coalesce(e.telefone, '')) like $${idx} or lower(coalesce(e.eleitor_id, '')) like $${idx})`
    );
  }

  if (normalizedFilters.etapa) {
    values.push(normalizedFilters.etapa);
    conditions.push(`coalesce(e.etapa_funil, 'nao_classificado') = $${values.length}`);
  }

  if (normalizedFilters.origem) {
    values.push(normalizedFilters.origem);
    conditions.push(`coalesce(e.origem_captacao, 'nao_informada') = $${values.length}`);
  }

  if (normalizedFilters.sentimento) {
    values.push(normalizedFilters.sentimento);
    conditions.push(`coalesce(e.sentimento, 'nao_classificado') = $${values.length}`);
  }

  const whereClause = conditions.join(" and ");

  const conversationsResult = await db.query<CampaignRecentConversation>(
    `
      with interaction_rank as (
        select
          i.*,
          row_number() over (
            partition by i.eleitor_uid
            order by i.criado_em desc
          ) as rn
        from interacoes i
        where i.id_candidato = $1
      ),
      interaction_totals as (
        select eleitor_uid, count(*)::int as total_interacoes
        from interacoes
        where id_candidato = $1
        group by eleitor_uid
      )
      select
        e.eleitor_uid,
        e.eleitor_id,
        e.nome,
        e.telefone,
        e.origem_captacao,
        e.etapa_funil,
        e.sentimento,
        e.intencao_voto,
        e.score_engajamento,
        e.score_propensao_voto,
        e.ultimo_contato_em::text as ultimo_contato_em,
        ir.canal as canal_ultimo_contato,
        ir.direcao as direcao_ultimo_contato,
        coalesce(nullif(ir.mensagem, ''), ir.resposta_eleitor) as ultima_mensagem,
        coalesce(it.total_interacoes, 0) as total_interacoes
      from eleitores e
      left join interaction_rank ir
        on ir.eleitor_uid = e.eleitor_uid
       and ir.rn = 1
      left join interaction_totals it
        on it.eleitor_uid = e.eleitor_uid
      where ${whereClause}
      order by coalesce(e.ultimo_contato_em, e.ultima_resposta_em, e.atualizado_em, e.criado_em) desc
      limit 60
    `,
    values
  );

  const selectedUid =
    String(filters?.eleitorUid ?? "").trim() || conversationsResult.rows[0]?.eleitor_uid || "";

  const selectedSummary =
    conversationsResult.rows.find((item) => item.eleitor_uid === selectedUid) ?? null;

  const timelineResult = selectedUid
    ? await db.query<CampaignConversationTimelineItem>(
        `
          select
            id::text as id,
            canal,
            direcao,
            mensagem,
            resposta_eleitor,
            tema_classificado,
            sentimento,
            intencao_voto,
            etapa_sugerida,
            risco_compliance,
            status_envio,
            criado_em::text as criado_em
          from interacoes
          where id_candidato = $1
            and eleitor_uid = $2
          order by criado_em desc
          limit 80
        `,
        [idCandidato, selectedUid]
      )
    : { rows: [] as CampaignConversationTimelineItem[] };

  const etapaOptions = await db.query<{ valor: string }>(
    `
      select distinct coalesce(etapa_funil, 'nao_classificado') as valor
      from eleitores
      where id_candidato = $1
      order by valor
    `,
    [idCandidato]
  );

  const origemOptions = await db.query<{ valor: string }>(
    `
      select distinct coalesce(origem_captacao, 'nao_informada') as valor
      from eleitores
      where id_candidato = $1
      order by valor
    `,
    [idCandidato]
  );

  const sentimentoOptions = await db.query<{ valor: string }>(
    `
      select distinct coalesce(sentimento, 'nao_classificado') as valor
      from eleitores
      where id_candidato = $1
      order by valor
    `,
    [idCandidato]
  );

  return {
    cabecalho,
    filtros: normalizedFilters,
    opcoes: {
      etapas: etapaOptions.rows.map((row) => row.valor),
      origens: origemOptions.rows.map((row) => row.valor),
      sentimentos: sentimentoOptions.rows.map((row) => row.valor)
    },
    conversas: conversationsResult.rows,
    conversaSelecionada: selectedSummary
      ? {
          resumo: selectedSummary,
          historico: timelineResult.rows
        }
      : null
  };
}

export async function getAdminCampaignStatsSnapshot(): Promise<AdminCampaignStatsSnapshot> {
  const campaignRows = await db.query<AdminCampaignStatItem>(
    `
      with eleitor_stats as (
        select
          id_candidato,
          count(*)::int as total_eleitores,
          count(*) filter (where etapa_funil in ('engajado', 'relacionamento', 'nutricao'))::int as leads_engajados,
          count(*) filter (where intencao_voto = 'apoiador')::int as apoiadores,
          coalesce(round(avg(score_engajamento)::numeric, 2), 0) as score_engajamento_medio
        from eleitores
        group by id_candidato
      ),
      interaction_stats as (
        select
          id_candidato,
          count(*)::int as interacoes_total,
          count(*) filter (where criado_em >= now() - interval '24 hours')::int as interacoes_24h
        from interacoes
        group by id_candidato
      )
      select
        c.id_candidato,
        c.nome_urna,
        camp.nome_campanha,
        camp.status as status_campanha,
        camp.meta_contatos_whatsapp,
        camp.meta_conversao_votos,
        coalesce(es.total_eleitores, 0) as total_eleitores,
        coalesce(es.leads_engajados, 0) as leads_engajados,
        coalesce(es.apoiadores, 0) as apoiadores,
        coalesce(is2.interacoes_total, 0) as interacoes_total,
        coalesce(is2.interacoes_24h, 0) as interacoes_24h,
        case
          when coalesce(es.total_eleitores, 0) = 0 then 0
          else round((coalesce(es.apoiadores, 0)::numeric / greatest(es.total_eleitores, 1)::numeric) * 100, 2)
        end as taxa_conversao_percentual,
        case
          when coalesce(camp.meta_contatos_whatsapp, 0) = 0 then 0
          else round(
            (
              coalesce(es.total_eleitores, 0)::numeric /
              greatest(camp.meta_contatos_whatsapp::numeric, 1)
            ) * 100,
            2
          )
        end as meta_contatos_percentual,
        case
          when coalesce(camp.meta_conversao_votos, 0) = 0 then 0
          else round(
            (
              coalesce(es.apoiadores, 0)::numeric /
              greatest(camp.meta_conversao_votos::numeric, 1)
            ) * 100,
            2
          )
        end as meta_conversao_percentual,
        coalesce(es.score_engajamento_medio, 0) as score_engajamento_medio
      from candidatos c
      left join campanhas camp
        on camp.id_candidato = c.id_candidato
      left join eleitor_stats es
        on es.id_candidato = c.id_candidato
      left join interaction_stats is2
        on is2.id_candidato = c.id_candidato
      where c.nome_urna is not null
        and btrim(c.nome_urna) <> ''
        and c.id_candidato ~ '^[0-9]+$'
      order by coalesce(is2.interacoes_24h, 0) desc, c.id_candidato
    `
  );

  const totals = campaignRows.rows.reduce(
    (acc, campaign) => {
      acc.campanhas += 1;
      acc.eleitores += campaign.total_eleitores;
      acc.interacoes += campaign.interacoes_total;
      acc.apoiadores += campaign.apoiadores;
      acc.interacoes_24h += campaign.interacoes_24h;
      return acc;
    },
    {
      campanhas: 0,
      eleitores: 0,
      interacoes: 0,
      apoiadores: 0,
      interacoes_24h: 0
    }
  );

  const rankings = {
    conversao: buildRanking(campaignRows.rows, "taxa_conversao_percentual", "conversao"),
    atividade_24h: buildRanking(campaignRows.rows, "interacoes_24h", "interacoes em 24h"),
    cobertura_meta: buildRanking(campaignRows.rows, "meta_contatos_percentual", "cobertura da meta")
  };

  return {
    totais: totals,
    campanhas: campaignRows.rows,
    rankings
  };
}

function normalizePeriodDays(periodDays: number) {
  if (periodDays <= 7) {
    return 7;
  }

  if (periodDays <= 14) {
    return 14;
  }

  return 30;
}

function buildRanking(
  campaigns: AdminCampaignStatItem[],
  field: "taxa_conversao_percentual" | "interacoes_24h" | "meta_contatos_percentual",
  rotulo: string
): AdminRankingItem[] {
  return [...campaigns]
    .sort((left, right) => Number(right[field]) - Number(left[field]))
    .slice(0, 5)
    .map((campaign) => ({
      id_candidato: campaign.id_candidato,
      nome_urna: campaign.nome_urna,
      valor: Number(campaign[field]),
      rotulo
    }));
}
