import { db } from "@/lib/db";
import { getOutreachIntelligenceSnapshot } from "@/lib/repositories/campaign-outreach-team";
import type { QueryResultRow } from "pg";
import type {
  AdminCampaignStatItem,
  AdminCampaignStatsSnapshot,
  AdminCampaignGrowthPoint,
  AdminCampaignStageMetric,
  AdminRankingItem,
  CampaignConversationExplorer,
  CampaignConversationFilters,
  CampaignConversationTimelineItem,
  CampaignAnalyticsHeader,
  CampaignAnalyticsSnapshot,
  CampaignDataQualitySummary,
  CampaignFunnelHealthSummary,
  CampaignGoalProgress,
  CampaignGroupMetric,
  CampaignImportReportSummary,
  CampaignPeriodSummary,
  CampaignAnalyticsSummary,
  CampaignBaseGrowthPoint,
  CampaignCityMetric,
  CampaignDailyMetric,
  CampaignOperationalAlert,
  CampaignOriginMetric,
  CampaignOutsideThemeMetric,
  CampaignRegionalMetric,
  CampaignRecentConversation,
  CampaignStageMetric
} from "@/lib/types";

const VALID_BRAZILIAN_UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

const VALID_BRAZILIAN_UF_SQL = VALID_BRAZILIAN_UFS.map((uf) => `'${uf}'`).join(", ");
const SUPPORT_INTENTION_SQL =
  "lower(coalesce(intencao_voto, '')) in ('apoiador', 'apoio', 'voto_confirmado', 'confirmado')";

const ELECTOR_CONVERSATION_STAGE_SQL = `
        case
          when lower(coalesce(e.intencao_voto, '')) in ('apoiador', 'apoio', 'voto_confirmado', 'confirmado')
            or lower(coalesce(ir.intencao_voto, '')) in ('apoiador', 'apoio', 'voto_confirmado', 'confirmado') then 'engajado'
          when lower(coalesce(e.etapa_funil, '')) in ('', 'novo_lead', 'qualificado')
            and lower(coalesce(ir.etapa_sugerida, '')) in ('engajado', 'relacionamento', 'nutricao', 'divulgador') then ir.etapa_sugerida
          else e.etapa_funil
        end as etapa_funil`;

const ELECTOR_CONVERSATION_INTENTION_SQL = `
        case
          when lower(coalesce(e.intencao_voto, '')) in ('apoiador', 'apoio', 'voto_confirmado', 'confirmado')
            or lower(coalesce(ir.intencao_voto, '')) in ('apoiador', 'apoio', 'voto_confirmado', 'confirmado') then 'apoiador'
          when lower(coalesce(e.intencao_voto, '')) in ('', 'nao_classificada', 'nao_classificado', 'sem_leitura')
            and nullif(trim(coalesce(ir.intencao_voto, '')), '') is not null then ir.intencao_voto
          else e.intencao_voto
        end as intencao_voto`;

const CAMPAIGN_THEME_CLASSIFICATION_SQL = `
  case
    when normalized.theme_key not in ('', 'geral', 'nao_classificado', 'nao classificado', 'não classificado') then normalized.theme_raw
    when normalized.conversation_text like '%seguranc%'
      or normalized.conversation_text like '%seguranç%'
      or normalized.conversation_text like '%polici%'
      or normalized.conversation_text like '%violencia%'
      or normalized.conversation_text like '%violência%'
      or normalized.conversation_text like '%crime%' then 'seguranca_publica'
    when normalized.conversation_text like '%saude%'
      or normalized.conversation_text like '%saúde%'
      or normalized.conversation_text like '%hospital%'
      or normalized.conversation_text like '%ubs%'
      or normalized.conversation_text like '%medic%'
      or normalized.conversation_text like '%vacina%' then 'saude'
    when normalized.conversation_text like '%educa%'
      or normalized.conversation_text like '%educaç%'
      or normalized.conversation_text like '%escola%'
      or normalized.conversation_text like '%creche%'
      or normalized.conversation_text like '%professor%' then 'educacao'
    when normalized.conversation_text like '%transporte%'
      or normalized.conversation_text like '%onibus%'
      or normalized.conversation_text like '%metro%'
      or normalized.conversation_text like '%mobilidade%'
      or normalized.conversation_text like '%transito%' then 'transporte_e_mobilidade'
    when normalized.conversation_text like '%moradia%'
      or normalized.conversation_text like '%habitacao%'
      or normalized.conversation_text like '%habitação%'
      or normalized.conversation_text like '%regulariza%'
      or normalized.conversation_text like '%condominio%' then 'moradia_e_regularizacao'
    when normalized.conversation_text like '%emprego%'
      or normalized.conversation_text like '%renda%'
      or normalized.conversation_text like '%trabalho%'
      or normalized.conversation_text like '%empreendedor%' then 'emprego_e_renda'
    when normalized.conversation_text like '%assistencia%'
      or normalized.conversation_text like '%social%'
      or normalized.conversation_text like '%familia%'
      or normalized.conversation_text like '%família%'
      or normalized.conversation_text like '%vulnerab%' then 'assistencia_social'
    when normalized.conversation_text like '%reuniao%'
      or normalized.conversation_text like '%reunião%'
      or normalized.conversation_text like '%evento%'
      or normalized.conversation_text like '%encontro%'
      or normalized.conversation_text like '%agenda%' then 'eventos_e_reunioes'
    when normalized.conversation_text like '%material%'
      or normalized.conversation_text like '%panfleto%'
      or normalized.conversation_text like '%divulga%'
      or normalized.conversation_text like '%santinho%' then 'materiais_e_divulgacao'
    when normalized.conversation_text like '%candidato%'
      or normalized.conversation_text like '%ricardo%'
      or normalized.conversation_text like '%proposta%'
      or normalized.conversation_text like '%plataforma%' then 'propostas_do_candidato'
    when normalized.conversation_text like '%equipe%'
      or normalized.conversation_text like '%tarefa%'
      or normalized.conversation_text like '%contatei%'
      or normalized.conversation_text like '%mobiliza%' then 'mobilizacao_da_equipe'
    when normalized.conversation_text like '%asfalto%'
      or normalized.conversation_text like '%buraco%'
      or normalized.conversation_text like '%iluminacao%'
      or normalized.conversation_text like '%infraestrutura%' then 'infraestrutura_urbana'
    when normalized.conversation_text like '%meio ambiente%'
      or normalized.conversation_text like '%ambiental%'
      or normalized.conversation_text like '%lixo%'
      or normalized.conversation_text like '%recicla%' then 'meio_ambiente'
    when normalized.conversation_text like '%esporte%'
      or normalized.conversation_text like '%cultura%'
      or normalized.conversation_text like '%lazer%' then 'cultura_esporte_e_lazer'
    else 'geral'
  end
`;

