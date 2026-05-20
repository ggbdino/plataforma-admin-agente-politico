import { db } from "@/lib/db";

type FunnelRecalculationSummary = {
  eleitores_processados: number;
  eleitores_atualizados: number;
  etapa_recalculada: number;
  intencao_recalculada: number;
  sentimento_recalculado: number;
  score_engajamento_recalculado: number;
  score_propensao_recalculado: number;
};

type ElectorCycleRow = {
  eleitor_uid: string;
  etapa_funil: string | null;
  intencao_voto: string | null;
  sentimento: string | null;
  score_engajamento: number | null;
  score_propensao_voto: number | null;
  opt_out: boolean | null;
  total_interacoes: number;
  inbound_total: number;
  outbound_total: number;
  ultimo_sentimento: string | null;
  ultima_intencao: string | null;
  ultimo_tema: string | null;
  ultima_etapa_sugerida: string | null;
  ultima_interacao_em: string | null;
  confirmacoes_evento: number;
  comparecimentos_evento: number;
};

type CycleInference = {
  etapa_funil: string;
  intencao_voto: string | null;
  sentimento: string | null;
  score_engajamento: number;
  score_propensao_voto: number;
  tema_interesse: string | null;
  ultimo_contato_em: string | null;
};

export async function recalculateCampaignFunnelCycle(
  idCandidato: string
): Promise<FunnelRecalculationSummary> {
  const electorRows = await db.query<ElectorCycleRow>(
    `
      with interaction_stats as (
        select
          i.eleitor_uid,
          count(*)::int as total_interacoes,
          count(*) filter (where i.direcao = 'inbound')::int as inbound_total,
          count(*) filter (where i.direcao = 'outbound')::int as outbound_total,
          max(i.criado_em)::text as ultima_interacao_em
        from interacoes i
        where i.id_candidato = $1
        group by i.eleitor_uid
      ),
      latest_interaction as (
        select distinct on (i.eleitor_uid)
          i.eleitor_uid,
          i.sentimento as ultimo_sentimento,
          i.intencao_voto as ultima_intencao,
          i.tema_classificado as ultimo_tema,
          i.etapa_sugerida as ultima_etapa_sugerida
        from interacoes i
        where i.id_candidato = $1
        order by i.eleitor_uid, i.criado_em desc
      ),
      event_stats as (
        select
          p.eleitor_uid,
          count(*) filter (where p.status_participacao in ('confirmado', 'confirmada'))::int as confirmacoes_evento,
          count(*) filter (where p.status_participacao in ('presente', 'compareceu'))::int as comparecimentos_evento
        from participacoes_eventos p
        where p.id_candidato = $1
        group by p.eleitor_uid
      )
      select
        e.eleitor_uid,
        e.etapa_funil,
        e.intencao_voto,
        e.sentimento,
        e.score_engajamento,
        e.score_propensao_voto,
        e.opt_out,
        coalesce(stats.total_interacoes, 0) as total_interacoes,
        coalesce(stats.inbound_total, 0) as inbound_total,
        coalesce(stats.outbound_total, 0) as outbound_total,
        latest.ultimo_sentimento,
        latest.ultima_intencao,
        latest.ultimo_tema,
        latest.ultima_etapa_sugerida,
        stats.ultima_interacao_em,
        coalesce(events.confirmacoes_evento, 0) as confirmacoes_evento,
        coalesce(events.comparecimentos_evento, 0) as comparecimentos_evento
      from eleitores e
      left join interaction_stats stats
        on stats.eleitor_uid = e.eleitor_uid
      left join latest_interaction latest
        on latest.eleitor_uid = e.eleitor_uid
      left join event_stats events
        on events.eleitor_uid = e.eleitor_uid
      where e.id_candidato = $1
    `,
    [idCandidato]
  );

  if (electorRows.rows.length === 0) {
    return {
      eleitores_processados: 0,
      eleitores_atualizados: 0,
      etapa_recalculada: 0,
      intencao_recalculada: 0,
      sentimento_recalculado: 0,
      score_engajamento_recalculado: 0,
      score_propensao_recalculado: 0
    };
  }

  const client = await db.connect();

  try {
    await client.query("begin");

    let eleitoresAtualizados = 0;
    let etapaRecalculada = 0;
    let intencaoRecalculada = 0;
    let sentimentoRecalculado = 0;
    let scoreEngajamentoRecalculado = 0;
    let scorePropensaoRecalculado = 0;

    for (const row of electorRows.rows) {
      const next = inferFunnelCycle(row);

      const stageChanged = normalizeNullable(row.etapa_funil) !== normalizeNullable(next.etapa_funil);
      const intentionChanged =
        normalizeNullable(row.intencao_voto) !== normalizeNullable(next.intencao_voto);
      const sentimentChanged =
        normalizeNullable(row.sentimento) !== normalizeNullable(next.sentimento);
      const engagementChanged = Number(row.score_engajamento ?? 0) !== Number(next.score_engajamento);
      const propensityChanged =
        Number(row.score_propensao_voto ?? 0) !== Number(next.score_propensao_voto);

      if (
        !stageChanged &&
        !intentionChanged &&
        !sentimentChanged &&
        !engagementChanged &&
        !propensityChanged &&
        normalizeNullable(next.tema_interesse) === null &&
        normalizeNullable(next.ultimo_contato_em) === normalizeNullable(row.ultima_interacao_em)
      ) {
        continue;
      }

      await client.query(
        `
          update eleitores
          set
            etapa_funil = $2,
            intencao_voto = $3,
            sentimento = $4,
            score_engajamento = $5,
            score_propensao_voto = $6,
            tema_interesse = coalesce($7, tema_interesse),
            ultimo_contato_em = coalesce($8::timestamptz, ultimo_contato_em),
            atualizado_em = now()
          where eleitor_uid = $1
        `,
        [
          row.eleitor_uid,
          next.etapa_funil,
          next.intencao_voto,
          next.sentimento,
          next.score_engajamento,
          next.score_propensao_voto,
          next.tema_interesse,
          next.ultimo_contato_em
        ]
      );

      eleitoresAtualizados += 1;
      if (stageChanged) etapaRecalculada += 1;
      if (intentionChanged) intencaoRecalculada += 1;
      if (sentimentChanged) sentimentoRecalculado += 1;
      if (engagementChanged) scoreEngajamentoRecalculado += 1;
      if (propensityChanged) scorePropensaoRecalculado += 1;
    }

    await client.query("commit");

    return {
      eleitores_processados: electorRows.rows.length,
      eleitores_atualizados: eleitoresAtualizados,
      etapa_recalculada: etapaRecalculada,
      intencao_recalculada: intencaoRecalculada,
      sentimento_recalculado: sentimentoRecalculado,
      score_engajamento_recalculado: scoreEngajamentoRecalculado,
      score_propensao_recalculado: scorePropensaoRecalculado
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

function inferFunnelCycle(row: ElectorCycleRow): CycleInference {
  const sentiment = normalizeNullable(row.ultimo_sentimento) ?? normalizeNullable(row.sentimento);
  const intention = inferIntention(row);
  const engagement = inferEngagementScore(row, sentiment, intention);
  const propensity = inferPropensityScore(row, sentiment, intention);

  return {
    etapa_funil: inferStage(row, engagement, propensity, intention),
    intencao_voto: intention,
    sentimento: sentiment,
    score_engajamento: engagement,
    score_propensao_voto: propensity,
    tema_interesse: normalizeNullable(row.ultimo_tema),
    ultimo_contato_em: normalizeNullable(row.ultima_interacao_em)
  };
}

function inferIntention(row: ElectorCycleRow) {
  const latest = normalizeNullable(row.ultima_intencao);

  if (latest) {
    return latest;
  }

  if (row.comparecimentos_evento > 0 || row.confirmacoes_evento > 0) {
    return "engajado";
  }

  return normalizeNullable(row.intencao_voto);
}

function inferEngagementScore(
  row: ElectorCycleRow,
  sentiment: string | null,
  intention: string | null
) {
  let score = 0;

  score += Math.min(row.total_interacoes * 12, 48);
  score += Math.min(row.inbound_total * 8, 24);
  score += Math.min(row.comparecimentos_evento * 20, 20);
  score += Math.min(row.confirmacoes_evento * 10, 10);

  if (sentiment === "positivo") score += 10;
  if (sentiment === "negativo") score -= 8;

  if (intention === "apoiador") score += 10;
  if (intention === "indeciso") score += 4;
  if (intention === "rejeicao" || intention === "opositor") score -= 12;

  if (row.opt_out) score = 0;

  return clampScore(score);
}

function inferPropensityScore(
  row: ElectorCycleRow,
  sentiment: string | null,
  intention: string | null
) {
  let score = 10;

  if (intention === "apoiador") score += 55;
  else if (intention === "engajado") score += 40;
  else if (intention === "indeciso") score += 25;
  else if (intention === "rejeicao" || intention === "opositor") score -= 25;

  if (sentiment === "positivo") score += 15;
  if (sentiment === "neutro") score += 5;
  if (sentiment === "negativo") score -= 15;

  score += Math.min(row.inbound_total * 4, 12);
  score += Math.min(row.comparecimentos_evento * 12, 12);
  score += Math.min(row.confirmacoes_evento * 6, 6);

  if (row.opt_out) score = 0;

  return clampScore(score);
}

function inferStage(
  row: ElectorCycleRow,
  engagement: number,
  propensity: number,
  intention: string | null
) {
  if (row.opt_out) {
    return "opt_out";
  }

  const suggested = normalizeNullable(row.ultima_etapa_sugerida);

  if (intention === "apoiador" || propensity >= 80) {
    return "engajado";
  }

  if (row.comparecimentos_evento > 0 || row.confirmacoes_evento > 0 || engagement >= 70) {
    return "relacionamento";
  }

  if (suggested === "engajado" || suggested === "relacionamento" || suggested === "nutricao") {
    return suggested;
  }

  if (row.inbound_total >= 2 || row.total_interacoes >= 3 || propensity >= 55) {
    return "qualificado_quente";
  }

  if (row.total_interacoes >= 1 || suggested === "qualificado" || suggested === "qualificado_quente") {
    return "qualificado";
  }

  return "novo_lead";
}

function normalizeNullable(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
