import Link from "next/link";
import { getCurrentPlatformSession } from "@/lib/auth";
import { triggerGovernanceWorkflowAction } from "@/lib/actions/workflow-center-action";

type WorkflowCenterPageProps = {
  searchParams?: Promise<{
    feedback?: string;
    mensagem?: string;
  }>;
};

const WORKFLOWS = [
  {
    ordem: "1",
    workflow: "candidato_sync",
    title: "Sincronizar candidato",
    description: "Atualiza o cadastro-base do candidato no ecossistema do n8n."
  },
  {
    ordem: "2",
    workflow: "qrcode_canais",
    title: "Gerar QR Code e canais",
    description: "Dispara o workflow de QR Code e atualização de canais."
  },
  {
    ordem: "3",
    workflow: "governanca",
    title: "Executar governança",
    description: "Aciona o workflow de governança operacional do candidato."
  },
  {
    ordem: "4",
    workflow: "entrada_eleitor",
    title: "Simular entrada de eleitor",
    description: "Aciona o workflow de entrada no funil com nome, telefone e mensagem."
  },
  {
    ordem: "5",
    workflow: "cadencia",
    title: "Acionar cadência",
    description: "Inicia o workflow de cadência e reativação controlada."
  }
] as const;

export const dynamic = "force-dynamic";

export default async function WorkflowCenterPage({ searchParams }: WorkflowCenterPageProps) {
  const query = searchParams ? await searchParams : undefined;
  const session = await getCurrentPlatformSession();

  return (
    <main className="page-shell">
      {query?.feedback && query?.mensagem ? (
        <section className={`feedback-banner ${query.feedback === "sucesso" ? "ok" : "error"}`}>
          <strong>{query.feedback === "sucesso" ? "Workflow iniciado." : "Falha ao iniciar workflow."}</strong>
          <div style={{ marginTop: 6 }}>{query.mensagem}</div>
        </section>
      ) : null}

      <section className="hero-card">
        <span className="pill">Governança de workflows</span>
        <h1 className="title">Central de workflows do n8n</h1>
        <p className="subtitle">
          Todos os workflows estratégicos da automação podem ser iniciados a partir desta
          plataforma, com trilha administrativa e contexto de campanha.
        </p>
        <div className="hero-meta">
          <span className="pill">
            {session?.perfil === "administrador" ? "Administrador autenticado" : "Acesso restrito"}
          </span>
          <span className="pill">Origem única da governança</span>
        </div>
        <div className="actions" style={{ marginTop: 18 }}>
          <Link className="button secondary" href="/estatisticas/governanca">
            Voltar para governança
          </Link>
        </div>
      </section>

      <section className="grid grid-2">
        {WORKFLOWS.map(({ ordem, workflow, title, description }) => (
          <article className="card analytics-panel" key={workflow}>
            <span className="pill">Workflow {ordem}</span>
            <h2 className="section-title">
              {ordem}. {title}
            </h2>
            <p className="subtitle">{description}</p>
            <form action={triggerGovernanceWorkflowAction} className="manager-auth-form">
              <input name="workflow" type="hidden" value={workflow} />
              <input name="redirectTo" type="hidden" value="/estatisticas/governanca/workflows" />
              <label className="step-note">
                <span>ID do candidato</span>
                <input className="step-input" defaultValue="0001" name="idCandidato" type="text" />
              </label>
              {workflow === "governanca" ? (
                <>
                  <label className="step-note">
                    <span>ID do líder</span>
                    <input
                      className="step-input"
                      defaultValue="d4ee483c-282c-428b-8ce2-188001d783d0"
                      name="liderId"
                      type="text"
                    />
                  </label>
                  <label className="step-note">
                    <span>Recurso</span>
                    <input className="step-input" defaultValue="agenda" name="recurso" type="text" />
                  </label>
                  <label className="step-note">
                    <span>Ação</span>
                    <input className="step-input" defaultValue="upsert" name="acao" type="text" />
                  </label>
                  <label className="step-note">
                    <span>Referência</span>
                    <input className="step-input" name="referenciaId" type="text" />
                  </label>
                  <label className="step-note">
                    <span>Observação</span>
                    <input
                      className="step-input"
                      defaultValue="Teste de governança acionado pela plataforma."
                      name="observacao"
                      type="text"
                    />
                  </label>
                  <label className="step-note">
                    <span>Payload JSON</span>
                    <textarea
                      className="step-textarea"
                      defaultValue={'{"titulo":"Agenda Teste Brunex","descricao":"Evento de teste","data_inicio":"2026-07-30T14:00:00-03:00","data_fim":"2026-07-30T18:00:00-03:00","local_nome":"Taguatinga","endereco":"A confirmar","cidade":"Taguatinga","uf":"DF","canal_confirmacao":"https://sympla.com.br","status":"planejado","metadata":{"origem_interface":"plataforma_admin"}}'}
                      name="payloadJson"
                      rows={5}
                    />
                  </label>
                </>
              ) : null}
              {workflow === "entrada_eleitor" || workflow === "cadencia" ? (
                <>
                  <label className="step-note">
                    <span>Telefone</span>
                    <input className="step-input" defaultValue="5561981297840" name="telefone" type="text" />
                  </label>
                  <label className="step-note">
                    <span>Nome</span>
                    <input className="step-input" defaultValue="Eleitor Teste" name="nome" type="text" />
                  </label>
                </>
              ) : null}
              {workflow === "entrada_eleitor" ? (
                <label className="step-note">
                  <span>Mensagem</span>
                  <textarea
                    className="step-textarea"
                    defaultValue="Olá, quero saber mais sobre a campanha."
                    name="mensagem"
                    rows={3}
                  />
                </label>
              ) : null}
              <div className="actions">
                <button className="button" type="submit">
                  Iniciar workflow pela plataforma
                </button>
              </div>
            </form>
          </article>
        ))}
      </section>
    </main>
  );
}
