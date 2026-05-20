import Link from "next/link";
import { requireAdminBootstrap } from "@/lib/auth";
import { createPlatformUserAction } from "@/lib/actions/platform-user-action";
import { listCandidates } from "@/lib/repositories/candidates";
import { listPlatformUsers } from "@/lib/repositories/platform-users";

type AdminUsersPageProps = {
  searchParams?: Promise<{
    feedback?: string;
    mensagem?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const query = searchParams ? await searchParams : undefined;
  const access = await requireAdminBootstrap();
  const users = await listPlatformUsers();
  const candidates = await listCandidates();

  return (
    <main className="page-shell">
      {query?.feedback && query?.mensagem ? (
        <section className={`feedback-banner ${query.feedback === "sucesso" ? "ok" : "error"}`}>
          <strong>{query.feedback === "sucesso" ? "Operação concluída." : "Falha administrativa."}</strong>
          <div style={{ marginTop: 6 }}>{query.mensagem}</div>
        </section>
      ) : null}

      <section className="hero-card">
        <span className="pill">Governança de acesso</span>
        <h1 className="title">Cadastro de usuários e perfis da plataforma</h1>
        <p className="subtitle">
          Central administrativa para criar usuários, definir perfis e vincular permissões por
          campanha.
        </p>
        <div className="hero-meta">
          <span className="pill">
            {access.mode === "bootstrap" ? "Sessão especial de bootstrap" : "Administrador autenticado"}
          </span>
          <span className="pill">{users.length} usuário(s) cadastrado(s)</span>
        </div>
        <div className="actions" style={{ marginTop: 18 }}>
          <Link className="button secondary" href="/estatisticas/governanca">
            Voltar para governança
          </Link>
        </div>
      </section>

      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">Novo usuário</h2>
            <p className="subtitle">
              Cadastre o usuário com perfil e informe as campanhas permitidas no formato{" "}
              <span className="mono">0001:gestor</span> ou{" "}
              <span className="mono">0001:operacao</span>, uma por linha.
            </p>
          </div>
          <span className="pill">Controle do admin</span>
        </div>
        <form action={createPlatformUserAction} className="manager-auth-form">
          <div className="step-form-grid">
            <label className="step-note">
              <span>Nome</span>
              <input className="step-input" name="nome" type="text" />
            </label>
            <label className="step-note">
              <span>E-mail</span>
              <input className="step-input" name="email" type="email" />
            </label>
            <label className="step-note">
              <span>Senha inicial</span>
              <input className="step-input" name="senha" type="password" />
            </label>
            <label className="step-note">
              <span>Perfil</span>
              <select className="step-input" name="perfil">
                <option value="administrador">Administrador</option>
                <option value="gestor_campanha">Gestor da campanha</option>
                <option value="operador">Operador</option>
                <option value="analista">Analista</option>
              </select>
            </label>
          </div>
          <label className="step-note">
            <span>Permissões por campanha</span>
            <textarea className="step-textarea" name="permissoes" rows={6} placeholder={`0001:gestor\n0002:operacao`} />
          </label>
          <div className="step-panel-callout">
            Campanhas disponíveis:{" "}
            {candidates.map((candidate) => `${candidate.id_candidato} (${candidate.nome_urna})`).join(" | ")}
          </div>
          <div className="actions">
            <button className="button" type="submit">
              Cadastrar usuário e permissões
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <h2 className="section-title">Usuários cadastrados</h2>
        <div className="table-responsive">
          <table className="table analytics-table">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Perfil</th>
                <th>Último login</th>
                <th>Permissões</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.nome}</strong>
                    <div className="mono">{user.email}</div>
                  </td>
                  <td>{user.perfil}</td>
                  <td>
                    {user.ultimo_login_em
                      ? new Intl.DateTimeFormat("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short"
                        }).format(new Date(user.ultimo_login_em))
                      : "sem acesso registrado"}
                  </td>
                  <td>
                    {user.permissoes.length === 0 ? (
                      <span className="muted">Sem permissões vinculadas</span>
                    ) : (
                      <div className="analytics-stack">
                        {user.permissoes.map((permission) => (
                          <div key={permission.id} className="step-panel-callout">
                            <strong>{permission.nome_urna ?? "Escopo amplo"}</strong>
                            <div className="muted">
                              visualizar: {permission.pode_visualizar ? "sim" : "não"} | implantar:{" "}
                              {permission.pode_implantar ? "sim" : "não"} | funil:{" "}
                              {permission.pode_operar_funil ? "sim" : "não"} | eventos:{" "}
                              {permission.pode_operar_eventos ? "sim" : "não"} | KPIs:{" "}
                              {permission.pode_ver_kpis ? "sim" : "não"}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
