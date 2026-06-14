import Link from "next/link";
import { redirect } from "next/navigation";
import { authenticatePlatformAreaAction } from "@/lib/actions/platform-user-action";
import { getCurrentPlatformSession, getDefaultPlatformRoute } from "@/lib/auth";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams?: Promise<{
    feedback?: string;
    mensagem?: string;
  }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const query = searchParams ? await searchParams : undefined;
  const session = await getCurrentPlatformSession();

  if (session) {
    redirect(await getDefaultPlatformRoute(session));
  }

  return (
    <main className="page-shell">
      {query?.feedback && query?.mensagem ? (
        <section className={`feedback-banner ${query.feedback === "sucesso" ? "ok" : "error"}`}>
          <strong>{query.feedback === "sucesso" ? "Acesso autenticado." : "Falha de acesso."}</strong>
          <div style={{ marginTop: 6 }}>{query.mensagem}</div>
        </section>
      ) : null}

      <section className="hero-card">
        <span className="pill ok">Produção controlada</span>
        <h1 className="title">Entrada da Plataforma Administrativa</h1>
        <p className="subtitle">
          O sistema agora exige autenticação antes da abertura. Cada usuário enxerga apenas as
          áreas compatíveis com o próprio perfil e, quando aplicável, somente o candidato ao qual
          está vinculado.
        </p>
        <div className="hero-meta">
          <span className="pill">Administrador: governança global</span>
          <span className="pill">Gestor: um candidato</span>
          <span className="pill">Operador e analista: visão isolada</span>
        </div>
        <div className="actions" style={{ marginTop: 18 }}>
          <Link className="button secondary" href="/admin/acesso">
            Primeiro acesso do administrador
          </Link>
        </div>
      </section>

      <section className="card manager-auth-card">
        <h2 className="section-title">Entrar no sistema</h2>
        <p className="subtitle">
          Use o e-mail e a senha do usuário cadastrado. O redirecionamento será feito
          automaticamente para a área correta.
        </p>
        <form action={authenticatePlatformAreaAction} className="manager-auth-form">
          <input name="redirectTo" type="hidden" value="/" />
          <input name="contexto" type="hidden" value="entrada" />
          <label className="step-note">
            <span>E-mail</span>
            <input className="step-input" name="email" type="email" />
          </label>
          <label className="step-note">
            <span>Senha</span>
            <input className="step-input" name="senha" type="password" />
          </label>
          <button className="button" type="submit">
            Abrir sistema
          </button>
        </form>
      </section>
    </main>
  );
}
