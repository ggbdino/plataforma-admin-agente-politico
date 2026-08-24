import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getDefaultPlatformRoute,
  requireAuthenticatedPlatformSession
} from "@/lib/auth";
import { env } from "@/lib/env";
import { APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

export default async function AdminImplantationGuidePage() {
  const session = await requireAuthenticatedPlatformSession();

  if (session.perfil !== "administrador") {
    redirect(await getDefaultPlatformRoute(session));
  }

  const formUrl = env.candidateIntakeFormUrl.trim();

  return (
    <main className="page-shell">
      <section className="hero-card">
        <span className="pill">Guia do administrador</span>
        <h1 className="title">Implantação e exclusão de candidatos</h1>
        <p className="subtitle">
          Roteiro objetivo para cadastrar candidatos, gerar workflows individualizados, importar no
          n8n, reimplantar os serviços necessários no EasyPanel e remover dados quando houver
          saneamento ou encerramento de campanha.
        </p>
        <div className="hero-meta">
          <span className="pill">Usuário {session.nome}</span>
          <span className="pill">Perfil administrador</span>
          <span className="pill">{APP_VERSION}</span>
        </div>
        <div className="actions" style={{ marginTop: 18 }}>
          <Link className="button secondary" href="/estatisticas">
            Voltar para inteligência
          </Link>
          <Link className="button secondary" href="/estatisticas/governanca/workflows">
            Central de workflows
          </Link>
          <Link className="button secondary" href="/admin/candidatos">
            Saneamento de base
          </Link>
          {formUrl ? (
            <Link className="button secondary" href={formUrl} target="_blank">
              Abrir formulário do candidato
            </Link>
          ) : null}
        </div>
      </section>

      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">1. Disponibilizar o formulário de cadastro</h2>
            <p className="subtitle">
              O processo começa fora da plataforma administrativa, com o preenchimento do formulário
              pela equipe ou pelo candidato.
            </p>
          </div>
          <span className={formUrl ? "pill ok" : "pill warn"}>
            {formUrl ? "Link configurado" : "Link pendente"}
          </span>
        </div>
        {formUrl ? (
          <div className="step-panel-callout">
            Link atual do formulário:{" "}
            <Link className="mono mono-wrap" href={formUrl} target="_blank">
              {formUrl}
            </Link>
          </div>
        ) : (
          <div className="step-panel-callout">
            Configure a variável <span className="mono">CANDIDATE_INTAKE_FORM_URL</span> no
            ambiente do serviço <span className="mono">plataforma_admin</span> para deixar o link
            oficial disponível nesta tela.
          </div>
        )}
        <div className="grid grid-3" style={{ marginTop: 16 }}>
          <InstructionCard title="O que conferir" text="Nome completo, nome de urna, partido, cargo, UF, telefone oficial, e-mail, responsável, metas e canais públicos informados." />
          <InstructionCard title="Quando reenviar" text="Sempre que nome de urna, número, telefone oficial, e-mail ou dados operacionais forem alterados pela campanha." />
          <InstructionCard title="Controle" text="O formulário alimenta a planilha-base; a plataforma só deve ser atualizada depois da sincronização controlada pelo administrador." />
        </div>
      </section>

      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">2. Criar ou atualizar o candidato na base</h2>
            <p className="subtitle">
              Use a Central de Workflows para refletir a planilha no banco de dados da plataforma.
            </p>
          </div>
          <Link className="button secondary" href="/estatisticas/governanca/workflows">
            Abrir Central de workflows
          </Link>
        </div>
        <ol className="analytics-stack">
          <Step text="Na Central de Workflows, execute a rotina de sincronização de candidatos." />
          <Step text="Aguarde a execução do n8n terminar sem erro." />
          <Step text="Confira se o candidato apareceu na base e se os dados mínimos foram preenchidos." />
          <Step text="Se houver mudança posterior de telefone oficial, nome de urna ou número, rode a atualização operacional do candidato." />
        </ol>
      </section>

      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">3. Gerar workflows individualizados por candidato</h2>
            <p className="subtitle">
              Cada candidato deve operar com seus próprios fluxos para preservar base, custos,
              webhooks, métricas, SMS, WhatsApp, eventos e evidências da Equipe de Divulgação.
            </p>
          </div>
          <span className="pill warn">Obrigatório por candidato</span>
        </div>
        <div className="grid grid-2">
          <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
            <span className="metric-label">Diretório padrão</span>
            <strong className="metric-title mono mono-wrap">
              n8n-agente-politico/workflows
            </strong>
            <span className="muted">
              Mantenha todos os JSON atualizados neste diretório para não fragmentar versões.
            </span>
          </article>
          <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
            <span className="metric-label">Arquivos esperados</span>
            <strong className="metric-title">Pacote do candidato</strong>
            <span className="muted">
              Inclui fluxos de funil, Datafy Chat, Meta/WhatsApp, eventos, SMS e evidências, sempre
              com o identificador do candidato no nome do arquivo.
            </span>
          </article>
        </div>
        <ol className="analytics-stack" style={{ marginTop: 16 }}>
          <Step text="Selecione o candidato na Central de Workflows." />
          <Step text="Execute a geração controlada do pacote de workflows." />
          <Step text="Verifique se os JSON foram gravados no diretório padrão /workflows." />
          <Step text="Importe cada JSON gerado no ambiente n8n de produção." />
          <Step text="Ative os workflows importados e confira se os webhooks de produção aparecem no n8n." />
        </ol>
      </section>

      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">4. Reimplantar serviços no EasyPanel quando necessário</h2>
            <p className="subtitle">
              A implantação só fica completa quando a versão do código e os workflows ativos estão
              coerentes entre plataforma_admin, n8n_start, n8n_webhook e demais serviços.
            </p>
          </div>
          <span className="pill">EasyPanel</span>
        </div>
        <div className="grid grid-3">
          <InstructionCard title="plataforma_admin" text="Reimplante quando houver nova versão do código, nova variável de ambiente ou mudança de tela/action da plataforma." />
          <InstructionCard title="n8n_start" text="Reimplante quando alterar variáveis usadas por workflows, como URLs, chaves de integração ou base pública da plataforma." />
          <InstructionCard title="n8n_webhook" text="Confirme que o serviço está ativo quando os webhooks de produção precisarem receber mensagens externas." />
        </div>
        <div className="step-panel-callout" style={{ marginTop: 16 }}>
          Após importar workflows no n8n, valide pelo menos um webhook de cada família crítica:
          funil do eleitor, confirmação de evento, SMS/WhatsApp quando aplicável e evidências da
          Equipe de Divulgação.
        </div>
      </section>

      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">5. Liberar equipe e validar a operação</h2>
            <p className="subtitle">
              Depois da base e dos workflows, o administrador deve liberar usuários e testar a
              jornada real antes de entregar ao gestor.
            </p>
          </div>
          <Link className="button secondary" href="/admin/usuarios">
            Usuários e perfis
          </Link>
        </div>
        <ol className="analytics-stack">
          <Step text="Crie ou vincule o gestor da campanha ao candidato." />
          <Step text="Crie operadores e analistas somente quando a campanha já tiver dados mínimos válidos." />
          <Step text="Teste QR Code, entrada no funil, painel de inteligência, evento público, presença, SMS/WhatsApp/e-mail e Equipe de Divulgação." />
          <Step text="Registre qualquer falha na governança antes de liberar uso continuado pela equipe." />
        </ol>
      </section>

      <section className="card analytics-panel">
        <div className="section-heading">
          <div>
            <h2 className="section-title">6. Excluir candidato ou sanear base</h2>
            <p className="subtitle">
              Use exclusão apenas quando houver decisão administrativa clara. Para erro de
              importação de eleitores, prefira eliminar apenas a base de eleitores do candidato.
            </p>
          </div>
          <Link className="button secondary" href="/admin/candidatos">
            Abrir saneamento
          </Link>
        </div>
        <div className="grid grid-3">
          <InstructionCard title="Eliminar eleitores" text="Mantém candidato, QR Code, permissões, workflows e configurações. Use para corrigir bases importadas com erro." />
          <InstructionCard title="Excluir candidato" text="Remove candidato e dados vinculados. Depois, desative ou remova manualmente os workflows correspondentes no n8n." />
          <InstructionCard title="Excluir todos" text="Use somente em saneamento total do ambiente, com backup e confirmação formal do administrador." />
        </div>
      </section>
    </main>
  );
}

function InstructionCard({ title, text }: { title: string; text: string }) {
  return (
    <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
      <span className="metric-label">{title}</span>
      <strong className="metric-title">{title}</strong>
      <span className="muted">{text}</span>
    </article>
  );
}

function Step({ text }: { text: string }) {
  return (
    <li className="step-panel-callout" style={{ listStylePosition: "inside" }}>
      {text}
    </li>
  );
}
