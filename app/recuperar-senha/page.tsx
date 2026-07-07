import Link from "next/link";
import { requestPasswordResetAction } from "@/lib/actions/platform-user-action";

export const dynamic = "force-dynamic";

type RecoverPasswordPageProps = {
  searchParams?: Promise<{ feedback?: string; mensagem?: string }>;
};

export default async function RecoverPasswordPage({ searchParams }: RecoverPasswordPageProps) {
  const query = searchParams ? await searchParams : undefined;

  return (
    <main className="page-shell">
      {query?.feedback && query?.mensagem ? (
        <section className={`feedback-banner ${query.feedback === "sucesso" ? "ok" : "error"}`}>
          <strong>{query.feedback === "sucesso" ? "Solicitação registrada." : "Falha na solicitação."}</strong>
          <div style={{ marginTop: 6 }}>{query.mensagem}</div>
        </section>
      ) : null}

      <section className="hero-card">
        <span className="pill">Recuperação de senha</span>
        <h1 className="title">Redefinir acesso à plataforma</h1>
        <p className="subtitle">
          Informe o e-mail cadastrado. Se o usuário estiver ativo, enviaremos um link temporário para criar uma nova senha.
        </p>
        <div className="actions" style={{ marginTop: 18 }}>
          <Link className="button secondary" href="/">
            Voltar para o login
          </Link>
        </div>
      </section>

      <section className="card manager-auth-card">
        <h2 className="section-title">Enviar link de recuperação</h2>
        <form action={requestPasswordResetAction} className="manager-auth-form">
          <label className="step-note">
            <span>E-mail cadastrado</span>
            <input className="step-input" name="email" required type="email" />
          </label>
          <div className="step-panel-callout">
            Por segurança, a plataforma não informa se o e-mail existe ou não. O link expira em 1 hora.
          </div>
          <button className="button" type="submit">
            Enviar link de recuperação
          </button>
        </form>
      </section>
    </main>
  );
}