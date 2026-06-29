import Link from "next/link";
import { redirect } from "next/navigation";
import { authenticatePlatformAreaAction } from "@/lib/actions/platform-user-action";
import { getCurrentPlatformSession, getDefaultPlatformRoute } from "@/lib/auth";
import {
  getAdminCampaignStatsSnapshot,
  getCampaignAnalyticsSnapshot
} from "@/lib/repositories/campaign-analytics";
import { APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

type StatisticsAdminPageProps = {
  searchParams?: Promise<{
    candidato?: string;
  }>;
};

export default async function StatisticsAdminPage({ searchParams }: StatisticsAdminPageProps) {
  const query = searchParams ? await searchParams : undefined;
  const session = await getCurrentPlatformSession();

  if (session && session.perfil !== "administrador") {
    redirect(await getDefaultPlatformRoute(session));
  }

  if (!session) {
    return (
      <main className="page-shell">
        <section className="hero-card">
          <span className="pill">InteligÃƒÂªncia da Campanha</span>
          <h1 className="title">Acesso protegido ÃƒÂ  inteligÃƒÂªncia consolidada</h1>
          <p className="subtitle">
            Entre com um usuÃƒÂ¡rio previamente cadastrado para consultar indicadores, auditoria,
            governanÃƒÂ§a e visÃƒÂ£o executiva das campanhas.
          </p>
        </section>

        <section className="card manager-auth-card">
          <h2 className="section-title">Autenticar acesso executivo</h2>
          <form action={authenticatePlatformAreaAction} className="manager-auth-form">
            <input name="redirectTo" type="hidden" value="/estatisticas" />
            <input name="contexto" type="hidden" value="governanca" />
            <label className="step-note">
              <span>E-mail do usuÃƒÂ¡rio</span>
              <input className="step-input" name="email" type="email" />
            </label>
            <label className="step-note">
              <span>Senha do usuÃƒÂ¡rio</span>
              <input className="step-input" name="senha" type="password" />
            </label>
            <button className="button" type="submit">
              Entrar em InteligÃƒÂªncia da Campanha
            </button>
          </form>
        </section>
      </main>
    );
  }

  const snapshot = await getAdminCampaignStatsSnapshot();
  const selectedCandidateId = query?.candidato || snapshot.campanhas[0]?.id_candidato || "";
  const selectedCandidate = selectedCandidateId
    ? await getCampaignAnalyticsSnapshot(selectedCandidateId)
    : null;
  const maxEleitores = Math.max(...snapshot.campanhas.map((item) => item.total_eleitores), 1);
  const maxMetaCoverage = Math.max(...snapshot.campanhas.map((item) => item.meta_contatos_percentual), 1);
  const maxMessages = Math.max(...snapshot.campanhas.map((item) => item.interacoes_total), 1);
  const globalGrowthMax = Math.max(...snapshot.crescimentoBase.map((item) => item.total_acumulado), 1);
  const globalGrowthPoints = buildGrowthPoints(snapshot.crescimentoBase, globalGrowthMax);
  const globalFunnelTotal = Math.max(snapshot.funilTotal.reduce((acc, item) => acc + item.total, 0), 1);
  const globalPieSegments = buildPieSegments(snapshot.funilTotal);

  return (
    <main className="page-shell">
      <section className="hero-card">
        <span className="pill">InteligÃƒÂªncia da Campanha</span>
        <h1 className="title">VisÃƒÂ£o consolidada de operaÃƒÂ§ÃƒÂ£o e conversÃƒÂ£o</h1>
        <p className="subtitle">
          Entrada executiva para a administraÃƒÂ§ÃƒÂ£o acompanhar a traÃƒÂ§ÃƒÂ£o de cada campanha sem misturar
          a camada de implantaÃƒÂ§ÃƒÂ£o com a camada de inteligÃƒÂªncia operacional.
        </p>
        <div className="hero-meta">
          <span className="pill">UsuÃƒÂ¡rio {session.nome}</span>
          <span className="pill">Perfil {session.perfil}</span>
          <span className="pill">{APP_VERSION}</span>
        </div>
        <div className="actions" style={{ marginTop: 18 }}>
          <Link className="button secondary" href="/">
            Voltar ao inÃƒÂ­cio
          </Link>
          <Link className="button secondary" href="/api/estatisticas/exportar">
            Exportar executivo
          </Link>
          <Link className="button secondary" href="/estatisticas/governanca">
            GovernanÃƒÂ§a do admin
          </Link>
          <Link className="button secondary" href="/admin/candidatos">
            Saneamento de base
          </Link>
          <Link className="button secondary" href="/estatisticas/auditoria">
            Auditoria do admin
          </Link>
          <Link className="button secondary" href="/candidatos">
            Ver implantaÃƒÂ§ÃƒÂ£o
          </Link>
        </div>
      </section>

      <section className="grid grid-3" style={{ marginBottom: 20 }}>
        <article className="card metric-card">
          <span className="metric-label">Campanhas monitoradas</span>
          <strong className="metric-value">{snapshot.totais.campanhas}</strong>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Eleitores na base</span>
          <strong className="metric-value">{snapshot.totais.eleitores}</strong>
        </article>
        <article className="card metric-card">
          <span className="metric-label">InteraÃƒÂ§ÃƒÂµes em 24h</span>
          <strong className="metric-value">{snapshot.totais.interacoes_24h}</strong>
        </article>
        <article className="card metric-card">
          <span className="metric-label">InteraÃƒÂ§ÃƒÂµes acumuladas</span>
          <strong className="metric-value">{snapshot.totais.interacoes}</strong>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Apoiadores mapeados</span>
          <strong className="metric-value">{snapshot.totais.apoiadores}</strong>
        </article>
        <article className="card metric-card">
          <span className="metric-label">MÃƒÂ©dia de eleitores por campanha</span>
          <strong className="metric-value">
            {snapshot.totais.campanhas === 0 ? 0 : Math.round(snapshot.totais.eleitores / snapshot.totais.campanhas)}
          </strong>
        </article>
      </section>

      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">Selecionar candidato</h2>
            <p className="subtitle">
              O administrador pode alternar a leitura individual e abrir a InteligÃƒÂªncia completa de cada campanha.
            </p>
          </div>
          {selectedCandidate ? (
            <Link className="button secondary" href={`/campanhas/${selectedCandidate.cabecalho.id_candidato}/inteligencia`}>
              Abrir inteligÃƒÂªncia de {selectedCandidate.cabecalho.nome_urna}
            </Link>
          ) : null}
        </div>
        <div className="actions">
          {snapshot.campanhas.map((campaign) => (
            <Link
              className={`button ${campaign.id_candidato === selectedCandidateId ? "" : "secondary"}`}
              href={`/estatisticas?candidato=${campaign.id_candidato}`}
              key={campaign.id_candidato}
            >
              {campaign.nome_urna}
            </Link>
          ))}
        </div>
      </section>

      {selectedCandidate ? (
        <section className="grid grid-3" style={{ marginBottom: 20 }}>
          <article className="card metric-card">
            <span className="metric-label">Candidato selecionado</span>
            <strong className="metric-value">{selectedCandidate.cabecalho.nome_urna}</strong>
          </article>
          <article className="card metric-card">
            <span className="metric-label">Base do candidato</span>
            <strong className="metric-value">{selectedCandidate.resumo.total_eleitores}</strong>
          </article>
          <article className="card metric-card">
            <span className="metric-label">Mensagens tratadas</span>
            <strong className="metric-value">{selectedCandidate.resumo.interacoes_total}</strong>
          </article>
        </section>
      ) : null}

      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">Crescimento de usuÃƒÂ¡rios da plataforma</h2>
            <p className="subtitle">SÃƒÂ©rie acumulada considerando todas as campanhas.</p>
          </div>
          <span className="pill">Todas as campanhas</span>
        </div>
        {renderLineChart(globalGrowthPoints)}
      </section>

      <section className="grid grid-2" style={{ marginBottom: 20 }}>
        <article className="card analytics-panel">
          <div className="section-heading">
            <div>
              <h2 className="section-title">EstÃƒÂ¡gio de conversÃƒÂ£o da plataforma</h2>
              <p className="subtitle">Total geral dos usuÃƒÂ¡rios em cada estÃƒÂ¡gio de KPI/funil.</p>
            </div>
            <span className="pill ok">{globalFunnelTotal} usuÃƒÂ¡rio(s)</span>
          </div>
          <div className="campaign-pie-layout">
            <div
              className="campaign-pie-chart"
              style={{
                background: `conic-gradient(${globalPieSegments
                  .map((segment) => `${segment.color} ${segment.start}% ${segment.end}%`)
                  .join(", ")})`
              }}
            >
              <div className="campaign-pie-core">
                <strong>{snapshot.totais.eleitores}</strong>
                <span>usuÃƒÂ¡rios</span>
              </div>
            </div>
            <div className="campaign-pie-legend">
              {globalPieSegments.map((segment) => (
                <div className="campaign-pie-legend-item" key={segment.label}>
                  <span className="campaign-pie-legend-swatch" style={{ background: segment.color }} />
                  <div>
                    <strong>{segment.label}</strong>
                    <div className="muted">{segment.total} usuÃƒÂ¡rio(s)</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="card analytics-panel">
          <div className="section-heading">
            <div>
              <h2 className="section-title">Mensagens tratadas por candidato</h2>
              <p className="subtitle">Volume total de interaÃƒÂ§ÃƒÂµes processadas por campanha.</p>
            </div>
            <span className="pill">Mensagens</span>
          </div>
          <div className="analytics-stack">
            {snapshot.campanhas.map((campaign, index) => (
              <div className="analytics-bar-row" key={`${campaign.id_candidato}-messages`}>
                <div className="analytics-bar-label">
                  <strong>{campaign.nome_urna}</strong>
                  <span className="muted">{campaign.interacoes_total} mensagem(ns)</span>
                </div>
                <div className="analytics-bar-track">
                  <div
                    className="analytics-bar-fill"
                    style={{
                      width: `${Math.max((campaign.interacoes_total / maxMessages) * 100, 6)}%`,
                      background: getCampaignChartColor(index + 5)
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">Densidade da base por campanha</h2>
            <p className="subtitle">
              Comparativo consolidado para priorizar onde aprofundar a operaÃƒÂ§ÃƒÂ£o.
            </p>
          </div>
          <span className="pill">Drill-down por candidato</span>
        </div>
        <div className="analytics-stack">
          {snapshot.campanhas.map((campaign, index) => (
            <div className="analytics-bar-row" key={campaign.id_candidato}>
              <div className="analytics-bar-label">
                <strong>{campaign.nome_urna}</strong>
                <span className="muted">
                  {campaign.total_eleitores} eleitores | {campaign.interacoes_24h} interaÃƒÂ§ÃƒÂµes em 24h
                </span>
              </div>
              <div className="analytics-bar-track">
                <div
                  className="analytics-bar-fill"
                  style={{
                    width: `${Math.max((campaign.total_eleitores / maxEleitores) * 100, 6)}%`,
                    background: getCampaignChartColor(index)
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-2" style={{ marginBottom: 20 }}>
        <article className="card analytics-panel">
          <div className="section-heading">
            <div>
              <h2 className="section-title">Cobertura da meta de contatos</h2>
              <p className="subtitle">
                Comparativo executivo do quanto cada campanha jÃƒÂ¡ conseguiu transformar a meta de
                contatos em base real.
              </p>
            </div>
            <span className="pill">Meta vs realizado</span>
          </div>
          <div className="analytics-stack">
            {snapshot.campanhas.map((campaign, index) => (
              <div className="analytics-bar-row" key={`${campaign.id_candidato}-meta`}>
                <div className="analytics-bar-label">
                  <strong>{campaign.nome_urna}</strong>
                  <span className="muted">{Number(campaign.meta_contatos_percentual).toFixed(2)}% da meta</span>
                </div>
                <div className="analytics-bar-track">
                  <div
                    className="analytics-bar-fill analytics-bar-fill-soft"
                    style={{
                      width: `${Math.max((Number(campaign.meta_contatos_percentual) / maxMetaCoverage) * 100, 6)}%`,
                      background: getCampaignChartColor(index + 3)
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="card analytics-panel">
          <div className="section-heading">
            <div>
              <h2 className="section-title">Rankings executivos</h2>
              <p className="subtitle">
                Top campanhas por conversÃƒÂ£o, atividade recente e cobertura de meta.
              </p>
            </div>
            <span className="pill">Drill-up de priorizaÃƒÂ§ÃƒÂ£o</span>
          </div>
          <div className="grid grid-3">
            <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
              <span className="metric-label">Melhor conversÃƒÂ£o</span>
              <strong className="metric-value">{snapshot.rankings.conversao[0]?.nome_urna ?? "sem dados"}</strong>
              <span className="muted">
                {snapshot.rankings.conversao[0] ? `${snapshot.rankings.conversao[0].valor.toFixed(2)}%` : "aguardando base"}
              </span>
            </article>
            <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
              <span className="metric-label">Maior atividade em 24h</span>
              <strong className="metric-value">{snapshot.rankings.atividade_24h[0]?.nome_urna ?? "sem dados"}</strong>
              <span className="muted">
                {snapshot.rankings.atividade_24h[0]
                  ? `${snapshot.rankings.atividade_24h[0].valor.toFixed(0)} interaÃƒÂ§ÃƒÂµes`
                  : "aguardando atividade"}
              </span>
            </article>
            <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
              <span className="metric-label">Maior cobertura de meta</span>
              <strong className="metric-value">{snapshot.rankings.cobertura_meta[0]?.nome_urna ?? "sem dados"}</strong>
              <span className="muted">
                {snapshot.rankings.cobertura_meta[0]
                  ? `${snapshot.rankings.cobertura_meta[0].valor.toFixed(2)}%`
                  : "aguardando meta"}
              </span>
            </article>
          </div>
        </article>
      </section>

      <section className="card">
        <h2 className="section-title">Campanhas com indicadores</h2>
        <div className="table-responsive">
          <table className="table analytics-table">
            <thead>
              <tr>
                <th>Candidato</th>
                <th>Status</th>
                <th>Eleitores</th>
                <th>Engajados</th>
                <th>Apoiadores</th>
                <th>InteraÃƒÂ§ÃƒÂµes</th>
                <th>ConversÃƒÂ£o</th>
                <th>Meta</th>
                <th>AÃƒÂ§ÃƒÂµes</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.campanhas.map((campaign) => (
                <tr key={campaign.id_candidato}>
                  <td>
                    <strong>{campaign.nome_urna}</strong>
                    <div className="muted">{campaign.nome_campanha ?? `Campanha ${campaign.id_candidato}`}</div>
                  </td>
                  <td>{campaign.status_campanha ?? "sem status"}</td>
                  <td>{campaign.total_eleitores}</td>
                  <td>{campaign.leads_engajados}</td>
                  <td>{campaign.apoiadores}</td>
                  <td>
                    <div>{campaign.interacoes_total}</div>
                    <div className="muted">{campaign.interacoes_24h} em 24h</div>
                  </td>
                  <td>{Number(campaign.taxa_conversao_percentual).toFixed(2)}%</td>
                  <td>
                    <div>{Number(campaign.meta_contatos_percentual).toFixed(2)}% contatos</div>
                    <div className="muted">{Number(campaign.meta_conversao_percentual).toFixed(2)}% apoiadores</div>
                  </td>
                  <td>
                    <div className="actions">
                      <Link className="button secondary" href={`/campanhas/${campaign.id_candidato}`}>
                        Abrir campanha
                      </Link>
                      <Link className="button secondary" href={`/campanhas/${campaign.id_candidato}/inteligencia`}>
                        InteligÃƒÂªncia
                      </Link>
                      <Link className="button secondary" href={`/campanhas/${campaign.id_candidato}/conversas`}>
                        Conversas
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function getCampaignChartColor(index: number) {
  const palette = [
    "#ff7a59",
    "#ffa94d",
    "#ffd43b",
    "#69db7c",
    "#38d9a9",
    "#4dabf7",
    "#748ffc",
    "#da77f2"
  ];
  return palette[index % palette.length];
}

function renderLineChart(points: Array<{ x: number; y: number; data_referencia: string; total_acumulado: number }>) {
  if (points.length === 0) {
    return <div className="step-panel-callout">Sem sÃƒÂ©rie de crescimento disponÃƒÂ­vel.</div>;
  }

  return (
    <div className="campaign-line-chart">
      <div className="campaign-line-axis campaign-line-axis-y">Qtd</div>
      <div className="campaign-line-grid" />
      <svg aria-label="Crescimento acumulado da plataforma" className="campaign-line-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline className="campaign-line-path" fill="none" points={points.map((item) => `${item.x},${item.y}`).join(" ")} />
        {points.map((item) => (
          <circle className="campaign-line-point" cx={item.x} cy={item.y} key={item.data_referencia} r={1.8}>
            <title>{`${formatShortDate(item.data_referencia)}: ${item.total_acumulado} usuÃƒÂ¡rio(s)`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

function buildGrowthPoints(
  growth: { data_referencia: string; total_acumulado: number }[],
  maxGrowth: number
) {
  return growth.map((item, index, array) => {
    const x = array.length === 1 ? 50 : (index / (array.length - 1)) * 100;
    const y = 100 - (item.total_acumulado / maxGrowth) * 88 - 6;

    return {
      ...item,
      x,
      y: Math.max(y, 6)
    };
  });
}

function buildPieSegments(funil: { etapa_funil: string; total: number }[]) {
  const total = Math.max(funil.reduce((acc, item) => acc + item.total, 0), 1);
  let cursor = 0;

  return funil.map((item, index) => {
    const slice = (item.total / total) * 100;
    const start = cursor;
    const end = cursor + slice;
    cursor = end;

    return {
      label: item.etapa_funil.replace(/_/g, " "),
      total: item.total,
      color: getCampaignChartColor(index),
      start,
      end
    };
  });
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value));
}
