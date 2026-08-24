import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getCurrentPlatformSession,
  getDefaultPlatformRoute,
  getVisibleCandidateIdsForSession
} from "@/lib/auth";
import { listCandidates } from "@/lib/repositories/candidates";
import { ImplantationStatusPill } from "@/components/implantation-status-pill";

export const dynamic = "force-dynamic";

export default async function GestoraDashboardPage() {
  const session = await getCurrentPlatformSession();

  if (!session) {
    redirect("/");
  }

  if (!["administrador", "gestor_campanha"].includes(session.perfil)) {
    redirect(await getDefaultPlatformRoute(session));
  }

  const visibleCandidateIds = await getVisibleCandidateIdsForSession(session);
  const allCandidates = await listCandidates();
  const candidates =
    visibleCandidateIds === null
      ? allCandidates
      : allCandidates.filter((candidate) => visibleCandidateIds.includes(candidate.id_candidato));

  return (
    <main className="page-shell">
      <section className="hero-card">
        <span className="pill">Área da gestora</span>
        <h1 className="title">Acompanhamento da gestora de campanha</h1>
        <p className="subtitle">
          Entrada dedicada para revisar dados importados, ajustar o canal oficial, consolidar
          canais de divulgação e acompanhar o que já foi registrado para cada candidato.
        </p>
        <div className="actions" style={{ marginTop: 18 }}>
          <Link className="button secondary" href="/">
            Voltar para início
          </Link>
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">Campanhas disponíveis para gestão</h2>
        <div className="manager-candidate-grid">
          {candidates.map((candidate) => {
            const progress =
              candidate.total_etapas > 0
                ? Math.round((candidate.etapas_concluidas / candidate.total_etapas) * 100)
                : 0;

            return (
              <article className="manager-candidate-card" key={candidate.id_candidato}>
                <div className="manager-candidate-head">
                  <div>
                    <strong>{candidate.nome_urna}</strong>
                    <div className="mono">#{candidate.id_candidato}</div>
                  </div>
                  <ImplantationStatusPill status={candidate.status_implantacao} />
                </div>
                <div className="muted">{candidate.cargo_disputado}</div>
                <div className="manager-candidate-progress">
                  <span>Progresso da implantação</span>
                  <div className="progress-inline">
                    <div className="progress-track">
                      <div className="progress-bar" style={{ width: `${progress}%` }} />
                    </div>
                    <span>{progress}%</span>
                  </div>
                </div>
                <div className="muted">
                  <strong>Próxima etapa:</strong>{" "}
                  {candidate.proxima_etapa ??
                    (candidate.total_etapas > 0
                      ? "Implantação concluída"
                      : "Implantação não iniciada")}
                </div>
                <div className="muted">
                  <strong>Número oficial:</strong> {candidate.numero_agente_oficial ?? "-"}
                </div>
                <div className="muted">
                  <strong>Última atualização da gestora:</strong>{" "}
                  {candidate.ultima_atualizacao_gestora_em
                    ? new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short"
                      }).format(new Date(candidate.ultima_atualizacao_gestora_em))
                    : "ainda não registrada"}
                </div>
                <div className="actions" style={{ marginTop: 12 }}>
                  <Link className="button secondary" href={`/gestor/candidato/${candidate.id_candidato}`}>
                    Abrir área da gestora
                  </Link>
                  <Link className="button secondary" href={`/candidatos/${candidate.id_candidato}`}>
                    Ver implantação
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
