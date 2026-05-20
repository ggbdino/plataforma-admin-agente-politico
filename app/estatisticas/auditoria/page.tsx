import Link from "next/link";
import { getAdminCampaignStatsSnapshot } from "@/lib/repositories/campaign-analytics";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  const snapshot = await getAdminCampaignStatsSnapshot();

  return (
    <main className="page-shell">
      <section className="hero-card">
        <span className="pill">Auditoria do admin</span>
        <h1 className="title">Auditoria consolidada da base operacional</h1>
        <p className="subtitle">
          Leitura administrativa da confiabilidade do dado com rastreio por campanha, para separar
          risco de estrutura, inconsistências cadastrais e maturidade operacional da base.
        </p>
        <div className="actions" style={{ marginTop: 18 }}>
          <Link className="button secondary" href="/estatisticas">
            Voltar para Inteligência da Campanha
          </Link>
          <Link className="button secondary" href="/api/estatisticas/exportar">
            Exportar executivo
          </Link>
          <Link className="button secondary" href="/candidatos">
            Ver implantação
          </Link>
        </div>
      </section>

      <section className="grid grid-3" style={{ marginBottom: 20 }}>
        <article className="card metric-card">
          <span className="metric-label">Confiabilidade média</span>
          <strong className="metric-value">
            {snapshot.totais.confiabilidade_media_percentual.toFixed(2)}%
          </strong>
          <span className="muted">Panorama consolidado da prontidão analítica</span>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Duplicidades de telefone</span>
          <strong className="metric-value">{snapshot.totais.duplicidades_telefone}</strong>
          <span className="muted">Risco de fragmentação ou inflação do funil</span>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Registros sem contato recente</span>
          <strong className="metric-value">{snapshot.totais.registros_sem_contato_30_dias}</strong>
          <span className="muted">Indica perda de cadência em toda a operação</span>
        </article>
      </section>

      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">Mapa de auditoria por campanha</h2>
            <p className="subtitle">
              Cada linha mostra qual problema existe, em qual campanha ele aparece e o impacto
              potencial na leitura dos indicadores.
            </p>
          </div>
          <span className="pill">Rastreio completo</span>
        </div>
        <div className="table-responsive">
          <table className="table analytics-table">
            <thead>
              <tr>
                <th>Campanha</th>
                <th>Criticidade</th>
                <th>Confiabilidade</th>
                <th>Cadastro incompleto</th>
                <th>Duplicidades</th>
                <th>Interação</th>
                <th>Contato 30d</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.campanhas.map((campaign) => {
                const severity = getAuditSeverity(campaign.confiabilidade_percentual);
                const incompleteCount =
                  campaign.sem_nome +
                  campaign.sem_telefone +
                  (snapshot.totais.email_disponivel ? campaign.sem_email : 0);

                return (
                  <tr key={campaign.id_candidato}>
                    <td>
                      <strong>{campaign.nome_urna}</strong>
                      <div className="muted">
                        {campaign.nome_campanha ?? `Campanha ${campaign.id_candidato}`}
                      </div>
                      <div className="mono">#{campaign.id_candidato}</div>
                    </td>
                    <td>
                      <span className={`pill ${severity.className}`}>{severity.label}</span>
                    </td>
                    <td>
                      <div>{Number(campaign.confiabilidade_percentual).toFixed(2)}%</div>
                      <div className="muted">
                        {campaign.total_eleitores} eleitor(es) na base
                      </div>
                    </td>
                    <td>
                      <div>{incompleteCount} registro(s)</div>
                      <div className="muted">
                        {campaign.sem_nome} sem nome | {campaign.sem_telefone} sem telefone
                        {snapshot.totais.email_disponivel ? ` | ${campaign.sem_email} sem email` : ""}
                      </div>
                    </td>
                    <td>
                      <div>{campaign.duplicidades_telefone}</div>
                      <div className="muted">telefones repetidos</div>
                    </td>
                    <td>
                      <div>{campaign.sem_interacoes}</div>
                      <div className="muted">sem histórico de conversa</div>
                    </td>
                    <td>
                      <div>{campaign.sem_contato_30_dias}</div>
                      <div className="muted">sem contato ha 30 dias</div>
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
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-2">
        <article className="card analytics-panel">
          <div className="section-heading">
            <div>
              <h2 className="section-title">Alertas administrativos</h2>
              <p className="subtitle">
                Síntese para tomada de decisão rápida da administração sobre onde agir primeiro.
              </p>
            </div>
            <span className="pill">Semáforo executivo</span>
          </div>
          <div className="analytics-stack">
            <div className="analytics-bar-row">
              <div className="analytics-bar-label">
                <strong>Campanhas em criticidade alta</strong>
                <span className="muted">
                  {snapshot.campanhas.filter((campaign) => campaign.confiabilidade_percentual < 70).length} campanha(s)
                </span>
              </div>
            </div>
            <div className="analytics-bar-row">
              <div className="analytics-bar-label">
                <strong>Campanhas com duplicidade de telefone</strong>
                <span className="muted">
                  {snapshot.campanhas.filter((campaign) => campaign.duplicidades_telefone > 0).length} campanha(s)
                </span>
              </div>
            </div>
            <div className="analytics-bar-row">
              <div className="analytics-bar-label">
                <strong>Campanhas com base sem interação</strong>
                <span className="muted">
                  {snapshot.campanhas.filter((campaign) => campaign.sem_interacoes > 0).length} campanha(s)
                </span>
              </div>
            </div>
            <div className="muted">
              Prioridade recomendada: saneie primeiro as campanhas com menor confiabilidade,
              telefones duplicados e maior volume de registros sem interação antes de comparar
              performance política entre candidatos.
            </div>
          </div>
        </article>

        <article className="card analytics-panel">
          <div className="section-heading">
            <div>
              <h2 className="section-title">Leitura do administrador</h2>
              <p className="subtitle">
                Interpretação orientada da auditoria para manter KPI, funil e exploração
                inteligente alinhados com a realidade da base.
              </p>
            </div>
            <span className="pill">Governança do dado</span>
          </div>
          <div className="grid grid-2">
            <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
              <span className="metric-label">Sinal principal</span>
              <strong className="metric-value">
                {snapshot.totais.duplicidades_telefone > 0 ? "Deduplicar" : "Base mais limpa"}
              </strong>
              <span className="muted">Primeira ação para proteger funil e conversão</span>
            </article>
            <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
              <span className="metric-label">Risco operacional</span>
              <strong className="metric-value">
                {snapshot.totais.registros_sem_interacoes > 0 ? "Base fria" : "Base ativa"}
              </strong>
              <span className="muted">Leitura do volume ainda não validado por conversa</span>
            </article>
            <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
              <span className="metric-label">Risco analitico</span>
              <strong className="metric-value">
                {snapshot.totais.confiabilidade_media_percentual < 80 ? "Elevado" : "Controlado"}
              </strong>
              <span className="muted">Confiança dos comparativos executivos</span>
            </article>
            <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
              <span className="metric-label">Proximo foco</span>
              <strong className="metric-value">Saneamento recorrente</strong>
              <span className="muted">Auditoria periódica antes de escalar automações</span>
            </article>
          </div>
        </article>
      </section>
    </main>
  );
}

function getAuditSeverity(score: number) {
  if (score < 70) {
    return { label: "Alta", className: "error" };
  }

  if (score < 85) {
    return { label: "Média", className: "warning" };
  }

  return { label: "Baixa", className: "ok" };
}
