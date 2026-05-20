import Link from "next/link";
import { notFound } from "next/navigation";
import {
  importCampaignElectorBaseAction,
  recalculateCampaignFunnelCycleAction
} from "@/lib/actions/campaign-analytics-action";
import { authenticatePlatformAreaAction } from "@/lib/actions/platform-user-action";
import { getCurrentPlatformSession, hasCampaignAccess } from "@/lib/auth";
import { getCampaignAnalyticsSnapshot } from "@/lib/repositories/campaign-analytics";
import { getCampaignGovernanceSnapshot } from "@/lib/repositories/governance";

export const dynamic = "force-dynamic";

type CampaignOperationalPageProps = {
  params: Promise<{
    idCandidato: string;
  }>;
  searchParams?: Promise<{
    operacao?: string;
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
  const session = await getCurrentPlatformSession();
  const hasAccess = await hasCampaignAccess(session, idCandidato, "pode_ver_kpis");
  const snapshot = await getCampaignAnalyticsSnapshot(idCandidato, selectedPeriodDays);
  const governance = await getCampaignGovernanceSnapshot(idCandidato);

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
                ? "Operação concluída."
                : "Acesso operacional não liberado."}
            </strong>
            <div style={{ marginTop: 6 }}>{query.mensagem}</div>
          </section>
        ) : null}

        <section className="hero-card">
          <span className="pill">Campanha individual</span>
          <h1 className="title">Painel operacional da campanha</h1>
          <p className="subtitle">
            Entrada protegida para exploração de conversas, conversão, metas e indicadores da
            campanha de forma individualizada por candidato.
          </p>
          <div className="actions" style={{ marginTop: 18 }}>
            <Link className="button secondary" href="/candidatos">
              Voltar para candidatos
            </Link>
            <Link className="button secondary" href="/estatisticas">
              Ver Inteligência da Campanha
            </Link>
          </div>
        </section>

        <section className="card manager-auth-card">
          <h2 className="section-title">Liberar acesso operacional da campanha</h2>
          <p className="subtitle">
            Informe o e-mail e a senha de um usuário cadastrado com permissão para visualizar os indicadores e operar o funil desta campanha.
          </p>
          <form action={authenticatePlatformAreaAction} className="manager-auth-form">
            <input name="idCandidato" type="hidden" value={idCandidato} />
            <input name="redirectTo" type="hidden" value={`/campanhas/${idCandidato}`} />
            <input name="contexto" type="hidden" value="campanha" />
            <label className="step-note">
              <span>E-mail do usuário</span>
              <input className="step-input" name="email" type="email" />
            </label>
            <label className="step-note">
              <span>Senha do usuário</span>
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
          <strong>{query.feedback === "sucesso" ? "Operação concluída." : "Falha operacional."}</strong>
          <div style={{ marginTop: 6 }}>{query.mensagem}</div>
        </section>
      ) : null}

      <section className="hero-card">
        <span className="pill">Campanha individual</span>
        <h1 className="title">
          {snapshot.cabecalho.nome_urna} <span className="mono">#{snapshot.cabecalho.id_candidato}</span>
        </h1>
        <p className="subtitle">
          Visão operacional da campanha com funil, metas, conversas recentes e indicadores para
          drill-down orientado pela equipe gestora.
        </p>
        <div className="hero-meta">
          <span className="pill">{snapshot.cabecalho.nome_campanha ?? "Campanha sem nome consolidado"}</span>
          <span className="pill">Status {snapshot.cabecalho.status_campanha ?? "em configuração"}</span>
          <span className="pill">
            Número oficial {snapshot.cabecalho.numero_agente_oficial ?? "pendente"}
          </span>
          {session ? <span className="pill">Usuário {session.nome}</span> : null}
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
            Voltar para implantação
          </Link>
        </div>
      </section>

      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">Importação controlada da base de eleitores</h2>
            <p className="subtitle">
              Upload administrativo de planilha CSV com <strong>nome</strong>, <strong>telefone</strong> e{" "}
              <strong>email</strong> para alimentar a base individual desta campanha.
            </p>
          </div>
          <span className="pill">Controle do administrador</span>
        </div>
        {query?.operacao === "importacao" && query?.feedback && query?.mensagem ? (
          <section
            className={`feedback-banner ${query.feedback === "sucesso" ? "ok" : "error"}`}
            style={{ marginBottom: 16 }}
          >
            <strong>
              {query.feedback === "sucesso"
                ? "Importação processada."
                : "Falha no processamento da importação."}
            </strong>
            <div style={{ marginTop: 6 }}>{query.mensagem}</div>
          </section>
        ) : null}
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
              Cabeçalho com colunas <span className="mono">nome</span>, <span className="mono">telefone</span> e{" "}
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

      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">Completar ciclo do funil</h2>
            <p className="subtitle">
              Recalcula etapa do funil, intenção, sentimento e scores com base nas interações,
              presença em eventos e sinais atuais da base desta campanha.
            </p>
          </div>
          <span className="pill">Motor operacional</span>
        </div>
        {query?.operacao === "recalculo" && query?.feedback && query?.mensagem ? (
          <section
            className={`feedback-banner ${query.feedback === "sucesso" ? "ok" : "error"}`}
            style={{ marginBottom: 16 }}
          >
            <strong>
              {query.feedback === "sucesso"
                ? "Recálculo processado."
                : "Falha no processamento do recálculo."}
            </strong>
            <div style={{ marginTop: 6 }}>{query.mensagem}</div>
          </section>
        ) : null}
        <form action={recalculateCampaignFunnelCycleAction} className="step-form-grid">
          <input name="idCandidato" type="hidden" value={idCandidato} />
          <input
            name="redirectTo"
            type="hidden"
            value={`/campanhas/${idCandidato}?periodo=${snapshot.periodoSelecionadoDias}`}
          />
          <label className="step-note">
            <span>O que será recalculado</span>
            <div className="step-panel-callout">
              Etapa do funil, intenção de voto, sentimento, score de engajamento, score de
              propensão e último tema de interesse com base no histórico real da campanha.
            </div>
          </label>
          <label className="step-note">
            <span>Objetivo operacional</span>
            <div className="step-panel-callout">
              Atualizar a maturidade dos eleitores antes de analisar conversão, explorar o console
              de conversas e comparar desempenho entre campanhas.
            </div>
          </label>
          <div className="actions" style={{ alignItems: "end" }}>
            <button className="button" type="submit">
              Recalcular ciclo do funil
            </button>
          </div>
        </form>
      </section>

      <section className="card" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">Recorte executivo</h2>
            <p className="subtitle">
              Ajuste a janela de leitura para acompanhar tração recente e comparar com o ritmo
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
          <span className="metric-label">Taxa de conversão</span>
          <strong className="metric-value">{formatPercent(snapshot.resumo.taxa_conversao_percentual)}</strong>
          <span className="muted">
            Meta eleitoral {formatPercent(snapshot.cabecalho.meta_conversao_votos ?? 0)}
          </span>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Interações nas últimas 24h</span>
          <strong className="metric-value">{snapshot.resumo.interacoes_24h}</strong>
          <span className="muted">{snapshot.resumo.interacoes_total} interações acumuladas</span>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Leads no periodo</span>
          <strong className="metric-value">{snapshot.resumoPeriodo.novos_leads_periodo}</strong>
          <span className="muted">
            {snapshot.resumoPeriodo.interacoes_periodo} interações em {snapshot.periodoSelecionadoDias} dias
          </span>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Conversão no período</span>
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
          <span className="metric-label">Confiabilidade da base</span>
          <strong className="metric-value">
            {formatPercent(snapshot.qualidade.confiabilidade_percentual)}
          </strong>
          <span className="muted">
            {snapshot.qualidade.sem_interacoes} registro(s) ainda sem histórico de conversa
          </span>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Apoiadores e indecisos</span>
          <strong className="metric-value">
            {snapshot.resumo.apoiadores} / {snapshot.resumo.indecisos}
          </strong>
          <span className="muted">Saldo de tração política real no funil</span>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Eventos e presença</span>
          <strong className="metric-value">
            {snapshot.resumo.confirmacoes_evento} / {snapshot.resumo.comparecimentos_evento}
          </strong>
          <span className="muted">{snapshot.resumo.eventos_ativos} eventos ativos no momento</span>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Semáforo do funil</span>
          <strong className="metric-value">
            {snapshot.saudeFunil.semaforo_funil === "error"
              ? "Crítico"
              : snapshot.saudeFunil.semaforo_funil === "warning"
                ? "Atenção"
                : "Estável"}
          </strong>
          <span className="muted">
            {snapshot.saudeFunil.leads_parados_total} lead(s) com risco de estagnação
          </span>
        </article>
      </section>

      <section className="grid grid-2" style={{ marginBottom: 20 }}>
        <article className="card analytics-panel">
          <div className="section-heading">
            <div>
              <h2 className="section-title">Saúde do ciclo do funil</h2>
              <p className="subtitle">
                Leitura operacional do funil para identificar eleitores parados e etapas com perda de cadência.
              </p>
            </div>
            <span className={`pill ${snapshot.saudeFunil.semaforo_funil === "error" ? "error" : snapshot.saudeFunil.semaforo_funil === "warning" ? "warn" : "ok"}`}>
              {snapshot.saudeFunil.semaforo_funil === "error"
                ? "Crítico"
                : snapshot.saudeFunil.semaforo_funil === "warning"
                  ? "Atenção"
                  : "Estável"}
            </span>
          </div>
          <div className="grid grid-2">
            <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
              <span className="metric-label">Novos leads sem contato em 7 dias</span>
              <strong className="metric-value">{snapshot.saudeFunil.leads_sem_contato_7_dias}</strong>
              <span className="muted">Entrada fria no topo do funil</span>
            </article>
            <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
              <span className="metric-label">Qualificados sem contato em 7 dias</span>
              <strong className="metric-value">{snapshot.saudeFunil.qualificados_sem_contato_7_dias}</strong>
              <span className="muted">Risco de perda de oportunidade</span>
            </article>
            <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
              <span className="metric-label">Engajados sem contato em 14 dias</span>
              <strong className="metric-value">{snapshot.saudeFunil.engajados_sem_contato_14_dias}</strong>
              <span className="muted">Base aquecida sem progressão</span>
            </article>
            <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
              <span className="metric-label">Apoiadores sem contato em 21 dias</span>
              <strong className="metric-value">{snapshot.saudeFunil.apoiadores_sem_contato_21_dias}</strong>
              <span className="muted">Relacionamento com apoiadores em risco</span>
            </article>
          </div>
        </article>

        <article className="card analytics-panel">
          <div className="section-heading">
            <div>
              <h2 className="section-title">Alertas operacionais da campanha</h2>
              <p className="subtitle">
                Priorização objetiva do que precisa ser saneado ou reativado antes de escalar a operação.
              </p>
            </div>
            <span className="pill">Ação imediata</span>
          </div>
          <div className="analytics-stack">
            {snapshot.alertas.map((alerta) => (
              <div className="analytics-bar-row" key={alerta.codigo}>
                <div className="analytics-bar-label">
                  <strong>{alerta.titulo}</strong>
                  <span className="muted">{alerta.descricao}</span>
                  <span className={`pill ${alerta.criticidade === "error" ? "error" : alerta.criticidade === "warning" ? "warn" : "ok"}`}>
                    {alerta.criticidade === "error" ? "Crítico" : alerta.criticidade === "warning" ? "Atenção" : "OK"}
                  </span>
                </div>
                <div className="analytics-bar-track">
                  <div
                    className={`analytics-bar-fill ${alerta.criticidade === "warning" ? "analytics-bar-fill-soft" : ""}`}
                    style={{ width: `${Math.max(Math.min(alerta.total * 4, 100), 6)}%` }}
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
              <h2 className="section-title">Meta vs realizado</h2>
              <p className="subtitle">
                Leitura executiva para saber onde a campanha está acima do ritmo e onde ainda há
                gap de captação e conversão.
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
                Distribuição atual dos eleitores por etapa para permitir drill-down na maturidade
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
              <h2 className="section-title">Origens de captação</h2>
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
                Assuntos com maior presença na campanha para orientar mensagens, agenda e
                priorização da equipe.
              </p>
            </div>
            <span className="pill">Inteligência de mensagem</span>
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
              <h2 className="section-title">Ritmo do período</h2>
              <p className="subtitle">
                Separação entre fluxo inbound e outbound para acompanhar a cadência operacional da
                campanha.
              </p>
            </div>
            <span className="pill">Monitoramento diário</span>
          </div>
          <div className="grid grid-2">
            <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
              <span className="metric-label">Inbound no periodo</span>
              <strong className="metric-value">{snapshot.resumoPeriodo.inbound_periodo}</strong>
              <span className="muted">Resposta espontânea da base</span>
            </article>
            <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
              <span className="metric-label">Outbound no periodo</span>
              <strong className="metric-value">{snapshot.resumoPeriodo.outbound_periodo}</strong>
              <span className="muted">Acionamento da campanha</span>
            </article>
            <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
              <span className="metric-label">Score médio de engajamento</span>
              <strong className="metric-value">{snapshot.resumo.score_engajamento_medio}</strong>
              <span className="muted">Média acumulada da base</span>
            </article>
            <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
              <span className="metric-label">Score médio de propensão</span>
              <strong className="metric-value">{snapshot.resumo.score_propensao_medio}</strong>
              <span className="muted">Média acumulada da intenção</span>
            </article>
          </div>
        </article>
      </section>

      <section className="grid grid-2" style={{ marginBottom: 20 }}>
        <article className="card analytics-panel">
          <div className="section-heading">
            <div>
              <h2 className="section-title">Confiabilidade do dado</h2>
              <p className="subtitle">
                Medição executiva da prontidão da base para sustentar indicadores, automações e
                leitura inteligente da campanha.
              </p>
            </div>
            <span className="pill">
              Score {formatPercent(snapshot.qualidade.confiabilidade_percentual)}
            </span>
          </div>
          <div className="grid grid-2">
            <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
              <span className="metric-label">Registros sem nome</span>
              <strong className="metric-value">{snapshot.qualidade.sem_nome}</strong>
              <span className="muted">Afeta personalização e leitura da equipe</span>
            </article>
            <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
              <span className="metric-label">Registros sem telefone</span>
              <strong className="metric-value">{snapshot.qualidade.sem_telefone}</strong>
              <span className="muted">Impede acionamento e deduplicação correta</span>
            </article>
            <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
              <span className="metric-label">
                {snapshot.qualidade.email_disponivel ? "Registros sem email" : "Email na estrutura"}
              </span>
              <strong className="metric-value">
                {snapshot.qualidade.email_disponivel ? snapshot.qualidade.sem_email : "n/d"}
              </strong>
              <span className="muted">
                {snapshot.qualidade.email_disponivel
                  ? "Apoia enriquecimento e contato complementar"
                  : "Coluna de email não disponível nesta base"}
              </span>
            </article>
            <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
              <span className="metric-label">Telefones duplicados</span>
              <strong className="metric-value">{snapshot.qualidade.duplicidades_telefone}</strong>
              <span className="muted">Risco de KPI inflado ou eleitor fragmentado</span>
            </article>
            <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
              <span className="metric-label">Sem interações</span>
              <strong className="metric-value">{snapshot.qualidade.sem_interacoes}</strong>
              <span className="muted">Base fria sem validação conversacional</span>
            </article>
            <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
              <span className="metric-label">Sem contato em 30 dias</span>
              <strong className="metric-value">{snapshot.qualidade.sem_contato_30_dias}</strong>
              <span className="muted">Indica estagnação ou perda de cadência</span>
            </article>
          </div>
        </article>

        <article className="card analytics-panel">
          <div className="section-heading">
            <div>
              <h2 className="section-title">Prioridades de saneamento</h2>
              <p className="subtitle">
                Sequência sugerida para melhorar a confiabilidade da base antes de escalar
                automações e análises mais sensíveis.
              </p>
            </div>
            <span className="pill">Ação operacional</span>
          </div>
          <div className="analytics-stack">
            <div className="analytics-bar-row">
              <div className="analytics-bar-label">
                <strong>Completude mínima da base</strong>
                <span className="muted">
                  {snapshot.qualidade.sem_nome + snapshot.qualidade.sem_telefone} registro(s) com
                  dados essenciais faltando
                </span>
              </div>
              <div className="analytics-bar-track">
                <div
                  className="analytics-bar-fill"
                  style={{
                    width: `${Math.max(
                      (
                        (snapshot.qualidade.sem_nome + snapshot.qualidade.sem_telefone) /
                        Math.max(snapshot.qualidade.total_registros || 1, 1)
                      ) *
                        100,
                      6
                    )}%`
                  }}
                />
              </div>
            </div>
            <div className="analytics-bar-row">
              <div className="analytics-bar-label">
                <strong>Relacionamento comprovado</strong>
                <span className="muted">
                  {snapshot.qualidade.sem_interacoes} eleitor(es) ainda sem qualquer interação
                </span>
              </div>
              <div className="analytics-bar-track">
                <div
                  className="analytics-bar-fill analytics-bar-fill-soft"
                  style={{
                    width: `${Math.max(
                      (snapshot.qualidade.sem_interacoes / Math.max(snapshot.qualidade.total_registros || 1, 1)) *
                        100,
                      6
                    )}%`
                  }}
                />
              </div>
            </div>
            <div className="analytics-bar-row">
              <div className="analytics-bar-label">
                <strong>Unicidade do cadastro</strong>
                <span className="muted">
                  {snapshot.qualidade.duplicidades_telefone} ocorrencia(s) com telefone repetido
                </span>
              </div>
              <div className="analytics-bar-track">
                <div
                  className="analytics-bar-fill"
                  style={{
                    width: `${Math.max(
                      (
                        snapshot.qualidade.duplicidades_telefone /
                        Math.max(snapshot.qualidade.total_registros || 1, 1)
                      ) *
                        100,
                      6
                    )}%`
                  }}
                />
              </div>
            </div>
            <div className="muted">
              Recomendação imediata: saneie importações, consolide telefones duplicados e priorize
              abordagem dos registros ainda sem interação para elevar a confiabilidade desta
              campanha.
            </div>
          </div>
        </article>
      </section>

      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">Evolução recente</h2>
            <p className="subtitle">
              Série curta para acompanhar novos leads e atividade conversacional nos últimos dias.
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
                  title={`${item.interacoes} interações`}
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
          <span className="pill">Interações</span>
        </div>
      </section>

      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">Governança operacional da campanha</h2>
            <p className="subtitle">
              Trilha recente das ações críticas desta campanha para acompanhamento administrativo
              e operacional.
            </p>
          </div>
          <Link className="button secondary" href="/estatisticas/governanca">
            Ver governança do admin
          </Link>
        </div>
        <div className="grid grid-3" style={{ marginBottom: 16 }}>
          <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
            <span className="metric-label">Ações registradas</span>
            <strong className="metric-value">{governance.totais.total_acoes}</strong>
          </article>
          <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
            <span className="metric-label">Sucessos em 7 dias</span>
            <strong className="metric-value">{governance.totais.acoes_sucesso_7_dias}</strong>
          </article>
          <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
            <span className="metric-label">Erros em 30 dias</span>
            <strong className="metric-value">{governance.totais.erros_30_dias}</strong>
          </article>
        </div>
        <div className="table-responsive">
          <table className="table analytics-table">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Categoria</th>
                <th>Ação</th>
                <th>Status</th>
                <th>Descrição</th>
              </tr>
            </thead>
            <tbody>
              {governance.recentes.map((evento) => (
                <tr key={evento.id}>
                  <td>{formatDateTime(evento.criado_em)}</td>
                  <td>{labelGovernance(evento.categoria)}</td>
                  <td>{labelGovernance(evento.acao)}</td>
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

      <section className="card">
        <div className="section-heading">
          <div>
            <h2 className="section-title">Conversas recentes</h2>
            <p className="subtitle">
              Amostra operacional para localizar eleitores, observar sinais de conversão e abrir
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
                <th>Sinal político</th>
                <th>Última mensagem</th>
                <th>Interações</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.conversasRecentes.map((conversation) => (
                <tr key={conversation.eleitor_uid}>
                  <td>
                    <strong>{conversation.nome ?? "Eleitor não identificado"}</strong>
                    <div className="mono">{conversation.telefone ?? conversation.eleitor_id}</div>
                  </td>
                  <td>{conversation.origem_captacao ?? "-"}</td>
                  <td>{labelStage(conversation.etapa_funil)}</td>
                  <td>
                    <div>{conversation.intencao_voto ?? "sem leitura"}</div>
                    <div className="muted">{conversation.sentimento ?? "sentimento não classificado"}</div>
                  </td>
                  <td className="analytics-message-cell">
                    {conversation.ultima_mensagem ?? "Sem histórico textual ainda"}
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
    return "não classificado";
  }

  return stage.replace(/_/g, " ");
}

function labelGovernance(value: string) {
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

