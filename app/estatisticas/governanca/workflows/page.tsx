import Link from "next/link";
import { getCurrentPlatformSession } from "@/lib/auth";
import { triggerGovernanceWorkflowAction } from "@/lib/actions/workflow-center-action";

type WorkflowCenterPageProps = {
  searchParams?: Promise<{
    feedback?: string;
    mensagem?: string;
  }>;
};

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
        {[
          ["candidato_sync", "Sincronizar candidato", "Atualiza o cadastro-base do candidato no ecossistema do n8n."],
          ["qrcode_canais", "Gerar QR Code e canais", "Dispara o workflow de QR Code e atualização de canais."],
          ["governanca", "Executar governança", "Aciona o workflow de governança operacional do candidato."],
          ["entrada_eleitor", "Simular entrada de eleitor", "Aciona o workflow de entrada no funil com nome, telefone e mensagem."],
          ["cadencia", "Acionar cadência", "Inicia o workflow de cadência e reativação controlada."]
        ].map(([workflow, title, description]) => (
          <article className="card analytics-panel" key={workflow}>
            <h2 className="section-title">{title}</h2>
            <p className="subtitle">{description}</p>
            <form action={triggerGovernanceWorkflowAction} className="manager-auth-form">
              <input name="workflow" type="hidden" value={workflow} />
              <input name="redirectTo" type="hidden" value="/estatisticas/governanca/workflows" />
              <label className="step-note">
                <span>ID do candidato</span>
                <input className="step-input" defaultValue="0001" name="idCandidato" type="text" />
              </label>
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
