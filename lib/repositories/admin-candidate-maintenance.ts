import { db } from "@/lib/db";

type CandidateDeletionSummary = {
  candidatos: number;
  campanhas: number;
  canais_integracao: number;
  perfis_candidato_md: number;
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
};

export async function getCandidateDeletionSummary(idCandidato: string | null) {
  const params = idCandidato ? [idCandidato] : [];
  const where = idCandidato ? " where id_candidato = $1" : "";
  const candidateScopedWhere = idCandidato ? " where id_candidato = $1" : " where id_candidato is not null";

  const [
    candidatos,
    campanhas,
    canaisIntegracao,
    perfisMarkdown,
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

export async function deleteCandidateCascade(idCandidato: string) {
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
  return deleteCascadeInternal(null);
}

async function deleteCascadeInternal(idCandidato: string | null): Promise<CandidateDeletionResult> {
  const client = await db.connect();

  try {
    await client.query("begin");

    const summary = await getCandidateDeletionSummary(idCandidato);
    const params = idCandidato ? [idCandidato] : [];
    const where = idCandidato ? " where id_candidato = $1" : "";
    const candidateScopedWhere = idCandidato
      ? " where id_candidato = $1"
      : " where id_candidato is not null";

    await client.query(`delete from participacoes_eventos${where}`, params);
    await client.query(`delete from eventos_campanha${where}`, params);
    await client.query(`delete from interacoes${where}`, params);
    await client.query(`delete from eleitores${where}`, params);
    await client.query(`delete from governanca_auditoria${candidateScopedWhere}`, params);
    await client.query(`delete from execucoes_implantacao${where}`, params);
    await client.query(`delete from implantacao_etapas_candidato${where}`, params);
    await client.query(`delete from implantacoes_candidato${where}`, params);
    await client.query(`delete from canais_integracao${where}`, params);
    await client.query(`delete from perfis_candidato_md${where}`, params);
    await client.query(`delete from campanhas${where}`, params);
    await client.query(`delete from paines_admin_permissoes${candidateScopedWhere}`, params);
    await client.query(`delete from candidatos${where}`, params);

    await client.query("commit");

    return {
      candidateId: idCandidato,
      mode: idCandidato ? "single" : "all",
      ...summary
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function countRows(query: string, params: unknown[]) {
  const result = await db.query<{ total: number }>(query, params);
  return Number(result.rows[0]?.total ?? 0);
}
