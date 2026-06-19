import Link from "next/link";
import { notFound } from "next/navigation";
import { authenticatePlatformAreaAction } from "@/lib/actions/platform-user-action";
import { getCurrentPlatformSession, hasCampaignAccess } from "@/lib/auth";
import { getCampaignAnalyticsSnapshot } from "@/lib/repositories/campaign-analytics";
import { APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

type CampaignIntelligencePageProps = {
  params: Promise<{
    idCandidato: string;
  }>;
  searchParams?: Promise<{
    feedback?: string;
    mensagem?: string;
    periodo?: string;
  }>;
};

export default async function CampaignIntelligencePage({
  params,
  searchParams
}: CampaignIntelligencePageProps) {
  const { idCandidato } = await params;
  const query = searchParams ? await searchParams : undefined;
  const selectedPeriodDays = parsePeriodDays(query?.periodo);
  const session = await getCurrentPlatformSession();
  const hasAccess = await hasCampaignAccess(session, idCandidato, "pode_ver_kpis");
  const canOperateFunnel = await hasCampaignAccess(session, idCandidato, "pode_operar_funil");
  const snapshot = await getCampaignAnalyticsSnapshot(idCandidato, selectedPeriodDays);

  if (!snapshot) {
    notFound();
  }

  if (!hasAccess) {
    return (
      <main className="page-shell">
        {query?.feedback && query?.mensagem ? (
          <section className={`feedback-banner ${query.feedback === "sucesso" ? "ok" : "error"}`}>
            <strong>{query.feedback === "sucesso" ? "Operação concluída." : "Acesso não liberado."}</strong>
            <div style={{ marginTop: 6 }}>{query.mensagem}</div>
          </section>
        ) : null}

        <section className="hero-card">
          <span className="pill">Inteligência da Campanha</span>
          <h1 className="title">Acesso protegido aos indicadores do candidato</h1>
          <p className="subtitle">
            Esta página é liberada para o gestor da campanha, o analista do candidato e o administrador.
          </p>
          <div className="hero-meta">
            <span className="pill">{APP_VERSION}</span>
          </div>
        </section>

        <section className="card manager-auth-card">
          <h2 className="section-title">Liberar Inteligência da Campanha</h2>
          <form action={authenticatePlatformAreaAction} className="manager-auth-form">
            <input name="idCandidato" type="hidden" value={idCandidato} />
            <input name="redirectTo" type="hidden" value={`/campanhas/${idCandidato}/inteligencia`} />
            <input name="contexto" type="hidden" value="inteligencia" />
            <label className="step-note">
              <span>E-mail do usuário</span>
              <input className="step-input" name="email" type="email" />
            </label>
            <label className="step-note">
              <span>Senha do usuário</span>
              <input className="step-input" name="senha" type="password" />
            </label>
            <button className="button" type="submit">
              Entrar
            </button>
          </form>
        </section>
      </main>
    );
  }

  const growthMax = Math.max(...snapshot.crescimentoBase.map((item) => item.total_acumulado), 1);
  const growthPoints = buildGrowthPoints(snapshot.crescimentoBase, growthMax);
  const funnelTotal = Math.max(snapshot.funil.reduce((acc, item) => acc + item.total, 0), 1);
  const pieSegments = buildPieSegments(snapshot.funil);
  const maxRegional = Math.max(...snapshot.distribuicaoRegional.map((item) => item.total), 1);
  const maxTheme = Math.max(...snapshot.temas.map((item) => item.total), 1);
  const maxOutsideTheme = Math.max(...snapshot.temasForaPlataforma.map((item) => item.total), 1);
  const metaContatos = Number(snapshot.metas.meta_contatos_whatsapp || 0);
  const baseAtual = Number(snapshot.metas.base_total_atual || 0);
  const metaConversao = Number(snapshot.metas.meta_conversao_votos || 0);
  const apoiadores = Number(snapshot.metas.apoiadores_atuais || 0);

  return (
    <main className="page-shell">
      <section className="hero-card">
        <span className="pill">Inteligência da Campanha</span>
        <h1 className="title">
          {snapshot.cabecalho.nome_urna} <span className="mono">#{snapshot.cabecalho.id_candidato}</span>
        </h1>
        <p className="subtitle">
          Leitura estatística do crescimento, funil, território, temas e perspectiva de conversão
          da campanha.
        </p>
        <div className="hero-meta">
          <span className="pill">{APP_VERSION}</span>
          <span className="pill">Perfil {session?.perfil ?? "autenticado"}</span>
          <span className="pill">{snapshot.resumo.total_eleitores} usuário(s)</span>
          <span className="pill">{snapshot.resumo.interacoes_total} mensagem(ns)</span>
        </div>
        <div className="actions" style={{ marginTop: 18 }}>
          <Link className="button secondary" href={`/campanhas/${idCandidato}`}>
            Painel da campanha
          </Link>
          {canOperateFunnel ? (
            <Link className="button secondary" href={`/campanhas/${idCandidato}/conversas`}>
              Conversas
            </Link>
          ) : null}
          <Link className="button secondary" href="/estatisticas">
            Visão consolidada
          </Link>
        </div>
      </section>

      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">Crescimento da base de usuários do candidato</h2>
            <p className="subtitle">Evolução acumulada desde a ativação da campanha.</p>
          </div>
          <span className="pill">Base acumulada</span>
        </div>
        {renderLineChart(growthPoints)}
      </section>

      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">Usuários por estágio do funil</h2>
            <p className="subtitle">Distribuição colorida dos usuários nos estágios de captação, relacionamento e conversão.</p>
          </div>
          <span className="pill ok">{funnelTotal} usuário(s)</span>
        </div>
        <div className="campaign-pie-layout">
          <div
            className="campaign-pie-chart"
            style={{
              background: `conic-gradient(${pieSegments
                .map((segment) => `${segment.color} ${segment.start}% ${segment.end}%`)
                .join(", ")})`
            }}
          >
            <div className="campaign-pie-core">
              <strong>{snapshot.resumo.total_eleitores}</strong>
              <span>usuários</span>
            </div>
          </div>
          <div className="campaign-pie-legend">
            {pieSegments.map((segment) => (
              <div className="campaign-pie-legend-item" key={segment.label}>
                <span className="campaign-pie-legend-swatch" style={{ background: segment.color }} />
                <div>
                  <strong>{segment.label}</strong>
                  <div className="muted">
                    {segment.total} usuário(s) | {formatPercent((segment.total / funnelTotal) * 100)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">Usuários por região, UF e cidade</h2>
            <p className="subtitle">Distribuição territorial com UF, cidade destaque e apoiadores mapeados.</p>
          </div>
          <span className="pill">Território</span>
        </div>
        <div className="analytics-stack">
          {snapshot.distribuicaoRegional.map((item, index) => (
            <div className="analytics-bar-row" key={`${item.uf}-${item.cidade_destaque ?? index}`}>
              <div className="analytics-bar-label">
                <strong>
                  {item.uf} | {item.cidade_destaque ?? "Cidade não informada"}
                </strong>
                <span className="muted">
                  {item.total} usuário(s), {item.apoiadores} apoiador(es), {item.cidades_mapeadas} cidade(s)
                </span>
              </div>
              <div className="analytics-bar-track">
                <div
                  className="analytics-bar-fill"
                  style={{
                    width: `${Math.max((item.total / maxRegional) * 100, 6)}%`,
                    background: getCampaignChartColor(index)
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">Temas abordados na plataforma do candidato</h2>
            <p className="subtitle">Temas classificados nas conversas e associados aos usuários.</p>
          </div>
          <span className="pill">Agenda programática</span>
        </div>
        <div className="analytics-stack">
          {snapshot.temas.map((item, index) => (
            <div className="analytics-bar-row" key={item.tema}>
              <div className="analytics-bar-label">
                <strong>{labelText(item.tema)}</strong>
                <span className="muted">{item.total} usuário(s)</span>
              </div>
              <div className="analytics-bar-track">
                <div
                  className="analytics-bar-fill"
                  style={{
                    width: `${Math.max((item.total / maxTheme) * 100, 6)}%`,
                    background: getCampaignChartColor(index + 2)
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">Temas fora da plataforma do candidato</h2>
            <p className="subtitle">Assuntos tratados por usuários que não aparecem no perfil, propostas ou dados cadastrados do candidato.</p>
          </div>
          <span className="pill warn">{snapshot.temasForaPlataforma.length} tema(s)</span>
        </div>
        {snapshot.temasForaPlataforma.length > 0 ? (
          <div className="analytics-stack">
            {snapshot.temasForaPlataforma.map((item, index) => (
              <div className="analytics-bar-row" key={item.tema}>
                <div className="analytics-bar-label">
                  <strong>{labelText(item.tema)}</strong>
                  <span className="muted">{item.total} usuário(s)</span>
                </div>
                <div className="analytics-bar-track">
                  <div
                    className="analytics-bar-fill analytics-bar-fill-soft"
                    style={{
                      width: `${Math.max((item.total / maxOutsideTheme) * 100, 6)}%`,
                      background: getCampaignChartColor(index + 4)
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="step-panel-callout">
            Nenhum tema externo identificado com segurança a partir do perfil cadastrado.
          </div>
        )}
      </section>

      <section className="card analytics-panel">
        <div className="section-heading">
          <div>
            <h2 className="section-title">Perspectiva de conversão e uso da ferramenta</h2>
            <p className="subtitle">Comparação entre usuários previstos no formulário, base atual e conversão esperada.</p>
          </div>
          <span className="pill">Meta vs realizado</span>
        </div>
        <div className="grid grid-2">
          {renderGoalBar("Uso da ferramenta", baseAtual, metaContatos, "usuário(s)", 0)}
          {renderGoalBar("Conversão em apoiadores", apoiadores, metaConversao, "apoiador(es)", 3)}
        </div>
      </section>
    </main>
  );
}

function renderLineChart(points: Array<{ x: number; y: number; data_referencia: string; total_acumulado: number }>) {
  if (points.length === 0) {
    return <div className="step-panel-callout">Sem série de crescimento disponível.</div>;
  }

  return (
    <div className="campaign-line-chart">
      <div className="campaign-line-axis campaign-line-axis-y">Qtd</div>
      <div className="campaign-line-grid" />
      <svg aria-label="Crescimento acumulado da base" className="campaign-line-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline className="campaign-line-path" fill="none" points={points.map((item) => `${item.x},${item.y}`).join(" ")} />
        {points.map((item) => (
          <circle className="campaign-line-point" cx={item.x} cy={item.y} key={item.data_referencia} r={1.8}>
            <title>{`${formatShortDate(item.data_referencia)}: ${item.total_acumulado} usuário(s)`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

function renderGoalBar(label: string, current: number, target: number, unit: string, colorOffset: number) {
  const percent = target > 0 ? Math.min((current / target) * 100, 100) : 0;

  return (
    <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">
        {current} / {target || 0}
      </strong>
      <span className="muted">
        {formatPercent(percent)} da previsão declarada | {unit}
      </span>
      <div className="analytics-bar-track" style={{ marginTop: 12 }}>
        <div
          className="analytics-bar-fill"
          style={{
            width: `${Math.max(percent, current > 0 ? 6 : 0)}%`,
            background: getCampaignChartColor(colorOffset)
          }}
        />
      </div>
    </article>
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
      label: labelText(item.etapa_funil),
      total: item.total,
      color: getCampaignChartColor(index),
      start,
      end
    };
  });
}

function getCampaignChartColor(index: number) {
  const palette = ["#ff7a59", "#ffa94d", "#ffd43b", "#69db7c", "#38d9a9", "#4dabf7", "#748ffc", "#da77f2"];
  return palette[index % palette.length];
}

function labelText(value: string | null) {
  return value ? value.replace(/_/g, " ") : "não classificado";
}

function formatPercent(value: number) {
  return `${Number(value).toFixed(2)}%`;
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value));
}

function parsePeriodDays(value?: string) {
  if (value === "7") {
    return 7;
  }

  if (value === "30") {
    return 30;
  }

  return 14;
}

