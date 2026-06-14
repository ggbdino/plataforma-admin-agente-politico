import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentPlatformSession, getVisibleCandidateIdsForSession } from "@/lib/auth";
import { listCandidates } from "@/lib/repositories/candidates";
import { ImplantationStatusPill } from "@/components/implantation-status-pill";

export const dynamic = "force-dynamic";

export default async function GestorDashboardPage() {
  const session = await getCurrentPlatformSession();

  if (!session) {
    redirect("/");
  }

  const visibleCandidateIds = await getVisibleCandidateIdsForSession(session);
  const allCandidates = await listCandidates();
  const candidates =
    visibleCandidateIds === null
      ? allCandidates
      : allCandidates.filter((candidate) => visibleCandidateIds.includes(candidate.id_candidato));

  const total = candidates.length;
  const ativos = candidates.filter((candidate) => candidate.status_implantacao === "ativo").length;
  const emPreparacao = candidates.filter(
    (candidate) => candidate.status_implantacao === "em_preparacao"
  ).length;
  const qrDisponivel = candidates.filter((candidate) => Boolean(candidate.qr_code_url)).length;
  const comErro = candidates.filter((candidate) => candidate.etapas_com_erro > 0).length;

  return (
    <main className="page-shell">
      <section className="hero-card">
        <span className="pill">Painel do gestor</span>
        <h1 className="title">Situação consolidada das campanhas</h1>
        <p className="subtitle">
          Visão executiva para acompanhar candidatos, progresso de implantação e o caminho para a operação de cada campanha.
        </p>
        <div className="actions" style={{ marginTop: 18 }}>
          <Link className="button secondary" href="/candidatos">
            Voltar para candidatos
          </Link>
          <Link className="button secondary" href="/estatisticas">
            Inteligência da Campanha
          </Link>
        </div>
      </section>

      <section className="grid grid-3" style={{ marginBottom: 20 }}>
        <article className="card metric-card">
          <span className="metric-label">Total de candidatos</span>
          <strong className="metric-value">{total}</strong>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Em preparação</span>
          <strong className="metric-value">{emPreparacao}</strong>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Campanhas ativas</span>
          <strong className="metric-value">{ativos}</strong>
        </article>
        <article className="card metric-card">
          <span className="metric-label">QR Code disponível</span>
          <strong className="metric-value">{qrDisponivel}</strong>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Com erro operacional</span>
          <strong className="metric-value">{comErro}</strong>
        </article>
      </section>

      <section className="card">
        <h2 className="section-title">Situação por candidato</h2>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome de urna</th>
                <th>Status</th>
                <th>Progresso</th>
                <th>Próxima etapa</th>
                <th>Incidentes</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate) => {
                const progress =
                  candidate.total_etapas > 0
                    ? Math.round((candidate.etapas_concluidas / candidate.total_etapas) * 100)
                    : 0;

                return (
                  <tr key={candidate.id_candidato}>
                    <td className="mono">{candidate.id_candidato}</td>
                    <td>{candidate.nome_urna}</td>
                    <td>
                      <ImplantationStatusPill status={candidate.status_implantacao} />
                    </td>
                    <td>
                      <div className="progress-inline">
                        <div className="progress-track">
                          <div className="progress-bar" style={{ width: `${progress}%` }} />
                        </div>
                        <span>{progress}%</span>
                      </div>
                    </td>
                    <td>
                      {candidate.proxima_etapa ??
                        (candidate.total_etapas > 0
                          ? "Implantação concluída"
                          : "Implantação não iniciada")}
                    </td>
                    <td>
                      {candidate.etapas_com_erro > 0 ? (
                        <span className="pill warn">{candidate.etapas_com_erro} etapa(s) com erro</span>
                      ) : (
                        <span className="pill ok">Sem incidentes</span>
                      )}
                    </td>
                    <td>
                      <div className="actions">
                        <Link className="button secondary" href={`/candidatos/${candidate.id_candidato}`}>
                          Implantação
                        </Link>
                        <Link className="button secondary" href={`/campanhas/${candidate.id_candidato}`}>
                          Campanha
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
