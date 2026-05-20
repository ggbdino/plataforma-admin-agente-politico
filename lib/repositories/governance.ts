import { db } from "@/lib/db";
import type {
  AdminGovernanceCampaignItem,
  AdminGovernanceSnapshot,
  CampaignGovernanceSnapshot,
  GovernanceAuditItem
} from "@/lib/types";

type GovernanceEventInput = {
  idCandidato?: string | null;
  escopo: "campanha" | "admin" | "sistema";
  ator: string;
  categoria: string;
  acao: string;
  descricao: string;
  status: "sucesso" | "erro" | "aviso";
  origem?: string | null;
  detalhes?: Record<string, unknown> | null;
};

let governanceTableReady = false;

export async function recordGovernanceEvent(input: GovernanceEventInput) {
  await ensureGovernanceTable();

  await db.query(
    `
      insert into governanca_auditoria (
        id,
        id_candidato,
        escopo,
        ator,
        categoria,
        acao,
        descricao,
        status,
        origem,
        detalhes,
        criado_em
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, now())
    `,
    [
      crypto.randomUUID(),
      input.idCandidato ?? null,
      input.escopo,
      input.ator,
      input.categoria,
      input.acao,
      input.descricao,
      input.status,
      input.origem ?? null,
      input.detalhes ? JSON.stringify(input.detalhes) : null
    ]
  );
}

export async function getCampaignGovernanceSnapshot(
  idCandidato: string
): Promise<CampaignGovernanceSnapshot> {
  await ensureGovernanceTable();

  const totalsResult = await db.query<{
    total_acoes: number;
    acoes_sucesso_7_dias: number;
    erros_30_dias: number;
    importacoes_30_dias: number;
    exportacoes_30_dias: number;
    recalculos_30_dias: number;
  }>(
    `
      select
        count(*)::int as total_acoes,
        count(*) filter (
          where status = 'sucesso'
            and criado_em >= now() - interval '7 days'
        )::int as acoes_sucesso_7_dias,
        count(*) filter (
          where status = 'erro'
            and criado_em >= now() - interval '30 days'
        )::int as erros_30_dias,
        count(*) filter (
          where categoria = 'importacao_base'
            and criado_em >= now() - interval '30 days'
        )::int as importacoes_30_dias,
        count(*) filter (
          where categoria = 'exportacao'
            and criado_em >= now() - interval '30 days'
        )::int as exportacoes_30_dias,
        count(*) filter (
          where categoria = 'recalculo_funil'
            and criado_em >= now() - interval '30 days'
        )::int as recalculos_30_dias
      from governanca_auditoria
      where id_candidato = $1
    `,
    [idCandidato]
  );

  const recentResult = await db.query<GovernanceAuditItem>(
    `
      select
        g.id,
        g.id_candidato,
        c.nome_urna,
        g.escopo,
        g.ator,
        g.categoria,
        g.acao,
        g.descricao,
        g.status,
        g.origem,
        g.criado_em::text as criado_em
      from governanca_auditoria g
      left join candidatos c
        on c.id_candidato = g.id_candidato
      where g.id_candidato = $1
      order by g.criado_em desc
      limit 8
    `,
    [idCandidato]
  );

  return {
    totais: totalsResult.rows[0] ?? {
      total_acoes: 0,
      acoes_sucesso_7_dias: 0,
      erros_30_dias: 0,
      importacoes_30_dias: 0,
      exportacoes_30_dias: 0,
      recalculos_30_dias: 0
    },
    recentes: recentResult.rows
  };
}

