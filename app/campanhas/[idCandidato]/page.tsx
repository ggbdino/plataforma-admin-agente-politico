import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import {
  authenticateCampaignAnalyticsAction,
  importCampaignElectorBaseAction
} from "@/lib/actions/campaign-analytics-action";
import { getCampaignAnalyticsSnapshot } from "@/lib/repositories/campaign-analytics";

export const dynamic = "force-dynamic";

type CampaignOperationalPageProps = {
  params: Promise<{
    idCandidato: string;
  }>;
  searchParams?: Promise<{
    feedback?: string;
    mensagem?: string;
    periodo?: string;
  }>;
};

export default async function CampaignOperationalPage({
  params,
  searchParams
}: CampaignOperationalPageProps) {
  const { idCandidato } = await params;
  const query = searchParams ? await searchParams : undefined;
  const selectedPeriodDays = parsePeriodDays(query?.periodo);
  const cookieStore = await cookies();
  const hasAccess =
    cookieStore.get(`campaign-analytics-access-${idCandidato}`)?.value === "ok";
  const snapshot = await getCampaignAnalyticsSnapshot(idCandidato, selectedPeriodDays);

  if (!snapshot) {
    notFound();
  }

  if (!hasAccess) {
    return (
      <main className="page-shell">
        {query?.feedback && query?.mensagem ? (
          <section
            className={`feedback-banner ${query.feedback === "sucesso" ? "ok" : "error"}`}
          >
            <strong>
              {query.feedback === "sucesso"
                ? "Operacao concluida."
                : "Acesso operacional nao liberado."}
            </strong>
            <div style={{ marginTop: 6 }}>{query.mensagem}</div>
          </section>
        ) : null}

        <section className="hero-card">
          <span className="pill">Campanha individual</span>
          <h1 className="title">Painel operacional da campanha</h1>
          <p className="subtitle">
            Entrada protegida para exploracao de conversas, conversao, metas e indicadores da
            campanha de forma individualizada por candidato.
          </p>
          <div className="actions" style={{ marginTop: 18 }}>
            <Link className="button secondary" href="/candidatos">
              Voltar para candidatos
            </Link>
            <Link className="button secondary" href="/estatisticas">
              Ver estatisticas do admin
            </Link>
          </div>
        </section>

        <section className="card manager-auth-card">
          <h2 className="section-title">Liberar acesso operacional da campanha</h2>
          <p className="subtitle">
            Informe o numero do gestor da campanha ou a senha mestra <span className="mono">654321</span>.
          </p>
          <form action={authenticateCampaignAnalyticsAction} className="manager-auth-form">
            <input name="idCandidato" type="hidden" value={idCandidato} />
            <input name="redirectTo" type="hidden" value={`/campanhas/${idCandidato}`} />
            <label className="step-note">
              <span>Senha de acesso</span>
              <input className="step-input" name="senha" type="password" />
            </label>
            <button className="button" type="submit">
              Entrar na campanha
            </button>
          </form>
        </section>
      </main>
    );
  }

  const maxFunil = Math.max(...snapshot.funil.map((item) => item.total), 1);
  const maxOrigem = Math.max(...snapshot.origens.map((item) => item.total), 1);
  const maxDaily = Math.max(
    ...snapshot.evolucaoDiaria.flatMap((item) => [item.novos_leads, item.interacoes]),
    1
  );

  return (
    <main className="page-shell">
      {query?.feedback && query?.mensagem ? (
        <section
          className={`feedback-banner ${query.feedback === "sucesso" ? "ok" : "error"}`}
        >
          <strong>{query.feedback === "sucesso" ? "Operacao concluida." : "Falha operacional."}</strong>
          <div style={{ marginTop: 6 }}>{query.mensagem}</div>
        </section>
      ) : null}

      <section className="hero-card">
        <span className="pill">Campanha individual</span>
        <h1 className="title">
          {snapshot.cabecalho.nome_urna} <span className="mono">#{snapshot.cabecalho.id_candidato}</span>
        </h1>
        <p className="subtitle">
          Visao operacional da campanha com funil, metas, conversas recentes e indicadores para
          drill-down orientado pela equipe gestora.
        </p>
        <div className="hero-meta">
          <span className="pill">{snapshot.cabecalho.nome_campanha ?? "Campanha sem nome consolidado"}</span>
          <span className="pill">Status {snapshot.cabecalho.status_campanha ?? "em configuracao"}</span>
          <span className="pill">
            Numero oficial {snapshot.cabecalho.numero_agente_oficial ?? "pendente"}
          </span>
        </div>
        <div className="actions" style={{ marginTop: 18 }}>
          <Link className="button secondary" href={`/campanhas/${idCandidato}/conversas`}>
            Abrir console de conversas
          </Link>
          <Link
            className="button secondary"
            href={`/api/campanhas/${idCandidato}/exportar?periodo=${snapshot.periodoSelecionadoDias}`}
          >
            Exportar executivo
          </Link>
          <Link className="button secondary" href={`/candidatos/${idCandidato}`}>
            Voltar para implantacao
          </Link>
        </div>
      </section>

      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">Importacao controlada da base de eleitores</h2>
            <p className="subtitle">
              Upload administrativo de planilha CSV com <strong>nome</strong>, <strong>telefone</strong> e{" "}
              <strong>email</strong> para alimentar a base individual desta campanha.
            </p>
          </div>
          <span className="pill">Controle do administrador</span>
        </div>
        <form action={importCampaignElectorBaseAction} className="step-form-grid" encType="multipart/form-data">
          <input name="idCandidato" type="hidden" value={idCandidato} />
          <input
            name="redirectTo"
            type="hidden"
            value={`/campanhas/${idCandidato}?periodo=${snapshot.periodoSelecionadoDias}`}
          />
          <input name="origemCaptacao" type="hidden" value="importacao_admin" />
          <label className="step-note">
            <span>Arquivo CSV da base</span>
            <input accept=".csv,.txt" className="step-input" name="arquivo" type="file" />
          </label>
          <label className="step-note">
            <span>Formato esperado</span>
            <div className="step-panel-callout">
              Cabecalho com colunas <span className="mono">nome</span>, <span className="mono">telefone</span> e{" "}
              <span className="mono">email</span>. Telefones repetidos atualizam o eleitor existente na campanha.
            </div>
          </label>
          <div className="actions" style={{ alignItems: "end" }}>
            <button className="button" type="submit">
              Importar base de eleitores
            </button>
          </div>
        </form>
      </section>

      <section className="card" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">Recorte executivo</h2>
            <p className="subtitle">
              Ajuste a janela de leitura para acompanhar tracao recente e comparar com o ritmo
              esperado da campanha.
            </p>
          </div>
          <div className="actions">
            {[7, 14, 30].map((days) => (
              <Link
                className={`button ${snapshot.periodoSelecionadoDias === days ? "" : "secondary"}`}
                href={`/campanhas/${idCandidato}?periodo=${days}`}
                key={days}
              >
                {days} dias
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-3" style={{ marginBottom: 20 }}>
        <article className="card metric-card">
          <span className="metric-label">Base total de eleitores</span>
          <strong className="metric-value">{snapshot.resumo.total_eleitores}</strong>
          <span className="muted">
            {snapshot.resumo.meta_contatos_percentual}% da meta de contatos do WhatsApp
          </span>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Taxa de conversao</span>
          <strong className="metric-value">{formatPercent(snapshot.resumo.taxa_conversao_percentual)}</strong>
          <span className="muted">
            Meta eleitoral {formatPercent(snapshot.cabecalho.meta_conversao_votos ?? 0)}
          </span>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Interacoes nas ultimas 24h</span>
          <strong className="metric-value">{snapshot.resumo.interacoes_24h}</strong>
          <span className="muted">{snapshot.resumo.interacoes_total} interacoes acumuladas</span>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Leads no periodo</span>
          <strong className="metric-value">{snapshot.resumoPeriodo.novos_leads_periodo}</strong>
          <span className="muted">
            {snapshot.resumoPeriodo.interacoes_periodo} interacoes em {snapshot.periodoSelecionadoDias} dias
          </span>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Conversao no periodo</span>
          <strong className="metric-value">
            {formatPercent(snapshot.resumoPeriodo.conversao_periodo_percentual)}
          </strong>
          <span className="muted">
            {snapshot.resumoPeriodo.apoiadores_periodo} apoiadores captados na janela
          </span>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Leads qualificados</span>
          <strong className="metric-value">{snapshot.resumo.leads_qualificados}</strong>
          <span className="muted">{snapshot.resumo.leads_novos} ainda em novo_lead</span>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Apoiadores e indecisos</span>
          <strong className="metric-value">
            {snapshot.resumo.apoiadores} / {snapshot.resumo.indecisos}
          </strong>
          <span className="muted">Saldo de tracao politica real no funil</span>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Eventos e presenca</span>
          <strong className="metric-value">
            {snapshot.resumo.confirmacoes_evento} / {snapshot.resumo.comparecimentos_evento}
          </strong>
          <span className="muted">{snapshot.resumo.eventos_ativos} eventos ativos no momento</span>
        </article>
      </section>

      <section className="grid grid-2" style={{ marginBottom: 20 }}>
        <article className="card analytics-panel">
          <div className="section-heading">
            <div>
              <h2 className="section-title">Meta vs realizado</h2>
              <p className="subtitle">
                Leitura executiva para saber onde a campanha esta acima do ritmo e onde ainda ha
                gap de captacao e conversao.
              </p>
            </div>
            <span className="pill">Controle gerencial</span>
          </div>
          <div className="analytics-stack">
            <div className="analytics-bar-row">
              <div className="analytics-bar-label">
                <strong>Base de contatos</strong>
                <span className="muted">
                  {snapshot.metas.base_total_atual} de {snapshot.metas.meta_contatos_whatsapp}
                </span>
              </div>
              <div className="analytics-bar-track">
                <div
                  className="analytics-bar-fill"
                  style={{ width: `${Math.max(Math.min(snapshot.metas.realizado_contatos_percentual, 100), 6)}%` }}
                />
              </div>
            </div>
            <div className="muted">
              Cobertura {formatPercent(snapshot.metas.realizado_contatos_percentual)} | gap restante{" "}
              {snapshot.metas.gap_contatos}
            </div>
            <div className="analytics-bar-row">
              <div className="analytics-bar-label">
                <strong>Meta de apoiadores</strong>
                <span className="muted">
                  {snapshot.metas.apoiadores_atuais} de {snapshot.metas.meta_conversao_votos}
                </span>
              </div>
              <div className="analytics-bar-track">
                <div
                  className="analytics-bar-fill analytics-bar-fill-soft"
                  style={{ width: `${Math.max(Math.min(snapshot.metas.realizado_conversao_percentual, 100), 6)}%` }}
                />
              </div>
            </div>
            <div className="muted">
              Cobertura {formatPercent(snapshot.metas.realizado_conversao_percentual)} | gap restante{" "}
              {snapshot.metas.gap_conversao}
            </div>
          </div>
        </article>

        <article className="card analytics-panel">
          <div className="section-heading">
            <div>
              <h2 className="section-title">Funil da campanha</h2>
              <p className="subtitle">
                Distribuicao atual dos eleitores por etapa para permitir drill-down na maturidade
                da base.
              </p>
            </div>
            <span className="pill ok">Drill-down por etapa</span>
          </div>
          <div className="analytics-stack">
            {snapshot.funil.map((item) => (
              <div className="analytics-bar-row" key={item.etapa_funil}>
                <div className="analytics-bar-label">
                  <strong>{labelStage(item.etapa_funil)}</strong>
                  <span className="muted">{item.total} eleitor(es)</span>
                </div>
                <div className="analytics-bar-track">
                  <div
                    className="analytics-bar-fill"
                    style={{ width: `${Math.max((item.total / maxFunil) * 100, 6)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="card analytics-panel">
          <div className="section-heading">
            <div>
              <h2 className="section-title">Origens de captacao</h2>
              <p className="subtitle">
                Leitura dos canais que mais trazem base para a campanha.
              </p>
            </div>
            <span className="pill">Drill-up por canal</span>
          </div>
          <div className="analytics-stack">
            {snapshot.origens.map((item) => (
              <div className="analytics-bar-row" key={item.origem_captacao}>
                <div className="analytics-bar-label">
                  <strong>{item.origem_captacao}</strong>
                  <span className="muted">{item.total} lead(s)</span>
                </div>
                <div className="analytics-bar-track">
                  <div
                    className="analytics-bar-fill analytics-bar-fill-soft"
                    style={{ width: `${Math.max((item.total / maxOrigem) * 100, 6)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid grid-2" style={{ marginBottom: 20 }}>
        <article className="card analytics-panel">
          <div className="section-heading">
            <div>
              <h2 className="section-title">Temas dominantes da base</h2>
              <p className="subtitle">
                Assuntos com maior presenca na campanha para orientar mensagens, agenda e
                priorizacao da equipe.
              </p>
            </div>
            <span className="pill">Inteligencia de mensagem</span>
          </div>
          <div className="analytics-stack">
            {snapshot.temas.map((item) => (
              <div className="analytics-bar-row" key={item.tema}>
                <div className="analytics-bar-label">
                  <strong>{item.tema.replace(/_/g, " ")}</strong>
                  <span className="muted">{item.total} ocorrencia(s)</span>
                </div>
                <div className="analytics-bar-track">
                  <div
                    className="analytics-bar-fill"
                    style={{
                      width: `${Math.max(
                        (item.total / Math.max(...snapshot.temas.map((theme) => theme.total), 1)) * 100,
                        6
                      )}%`
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
              <h2 className="section-title">Ritmo do periodo</h2>
              <p className="subtitle">
                Separacao entre fluxo inbound e outbound para acompanhar a cadencia operacional da
                campanha.
              </p>
            </div>
            <span className="pill">Monitoramento diario</span>
          </div>
          <div className="grid grid-2">
            <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
              <span className="metric-label">Inbound no periodo</span>
              <strong className="metric-value">{snapshot.resumoPeriodo.inbound_periodo}</strong>
              <span className="muted">Resposta espontanea da base</span>
            </article>
            <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
              <span className="metric-label">Outbound no periodo</span>
              <strong className="metric-value">{snapshot.resumoPeriodo.outbound_periodo}</strong>
              <span className="muted">Acionamento da campanha</span>
            </article>
            <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
              <span className="metric-label">Score medio de engajamento</span>
              <strong className="metric-value">{snapshot.resumo.score_engajamento_medio}</strong>
              <span className="muted">Media acumulada da base</span>
            </article>
            <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
              <span className="metric-label">Score medio de propensao</span>
              <strong className="metric-value">{snapshot.resumo.score_propensao_medio}</strong>
              <span className="muted">Media acumulada da intencao</span>
            </article>
          </div>
        </article>
      </section>

      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">Evolucao recente</h2>
            <p className="subtitle">
              Serie curta para acompanhar novos leads e atividade conversacional nos ultimos dias.
            </p>
          </div>
          <span className="pill">Drill-up temporal</span>
        </div>
        <div className="timeline-chart">
          {snapshot.evolucaoDiaria.map((item) => (
            <div className="timeline-chart-item" key={item.data_referencia}>
              <div className="timeline-chart-bars">
                <div
                  className="timeline-chart-bar timeline-chart-bar-leads"
                  style={{ height: `${Math.max((item.novos_leads / maxDaily) * 120, 8)}px` }}
                  title={`${item.novos_leads} novos leads`}
                />
                <div
                  className="timeline-chart-bar timeline-chart-bar-interactions"
                  style={{ height: `${Math.max((item.interacoes / maxDaily) * 120, 8)}px` }}
                  title={`${item.interacoes} interacoes`}
                />
              </div>
              <div className="timeline-chart-day">
                {new Intl.DateTimeFormat("pt-BR", { month: "2-digit", day: "2-digit" }).format(
                  new Date(item.data_referencia)
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="timeline-chart-legend">
          <span className="pill">Novos leads</span>
          <span className="pill">Interacoes</span>
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <h2 className="section-title">Conversas recentes</h2>
            <p className="subtitle">
              Amostra operacional para localizar eleitores, observar sinais de conversao e abrir
              o console detalhado.
            </p>
          </div>
          <Link className="button secondary" href={`/campanhas/${idCandidato}/conversas`}>
            Ver console completo
          </Link>
        </div>
        <div className="table-responsive">
          <table className="table analytics-table">
            <thead>
              <tr>
                <th>Eleitor</th>
                <th>Origem</th>
                <th>Etapa</th>
                <th>Sinal politico</th>
                <th>Ultima mensagem</th>
                <th>Interacoes</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.conversasRecentes.map((conversation) => (
                <tr key={conversation.eleitor_uid}>
                  <td>
                    <strong>{conversation.nome ?? "Eleitor nao identificado"}</strong>
                    <div className="mono">{conversation.telefone ?? conversation.eleitor_id}</div>
                  </td>
                  <td>{conversation.origem_captacao ?? "-"}</td>
                  <td>{labelStage(conversation.etapa_funil)}</td>
                  <td>
                    <div>{conversation.intencao_voto ?? "sem leitura"}</div>
                    <div className="muted">{conversation.sentimento ?? "sentimento nao classificado"}</div>
                  </td>
                  <td className="analytics-message-cell">
                    {conversation.ultima_mensagem ?? "Sem historico textual ainda"}
                  </td>
                  <td>{conversation.total_interacoes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function labelStage(stage: string | null) {
  if (!stage) {
    return "nao_classificado";
  }

  return stage.replace(/_/g, " ");
}

function formatPercent(value: number) {
  return `${Number(value).toFixed(2)}%`;
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
