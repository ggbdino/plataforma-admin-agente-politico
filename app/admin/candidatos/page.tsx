import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getDefaultPlatformRoute,
  getCurrentPlatformSession,
  requireAdminBootstrap
} from "@/lib/auth";
import {
  deleteAllCandidatesAction,
  deleteCandidateAction,
  deleteCandidateElectorsAction
} from "@/lib/actions/admin-candidate-maintenance-action";
import { listCandidates } from "@/lib/repositories/candidates";
import { getCandidateDeletionSummary } from "@/lib/repositories/admin-candidate-maintenance";

type AdminCandidatesPageProps = {
  searchParams?: Promise<{
    feedback?: string;
    mensagem?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function AdminCandidatesPage({ searchParams }: AdminCandidatesPageProps) {
  const query = searchParams ? await searchParams : undefined;
  const hasSession = await getCurrentPlatformSession();
  const access = await requireAdminBootstrap();

  if (hasSession && hasSession.perfil !== "administrador") {
    redirect(await getDefaultPlatformRoute(hasSession));
  }

  const candidates = await listCandidates();
  const globalSummary = await getCandidateDeletionSummary(null);

  return (
    <main className="page-shell">
      {query?.feedback && query?.mensagem ? (
        <section className={`feedback-banner ${query.feedback === "sucesso" ? "ok" : "error"}`}>
          <strong>{query.feedback === "sucesso" ? "Operacao concluida." : "Falha administrativa."}</strong>
          <div style={{ marginTop: 6 }}>{query.mensagem}</div>
        </section>
      ) : null}

      <section className="hero-card">
        <span className="pill">Saneamento administrativo</span>
        <h1 className="title">Saneamento de candidatos e eleitores</h1>
        <p className="subtitle">
          Esta area remove da base o candidato selecionado ou toda a base de candidatos, incluindo
          eleitores, interacoes, eventos, implantacoes, canais e registros de governanca vinculados.
        </p>
        <div className="hero-meta">
          <span className="pill">
            {access.mode === "bootstrap" ? "Sessao especial de bootstrap" : "Administrador autenticado"}
          </span>
          <span className="pill">{candidates.length} candidato(s) disponivel(is)</span>
        </div>
        <div className="actions" style={{ marginTop: 18 }}>
          <Link className="button secondary" href="/estatisticas/governanca">
            Voltar para governanca
          </Link>
          <Link className="button secondary" href="/admin/usuarios">
            Usuarios e perfis
          </Link>
          <Link className="button secondary" href="/admin/implantacao">
            Guia de implantacao e exclusao
          </Link>
        </div>
      </section>

      <section className="grid grid-3" style={{ marginBottom: 20 }}>
        <article className="card metric-card">
          <span className="metric-label">Candidatos na base</span>
          <strong className="metric-value">{globalSummary.candidatos}</strong>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Eleitores vinculados</span>
          <strong className="metric-value">{globalSummary.eleitores}</strong>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Interacoes registradas</span>
          <strong className="metric-value">{globalSummary.interacoes}</strong>
        </article>
      </section>

      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">Excluir um candidato</h2>
            <p className="subtitle">
              Selecione um candidato e confirme digitando <span className="mono">EXCLUIR ID_DO_CANDIDATO</span>.
            </p>
          </div>
          <span className="pill warn">Operacao irreversivel</span>
        </div>
        <form action={deleteCandidateAction} className="manager-auth-form">
          <div className="step-form-grid">
            <label className="step-note">
              <span>Candidato</span>
              <select className="step-input" name="idCandidato" defaultValue="">
                <option value="" disabled>
                  Selecione o candidato
                </option>
                {candidates.map((candidate) => (
                  <option key={candidate.id_candidato} value={candidate.id_candidato}>
                    {candidate.id_candidato} - {candidate.nome_urna}
                  </option>
                ))}
              </select>
            </label>
            <label className="step-note">
              <span>Confirmacao textual</span>
              <input
                className="step-input"
                name="confirmacao"
                placeholder="EXCLUIR 0001"
                type="text"
              />
            </label>
          </div>
          <div className="step-panel-callout">
            A exclusao individual remove o candidato, seus eleitores, conversas, eventos,
            implantacoes, permissoes e rastros administrativos associados.
          </div>
          <div className="actions">
            <button className="button" type="submit">
              Excluir candidato da base
            </button>
          </div>
        </form>
      </section>

      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">Eliminar eleitores de um candidato</h2>
            <p className="subtitle">
              Preserva o cadastro do candidato, campanha, integrações e workflows, removendo apenas
              eleitores, interações e participações vinculadas aos eventos.
            </p>
          </div>
          <span className="pill warn">Saneamento da base</span>
        </div>
        <form action={deleteCandidateElectorsAction} className="manager-auth-form">
          <div className="step-form-grid">
            <label className="step-note">
              <span>Candidato</span>
              <select className="step-input" name="idCandidato" defaultValue="">
                <option value="" disabled>
                  Selecione o candidato
                </option>
                {candidates.map((candidate) => (
                  <option key={candidate.id_candidato} value={candidate.id_candidato}>
                    {candidate.id_candidato} - {candidate.nome_urna}
                  </option>
                ))}
              </select>
            </label>
            <label className="step-note">
              <span>Confirmacao textual</span>
              <input
                className="step-input"
                name="confirmacaoEleitores"
                placeholder="EXCLUIR ELEITORES 0001"
                type="text"
              />
            </label>
          </div>
          <div className="step-panel-callout">
            Use quando for necessário limpar uma base importada com erro sem perder configuração do candidato,
            QR Code, permissões, implantação e parâmetros operacionais da campanha.
          </div>
          <div className="actions">
            <button className="button" type="submit">
              Eliminar eleitores do candidato
            </button>
          </div>
        </form>
      </section>
      <section className="card analytics-panel">
        <div className="section-heading">
          <div>
            <h2 className="section-title">Excluir todos os candidatos</h2>
            <p className="subtitle">
              Use apenas em saneamento total do ambiente. Confirme digitando{" "}
              <span className="mono">EXCLUIR TODOS</span>.
            </p>
          </div>
          <span className="pill error">Zona critica</span>
        </div>
        <div className="table-responsive" style={{ marginBottom: 16 }}>
          <table className="table analytics-table">
            <thead>
              <tr>
                <th>Registro</th>
                <th>Total atual</th>
              </tr>
            </thead>
            <tbody>
              <SummaryRow label="Campanhas" total={globalSummary.campanhas} />
              <SummaryRow label="Canais de integracao" total={globalSummary.canais_integracao} />
              <SummaryRow label="Perfis markdown do candidato" total={globalSummary.perfis_candidato_md} />
              <SummaryRow label="Prompts dos agentes" total={globalSummary.prompts_agentes} />
              <SummaryRow label="Implantacoes" total={globalSummary.implantacoes_candidato} />
              <SummaryRow label="Etapas de implantacao" total={globalSummary.implantacao_etapas_candidato} />
              <SummaryRow label="Execucoes de implantacao" total={globalSummary.execucoes_implantacao} />
              <SummaryRow label="Eventos de campanha" total={globalSummary.eventos_campanha} />
              <SummaryRow label="Participacoes em eventos" total={globalSummary.participacoes_eventos} />
              <SummaryRow label="Permissoes administrativas" total={globalSummary.paines_admin_permissoes} />
              <SummaryRow label="Auditoria de governanca" total={globalSummary.governanca_auditoria} />
            </tbody>
          </table>
        </div>
        <form action={deleteAllCandidatesAction} className="manager-auth-form">
          <label className="step-note">
            <span>Confirmacao global</span>
            <input
              className="step-input"
              name="confirmacaoGlobal"
              placeholder="EXCLUIR TODOS"
              type="text"
            />
          </label>
          <div className="actions">
            <button className="button" type="submit">
              Excluir toda a base de candidatos
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

function SummaryRow({ label, total }: { label: string; total: number }) {
  return (
    <tr>
      <td>{label}</td>
      <td>{total}</td>
    </tr>
  );
}
