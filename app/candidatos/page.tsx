import Link from "next/link";
import { listCandidates } from "@/lib/repositories/candidates";
import { ImplantationStatusPill } from "@/components/implantation-status-pill";

export const dynamic = "force-dynamic";

export default async function CandidatesPage() {
  const candidates = await listCandidates();
  const total = candidates.length;
  const withQr = candidates.filter((candidate) => Boolean(candidate.qr_code_url)).length;
  const withErrors = candidates.filter((candidate) => candidate.etapas_com_erro > 0).length;

  return (
    <main className="page-shell">
      <section className="hero-card">
        <span className="pill">Tela 1</span>
        <h1 className="title">Candidatos</h1>
        <p className="subtitle">
          Cadastros importados da planilha, status de implantacao e acesso rapido ao
          painel de campanha da GAP.
        </p>
        <div className="hero-meta">
          <span className="pill ok">{total} candidato(s) monitorado(s)</span>
          <span className="pill">{withQr} com QR disponivel</span>
          <span className="pill warn">{withErrors} com alerta operacional</span>
        </div>
        <div className="actions" style={{ marginTop: 18 }}>
          <Link className="button secondary" href="/gestor">
            Abrir painel do gestor
          </Link>
          <Link className="button secondary" href="/gestora">
            Abrir area da gestora
          </Link>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">Resumo do gestor</h2>
            <p className="subtitle">
              Acesso rapido a uma leitura executiva do progresso das campanhas. Esta area
              fica separada para uso prioritario da gestao do aplicativo.
            </p>
          </div>
          <Link className="button secondary" href="/gestor">
            Ver situacao consolidada
          </Link>
        </div>
      </section>

      <section className="card">
        <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nome de urna</th>
              <th>Partido</th>
              <th>Cargo</th>
              <th>Status</th>
              <th>Progresso</th>
              <th>Proxima etapa</th>
              <th>Numero do agente</th>
              <th>QR</th>
              <th>Atualizacao da gestora</th>
              <th>Acoes</th>
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
                  <td>{candidate.partido}</td>
                  <td>{candidate.cargo_disputado}</td>
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
                  <td>{candidate.proxima_etapa ?? "Implantacao concluida"}</td>
                  <td className="mono">{candidate.numero_agente_oficial ?? "-"}</td>
                  <td>{candidate.qr_code_url ? "QR disponivel" : "QR pendente"}</td>
                  <td>
                    {candidate.ultima_atualizacao_gestora_em ? (
                      <div className="muted">
                        <strong>
                          {new Intl.DateTimeFormat("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short"
                          }).format(new Date(candidate.ultima_atualizacao_gestora_em))}
                        </strong>
                        <div>{candidate.ultima_atualizacao_gestora_resumo ?? "Atualizacao da gestora registrada."}</div>
                      </div>
                    ) : (
                      "Sem atualizacao"
                    )}
                  </td>
                  <td>
                    <div className="actions">
                      <Link
                        className="button secondary"
                        href={`/candidatos/${candidate.id_candidato}`}
                      >
                        Abrir campanha
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
