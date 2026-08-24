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
  deleteCandidateElectorsAction,
  logicallyDeleteCandidateAction,
  restoreCandidateAction
} from "@/lib/actions/admin-candidate-maintenance-action";
import { listCandidates } from "@/lib/repositories/candidates";
import {
  getCandidateDeletionSummary,
  listArchivedCandidatesForMaintenance,
  listCandidateDeletionArchives
} from "@/lib/repositories/admin-candidate-maintenance";

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
  const archivedCandidates = await listArchivedCandidatesForMaintenance();
  const deletionArchives = await listCandidateDeletionArchives();
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
          <span className="pill warn">{archivedCandidates.length} arquivado(s)</span>
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
        <article className="card metric-card">
          <span className="metric-label">Arquivos de recuperacao</span>
          <strong className="metric-value">{deletionArchives.length}</strong>
          <span className="muted">Últimos arquivos administrativos disponíveis para download</span>
        </article>
      </section>

      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">Exclusão lógica de candidato</h2>
            <p className="subtitle">
              Arquiva o candidato sem remover dados da base. A operação sai das telas regulares e
              pode ser revertida pelo administrador.
            </p>
          </div>
          <span className="pill warn">Reversível</span>
        </div>
        <form action={logicallyDeleteCandidateAction} className="manager-auth-form">
          <div className="step-form-grid">
            <label className="step-note">
              <span>Candidato</span>
              <select className="step-input" name="idCandidatoLogico" defaultValue="">
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
              <span>Confirmação textual</span>
              <input
                className="step-input"
                name="confirmacaoLogica"
                placeholder="ARQUIVAR 0001"
                type="text"
              />
            </label>
            <label className="step-note">
              <span>Motivo administrativo</span>
              <input
                className="step-input"
                name="motivoLogico"
                placeholder="Ex.: campanha encerrada, cadastro duplicado ou saneamento"
                type="text"
              />
            </label>
          </div>
          <div className="step-panel-callout">
            Use primeiro esta opção quando ainda houver possibilidade de reversão. O candidato
            arquivado deixa de aparecer para gestor, operador e analista.
          </div>
          <div className="actions">
            <button className="button" type="submit">
              Arquivar candidato
            </button>
          </div>
        </form>
      </section>

      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">Restaurar candidato arquivado</h2>
            <p className="subtitle">
              Reverte a exclusão lógica e libera novamente o candidato para operação.
            </p>
          </div>
          <span className="pill ok">Reativação</span>
        </div>
        <form action={restoreCandidateAction} className="manager-auth-form">
          <div className="step-form-grid">
            <label className="step-note">
              <span>Candidato arquivado</span>
              <select className="step-input" name="idCandidatoRestaurar" defaultValue="">
                <option value="" disabled>
                  Selecione o candidato arquivado
                </option>
                {archivedCandidates.map((candidate) => (
                  <option key={candidate.id_candidato} value={candidate.id_candidato}>
                    {candidate.id_candidato} - {candidate.nome_urna ?? "sem nome de urna"}
                  </option>
                ))}
              </select>
            </label>
            <label className="step-note">
              <span>Confirmação textual</span>
              <input
                className="step-input"
                name="confirmacaoRestaurar"
                placeholder="RESTAURAR 0001"
                type="text"
              />
            </label>
          </div>
          <div className="step-panel-callout">
            Esta ação não recria workflows removidos manualmente no n8n. Ela apenas reativa o
            candidato arquivado na base da plataforma.
          </div>
          <div className="actions">
            <button className="button" disabled={archivedCandidates.length === 0} type="submit">
              Restaurar candidato
            </button>
          </div>
        </form>
      </section>

      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">Exclusão definitiva de candidato</h2>
            <p className="subtitle">
              Remove o candidato da base e cria antes um arquivo JSON de recuperação para consulta
              administrativa ou reconstrução assistida.
            </p>
          </div>
          <span className="pill error">Irreversível pela tela</span>
        </div>
        <form action={deleteCandidateAction} className="manager-auth-form">
          <div className="step-form-grid">
            <label className="step-note">
              <span>Candidato</span>
              <select className="step-input" name="idCandidato" defaultValue="">
                <option value="" disabled>
                  Selecione o candidato
                </option>
                {[...candidates, ...archivedCandidates].map((candidate) => (
                  <option key={candidate.id_candidato} value={candidate.id_candidato}>
                    {candidate.id_candidato} - {candidate.nome_urna ?? "sem nome de urna"}
                  </option>
                ))}
              </select>
            </label>
            <label className="step-note">
              <span>Confirmação textual</span>
              <input
                className="step-input"
                name="confirmacao"
                placeholder="EXCLUIR 0001"
                type="text"
              />
            </label>
          </div>
          <div className="step-panel-callout">
            Antes da remoção, a plataforma gera um arquivo JSON com os dados vinculados ao
            candidato. Depois da exclusão definitiva, a restauração automática não fica disponível
            nesta tela.
          </div>
          <div className="actions">
            <button className="button" type="submit">
              Excluir definitivamente
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
      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
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

      <section className="card analytics-panel">
        <div className="section-heading">
          <div>
            <h2 className="section-title">Arquivos de recuperação</h2>
            <p className="subtitle">
              Arquivos JSON criados antes das exclusões definitivas. Use para auditoria, consulta
              histórica ou recuperação assistida por equipe técnica.
            </p>
          </div>
          <span className="pill">Últimos {deletionArchives.length}</span>
        </div>
        <div className="table-responsive">
          <table className="table analytics-table">
            <thead>
              <tr>
                <th>Arquivo</th>
                <th>Escopo</th>
                <th>Candidato</th>
                <th>Criado em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {deletionArchives.map((archive) => (
                <tr key={archive.id}>
                  <td className="mono mono-wrap">{archive.nome_arquivo}</td>
                  <td>{archive.escopo}</td>
                  <td>{archive.id_candidato ?? "todos"}</td>
                  <td>{formatDateTime(archive.criado_em)}</td>
                  <td>
                    <Link
                      className="button secondary"
                      href={`/api/admin/candidatos/arquivos/${archive.id}`}
                    >
                      Baixar JSON
                    </Link>
                  </td>
                </tr>
              ))}
              {deletionArchives.length === 0 ? (
                <tr>
                  <td colSpan={5}>Nenhum arquivo de recuperação foi gerado ainda.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
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

function formatDateTime(value: string | null) {
  if (!value) {
    return "sem registro";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}
