import Link from "next/link";
import { listCandidates } from "@/lib/repositories/candidates";
import { ImplantationStatusPill } from "@/components/implantation-status-pill";

export const dynamic = "force-dynamic";

export default async function CandidatesPage() {
  const candidates = await listCandidates();

  return (
    <main className="page-shell">
      <section className="hero-card">
        <span className="pill">Tela 1</span>
        <h1 className="title">Candidatos</h1>
        <p className="subtitle">
          Cadastros importados da planilha, status de implantacao e acesso rapido ao
          painel de campanha da GAP.
        </p>
      </section>

      <section className="card">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nome de urna</th>
              <th>Partido</th>
              <th>Cargo</th>
              <th>Status</th>
              <th>Numero do agente</th>
              <th>QR</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((candidate) => (
              <tr key={candidate.id_candidato}>
                <td className="mono">{candidate.id_candidato}</td>
                <td>{candidate.nome_urna}</td>
                <td>{candidate.partido}</td>
                <td>{candidate.cargo_disputado}</td>
                <td>
                  <ImplantationStatusPill status={candidate.status_implantacao} />
                </td>
                <td className="mono">{candidate.numero_agente_oficial ?? "-"}</td>
                <td>{candidate.qr_code_url ? "QR disponivel" : "QR pendente"}</td>
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
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
