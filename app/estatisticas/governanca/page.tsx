import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getDefaultPlatformRoute,
  requireAuthenticatedPlatformSession
} from "@/lib/auth";
import { getAdminGovernanceSnapshot } from "@/lib/repositories/governance";

export const dynamic = "force-dynamic";

export default async function GovernanceAdminPage() {
  const session = await requireAuthenticatedPlatformSession();

  if (session.perfil !== "administrador") {
    redirect(await getDefaultPlatformRoute(session));
  }

  const snapshot = await getAdminGovernanceSnapshot();

  return (
    <main className="page-shell">
      <section className="hero-card">
        <span className="pill">GovernanÃƒÂ§a do admin</span>
        <h1 className="title">Trilha administrativa e operacional da plataforma</h1>
        <p className="subtitle">
          VisÃƒÂ£o consolidada das aÃƒÂ§ÃƒÂµes crÃƒÂ­ticas do produto para acompanhar importaÃƒÂ§ÃƒÂµes, exportaÃƒÂ§ÃƒÂµes,
          liberaÃƒÂ§ÃƒÂµes de acesso, recÃƒÂ¡lculos do funil e disparos de workflow.
        </p>
        <div className="actions" style={{ marginTop: 18 }}>
          <Link className="button secondary" href="/estatisticas">
            Voltar para InteligÃƒÂªncia da Campanha
          </Link>
          <Link className="button secondary" href="/estatisticas/auditoria">
            Ver auditoria da base
          </Link>
          <Link className="button secondary" href="/estatisticas/governanca/workflows">
            Central de workflows
          </Link>
          <Link className="button secondary" href="/admin/candidatos">
            Saneamento de candidatos e eleitores
          </Link>
          <Link className="button secondary" href="/admin/usuarios">
            UsuÃƒÂ¡rios e perfis
          </Link>
        </div>
      </section>

      <section className="grid grid-3" style={{ marginBottom: 20 }}>
        <article className="card metric-card">
          <span className="metric-label">Campanhas auditadas</span>
          <strong className="metric-value">{snapshot.totais.campanhas_auditadas}</strong>
        </article>
        <article className="card metric-card">
          <span className="metric-label">AÃƒÂ§ÃƒÂµes em 7 dias</span>
          <strong className="metric-value">{snapshot.totais.acoes_7_dias}</strong>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Erros em 7 dias</span>
          <strong className="metric-value">{snapshot.totais.erros_7_dias}</strong>
        </article>
        <article className="card metric-card">
          <span className="metric-label">ImportaÃƒÂ§ÃƒÂµes em 30 dias</span>
          <strong className="metric-value">{snapshot.totais.importacoes_30_dias}</strong>
        </article>
        <article className="card metric-card">
          <span className="metric-label">ExportaÃƒÂ§ÃƒÂµes em 30 dias</span>
          <strong className="metric-value">{snapshot.totais.exportacoes_30_dias}</strong>
        </article>
        <article className="card metric-card">
          <span className="metric-label">RecÃƒÂ¡lculos em 30 dias</span>
          <strong className="metric-value">{snapshot.totais.recalculos_30_dias}</strong>
        </article>
      </section>

      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">Mapa de governanÃƒÂ§a por campanha</h2>
            <p className="subtitle">
              Leitura consolidada da criticidade operacional para localizar campanhas com maior
              volume de erro, exportaÃƒÂ§ÃƒÂµes sensÃƒÂ­veis e saneamentos recentes.
            </p>
          </div>
          <span className="pill">GovernanÃƒÂ§a consolidada</span>
        </div>
        <div className="table-responsive">
          <table className="table analytics-table">
            <thead>
              <tr>
                <th>Campanha</th>
                <th>AÃƒÂ§ÃƒÂµes</th>
                <th>Erros em 30 dias</th>
                <th>ImportaÃƒÂ§ÃƒÂµes</th>
                <th>ExportaÃƒÂ§ÃƒÂµes</th>
                <th>RecÃƒÂ¡lculos</th>
                <th>Criticidade</th>
                <th>ÃƒÅ¡ltimo evento</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.campanhas.map((campanha) => (
                <tr key={campanha.id_candidato}>
                  <td>
                    <strong>{campanha.nome_urna}</strong>
                    <div className="mono">#{campanha.id_candidato}</div>
                  </td>
                  <td>{campanha.total_acoes}</td>
                  <td>{campanha.erros_30_dias}</td>
                  <td>{campanha.importacoes_30_dias}</td>
                  <td>{campanha.exportacoes_30_dias}</td>
                  <td>{campanha.recalculos_30_dias}</td>
                  <td>
                    <span
                      className={`pill ${
                        campanha.criticidade === "error"
                          ? "error"
                          : campanha.criticidade === "warning"
                            ? "warn"
                            : "ok"
                      }`}
                    >
                      {campanha.criticidade === "error"
                        ? "CrÃƒÂ­tica"
                        : campanha.criticidade === "warning"
                          ? "AtenÃƒÂ§ÃƒÂ£o"
                          : "EstÃƒÂ¡vel"}
                    </span>
                  </td>
                  <td>{formatDateTime(campanha.ultimo_evento_em)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <h2 className="section-title">Eventos recentes de governanÃƒÂ§a</h2>
            <p className="subtitle">
              SequÃƒÂªncia das ÃƒÂºltimas aÃƒÂ§ÃƒÂµes administrativas e operacionais registradas na plataforma.
            </p>
          </div>
          <span className="pill">Trilha transacional</span>
        </div>
        <div className="table-responsive">
          <table className="table analytics-table">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Campanha</th>
                <th>Categoria</th>
                <th>AÃƒÂ§ÃƒÂ£o</th>
                <th>Ator</th>
                <th>Status</th>
                <th>DescriÃƒÂ§ÃƒÂ£o</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.recentes.map((evento) => (
                <tr key={evento.id}>
                  <td>{formatDateTime(evento.criado_em)}</td>
                  <td>{evento.nome_urna ?? "admin"}</td>
                  <td>{labelize(evento.categoria)}</td>
                  <td>{labelize(evento.acao)}</td>
                  <td>{labelize(evento.ator)}</td>
                  <td>
                    <span
                      className={`pill ${
                        evento.status === "erro"
                          ? "error"
                          : evento.status === "aviso"
                            ? "warn"
                            : "ok"
                      }`}
                    >
                      {evento.status}
                    </span>
                  </td>
                  <td>{evento.descricao}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function labelize(value: string) {
  return value.replace(/_/g, " ");
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "sem registro";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}
