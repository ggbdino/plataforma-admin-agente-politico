import Link from "next/link";
import { resetPasswordAction } from "@/lib/actions/platform-user-action";

export const dynamic = "force-dynamic";

type ResetPasswordPageProps = {
  searchParams?: Promise<{ token?: string; feedback?: string; mensagem?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const query = searchParams ? await searchParams : undefined;
  const token = query?.token ?? "";

  return (
    <main className="page-shell">
      {query?.feedback && query?.mensagem ? (
        <section className={`feedback-banner ${query.feedback === "sucesso" ? "ok" : "error"}`}>
          <strong>{query.feedback === "sucesso" ? "Senha atualizada." : "Falha na redefinição."}</strong>
          <div style={{ marginTop: 6 }}>{query.mensagem}</div>
        </section>
      ) : null}

      <section className="hero-card">
        <span className="pill">Nova senha</span>
        <h1 className="title">Criar nova senha de acesso</h1>
        <p className="subtitle">
          Defina uma senha com pelo menos 8 caracteres. Após a alteração, sessões antigas desse usuário serão encerradas.
        </p>
        <div className="actions" style={{ marginTop: 18 }}>
          <Link className="button secondary" href="/">
            Voltar para o login
          </Link>
        </div>
      </section>

      <section className="card manager-auth-card">
        <h2 className="section-title">Redefinir senha</h2>
        <form action={resetPasswordAction} className="manager-auth-form">
          <input name="token" type="hidden" value={token} />
          <label className="step-note">
            <span>Nova senha</span>
            <input className="step-input" minLength={8} name="senha" required type="password" />
          </label>
          <label className="step-note">
            <span>Confirmar nova senha</span>
            <input className="step-input" minLength={8} name="confirmarSenha" required type="password" />
          </label>
          <button className="button" disabled={!token} type="submit">
            Alterar senha
          </button>
        </form>
        {!token ? <div className="empty-state">Link de recuperação ausente ou inválido.</div> : null}
      </section>
    </main>
  );
}