import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PasswordInput } from "@/components/password-input";
import { authenticatePlatformAreaAction } from "@/lib/actions/platform-user-action";
import { getCurrentPlatformSession, getDefaultPlatformRoute, hasCampaignAccess } from "@/lib/auth";
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
    if (session) {
      redirect(await getDefaultPlatformRoute(session));
    }

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
              <PasswordInput name="senha" />
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
          {session?.perfil === "administrador" ? (
            <Link className="button secondary" href="/estatisticas">
              Visão consolidada
            </Link>
          ) : null}
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
          {snapshot.distribuicaoRegional.length === 0 ? (
            <div className="step-panel-callout">
              Nenhuma UF válida com eleitor cadastrado foi encontrada para esta campanha.
            </div>
          ) : null}
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
        {renderThemeInsightGrid(snapshot.temas, snapshot.resumo.total_eleitores)}
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
          renderOutsideThemeChips(snapshot.temasForaPlataforma)
        ) : (
          <div className="step-panel-callout">
            Nenhum tema externo identificado com segurança a partir do perfil cadastrado.
          </div>
        )}
      </section>

      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">Equipe de Divulgação e tarefas territoriais</h2>
            <p className="subtitle">Tarefas de mobilização criadas pelo gestor e nível de realização por membro da equipe.</p>
          </div>
          <span className="pill ok">{formatPercent(snapshot.equipeDivulgacao.resumo.percentual_realizacao_medio)} realizado</span>
        </div>
        <div className="grid grid-4" style={{ marginBottom: 18 }}>
          <article className="metric-card"><span className="metric-label">Membros ativos</span><strong className="metric-value">{snapshot.equipeDivulgacao.resumo.membros_ativos}</strong><span className="muted">{snapshot.equipeDivulgacao.resumo.total_membros} no cadastro</span></article>
          <article className="metric-card"><span className="metric-label">Tarefas ativas</span><strong className="metric-value">{snapshot.equipeDivulgacao.resumo.tarefas_ativas}</strong><span className="muted">Em execução pela equipe</span></article>
          <article className="metric-card"><span className="metric-label">Tarefas concluídas</span><strong className="metric-value">{snapshot.equipeDivulgacao.resumo.tarefas_concluidas}</strong><span className="muted">Validadas por evidência</span></article>
          <article className="metric-card"><span className="metric-label">Acompanhamento</span><strong className="metric-value">{snapshot.equipeDivulgacao.tarefas.length}</strong><span className="muted">Tarefa(s) cadastrada(s)</span></article>
        </div>
        {snapshot.equipeDivulgacao.tarefas.length > 0 ? (
          <div className="analytics-stack" style={{ marginBottom: 18 }}>
            {snapshot.equipeDivulgacao.tarefas.slice(0, 8).map((task, index) => (
              <div className="analytics-bar-row" key={task.id}>
                <div className="analytics-bar-label">
                  <strong>{task.titulo}</strong>
                  <span className="muted">
                    {labelOutreachTaskType(task.tipo_tarefa)} | {task.total_membros} membro(s) | {task.realizado_total}/{task.meta_quantidade || 0} realizado(s)
                  </span>
                </div>
                <div className="analytics-bar-track">
                  <div
                    className="analytics-bar-fill"
                    style={{
                      width: `${Math.max(Math.min(Number(task.percentual_realizacao || 0), 100), 4)}%`,
                      background: getCampaignChartColor(index + 5)
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="step-panel-callout" style={{ marginBottom: 18 }}>
            Nenhuma tarefa da Equipe de Divulgação foi criada para esta campanha.
          </div>
        )}
        <div className="responsive-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Membro</th>
                <th>Território</th>
                <th>Grupo</th>
                <th>Tarefas</th>
                <th>Realização</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.equipeDivulgacao.membros.slice(0, 12).map((member) => (
                <tr key={member.id}>
                  <td><strong>{member.nome}</strong><br /><span className="muted">{member.papel ?? "Membro"}</span></td>
                  <td>{[member.cidade, member.uf].filter(Boolean).join("/") || member.bairro || "-"}</td>
                  <td>{member.grupo ?? "-"}</td>
                  <td>{member.tarefas_concluidas}/{member.total_tarefas}</td>
                  <td>{formatPercent(member.percentual_realizacao)}</td>
                </tr>
              ))}
              {snapshot.equipeDivulgacao.membros.length === 0 ? <tr><td colSpan={5}>Equipe ainda não importada.</td></tr> : null}
            </tbody>
          </table>
        </div>
        {session?.perfil === "gestor_campanha" || session?.perfil === "administrador" ? (
          <div className="actions" style={{ marginTop: 18 }}>
            <Link className="button secondary" href={`/gestor/candidato/${idCandidato}/divulgacao`}>
              Gerenciar Equipe de Divulgação
            </Link>
          </div>
        ) : null}
      </section>
      <section className="card analytics-panel">
        <div className="section-heading">
          <div>
            <h2 className="section-title">Perspectiva de conversão e uso da ferramenta</h2>
            <p className="subtitle">Comparação entre usuários previstos no formulário, base atual e conversão esperada.</p>
          </div>
          <span className="pill">Meta vs realizado</span>
        </div>
        {renderGoalPowerPanel(baseAtual, metaContatos, apoiadores, metaConversao)}
      </section>
    </main>
  );
}

function renderThemeInsightGrid(themes: Array<{ tema: string; total: number }>, totalUsers: number) {
  if (themes.length === 0) {
    return <div className="step-panel-callout">Nenhum tema foi identificado nas conversas desta campanha.</div>;
  }

  const max = Math.max(...themes.map((theme) => theme.total), 1);

  return (
    <div className="theme-insight-grid">
      {themes.map((theme, index) => {
        const percent = totalUsers > 0 ? (theme.total / totalUsers) * 100 : 0;
        const intensity = Math.max(theme.total / max, 0.08);

        return (
          <article
            className="theme-insight-card"
            key={theme.tema}
            style={{
              borderColor: getCampaignChartColor(index),
              background: `linear-gradient(135deg, color-mix(in srgb, ${getCampaignChartColor(index)} ${Math.round(
                18 + intensity * 22
              )}%, white), rgba(255, 255, 255, 0.96))`
            }}
          >
            <div className="theme-insight-head">
              <span className="theme-insight-rank">{String(index + 1).padStart(2, "0")}</span>
              <span className="theme-insight-signal" style={{ background: getCampaignChartColor(index) }} />
            </div>
            <strong>{labelTheme(theme.tema)}</strong>
            <div className="theme-insight-value">
              <span>{theme.total}</span>
              <small>usuário(s)</small>
            </div>
            <div className="theme-insight-meter">
              <span
                style={{
                  width: `${Math.max(percent, theme.total > 0 ? 5 : 0)}%`,
                  background: getCampaignChartColor(index)
                }}
              />
            </div>
            <div className="muted">{formatPercent(percent)} da base monitorada</div>
          </article>
        );
      })}
    </div>
  );
}

function renderOutsideThemeChips(themes: Array<{ tema: string; total: number }>) {
  return (
    <div className="outside-theme-cloud">
      {themes.map((theme, index) => (
        <article className="outside-theme-chip" key={theme.tema}>
          <span className="outside-theme-dot" style={{ background: getCampaignChartColor(index + 4) }} />
          <strong>{labelTheme(theme.tema)}</strong>
          <span>{theme.total} usuário(s)</span>
        </article>
      ))}
    </div>
  );
}

function renderGoalPowerPanel(baseAtual: number, metaContatos: number, apoiadores: number, metaConversao: number) {
  const contactPercent = metaContatos > 0 ? Math.min((baseAtual / metaContatos) * 100, 100) : 0;
  const conversionPercent = metaConversao > 0 ? Math.min((apoiadores / metaConversao) * 100, 100) : 0;
  const contactGap = Math.max(metaContatos - baseAtual, 0);
  const conversionGap = Math.max(metaConversao - apoiadores, 0);

  return (
    <div className="goal-power-layout">
      {renderGoalGauge("Uso da ferramenta", baseAtual, metaContatos, contactPercent, "usuários", "#4dabf7")}
      {renderGoalGauge("Conversão em apoiadores", apoiadores, metaConversao, conversionPercent, "apoiadores", "#38d9a9")}
      <div className="goal-power-side">
        <article>
          <span className="metric-label">Gap de base</span>
          <strong>{contactGap}</strong>
          <small>usuário(s) até a previsão declarada</small>
        </article>
        <article>
          <span className="metric-label">Gap de conversão</span>
          <strong>{conversionGap}</strong>
          <small>apoiador(es) até a meta esperada</small>
        </article>
        <article>
          <span className="metric-label">Eficiência atual</span>
          <strong>{baseAtual > 0 ? formatPercent((apoiadores / baseAtual) * 100) : "0.00%"}</strong>
          <small>apoiadores em relação à base cadastrada</small>
        </article>
      </div>
    </div>
  );
}

function renderGoalGauge(
  label: string,
  current: number,
  target: number,
  percent: number,
  unit: string,
  color: string
) {
  const circumference = 2 * Math.PI * 44;
  const dash = (percent / 100) * circumference;

  return (
    <article className="goal-gauge-card">
      <div className="goal-gauge-visual">
        <svg aria-label={`${label}: ${formatPercent(percent)}`} viewBox="0 0 110 110">
          <circle className="goal-gauge-base" cx="55" cy="55" r="44" />
          <circle
            className="goal-gauge-progress"
            cx="55"
            cy="55"
            r="44"
            stroke={color}
            strokeDasharray={`${dash} ${circumference - dash}`}
          />
        </svg>
        <div>
          <strong>{formatPercent(percent)}</strong>
          <span>realizado</span>
        </div>
      </div>
      <div className="goal-gauge-copy">
        <span className="metric-label">{label}</span>
        <strong>
          {current} / {target || 0}
        </strong>
        <span className="muted">{unit}</span>
      </div>
    </article>
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


function labelOutreachTaskType(value: string) {
  const labels: Record<string, string> = {
    inserir_contatos: "Inserir novos contatos",
    convidar_eventos: "Convidar para eventos",
    captar_eleitores: "Captar eleitores",
    visitar_locais: "Visitar locais",
    participar_reunioes: "Participar de reuniões",
    panfletar: "Panfletar",
    divulgar_localidade: "Divulgar em localidade",
    outros: "Outras ações"
  };
  return labels[value] ?? labelText(value);
}
function getCampaignChartColor(index: number) {
  const palette = ["#ff7a59", "#ffa94d", "#ffd43b", "#69db7c", "#38d9a9", "#4dabf7", "#748ffc", "#da77f2"];
  return palette[index % palette.length];
}

function labelText(value: string | null) {
  return value ? value.replace(/_/g, " ") : "não classificado";
}

function labelTheme(value: string | null) {
  const normalized = String(value ?? "").trim();
  const labels: Record<string, string> = {
    seguranca_publica: "Segurança pública",
    "seguranca publica": "Segurança pública",
    saude: "Saúde",
    educacao: "Educação",
    transporte_e_mobilidade: "Transporte e mobilidade",
    moradia_e_regularizacao: "Moradia e regularização",
    emprego_e_renda: "Emprego e renda",
    assistencia_social: "Assistência social",
    eventos_e_reunioes: "Eventos e reuniões",
    materiais_e_divulgacao: "Materiais e divulgação",
    propostas_do_candidato: "Propostas do candidato",
    mobilizacao_da_equipe: "Mobilização da equipe",
    infraestrutura_urbana: "Infraestrutura urbana",
    meio_ambiente: "Meio ambiente",
    cultura_esporte_e_lazer: "Cultura, esporte e lazer",
    geral: "Geral",
    nao_classificado: "Não classificado",
    "nao classificado": "Não classificado"
  };

  return labels[normalized] ?? labelText(normalized);
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
