import Link from "next/link";
import { getAdminGovernanceSnapshot } from "@/lib/repositories/governance";

export const dynamic = "force-dynamic";

export default async function GovernanceAdminPage() {
  const snapshot = await getAdminGovernanceSnapshot();

  return (
    <main className="page-shell">
      <section className="hero-card">
        <span className="pill">Governança do Admin</span>
        <h1 className="title">Trilha administrativa e operacional da plataforma</h1>
        <p className="subtitle">
          Visão consolidada das ações críticas do produto para acompanhar importações,
          exportações, liberações de acesso e recálculos do funil por campanha.
        </p>
        <div className="actions" style={{ marginTop: 18 }}>
          <Link className="button secondary" href="/estatisticas">
            Voltar para Inteligência da Campanha
          </Link>
          <Link className="button secondary" href="/estatisticas/auditoria">
            Ver auditoria da base
          </Link>
          <Link className="button secondary" href="/api/estatisticas/exportar">
            Exportar executivo
          </Link>
        </div>
      </section>

      <section className="grid grid-3" style={{ marginBottom: 20 }}>
        <article className="card metric-card">
          <span className="metric-label">Campanhas auditadas</span>
          <strong className="metric-value">{snapshot.totais.campanhas_auditadas}</strong>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Ações em 7 dias</span>
          <strong className="metric-value">{snapshot.totais.acoes_7_dias}</strong>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Erros em 7 dias</span>
          <strong className="metric-value">{snapshot.totais.erros_7_dias}</strong>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Importações em 30 dias</span>
          <strong className="metric-value">{snapshot.totais.importacoes_30_dias}</strong>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Exportações em 30 dias</span>
          <strong className="metric-value">{snapshot.totais.exportacoes_30_dias}</strong>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Recálculos em 30 dias</span>
          <strong className="metric-value">{snapshot.totais.recalculos_30_dias}</strong>
        </article>
      </section>

      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">Mapa de governança por campanha</h2>
            <p className="subtitle">
              Leitura consolidada da criticidade operacional para localizar campanhas com maior
              volume de erro, exportações sensíveis e saneamentos recentes.
            </p>
          </div>
          <span className="pill">Governança consolidada</span>
        </div>
        <div className="table-responsive">
          <table className="table analytics-table">
            <thead>
              <tr>
                <th>Campanha</th>
                <th>Ações</th>
                <th>Erros 30 dias</th>
                <th>Importações</th>
                <th>Exportações</th>
                <th>Recálculos</th>
                <th>Criticidade</th>
                <th>Último evento</th>
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
                        ? "Crítica"
                        : campanha.criticidade === "warning"
                          ? "Atenção"
                          : "Estável"}
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
            <h2 className="section-title">Eventos recentes de governança</h2>
            <p className="subtitle">
              Sequência das últimas ações administrativas e operacionais registradas na
              plataforma.
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
                <th>Ação</th>
                <th>Ator</th>
                <th>Status</th>
                <th>Descrição</th>
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
