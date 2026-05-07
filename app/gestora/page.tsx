import Link from "next/link";
import { listCandidates } from "@/lib/repositories/candidates";
import { ImplantationStatusPill } from "@/components/implantation-status-pill";

export const dynamic = "force-dynamic";

export default async function GestoraDashboardPage() {
  const candidates = await listCandidates();

  return (
    <main className="page-shell">
      <section className="hero-card">
        <span className="pill">Area da gestora</span>
        <h1 className="title">Acompanhamento da gestora de campanha</h1>
        <p className="subtitle">
          Entrada dedicada para a Gestora da Campanha revisar dados importados, ajustar o
          canal oficial, consolidar canais de divulgacao e acompanhar o que ja foi registrado
          para cada candidato.
        </p>
        <div className="actions" style={{ marginTop: 18 }}>
          <Link className="button secondary" href="/">
            Voltar para inicio
          </Link>
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">Campanhas disponiveis para gestao</h2>
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
                  <span>Progresso da implantacao</span>
                  <div className="progress-inline">
                    <div className="progress-track">
                      <div className="progress-bar" style={{ width: `${progress}%` }} />
                    </div>
                    <span>{progress}%</span>
                  </div>
                </div>
                <div className="muted">
                  <strong>Proxima etapa:</strong> {candidate.proxima_etapa ?? "Implantacao concluida"}
                </div>
                <div className="muted">
                  <strong>Numero oficial:</strong> {candidate.numero_agente_oficial ?? "-"}
                </div>
                <div className="muted">
                  <strong>Ultima atualizacao da gestora:</strong>{" "}
                  {candidate.ultima_atualizacao_gestora_em
                    ? new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short"
                      }).format(new Date(candidate.ultima_atualizacao_gestora_em))
                    : "ainda nao registrada"}
                </div>
                <div className="actions" style={{ marginTop: 12 }}>
                  <Link className="button secondary" href={`/gestor/candidato/${candidate.id_candidato}`}>
                    Abrir area da gestora
                  </Link>
                  <Link className="button secondary" href={`/candidatos/${candidate.id_candidato}`}>
                    Ver implantacao
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
