import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getCurrentPlatformSession,
  getDefaultPlatformRoute,
  hasCampaignAccess
} from "@/lib/auth";
import { env } from "@/lib/env";
import { getCampaignManagerContext } from "@/lib/repositories/implantation";
import { APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

type CampaignManagerInstructionsPageProps = {
  params: Promise<{
    idCandidato: string;
  }>;
};

export default async function CampaignManagerInstructionsPage({
  params
}: CampaignManagerInstructionsPageProps) {
  const { idCandidato } = await params;
  const session = await getCurrentPlatformSession();
  const hasAccess = await hasCampaignAccess(session, idCandidato, "pode_implantar");

  if (!session) {
    redirect("/");
  }

  if (!hasAccess) {
    redirect(await getDefaultPlatformRoute(session));
  }

  const data = await getCampaignManagerContext(idCandidato);

  if (!data) {
    notFound();
  }

  const formUrl = env.candidateIntakeFormUrl.trim();

  return (
    <main className="page-shell">
      <section className="hero-card">
        <span className="pill">Instruções do gestor</span>
        <h1 className="title">Como acompanhar a implantação de {data.nome_urna}</h1>
        <p className="subtitle">
          Consulta rápida para o gestor entender o que deve conferir, o que pode ajustar na
          campanha e quando acionar o administrador da plataforma.
        </p>
        <div className="hero-meta">
          <span className="pill">Candidato {data.nome_urna}</span>
          <span className="pill">Usuário {session.nome}</span>
          <span className="pill">{APP_VERSION}</span>
        </div>
        <div className="actions" style={{ marginTop: 18 }}>
          <Link className="button secondary" href={`/gestor/candidato/${idCandidato}`}>
            Voltar para a área do gestor
          </Link>
          <Link className="button secondary" href={`/candidatos/${idCandidato}`}>
            Implantação do candidato
          </Link>
          {formUrl ? (
            <Link className="button secondary" href={formUrl} target="_blank">
              Abrir formulário
            </Link>
          ) : null}
        </div>
      </section>

      <section className="grid grid-2" style={{ marginBottom: 20 }}>
        <article className="card analytics-panel">
          <div className="section-heading">
            <div>
              <h2 className="section-title">O que o gestor deve conferir</h2>
              <p className="subtitle">
                Estes dados sustentam QR Code, WhatsApp oficial, mensagens e leitura da campanha.
              </p>
            </div>
            <span className="pill ok">Responsabilidade do gestor</span>
          </div>
          <ol className="analytics-stack">
            <Step text="Confira nome de urna, número do candidato, partido, cargo e UF." />
            <Step text="Confirme o telefone oficial da campanha, pois ele define o QR Code e o canal público." />
            <Step text="Cadastre ou valide e-mail do candidato, remetente SMTP, gateway SMS e canal WhatsApp quando essas funções forem usadas." />
            <Step text="Revise redes sociais e canais de divulgação para garantir que apontem para o WhatsApp oficial correto." />
          </ol>
        </article>

        <article className="card analytics-panel">
          <div className="section-heading">
            <div>
              <h2 className="section-title">O que é responsabilidade do administrador</h2>
              <p className="subtitle">
                O gestor acompanha e informa dados. A preparação técnica dos fluxos continua sob
                controle do administrador.
              </p>
            </div>
            <span className="pill warn">Acione o administrador</span>
          </div>
          <ol className="analytics-stack">
            <Step text="Sincronizar a planilha do formulário com a base da plataforma." />
            <Step text="Gerar os workflows individualizados do candidato no diretório /workflows." />
            <Step text="Importar e ativar os workflows no n8n de produção." />
            <Step text="Reimplantar serviços no EasyPanel quando houver alteração de código, variáveis ou ambiente." />
          </ol>
        </article>
      </section>

      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">Sequência simples para entrada de um candidato</h2>
            <p className="subtitle">
              Use este roteiro para saber em que ponto a campanha está e o que deve ser validado.
            </p>
          </div>
          <span className="pill">Roteiro rápido</span>
        </div>
        <div className="grid grid-4">
          <MiniStep number="1" title="Formulário" text="O candidato ou a equipe preenche os dados de entrada." />
          <MiniStep number="2" title="Sincronização" text="O administrador atualiza a base a partir da planilha." />
          <MiniStep number="3" title="Workflows" text="O administrador gera, importa e ativa os fluxos do candidato no n8n." />
          <MiniStep number="4" title="Validação" text="O gestor testa QR Code, conversas, eventos, comunicação e inteligência." />
        </div>
      </section>

      <section className="card analytics-panel">
        <div className="section-heading">
          <div>
            <h2 className="section-title">Quando pedir apoio técnico</h2>
            <p className="subtitle">
              Estes casos indicam que a equipe técnica ou o administrador precisa atuar antes de
              continuar a operação.
            </p>
          </div>
          <span className="pill warn">Atenção</span>
        </div>
        <div className="grid grid-3">
          <InstructionCard title="Candidato não aparece" text="Peça ao administrador para conferir a planilha e executar a sincronização." />
          <InstructionCard title="QR Code errado" text="Atualize o telefone oficial da campanha e peça a regeneração do QR Code." />
          <InstructionCard title="Mensagem não dispara" text="Verifique remetente, gateway, token, limite de envio e workflows ativos no n8n." />
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

function MiniStep({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <article className="metric-card" style={{ border: "1px solid var(--border-soft)" }}>
      <span className="pill">{number}</span>
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
