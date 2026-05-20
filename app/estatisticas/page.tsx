import Link from "next/link";
import { getAdminCampaignStatsSnapshot } from "@/lib/repositories/campaign-analytics";

export const dynamic = "force-dynamic";

export default async function StatisticsAdminPage() {
  const snapshot = await getAdminCampaignStatsSnapshot();
  const maxEleitores = Math.max(...snapshot.campanhas.map((item) => item.total_eleitores), 1);
  const maxMetaCoverage = Math.max(
    ...snapshot.campanhas.map((item) => item.meta_contatos_percentual),
    1
  );

  return (
    <main className="page-shell">
      <section className="hero-card">
        <span className="pill">Inteligência da Campanha</span>
        <h1 className="title">Visão consolidada de operação e conversão</h1>
        <p className="subtitle">
          Entrada executiva para a administração acompanhar a tração de cada campanha sem misturar
          a camada de implantação com a camada de inteligência operacional.
        </p>
        <div className="actions" style={{ marginTop: 18 }}>
          <Link className="button secondary" href="/">
            Voltar ao início
          </Link>
          <Link className="button secondary" href="/api/estatisticas/exportar">
            Exportar executivo
          </Link>
          <Link className="button secondary" href="/estatisticas/auditoria">
            Auditoria do admin
          </Link>
          <Link className="button secondary" href="/candidatos">
            Ver implantação
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
          <span className="metric-label">Interações em 24h</span>
          <strong className="metric-value">{snapshot.totais.interacoes_24h}</strong>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Interações acumuladas</span>
          <strong className="metric-value">{snapshot.totais.interacoes}</strong>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Apoiadores mapeados</span>
          <strong className="metric-value">{snapshot.totais.apoiadores}</strong>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Média de eleitores por campanha</span>
          <strong className="metric-value">
            {snapshot.totais.campanhas === 0
              ? 0
              : Math.round(snapshot.totais.eleitores / snapshot.totais.campanhas)}
          </strong>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Confiabilidade média</span>
          <strong className="metric-value">
            {snapshot.totais.confiabilidade_media_percentual.toFixed(2)}%
          </strong>
          <span className="muted">Prontidão média da base consolidada</span>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Sem telefone</span>
          <strong className="metric-value">{snapshot.totais.registros_sem_telefone}</strong>
          <span className="muted">Registros sem chave principal de contato</span>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Sem interações</span>
          <strong className="metric-value">{snapshot.totais.registros_sem_interacoes}</strong>
          <span className="muted">Base sem validação conversacional</span>
        </article>
      </section>

      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">Densidade da base por campanha</h2>
            <p className="subtitle">
              Comparativo consolidado para priorizar onde aprofundar a operação.
            </p>
          </div>
          <span className="pill">Drill-down por candidato</span>
        </div>
        <div className="analytics-stack">
          {snapshot.campanhas.map((campaign) => (
            <div className="analytics-bar-row" key={campaign.id_candidato}>
              <div className="analytics-bar-label">
                <strong>{campaign.nome_urna}</strong>
                <span className="muted">
                  {campaign.total_eleitores} eleitores | {campaign.interacoes_24h} interações 24h
                </span>
              </div>
              <div className="analytics-bar-track">
                <div
                  className="analytics-bar-fill"
                  style={{ width: `${Math.max((campaign.total_eleitores / maxEleitores) * 100, 6)}%` }}
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
                Comparativo executivo do quanto cada campanha já conseguiu transformar a meta de
                contatos em base real.
              </p>
            </div>
            <span className="pill">Meta vs realizado</span>
          </div>
          <div className="analytics-stack">
            {snapshot.campanhas.map((campaign) => (
              <div className="analytics-bar-row" key={`${campaign.id_candidato}-meta`}>
                <div className="analytics-bar-label">
                  <strong>{campaign.nome_urna}</strong>
                  <span className="muted">
                    {Number(campaign.meta_contatos_percentual).toFixed(2)}% da meta
                  </span>
                </div>
                <div className="analytics-bar-track">
                  <div
                    className="analytics-bar-fill analytics-bar-fill-soft"
                    style={{
                      width: `${Math.max(
                        (Number(campaign.meta_contatos_percentual) / maxMetaCoverage) * 100,
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
              <h2 className="section-title">Rankings executivos</h2>
              <p className="subtitle">
                Top campanhas por conversão, atividade recente e cobertura de meta.
              </p>
            </div>
            <span className="pill">Drill-up de priorização</span>
          </div>
          <div className="grid grid-3">
            <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
              <span className="metric-label">Melhor conversão</span>
              <strong className="metric-value">
                {snapshot.rankings.conversao[0]?.nome_urna ?? "sem dados"}
              </strong>
              <span className="muted">
                {snapshot.rankings.conversao[0]
                  ? `${snapshot.rankings.conversao[0].valor.toFixed(2)}%`
                  : "aguardando base"}
              </span>
            </article>
            <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
              <span className="metric-label">Maior atividade 24h</span>
              <strong className="metric-value">
                {snapshot.rankings.atividade_24h[0]?.nome_urna ?? "sem dados"}
              </strong>
              <span className="muted">
                {snapshot.rankings.atividade_24h[0]
                  ? `${snapshot.rankings.atividade_24h[0].valor.toFixed(0)} interações`
                  : "aguardando atividade"}
              </span>
            </article>
            <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
              <span className="metric-label">Maior cobertura de meta</span>
              <strong className="metric-value">
                {snapshot.rankings.cobertura_meta[0]?.nome_urna ?? "sem dados"}
              </strong>
              <span className="muted">
                {snapshot.rankings.cobertura_meta[0]
                  ? `${snapshot.rankings.cobertura_meta[0].valor.toFixed(2)}%`
                  : "aguardando meta"}
              </span>
            </article>
          </div>
        </article>
      </section>

      <section className="grid grid-2" style={{ marginBottom: 20 }}>
        <article className="card analytics-panel">
          <div className="section-heading">
            <div>
              <h2 className="section-title">Confiabilidade consolidada do dado</h2>
              <p className="subtitle">
                Panorama do quanto a base atual sustenta leitura de conversão, automações e
                comparativos entre campanhas.
              </p>
            </div>
            <span className="pill">
              Score médio {snapshot.totais.confiabilidade_media_percentual.toFixed(2)}%
            </span>
          </div>
          <div className="grid grid-2">
            <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
              <span className="metric-label">Registros sem nome</span>
              <strong className="metric-value">{snapshot.totais.registros_sem_nome}</strong>
              <span className="muted">Afetam leitura humana e personalização</span>
            </article>
            <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
              <span className="metric-label">Registros sem telefone</span>
              <strong className="metric-value">{snapshot.totais.registros_sem_telefone}</strong>
              <span className="muted">Bloqueiam contato e deduplicação</span>
            </article>
            <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
              <span className="metric-label">
                {snapshot.totais.email_disponivel ? "Registros sem email" : "Email na estrutura"}
              </span>
              <strong className="metric-value">
                {snapshot.totais.email_disponivel ? snapshot.totais.registros_sem_email : "n/d"}
              </strong>
              <span className="muted">
                {snapshot.totais.email_disponivel
                  ? "Campo adicional para enriquecimento e outreach"
                  : "Coluna de email indisponível no schema atual"}
              </span>
            </article>
            <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
              <span className="metric-label">Telefones duplicados</span>
              <strong className="metric-value">{snapshot.totais.duplicidades_telefone}</strong>
              <span className="muted">Risco de inflar a leitura do funil</span>
            </article>
            <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
              <span className="metric-label">Sem interações</span>
              <strong className="metric-value">{snapshot.totais.registros_sem_interacoes}</strong>
              <span className="muted">Base ainda sem resposta do campo</span>
            </article>
            <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
              <span className="metric-label">Sem contato em 30 dias</span>
              <strong className="metric-value">
                {snapshot.totais.registros_sem_contato_30_dias}
              </strong>
              <span className="muted">Indício de estagnação operacional</span>
            </article>
          </div>
        </article>

        <article className="card analytics-panel">
          <div className="section-heading">
            <div>
              <h2 className="section-title">Ranking de confiabilidade</h2>
              <p className="subtitle">
                Identifica quais campanhas já estão maduras para leitura executiva mais sensível e
                quais ainda precisam de saneamento.
              </p>
            </div>
            <span className="pill">Drill-up de prontidão</span>
          </div>
          <div className="analytics-stack">
            {snapshot.rankings.confiabilidade.map((item) => (
              <div className="analytics-bar-row" key={item.id_candidato}>
                <div className="analytics-bar-label">
                  <strong>{item.nome_urna}</strong>
                  <span className="muted">{item.valor.toFixed(2)}% de confiabilidade</span>
                </div>
                <div className="analytics-bar-track">
                  <div
                    className="analytics-bar-fill analytics-bar-fill-soft"
                    style={{ width: `${Math.max(item.valor, 6)}%` }}
                  />
                </div>
              </div>
            ))}
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
                <th>Interações</th>
                <th>Conversão</th>
                <th>Meta</th>
                <th>Confiabilidade</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.campanhas.map((campaign) => (
                <tr key={campaign.id_candidato}>
                  <td>
                    <strong>{campaign.nome_urna}</strong>
                    <div className="muted">
                      {campaign.nome_campanha ?? `Campanha ${campaign.id_candidato}`}
                    </div>
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
                    <div className="muted">
                      {Number(campaign.meta_conversao_percentual).toFixed(2)}% apoiadores
                    </div>
                  </td>
                  <td>
                    <div>{Number(campaign.confiabilidade_percentual).toFixed(2)}%</div>
                    <div className="muted">
                      {campaign.sem_telefone} sem telefone | {campaign.sem_interacoes} sem interação
                    </div>
                  </td>
                  <td>
                    <div className="actions">
                      <Link className="button secondary" href={`/campanhas/${campaign.id_candidato}`}>
                        Abrir campanha
                      </Link>
                      <Link
                        className="button secondary"
                        href={`/campanhas/${campaign.id_candidato}/conversas`}
                      >
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
