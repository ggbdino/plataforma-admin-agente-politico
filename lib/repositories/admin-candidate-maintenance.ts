import { db } from "@/lib/db";
import type { PoolClient } from "pg";

type CandidateDeletionSummary = {
  candidatos: number;
  campanhas: number;
  canais_integracao: number;
  perfis_candidato_md: number;
  prompts_agentes: number;
  implantacoes_candidato: number;
  implantacao_etapas_candidato: number;
  execucoes_implantacao: number;
  eleitores: number;
  interacoes: number;
  eventos_campanha: number;
  participacoes_eventos: number;
  paines_admin_permissoes: number;
  governanca_auditoria: number;
};

type CandidateDeletionResult = CandidateDeletionSummary & {
  candidateId: string | null;
  mode: "single" | "all";
  archiveId: string;
  archiveFileName: string;
};

type CandidateArchiveRecord = {
  id: string;
  escopo: string;
  id_candidato: string | null;
  nome_arquivo: string;
  resumo: Record<string, unknown>;
  criado_em: string;
  criado_por: string | null;
};

type ArchivedCandidateRecord = {
  id_candidato: string;
  nome_urna: string | null;
  status_registro: string | null;
  exclusao_logica_em: string | null;
  exclusao_logica_motivo: string | null;
};

const CANDIDATE_SCOPED_TABLES = [
  "participacoes_eventos",
  "eventos_campanha",
  "interacoes",
  "eleitores",
  "execucoes_implantacao",
  "implantacao_etapas_candidato",
  "implantacoes_candidato",
  "canais_integracao",
  "perfis_candidato_md",
  "prompts_agentes",
  "campanhas",
  "campanha_sms_config",
  "campanha_email_config",
  "campanha_whatsapp_config",
  "remessas_sms_campanha",
  "remessas_email_campanha",
  "remessas_whatsapp_campanha",
  "campanha_divulgacao_evidencias",
  "campanha_divulgacao_tarefa_membros",
  "campanha_divulgacao_tarefas",
  "campanha_divulgacao_membros"
];

const CANDIDATE_REFERENCED_TABLES = [
  "paines_admin_permissoes",
  "governanca_auditoria"
];

const RECIPIENT_TABLES = [
  {
    table: "remessas_sms_destinatarios",
    parent: "remessas_sms_campanha",
    foreignKey: "remessa_id"
  },
  {
    table: "remessas_email_destinatarios",
    parent: "remessas_email_campanha",
    foreignKey: "remessa_id"
  },
  {
    table: "remessas_whatsapp_destinatarios",
    parent: "remessas_whatsapp_campanha",
    foreignKey: "remessa_id"
  }
];

export async function ensureCandidateMaintenanceTables() {
  await db.query(`
    alter table candidatos
      add column if not exists status_registro text not null default 'ativo',
      add column if not exists exclusao_logica_em timestamptz,
      add column if not exists exclusao_logica_motivo text
  `);

  await db.query(`
    create table if not exists arquivos_exclusao_candidato (
      id uuid primary key default gen_random_uuid(),
      escopo text not null,
      id_candidato varchar(120),
      nome_arquivo text not null,
      content_type text not null default 'application/json',
      payload jsonb not null,
      resumo jsonb not null default '{}'::jsonb,
      criado_em timestamptz default now(),
      criado_por text
    )
  `);
}

export async function getCandidateDeletionSummary(idCandidato: string | null) {
  await ensureCandidateMaintenanceTables();

  const params = idCandidato ? [idCandidato] : [];
  const where = idCandidato ? " where id_candidato = $1" : "";
  const candidateScopedWhere = idCandidato ? " where id_candidato = $1" : " where id_candidato is not null";

  const [
    candidatos,
    campanhas,
    canaisIntegracao,
    perfisMarkdown,
    promptsAgentes,
    implantacoes,
    etapas,
    execucoes,
    eleitores,
    interacoes,
    eventos,
    participacoes,
    permissoes,
    auditoria
  ] = await Promise.all([
    countRows(`select count(*)::int as total from candidatos${where}`, params),
    countRows(`select count(*)::int as total from campanhas${where}`, params),
    countRows(`select count(*)::int as total from canais_integracao${where}`, params),
    countRows(`select count(*)::int as total from perfis_candidato_md${where}`, params),
    countRows(`select count(*)::int as total from prompts_agentes${where}`, params),
    countRows(`select count(*)::int as total from implantacoes_candidato${where}`, params),
    countRows(`select count(*)::int as total from implantacao_etapas_candidato${where}`, params),
    countRows(`select count(*)::int as total from execucoes_implantacao${where}`, params),
    countRows(`select count(*)::int as total from eleitores${where}`, params),
    countRows(`select count(*)::int as total from interacoes${where}`, params),
    countRows(`select count(*)::int as total from eventos_campanha${where}`, params),
    countRows(`select count(*)::int as total from participacoes_eventos${where}`, params),
    countRows(`select count(*)::int as total from paines_admin_permissoes${candidateScopedWhere}`, params),
    countRows(`select count(*)::int as total from governanca_auditoria${candidateScopedWhere}`, params)
  ]);

  return {
    candidatos,
    campanhas,
    canais_integracao: canaisIntegracao,
    perfis_candidato_md: perfisMarkdown,
    prompts_agentes: promptsAgentes,
    implantacoes_candidato: implantacoes,
    implantacao_etapas_candidato: etapas,
    execucoes_implantacao: execucoes,
    eleitores,
    interacoes,
    eventos_campanha: eventos,
    participacoes_eventos: participacoes,
    paines_admin_permissoes: permissoes,
    governanca_auditoria: auditoria
  } satisfies CandidateDeletionSummary;
}