export async function getAdminGovernanceSnapshot(): Promise<AdminGovernanceSnapshot> {
  await ensureGovernanceTable();

  const totalsResult = await db.query<{
    campanhas_auditadas: number;
    acoes_7_dias: number;
    erros_7_dias: number;
    importacoes_30_dias: number;
    exportacoes_30_dias: number;
    recalculos_30_dias: number;
  }>(
    `
      select
        count(distinct id_candidato)::int as campanhas_auditadas,
        count(*) filter (
          where criado_em >= now() - interval '7 days'
        )::int as acoes_7_dias,
        count(*) filter (
          where status = 'erro'
            and criado_em >= now() - interval '7 days'
        )::int as erros_7_dias,
        count(*) filter (
          where categoria = 'importacao_base'
            and criado_em >= now() - interval '30 days'
        )::int as importacoes_30_dias,
        count(*) filter (
          where categoria = 'exportacao'
            and criado_em >= now() - interval '30 days'
        )::int as exportacoes_30_dias,
        count(*) filter (
          where categoria = 'recalculo_funil'
            and criado_em >= now() - interval '30 days'
        )::int as recalculos_30_dias
      from governanca_auditoria
    `
  );

  const campaignResult = await db.query<{
    id_candidato: string;
    nome_urna: string | null;
    total_acoes: number;
    erros_30_dias: number;
    importacoes_30_dias: number;
    exportacoes_30_dias: number;
    recalculos_30_dias: number;
    ultimo_evento_em: string | null;
  }>(
    `
      select
        g.id_candidato,
        max(c.nome_urna) as nome_urna,
        count(*)::int as total_acoes,
        count(*) filter (
          where g.status = 'erro'
            and g.criado_em >= now() - interval '30 days'
        )::int as erros_30_dias,
        count(*) filter (
          where g.categoria = 'importacao_base'
            and g.criado_em >= now() - interval '30 days'
        )::int as importacoes_30_dias,
        count(*) filter (
          where g.categoria = 'exportacao'
            and g.criado_em >= now() - interval '30 days'
        )::int as exportacoes_30_dias,
        count(*) filter (
          where g.categoria = 'recalculo_funil'
            and g.criado_em >= now() - interval '30 days'
        )::int as recalculos_30_dias,
        max(g.criado_em)::text as ultimo_evento_em
      from governanca_auditoria g
      left join candidatos c
        on c.id_candidato = g.id_candidato
      where g.id_candidato is not null
      group by g.id_candidato
      order by max(g.criado_em) desc
    `
  );

  const recentResult = await db.query<GovernanceAuditItem>(
    `
      select
        g.id,
        g.id_candidato,
        c.nome_urna,
        g.escopo,
        g.ator,
        g.categoria,
        g.acao,
        g.descricao,
        g.status,
        g.origem,
        g.criado_em::text as criado_em
      from governanca_auditoria g
      left join candidatos c
        on c.id_candidato = g.id_candidato
      order by g.criado_em desc
      limit 20
    `
  );

  return {
    totais: totalsResult.rows[0] ?? {
      campanhas_auditadas: 0,
      acoes_7_dias: 0,
      erros_7_dias: 0,
      importacoes_30_dias: 0,
      exportacoes_30_dias: 0,
      recalculos_30_dias: 0
    },
    campanhas: campaignResult.rows.map((row): AdminGovernanceCampaignItem => ({
      id_candidato: row.id_candidato,
      nome_urna: row.nome_urna ?? `Campanha ${row.id_candidato}`,
      total_acoes: row.total_acoes,
      erros_30_dias: row.erros_30_dias,
      importacoes_30_dias: row.importacoes_30_dias,
      exportacoes_30_dias: row.exportacoes_30_dias,
      recalculos_30_dias: row.recalculos_30_dias,
      ultimo_evento_em: row.ultimo_evento_em,
      criticidade:
        row.erros_30_dias >= 3
          ? "error"
          : row.erros_30_dias >= 1
            ? "warning"
            : "ok"
    })),
    recentes: recentResult.rows
  };
}

async function ensureGovernanceTable() {
  if (governanceTableReady) {
    return;
  }

  await db.query(`
    create table if not exists governanca_auditoria (
      id text primary key,
      id_candidato text null,
      escopo text not null,
      ator text not null,
      categoria text not null,
      acao text not null,
      descricao text not null,
      status text not null,
      origem text null,
      detalhes jsonb null,
      criado_em timestamptz not null default now()
    )
  `);

  await db.query(
    `create index if not exists idx_governanca_auditoria_candidato_data on governanca_auditoria (id_candidato, criado_em desc)`
  );
  await db.query(
    `create index if not exists idx_governanca_auditoria_categoria_data on governanca_auditoria (categoria, criado_em desc)`
  );
  await db.query(
    `create index if not exists idx_governanca_auditoria_status_data on governanca_auditoria (status, criado_em desc)`
  );

  governanceTableReady = true;
}