type CampaignImportReportRow = {
  status: string;
  descricao: string;
  criado_em: string;
  importados: number;
  atualizados: number;
  ignorados: number;
  ignorados_por_motivo: Record<string, number> | null;
};

export async function getCampaignAnalyticsSnapshot(
  idCandidato: string,
  periodDays = 14
): Promise<CampaignAnalyticsSnapshot | null> {
  const normalizedPeriodDays = normalizePeriodDays(periodDays);
  const hasElectorEmailColumn = await hasTableColumn("eleitores", "email");
  const hasElectorUfColumn = await hasTableColumn("eleitores", "uf");
  const hasElectorGroupColumn = await hasTableColumn("eleitores", "grupo_interesse");
  const headerResult = await db.query<CampaignAnalyticsHeader>(
    `
      select
        c.id_candidato,
        c.nome_urna,
        camp.nome_campanha,
        camp.status as status_campanha,
        ic.status_implantacao,
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

  const summaryResult = await queryOrDefault<CampaignAnalyticsSummary>(
    "campaign-summary",
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
        coalesce((select count(*)::int from eleitor_base where etapa_funil in ('engajado', 'relacionamento', 'nutricao', 'divulgador')), 0) as leads_engajados,
        coalesce((select count(*)::int from eleitor_base where ${SUPPORT_INTENTION_SQL}), 0) as apoiadores,
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
              coalesce((select count(*) from eleitor_base where ${SUPPORT_INTENTION_SQL}), 0)::numeric /
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
    [idCandidato, cabecalho.meta_contatos_whatsapp ?? 0],
    [
      {
        total_eleitores: 0,
        leads_novos: 0,
        leads_qualificados: 0,
        leads_engajados: 0,
        apoiadores: 0,
        indecisos: 0,
        opt_outs: 0,
        interacoes_total: 0,
        interacoes_24h: 0,
        inbound_total: 0,
        outbound_total: 0,
        eventos_ativos: 0,
        confirmacoes_evento: 0,
        comparecimentos_evento: 0,
        score_engajamento_medio: 0,
        score_propensao_medio: 0,
        taxa_conversao_percentual: 0,
        meta_contatos_percentual: 0
      }
    ]
  );

  const periodSummaryResult = await queryOrDefault<CampaignPeriodSummary>(
    "campaign-period-summary",
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
        coalesce((select count(*)::int from lead_period where ${SUPPORT_INTENTION_SQL}), 0) as apoiadores_periodo,
        case
          when coalesce((select count(*) from lead_period), 0) = 0 then 0
          else round(
            (
              coalesce((select count(*) from lead_period where ${SUPPORT_INTENTION_SQL}), 0)::numeric /
              greatest((select count(*) from lead_period), 1)::numeric
            ) * 100,
            2
          )
        end as conversao_periodo_percentual
    `,
    [idCandidato, normalizedPeriodDays],
    [
      {
        periodo_dias: normalizedPeriodDays,
        novos_leads_periodo: 0,
        interacoes_periodo: 0,
        inbound_periodo: 0,
        outbound_periodo: 0,
        apoiadores_periodo: 0,
        conversao_periodo_percentual: 0
      }
    ]
  );

  const goalProgressResult = await queryOrDefault<CampaignGoalProgress>(
    "campaign-goals",
    `
      with eleitor_base as (
        select *
        from eleitores
        where id_candidato = $1
      )
      select
        coalesce($2::numeric, 0) as meta_contatos_whatsapp,
        coalesce((select count(*)::int from eleitor_base), 0) as base_total_atual,
        greatest(coalesce($2::numeric, 0) - coalesce((select count(*)::int from eleitor_base), 0), 0) as gap_contatos,
        case
          when coalesce($2::numeric, 0) = 0 then 0
          else round(
            (
              coalesce((select count(*)::int from eleitor_base), 0)::numeric /
              greatest($2::numeric, 1)
            ) * 100,
            2
          )
        end as realizado_contatos_percentual,
        coalesce($3::numeric, 0) as meta_conversao_votos,
        coalesce((select count(*)::int from eleitor_base where ${SUPPORT_INTENTION_SQL}), 0) as apoiadores_atuais,
        greatest(
          coalesce($3::numeric, 0) -
            coalesce((select count(*)::int from eleitor_base where ${SUPPORT_INTENTION_SQL}), 0),
          0
        ) as gap_conversao,
        case
          when coalesce($3::numeric, 0) = 0 then 0
          else round(
            (
              coalesce((select count(*)::int from eleitor_base where ${SUPPORT_INTENTION_SQL}), 0)::numeric /
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
    ],
    [
      {
        meta_contatos_whatsapp: Number(cabecalho.meta_contatos_whatsapp ?? 0),
        base_total_atual: 0,
        gap_contatos: Number(cabecalho.meta_contatos_whatsapp ?? 0),
        realizado_contatos_percentual: 0,
        meta_conversao_votos: Number(cabecalho.meta_conversao_votos ?? 0),
        apoiadores_atuais: 0,
        gap_conversao: Number(cabecalho.meta_conversao_votos ?? 0),
        realizado_conversao_percentual: 0
      }
    ]
  );

  const qualityResult = await queryOrDefault<CampaignDataQualitySummary>(
    "campaign-data-quality",
    `
      with eleitor_base as (
        select *
        from eleitores
        where id_candidato = $1
      ),
      duplicados_telefone as (
        select
          coalesce(sum(group_total), 0)::int as total
        from (
          select count(*)::int as group_total
          from eleitor_base
          where nullif(trim(coalesce(telefone, '')), '') is not null
          group by telefone
          having count(*) > 1
        ) grouped
      ),
      com_interacoes as (
        select count(distinct eleitor_uid)::int as total
        from interacoes
        where id_candidato = $1
      )
      select
        coalesce((select count(*)::int from eleitor_base), 0) as total_registros,
        coalesce((select count(*)::int from eleitor_base where nullif(trim(coalesce(nome, '')), '') is null), 0) as sem_nome,
        coalesce((select count(*)::int from eleitor_base where nullif(trim(coalesce(telefone, '')), '') is null), 0) as sem_telefone,
        ${
          hasElectorEmailColumn
            ? "coalesce((select count(*)::int from eleitor_base where nullif(trim(coalesce(email, '')), '') is null), 0)"
            : "0"
        } as sem_email,
        ${
          hasElectorUfColumn
            ? `coalesce((select count(*)::int from eleitor_base where nullif(trim(coalesce(uf, '')), '') is not null and upper(trim(uf)) not in (${VALID_BRAZILIAN_UF_SQL})), 0)`
            : "0"
        } as uf_invalidas,
        coalesce((select total from duplicados_telefone), 0) as duplicidades_telefone,
        greatest(
          coalesce((select count(*)::int from eleitor_base), 0) -
          coalesce((select total from com_interacoes), 0),
          0
        ) as sem_interacoes,
        coalesce((
          select count(*)::int
          from eleitor_base
          where coalesce(ultimo_contato_em, ultima_resposta_em, atualizado_em, criado_em) < now() - interval '30 days'
        ), 0) as sem_contato_30_dias,
        coalesce((select count(*)::int from eleitor_base where opt_out = true), 0) as opt_outs,
        case
          when coalesce((select count(*) from eleitor_base), 0) = 0 then 100
          else round(
            (
              (
                greatest(
                  (
                    coalesce((select count(*)::int from eleitor_base), 0) -
                    coalesce((select count(*)::int from eleitor_base where nullif(trim(coalesce(nome, '')), '') is null), 0)
                  )::numeric /
                  greatest((select count(*)::int from eleitor_base), 1)::numeric,
                  0
                )
              ) +
              (
                greatest(
                  (
                    coalesce((select count(*)::int from eleitor_base), 0) -
                    coalesce((select count(*)::int from eleitor_base where nullif(trim(coalesce(telefone, '')), '') is null), 0)
                  )::numeric /
                  greatest((select count(*)::int from eleitor_base), 1)::numeric,
                  0
                )
              ) +
              (
                greatest(
                  (
                    coalesce((select count(*)::int from eleitor_base), 0) -
                    coalesce((select total from duplicados_telefone), 0)
                  )::numeric /
                  greatest((select count(*)::int from eleitor_base), 1)::numeric,
                  0
                )
              ) +
              (
                greatest(
                  coalesce((select total from com_interacoes), 0)::numeric /
                  greatest((select count(*)::int from eleitor_base), 1)::numeric,
                  0
                )
              )
            ) / 4 * 100,
            2
          )
        end as confiabilidade_percentual,
        ${hasElectorEmailColumn ? "true" : "false"} as email_disponivel
    `,
    [idCandidato],
    [
      {
        total_registros: 0,
        sem_nome: 0,
        sem_telefone: 0,
        sem_email: 0,
        uf_invalidas: 0,
        duplicidades_telefone: 0,
        sem_interacoes: 0,
        sem_contato_30_dias: 0,
        opt_outs: 0,
        confiabilidade_percentual: 100,
        email_disponivel: hasElectorEmailColumn
      }
    ]
  );

  const funnelHealthResult = await queryOrDefault<CampaignFunnelHealthSummary>(
    "campaign-funnel-health",
    `
      with eleitor_base as (
        select *,
          coalesce(ultimo_contato_em, ultima_resposta_em, atualizado_em, criado_em) as referencia_contato
        from eleitores
        where id_candidato = $1
      )
      select
        count(*) filter (
          where etapa_funil = 'novo_lead'
            and referencia_contato < now() - interval '7 days'
        )::int as leads_sem_contato_7_dias,
        count(*) filter (
          where etapa_funil in ('qualificado', 'qualificado_quente')
            and referencia_contato < now() - interval '7 days'
        )::int as qualificados_sem_contato_7_dias,
        count(*) filter (
          where etapa_funil in ('engajado', 'relacionamento', 'nutricao', 'divulgador')
            and referencia_contato < now() - interval '14 days'
        )::int as engajados_sem_contato_14_dias,
        count(*) filter (
          where ${SUPPORT_INTENTION_SQL}
            and referencia_contato < now() - interval '21 days'
        )::int as apoiadores_sem_contato_21_dias,
        count(*) filter (
          where (
            etapa_funil = 'novo_lead' and referencia_contato < now() - interval '7 days'
          ) or (
            etapa_funil in ('qualificado', 'qualificado_quente') and referencia_contato < now() - interval '7 days'
          ) or (
            etapa_funil in ('engajado', 'relacionamento', 'nutricao', 'divulgador') and referencia_contato < now() - interval '14 days'
          ) or (
            ${SUPPORT_INTENTION_SQL} and referencia_contato < now() - interval '21 days'
          )
        )::int as leads_parados_total
      from eleitor_base
    `,
    [idCandidato],
    [
      {
        leads_sem_contato_7_dias: 0,
        qualificados_sem_contato_7_dias: 0,
        engajados_sem_contato_14_dias: 0,
        apoiadores_sem_contato_21_dias: 0,
        leads_parados_total: 0,
        semaforo_funil: "ok"
      }
    ]
  );

  const funilResult = await queryOrDefault<CampaignStageMetric>(
    "campaign-funnel",
    `
      select
        coalesce(etapa_funil, 'nao_classificado') as etapa_funil,
        count(*)::int as total
      from eleitores
      where id_candidato = $1
      group by coalesce(etapa_funil, 'nao_classificado')
      order by total desc, etapa_funil asc
    `,
    [idCandidato],
    []
  );

  const originsResult = await queryOrDefault<CampaignOriginMetric>(
    "campaign-origins",
    `
      select
        coalesce(origem_captacao, 'nao_informada') as origem_captacao,
        count(*)::int as total
      from eleitores
      where id_candidato = $1
      group by coalesce(origem_captacao, 'nao_informada')
      order by total desc, origem_captacao asc
    `,
    [idCandidato],
    []
  );

  const themesResult = await queryOrDefault<{ tema: string; total: number }>(
    "campaign-themes",
    `
      select
        tema,
        count(*)::int as total
      from (
        select ${CAMPAIGN_THEME_CLASSIFICATION_SQL} as tema
        from eleitores e
        left join lateral (
          select tema_classificado, mensagem, resposta_eleitor
          from interacoes
          where id_candidato = $1
            and eleitor_uid = e.eleitor_uid
          order by criado_em desc
          limit 1
        ) i on true
        cross join lateral (
          select
            lower(coalesce(nullif(i.tema_classificado, ''), nullif(e.tema_interesse, ''), 'nao_classificado')) as theme_raw,
            lower(replace(coalesce(nullif(i.tema_classificado, ''), nullif(e.tema_interesse, ''), 'nao_classificado'), '_', ' ')) as theme_key,
            lower(concat_ws(' ', i.mensagem, i.resposta_eleitor, e.tema_interesse)) as conversation_text
        ) normalized
        where e.id_candidato = $1
      ) themes
      group by tema
      order by total desc, tema asc
      limit 8
    `,
    [idCandidato],
    []
  );

  const allThemesResult = await queryOrDefault<CampaignOutsideThemeMetric>(
    "campaign-all-themes",
    `
      select
        tema,
        count(*)::int as total
      from (
        select ${CAMPAIGN_THEME_CLASSIFICATION_SQL} as tema
        from eleitores e
        left join lateral (
          select tema_classificado, mensagem, resposta_eleitor
          from interacoes
          where id_candidato = $1
            and eleitor_uid = e.eleitor_uid
          order by criado_em desc
          limit 1
        ) i on true
        cross join lateral (
          select
            lower(coalesce(nullif(i.tema_classificado, ''), nullif(e.tema_interesse, ''), 'nao_classificado')) as theme_raw,
            lower(replace(coalesce(nullif(i.tema_classificado, ''), nullif(e.tema_interesse, ''), 'nao_classificado'), '_', ' ')) as theme_key,
            lower(concat_ws(' ', i.mensagem, i.resposta_eleitor, e.tema_interesse)) as conversation_text
        ) normalized
        where e.id_candidato = $1
      ) themes
      group by tema
      order by total desc, tema asc
      limit 20
    `,
    [idCandidato],
    []
  );

  const platformTextResult = await queryOrDefault<{ plataforma_texto: string }>(
    "campaign-platform-text",
    `
      select concat_ws(
        ' ',
        c.perfil_markdown,
        c.dados_brutos::text,
        camp.configuracao::text
      ) as plataforma_texto
      from candidatos c
      left join campanhas camp
        on camp.id_candidato = c.id_candidato
      where c.id_candidato = $1
    `,
    [idCandidato],
    [{ plataforma_texto: "" }]
  );

  const temasForaPlataforma = buildOutsidePlatformThemes(
    allThemesResult.rows,
    platformTextResult.rows[0]?.plataforma_texto ?? ""
  );

  const regionalResult = await queryOrDefault<CampaignRegionalMetric>(
    "campaign-regional",
    `
      with eleitor_base as (
        select
          ${
            hasElectorUfColumn
              ? `case when upper(trim(coalesce(uf, ''))) in (${VALID_BRAZILIAN_UF_SQL}) then upper(trim(uf)) else null end`
              : "null"
          } as uf_resolvida,
          coalesce(nullif(trim(coalesce(cidade, '')), ''), 'Cidade nao informada') as cidade_resolvida,
          intencao_voto
        from eleitores
        where id_candidato = $1
      ),
      uf_totais as (
        select
          uf_resolvida,
          count(*)::int as total,
          count(*) filter (where ${SUPPORT_INTENTION_SQL})::int as apoiadores,
          count(distinct cidade_resolvida)::int as cidades_mapeadas
        from eleitor_base
        where uf_resolvida is not null
        group by uf_resolvida
      ),
      cidade_rank as (
        select
          uf_resolvida,
          cidade_resolvida,
          count(*)::int as total_cidade,
          row_number() over (
            partition by uf_resolvida
            order by count(*) desc, cidade_resolvida asc
          ) as rn
        from eleitor_base
        where uf_resolvida is not null
        group by uf_resolvida, cidade_resolvida
      )
      select
        uf_totais.uf_resolvida as uf,
        cidade_rank.cidade_resolvida as cidade_destaque,
        uf_totais.total as total,
        uf_totais.apoiadores as apoiadores,
        case
          when uf_totais.total = 0 then 0
          else round((coalesce(uf_totais.apoiadores, 0)::numeric / greatest(uf_totais.total, 1)::numeric) * 100, 2)
        end as taxa_conversao_percentual,
        uf_totais.cidades_mapeadas as cidades_mapeadas,
        coalesce(cidade_rank.total_cidade, 0) as total_cidade_destaque
      from uf_totais
      left join cidade_rank
        on cidade_rank.uf_resolvida = uf_totais.uf_resolvida
       and cidade_rank.rn = 1
      where uf_totais.total > 0
      order by uf_totais.total desc, uf_totais.uf_resolvida asc
    `,
    [idCandidato],
    []
  );

  const cityDistributionResult = await queryOrDefault<CampaignCityMetric>(
    "campaign-city-distribution",
    `
      select
        ${
          hasElectorUfColumn
            ? `case when upper(trim(coalesce(uf, ''))) in (${VALID_BRAZILIAN_UF_SQL}) then upper(trim(uf)) else 'UF_INVALIDA' end`
            : "'UF_INVALIDA'"
        } as uf,
        coalesce(nullif(trim(coalesce(cidade, '')), ''), 'Cidade nao informada') as cidade,
        count(*)::int as total
      from eleitores
      where id_candidato = $1
      group by 1, 2
      order by total desc, uf asc, cidade asc
      limit 120
    `,
    [idCandidato],
    []
  );

  const groupDistributionResult = await queryOrDefault<CampaignGroupMetric>(
    "campaign-group-distribution",
    `
      select
        ${
          hasElectorGroupColumn
            ? "coalesce(nullif(trim(coalesce(grupo_interesse, '')), ''), 'Grupo nao informado')"
            : "'Grupo nao informado'"
        } as grupo,
        count(*)::int as total
      from eleitores
      where id_candidato = $1
      group by 1
      order by total desc, grupo asc
      limit 40
    `,
    [idCandidato],
    []
  );

  const importReportResult = await queryOrDefault<CampaignImportReportRow>(
    "campaign-import-report",
    `
      select
        status,
        descricao,
        criado_em::text as criado_em,
        coalesce((detalhes->>'importados')::int, 0) as importados,
        coalesce((detalhes->>'atualizados')::int, 0) as atualizados,
        coalesce((detalhes->>'ignorados')::int, 0) as ignorados,
        coalesce(detalhes->'ignorados_por_motivo', '{}'::jsonb) as ignorados_por_motivo
      from governanca_auditoria
      where id_candidato = $1
        and categoria = 'importacao_base'
      order by criado_em desc
      limit 1
    `,
    [idCandidato],
    []
  );

  const dailyResult = await queryOrDefault<CampaignDailyMetric>(
    "campaign-daily",
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
    [idCandidato],
    buildEmptyDailySeries()
  );

  const growthResult = await queryOrDefault<CampaignBaseGrowthPoint>(
    "campaign-growth",
    `
      with limites as (
        select
          coalesce(
            date_trunc('day', camp.criado_em)::date,
            date_trunc('day', min(e.criado_em))::date,
            current_date
          ) as inicio,
          current_date as fim
        from candidatos c
        left join campanhas camp
          on camp.id_candidato = c.id_candidato
        left join eleitores e
          on e.id_candidato = c.id_candidato
        where c.id_candidato = $1
        group by camp.criado_em
      ),
      dias as (
        select generate_series(limites.inicio, limites.fim, interval '1 day')::date as ref
        from limites
      ),
      base_dia as (
        select
          date_trunc('day', criado_em)::date as ref,
          count(*)::int as total
        from eleitores
        where id_candidato = $1
        group by 1
      )
      select
        dias.ref::text as data_referencia,
        coalesce(sum(base_dia.total) over (order by dias.ref rows between unbounded preceding and current row), 0)::int as total_acumulado
      from dias
      left join base_dia
        on base_dia.ref = dias.ref
      order by dias.ref
    `,
    [idCandidato],
    buildEmptyGrowthSeries()
  );

  const recentConversationsResult = await queryOrDefault<CampaignRecentConversation>(
    "campaign-recent-conversations",
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
        ${ELECTOR_CONVERSATION_STAGE_SQL},
        e.sentimento,
        ${ELECTOR_CONVERSATION_INTENTION_SQL},
        e.score_engajamento,
        e.score_propensao_voto,
        e.ultimo_contato_em::text as ultimo_contato_em,
        ir.canal as canal_ultimo_contato,
        ir.direcao as direcao_ultimo_contato,
        case
          when ir.direcao = 'inbound' then coalesce(nullif(ir.resposta_eleitor, ''), nullif(ir.mensagem, ''))
          else coalesce(nullif(ir.mensagem, ''), nullif(ir.resposta_eleitor, ''))
        end as ultima_mensagem,
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
    [idCandidato],
    []
  );

  const saudeFunil = withFunnelHealthSemaphore(funnelHealthResult.rows[0]);
  const alertas = buildCampaignOperationalAlerts(qualityResult.rows[0], saudeFunil);
  const equipeDivulgacao = await getOutreachIntelligenceSnapshot(idCandidato);

  return {
    cabecalho,
    resumo: summaryResult.rows[0],
    resumoPeriodo: periodSummaryResult.rows[0],
    metas: goalProgressResult.rows[0],
    qualidade: qualityResult.rows[0],
    saudeFunil,
    alertas,
    periodoSelecionadoDias: normalizedPeriodDays,
    funil: funilResult.rows,
    origens: originsResult.rows,
    temas: themesResult.rows,
    temasForaPlataforma,
    distribuicaoRegional: regionalResult.rows,
    distribuicaoCidades: cityDistributionResult.rows,
    distribuicaoGrupos: groupDistributionResult.rows,
    relatorioImportacao: buildImportReportSummary(importReportResult.rows[0]),
    evolucaoDiaria: dailyResult.rows,
    crescimentoBase: growthResult.rows,
    conversasRecentes: recentConversationsResult.rows,
    equipeDivulgacao
  };
}


function buildImportReportSummary(
  row: CampaignImportReportRow | undefined
): CampaignImportReportSummary | null {
  if (!row) {
    return null;
  }

  const reasons = Object.entries(row.ignorados_por_motivo ?? {})
    .filter(([, total]) => Number(total) > 0)
    .map(([motivo, total]) => ({
      motivo,
      total: Number(total)
    }));

  return {
    status: row.status,
    descricao: row.descricao,
    criado_em: row.criado_em,
    importados: Number(row.importados ?? 0),
    atualizados: Number(row.atualizados ?? 0),
    ignorados: Number(row.ignorados ?? 0),
    total_processado:
      Number(row.importados ?? 0) + Number(row.atualizados ?? 0) + Number(row.ignorados ?? 0),
    motivos_ignorados: reasons
  };
}

function withFunnelHealthSemaphore(
  summary: CampaignFunnelHealthSummary
): CampaignFunnelHealthSummary {
  let semaforo: CampaignFunnelHealthSummary["semaforo_funil"] = "ok";

  if (summary.leads_parados_total >= 25 || summary.qualificados_sem_contato_7_dias >= 10) {
    semaforo = "error";
  } else if (summary.leads_parados_total >= 10 || summary.engajados_sem_contato_14_dias >= 5) {
    semaforo = "warning";
  }

  return {
    ...summary,
    semaforo_funil: semaforo
  };
}

function buildCampaignOperationalAlerts(
  qualidade: CampaignDataQualitySummary,
  saudeFunil: CampaignFunnelHealthSummary
): CampaignOperationalAlert[] {
  const alerts: CampaignOperationalAlert[] = [];

  if (saudeFunil.leads_parados_total > 0) {
    alerts.push({
      codigo: "funil_estagnado",
      titulo: "Leads parados no funil",
      descricao: "Há eleitores sem contato recente nas etapas mais sensíveis do funil.",
      criticidade: saudeFunil.semaforo_funil,
      total: saudeFunil.leads_parados_total
    });
  }

  if (qualidade.duplicidades_telefone > 0) {
    alerts.push({
      codigo: "telefone_duplicado",
      titulo: "Telefones duplicados",
      descricao: "Há risco de fragmentação do eleitor e distorção do KPI do funil.",
      criticidade: qualidade.duplicidades_telefone >= 5 ? "error" : "warning",
      total: qualidade.duplicidades_telefone
    });
  }

  if (qualidade.uf_invalidas > 0) {
    alerts.push({
      codigo: "uf_invalida",
      titulo: "UF fora do padrão brasileiro",
      descricao: "Há registros com unidade da federação diferente das 27 siglas oficiais do Brasil.",
      criticidade: qualidade.uf_invalidas >= 5 ? "error" : "warning",
      total: qualidade.uf_invalidas
    });
  }

  if (qualidade.sem_interacoes > 0) {
    alerts.push({
      codigo: "sem_interacoes",
      titulo: "Base sem interação",
      descricao: "Parte da base ainda não foi validada por conversa real.",
      criticidade: qualidade.sem_interacoes >= 20 ? "error" : "warning",
      total: qualidade.sem_interacoes
    });
  }

  if (qualidade.sem_telefone > 0 || qualidade.sem_nome > 0) {
    alerts.push({
      codigo: "cadastro_incompleto",
      titulo: "Cadastro incompleto",
      descricao: "Há registros sem nome ou telefone, comprometendo acionamento e personalização.",
      criticidade: qualidade.sem_telefone > 0 ? "error" : "warning",
      total: qualidade.sem_telefone + qualidade.sem_nome
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      codigo: "operacao_estavel",
      titulo: "Operação estável",
      descricao: "Não há alertas críticos no ciclo do funil neste momento.",
      criticidade: "ok",
      total: 0
    });
  }

  return alerts;
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
        ic.status_implantacao,
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

  const conversationsResult = await queryOrDefault<CampaignRecentConversation>(
    "conversation-explorer-list",
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
        ${ELECTOR_CONVERSATION_STAGE_SQL},
        e.sentimento,
        ${ELECTOR_CONVERSATION_INTENTION_SQL},
        e.score_engajamento,
        e.score_propensao_voto,
        e.ultimo_contato_em::text as ultimo_contato_em,
        ir.canal as canal_ultimo_contato,
        ir.direcao as direcao_ultimo_contato,
        case
          when ir.direcao = 'inbound' then coalesce(nullif(ir.resposta_eleitor, ''), nullif(ir.mensagem, ''))
          else coalesce(nullif(ir.mensagem, ''), nullif(ir.resposta_eleitor, ''))
        end as ultima_mensagem,
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
    values,
    []
  );

  const selectedUid =
    String(filters?.eleitorUid ?? "").trim() || conversationsResult.rows[0]?.eleitor_uid || "";

  const selectedSummary =
    conversationsResult.rows.find((item) => item.eleitor_uid === selectedUid) ?? null;

  const timelineResult = selectedUid
    ? await queryOrDefault<CampaignConversationTimelineItem>(
        "conversation-explorer-timeline",
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
        [idCandidato, selectedUid],
        []
      )
    : { rows: [] as CampaignConversationTimelineItem[] };

  const etapaOptions = await queryOrDefault<{ valor: string }>(
    "conversation-explorer-stage-options",
    `
      select distinct coalesce(etapa_funil, 'nao_classificado') as valor
      from eleitores
      where id_candidato = $1
      order by valor
    `,
    [idCandidato],
    []
  );

  const origemOptions = await queryOrDefault<{ valor: string }>(
    "conversation-explorer-origin-options",
    `
      select distinct coalesce(origem_captacao, 'nao_informada') as valor
      from eleitores
      where id_candidato = $1
      order by valor
    `,
    [idCandidato],
    []
  );

  const sentimentoOptions = await queryOrDefault<{ valor: string }>(
    "conversation-explorer-sentiment-options",
    `
      select distinct coalesce(sentimento, 'nao_classificado') as valor
      from eleitores
      where id_candidato = $1
      order by valor
    `,
    [idCandidato],
    []
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
  const hasElectorEmailColumn = await hasTableColumn("eleitores", "email");
  const campaignRows = await db.query<AdminCampaignStatItem>(
    `
      with eleitor_stats as (
        select
          id_candidato,
          count(*)::int as total_eleitores,
          count(*) filter (where etapa_funil in ('engajado', 'relacionamento', 'nutricao', 'divulgador'))::int as leads_engajados,
          count(*) filter (where ${SUPPORT_INTENTION_SQL})::int as apoiadores,
          count(*) filter (where nullif(trim(coalesce(nome, '')), '') is null)::int as sem_nome,
          count(*) filter (where nullif(trim(coalesce(telefone, '')), '') is null)::int as sem_telefone,
          ${
            hasElectorEmailColumn
              ? "count(*) filter (where nullif(trim(coalesce(email, '')), '') is null)::int"
              : "0::int"
          } as sem_email,
          count(*) filter (
            where coalesce(ultimo_contato_em, ultima_resposta_em, atualizado_em, criado_em) < now() - interval '30 days'
          )::int as sem_contato_30_dias,
          coalesce(round(avg(score_engajamento)::numeric, 2), 0) as score_engajamento_medio
        from eleitores
        group by id_candidato
      ),
      telefone_duplicates as (
        select
          id_candidato,
          coalesce(sum(group_total), 0)::int as duplicidades_telefone
        from (
          select
            id_candidato,
            telefone,
            count(*)::int as group_total
          from eleitores
          where nullif(trim(coalesce(telefone, '')), '') is not null
          group by id_candidato, telefone
          having count(*) > 1
        ) grouped
        group by id_candidato
      ),
      interaction_stats as (
        select
          id_candidato,
          count(*)::int as interacoes_total,
          count(*) filter (where criado_em >= now() - interval '24 hours')::int as interacoes_24h,
          count(distinct eleitor_uid)::int as eleitores_com_interacao
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
        coalesce(es.score_engajamento_medio, 0) as score_engajamento_medio,
        coalesce(es.sem_nome, 0) as sem_nome,
        coalesce(es.sem_telefone, 0) as sem_telefone,
        coalesce(es.sem_email, 0) as sem_email,
        coalesce(td.duplicidades_telefone, 0) as duplicidades_telefone,
        greatest(coalesce(es.total_eleitores, 0) - coalesce(is2.eleitores_com_interacao, 0), 0) as sem_interacoes,
        coalesce(es.sem_contato_30_dias, 0) as sem_contato_30_dias,
        case
          when coalesce(es.total_eleitores, 0) = 0 then 100
          else round(
            (
              (
                greatest((coalesce(es.total_eleitores, 0) - coalesce(es.sem_nome, 0))::numeric / greatest(es.total_eleitores, 1)::numeric, 0)
              ) +
              (
                greatest((coalesce(es.total_eleitores, 0) - coalesce(es.sem_telefone, 0))::numeric / greatest(es.total_eleitores, 1)::numeric, 0)
              ) +
              (
                greatest((coalesce(es.total_eleitores, 0) - coalesce(td.duplicidades_telefone, 0))::numeric / greatest(es.total_eleitores, 1)::numeric, 0)
              ) +
              (
                greatest(coalesce(is2.eleitores_com_interacao, 0)::numeric / greatest(es.total_eleitores, 1)::numeric, 0)
              )
            ) / 4 * 100,
            2
          )
        end as confiabilidade_percentual
      from candidatos c
      left join campanhas camp
        on camp.id_candidato = c.id_candidato
      left join eleitor_stats es
        on es.id_candidato = c.id_candidato
      left join telefone_duplicates td
        on td.id_candidato = c.id_candidato
      left join interaction_stats is2
        on is2.id_candidato = c.id_candidato
      where c.nome_urna is not null
        and btrim(c.nome_urna) <> ''
      order by
        coalesce(is2.interacoes_24h, 0) desc,
        lower(coalesce(nullif(btrim(c.nome_urna), ''), c.nome_completo, c.id_candidato)),
        c.id_candidato
    `
  );

  const totals = campaignRows.rows.reduce(
    (acc, campaign) => {
      acc.campanhas += 1;
      acc.eleitores += campaign.total_eleitores;
      acc.interacoes += campaign.interacoes_total;
      acc.apoiadores += campaign.apoiadores;
      acc.interacoes_24h += campaign.interacoes_24h;
      acc.registros_sem_nome += campaign.sem_nome;
      acc.registros_sem_telefone += campaign.sem_telefone;
      acc.registros_sem_email += campaign.sem_email;
      acc.duplicidades_telefone += campaign.duplicidades_telefone;
      acc.registros_sem_interacoes += campaign.sem_interacoes;
      acc.registros_sem_contato_30_dias += campaign.sem_contato_30_dias;
      acc.confiabilidade_soma += Number(campaign.confiabilidade_percentual);
      return acc;
    },
    {
      campanhas: 0,
      eleitores: 0,
      interacoes: 0,
      apoiadores: 0,
      interacoes_24h: 0,
      registros_sem_nome: 0,
      registros_sem_telefone: 0,
      registros_sem_email: 0,
      duplicidades_telefone: 0,
      registros_sem_interacoes: 0,
      registros_sem_contato_30_dias: 0,
      confiabilidade_soma: 0
    }
  );

  const rankings = {
    conversao: buildRanking(campaignRows.rows, "taxa_conversao_percentual", "conversao"),
    atividade_24h: buildRanking(campaignRows.rows, "interacoes_24h", "interacoes em 24h"),
    cobertura_meta: buildRanking(campaignRows.rows, "meta_contatos_percentual", "cobertura da meta"),
    confiabilidade: buildRanking(campaignRows.rows, "confiabilidade_percentual", "confiabilidade")
  };

  const funnelRows = await queryOrDefault<AdminCampaignStageMetric>(
    "admin-campaign-funnel-total",
    `
      select
        coalesce(etapa_funil, 'nao_classificado') as etapa_funil,
        count(*)::int as total
      from eleitores
      group by coalesce(etapa_funil, 'nao_classificado')
      order by total desc, etapa_funil asc
    `,
    [],
    []
  );

  const growthRows = await queryOrDefault<AdminCampaignGrowthPoint>(
    "admin-campaign-growth-total",
    `
      with limites as (
        select
          coalesce(date_trunc('day', min(criado_em))::date, current_date) as inicio,
          current_date as fim
        from eleitores
      ),
      dias as (
        select generate_series(limites.inicio, limites.fim, interval '1 day')::date as ref
        from limites
      ),
      base_dia as (
        select date_trunc('day', criado_em)::date as ref, count(*)::int as total
        from eleitores
        group by 1
      )
      select
        dias.ref::text as data_referencia,
        coalesce(sum(base_dia.total) over (order by dias.ref rows between unbounded preceding and current row), 0)::int as total_acumulado
      from dias
      left join base_dia
        on base_dia.ref = dias.ref
      order by dias.ref
    `,
    [],
    buildEmptyGrowthSeries()
  );

  return {
    totais: {
      campanhas: totals.campanhas,
      eleitores: totals.eleitores,
      interacoes: totals.interacoes,
      apoiadores: totals.apoiadores,
      interacoes_24h: totals.interacoes_24h,
      registros_sem_nome: totals.registros_sem_nome,
      registros_sem_telefone: totals.registros_sem_telefone,
      registros_sem_email: totals.registros_sem_email,
      duplicidades_telefone: totals.duplicidades_telefone,
      registros_sem_interacoes: totals.registros_sem_interacoes,
      registros_sem_contato_30_dias: totals.registros_sem_contato_30_dias,
      confiabilidade_media_percentual:
        totals.campanhas === 0 ? 100 : Number((totals.confiabilidade_soma / totals.campanhas).toFixed(2)),
      email_disponivel: hasElectorEmailColumn
    },
    campanhas: campaignRows.rows,
    funilTotal: funnelRows.rows,
    crescimentoBase: growthRows.rows,
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

async function queryOrDefault<T extends QueryResultRow>(
  label: string,
  query: string,
  values: unknown[],
  fallbackRows: T[]
) {
  try {
    return await db.query<T>(query, values);
  } catch (error) {
    console.error(`[campaign-analytics:${label}]`, error);
    return { rows: fallbackRows } as { rows: T[] };
  }
}

function buildEmptyDailySeries(): CampaignDailyMetric[] {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (13 - index));

    return {
      data_referencia: formatter.format(date),
      novos_leads: 0,
      interacoes: 0
    };
  });
}

function buildEmptyGrowthSeries(): CampaignBaseGrowthPoint[] {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  const date = new Date();

  return [
    {
      data_referencia: formatter.format(date),
      total_acumulado: 0
    }
  ];
}

function buildRanking(
  campaigns: AdminCampaignStatItem[],
  field:
    | "taxa_conversao_percentual"
    | "interacoes_24h"
    | "meta_contatos_percentual"
    | "confiabilidade_percentual",
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

function buildOutsidePlatformThemes(
  themes: CampaignOutsideThemeMetric[],
  platformText: string
) {
  const normalizedPlatformText = normalizeComparableText(platformText);

  if (!normalizedPlatformText) {
    return [];
  }

  return themes
    .filter((theme) => {
      const normalizedTheme = normalizeComparableText(theme.tema);

      if (!normalizedTheme || normalizedTheme === "geral" || normalizedTheme === "nao classificado") {
        return false;
      }

      return !normalizedPlatformText.includes(normalizedTheme);
    })
    .slice(0, 8);
}

function normalizeComparableText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function hasTableColumn(tableName: string, columnName: string) {
  try {
    const result = await db.query<{ exists: boolean }>(
      `
        select exists(
          select 1
          from information_schema.columns
          where table_schema = 'public'
            and table_name = $1
            and column_name = $2
        ) as exists
      `,
      [tableName, columnName]
    );

    return result.rows[0]?.exists ?? false;
  } catch (error) {
    console.error("[campaign-analytics:has-column]", error);
    return false;
  }
}