export async function listArchivedCandidatesForMaintenance() {
  await ensureCandidateMaintenanceTables();

  const result = await db.query<ArchivedCandidateRecord>(
    `
      select
        id_candidato,
        nome_urna,
        status_registro,
        exclusao_logica_em::text as exclusao_logica_em,
        exclusao_logica_motivo
      from candidatos
      where coalesce(status_registro, 'ativo') = 'excluido_logico'
      order by exclusao_logica_em desc nulls last, nome_urna
    `
  );

  return result.rows;
}

export async function listCandidateDeletionArchives(limit = 20) {
  await ensureCandidateMaintenanceTables();

  const result = await db.query<CandidateArchiveRecord>(
    `
      select
        id::text as id,
        escopo,
        id_candidato,
        nome_arquivo,
        resumo,
        criado_em::text as criado_em,
        criado_por
      from arquivos_exclusao_candidato
      order by criado_em desc
      limit $1
    `,
    [limit]
  );

  return result.rows;
}

export async function getCandidateDeletionArchive(id: string) {
  await ensureCandidateMaintenanceTables();

  const result = await db.query<{
    id: string;
    nome_arquivo: string;
    content_type: string;
    payload: Record<string, unknown>;
  }>(
    `
      select id::text as id, nome_arquivo, content_type, payload
      from arquivos_exclusao_candidato
      where id = $1::uuid
      limit 1
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

export async function logicallyDeleteCandidate(input: {
  idCandidato: string;
  motivo: string;
}) {
  await ensureCandidateMaintenanceTables();
  const candidateId = input.idCandidato.trim();

  if (!candidateId) {
    throw new Error("Informe o identificador do candidato para arquivar.");
  }

  const result = await db.query<{ id_candidato: string }>(
    `
      update candidatos
      set
        status_registro = 'excluido_logico',
        exclusao_logica_em = now(),
        exclusao_logica_motivo = nullif($2, '')
      where id_candidato = $1
      returning id_candidato
    `,
    [candidateId, input.motivo.trim()]
  );

  if (!result.rows[0]) {
    throw new Error("O candidato informado nao foi localizado na base.");
  }

  return result.rows[0];
}

export async function restoreLogicallyDeletedCandidate(idCandidato: string) {
  await ensureCandidateMaintenanceTables();
  const candidateId = idCandidato.trim();

  if (!candidateId) {
    throw new Error("Informe o identificador do candidato para restaurar.");
  }

  const result = await db.query<{ id_candidato: string }>(
    `
      update candidatos
      set
        status_registro = 'ativo',
        exclusao_logica_em = null,
        exclusao_logica_motivo = null
      where id_candidato = $1
        and coalesce(status_registro, 'ativo') = 'excluido_logico'
      returning id_candidato
    `,
    [candidateId]
  );

  if (!result.rows[0]) {
    throw new Error("O candidato informado nao esta arquivado logicamente.");
  }

  return result.rows[0];
}


export async function deleteCandidateElectorsCascade(idCandidato: string) {
  await ensureCandidateMaintenanceTables();
  const candidateId = idCandidato.trim();

  if (!candidateId) {
    throw new Error("Informe o identificador do candidato para excluir os eleitores.");
  }

  const existsResult = await db.query<{ nome_urna: string | null }>(
    `select nome_urna from candidatos where id_candidato = $1 limit 1`,
    [candidateId]
  );

  if (!existsResult.rows[0]) {
    throw new Error("O candidato informado nao foi localizado na base.");
  }

  const client = await db.connect();

  try {
    await client.query("begin");

    const summary = await getCandidateDeletionSummary(candidateId);
    const archive = await createDeletionArchive(client, {
      idCandidato: candidateId,
      escopo: "eleitores_candidato",
      summary,
      createdBy: "administrador"
    });
    const params = [candidateId];

    await client.query(`delete from participacoes_eventos where id_candidato = $1`, params);
    await client.query(`delete from interacoes where id_candidato = $1`, params);
    await client.query(`delete from eleitores where id_candidato = $1`, params);

    await client.query("commit");

    return {
      candidateId,
      archiveId: archive.id,
      archiveFileName: archive.fileName,
      eleitores: summary.eleitores,
      interacoes: summary.interacoes,
      participacoes_eventos: summary.participacoes_eventos
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
export async function deleteCandidateCascade(idCandidato: string) {
  await ensureCandidateMaintenanceTables();
  const candidateId = idCandidato.trim();

  if (!candidateId) {
    throw new Error("Informe o identificador do candidato a ser excluido.");
  }

  const existsResult = await db.query<{ nome_urna: string | null }>(
    `select nome_urna from candidatos where id_candidato = $1 limit 1`,
    [candidateId]
  );

  if (!existsResult.rows[0]) {
    throw new Error("O candidato informado nao foi localizado na base.");
  }

  return deleteCascadeInternal(candidateId);
}

export async function deleteAllCandidatesCascade() {
  await ensureCandidateMaintenanceTables();
  return deleteCascadeInternal(null);
}

async function deleteCascadeInternal(idCandidato: string | null): Promise<CandidateDeletionResult> {
  const client = await db.connect();

  try {
    await client.query("begin");

    const summary = await getCandidateDeletionSummary(idCandidato);
    const archive = await createDeletionArchive(client, {
      idCandidato,
      escopo: idCandidato ? "candidato_definitivo" : "todos_candidatos_definitivo",
      summary,
      createdBy: "administrador"
    });
    const params = idCandidato ? [idCandidato] : [];
    const where = idCandidato ? " where id_candidato = $1" : "";
    const candidateScopedWhere = idCandidato
      ? " where id_candidato = $1"
      : " where id_candidato is not null";

    await deleteRecipientTables(client, idCandidato);
    await client.query(`delete from participacoes_eventos${where}`, params);
    await client.query(`delete from eventos_campanha${where}`, params);
    await client.query(`delete from interacoes${where}`, params);
    await client.query(`delete from eleitores${where}`, params);
    await deleteIfExists(client, "remessas_sms_campanha", where, params);
    await deleteIfExists(client, "remessas_email_campanha", where, params);
    await deleteIfExists(client, "remessas_whatsapp_campanha", where, params);
    await deleteIfExists(client, "campanha_sms_config", where, params);
    await deleteIfExists(client, "campanha_email_config", where, params);
    await deleteIfExists(client, "campanha_whatsapp_config", where, params);
    await deleteIfExists(client, "campanha_divulgacao_evidencias", where, params);
    await deleteIfExists(client, "campanha_divulgacao_tarefa_membros", where, params);
    await deleteIfExists(client, "campanha_divulgacao_tarefas", where, params);
    await deleteIfExists(client, "campanha_divulgacao_membros", where, params);
    await client.query(`delete from governanca_auditoria${candidateScopedWhere}`, params);
    await client.query(`delete from execucoes_implantacao${where}`, params);
    await client.query(`delete from implantacao_etapas_candidato${where}`, params);
    await client.query(`delete from implantacoes_candidato${where}`, params);
    await client.query(`delete from canais_integracao${where}`, params);
    await client.query(`delete from perfis_candidato_md${where}`, params);
    await client.query(`delete from prompts_agentes${where}`, params);
    await client.query(`delete from campanhas${where}`, params);
    await client.query(`delete from paines_admin_permissoes${candidateScopedWhere}`, params);
    await client.query(`delete from candidatos${where}`, params);

    await client.query("commit");

    return {
      candidateId: idCandidato,
      mode: idCandidato ? "single" : "all",
      archiveId: archive.id,
      archiveFileName: archive.fileName,
      ...summary
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function createDeletionArchive(
  client: PoolClient,
  input: {
    idCandidato: string | null;
    escopo: string;
    summary: CandidateDeletionSummary;
    createdBy: string;
  }
) {
  const now = new Date().toISOString();
  const fileName = buildArchiveFileName(input.escopo, input.idCandidato, now);
  const data = await collectArchivePayload(client, input.idCandidato);
  const payload = {
    versao_arquivo: 1,
    criado_em: now,
    escopo: input.escopo,
    id_candidato: input.idCandidato,
    resumo: input.summary,
    dados: data
  };

  const result = await client.query<{ id: string }>(
    `
      insert into arquivos_exclusao_candidato (
        escopo,
        id_candidato,
        nome_arquivo,
        content_type,
        payload,
        resumo,
        criado_por
      )
      values ($1, $2, $3, 'application/json', $4::jsonb, $5::jsonb, $6)
      returning id::text as id
    `,
    [
      input.escopo,
      input.idCandidato,
      fileName,
      JSON.stringify(payload),
      JSON.stringify(input.summary),
      input.createdBy
    ]
  );

  return {
    id: result.rows[0].id,
    fileName
  };
}

async function collectArchivePayload(
  client: PoolClient,
  idCandidato: string | null
) {
  const payload: Record<string, unknown> = {};

  payload.candidatos = await selectRowsAsJson(client, "candidatos", idCandidato);

  for (const table of CANDIDATE_SCOPED_TABLES) {
    payload[table] = await selectRowsAsJson(client, table, idCandidato);
  }

  for (const table of CANDIDATE_REFERENCED_TABLES) {
    payload[table] = await selectRowsAsJson(client, table, idCandidato, true);
  }

  for (const item of RECIPIENT_TABLES) {
    payload[item.table] = await selectRecipientRowsAsJson(client, item, idCandidato);
  }

  return payload;
}

async function selectRowsAsJson(
  client: PoolClient,
  table: string,
  idCandidato: string | null,
  onlyCandidateReferenced = false
) {
  if (!(await tableExists(client, table))) {
    return [];
  }

  const params = idCandidato ? [idCandidato] : [];
  const where = idCandidato
    ? "where id_candidato = $1"
    : onlyCandidateReferenced
      ? "where id_candidato is not null"
      : "";
  const result = await client.query<{ rows: unknown[] }>(
    `select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) as rows from (select * from ${table} ${where}) t`,
    params
  );

  return result.rows[0]?.rows ?? [];
}

async function selectRecipientRowsAsJson(
  client: PoolClient,
  input: { table: string; parent: string; foreignKey: string },
  idCandidato: string | null
) {
  if (!(await tableExists(client, input.table)) || !(await tableExists(client, input.parent))) {
    return [];
  }

  const params = idCandidato ? [idCandidato] : [];
  const where = idCandidato ? "where p.id_candidato = $1" : "";
  const result = await client.query<{ rows: unknown[] }>(
    `
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) as rows
      from (
        select d.*
        from ${input.table} d
        join ${input.parent} p on p.id = d.${input.foreignKey}
        ${where}
      ) t
    `,
    params
  );

  return result.rows[0]?.rows ?? [];
}

async function deleteRecipientTables(client: PoolClient, idCandidato: string | null) {
  for (const item of RECIPIENT_TABLES) {
    if (!(await tableExists(client, item.table)) || !(await tableExists(client, item.parent))) {
      continue;
    }

    const params = idCandidato ? [idCandidato] : [];
    const where = idCandidato ? "where p.id_candidato = $1" : "";
    await client.query(
      `
        delete from ${item.table} d
        using ${item.parent} p
        where p.id = d.${item.foreignKey}
        ${where ? `and p.id_candidato = $1` : ""}
      `,
      params
    );
  }
}

async function deleteIfExists(
  client: PoolClient,
  table: string,
  where: string,
  params: unknown[]
) {
  if (await tableExists(client, table)) {
    await client.query(`delete from ${table}${where}`, params);
  }
}

async function tableExists(client: PoolClient, table: string) {
  const result = await client.query<{ exists: boolean }>(
    `select to_regclass($1) is not null as exists`,
    [table]
  );
  return result.rows[0]?.exists ?? false;
}

function buildArchiveFileName(scope: string, idCandidato: string | null, isoDate: string) {
  const stamp = isoDate.replace(/[:.]/g, "-");
  const candidate = idCandidato ? idCandidato.replace(/[^a-zA-Z0-9_-]/g, "-") : "todos";
  return `arquivo-exclusao-${scope}-${candidate}-${stamp}.json`;
}

async function countRows(query: string, params: unknown[]) {
  const result = await db.query<{ total: number }>(query, params);
  return Number(result.rows[0]?.total ?? 0);
}
