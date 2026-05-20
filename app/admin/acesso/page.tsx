import Link from "next/link";
import { authenticateAdminBootstrapAction } from "@/lib/actions/platform-user-action";

type AdminAccessPageProps = {
  searchParams?: Promise<{
    feedback?: string;
    mensagem?: string;
  }>;
};

export default async function AdminAccessPage({ searchParams }: AdminAccessPageProps) {
  const query = searchParams ? await searchParams : undefined;

  return (
    <main className="page-shell">
      {query?.feedback && query?.mensagem ? (
        <section className={`feedback-banner ${query.feedback === "sucesso" ? "ok" : "error"}`}>
          <strong>{query.feedback === "sucesso" ? "Acesso liberado." : "Falha de autenticação."}</strong>
          <div style={{ marginTop: 6 }}>{query.mensagem}</div>
        </section>
      ) : null}

      <section className="hero-card">
        <span className="pill">Administração especial</span>
        <h1 className="title">Entrada especial do administrador</h1>
        <p className="subtitle">
          Use este acesso controlado para cadastrar usuários, perfis e permissões da plataforma.
        </p>
        <div className="actions" style={{ marginTop: 18 }}>
          <Link className="button secondary" href="/">
            Voltar para início
          </Link>
        </div>
      </section>

      <section className="card manager-auth-card">
        <h2 className="section-title">Validar código especial</h2>
        <p className="subtitle">
          Esta entrada existe apenas para liberar a administração do cadastro interno de usuários.
        </p>
        <form action={authenticateAdminBootstrapAction} className="manager-auth-form">
          <label className="step-note">
            <span>Código especial do administrador</span>
            <input className="step-input" name="codigo" type="password" />
          </label>
          <button className="button" type="submit">
            Liberar administração de usuários
          </button>
        </form>
      </section>
    </main>
  );
}
