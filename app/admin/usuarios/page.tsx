import Link from "next/link";
import {
  canManagePlatformUsers,
  getCurrentPlatformSession,
  getManageableProfilesForSession,
  getVisibleCandidateIdsForSession,
  requireAdminBootstrap
} from "@/lib/auth";
import { createPlatformUserAction } from "@/lib/actions/platform-user-action";
import { listCandidates } from "@/lib/repositories/candidates";
import { hasAnyPlatformUser, listPlatformUsers } from "@/lib/repositories/platform-users";

type AdminUsersPageProps = {
  searchParams?: Promise<{
    feedback?: string;
    mensagem?: string;
  }>;
};

export const dynamic = "force-dynamic";

const PROFILE_LABELS = {
  administrador: "Administrador",
  gestor_campanha: "Gestor da campanha",
  operador: "Operador",
  analista: "Analista"
} as const;

const PROFILE_SUMMARY = {
  administrador:
    "Acesso total à plataforma, governança, saneamento da base, usuários, workflows e visão consolidada.",
  gestor_campanha:
    "Acesso integral apenas ao candidato vinculado, incluindo implantação, eventos, funil e cadastro de operadores e analistas.",
  operador:
    "Operação diária do candidato vinculado, com atuação em relacionamento, funil e eventos, sem governança global.",
  analista:
    "Consulta de indicadores e leitura analítica do candidato vinculado, sem implantação e sem operação administrativa."
} as const;

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const query = searchParams ? await searchParams : undefined;
  const hasUsers = await hasAnyPlatformUser();
  const access = !hasUsers ? await requireAdminBootstrap() : null;
  const session =
    access?.mode === "session" ? access.session : await getCurrentPlatformSession();

  if (hasUsers && !(await canManagePlatformUsers(session))) {
    return (
      <main className="page-shell">
        <section className="feedback-banner error">
          <strong>Acesso administrativo restrito.</strong>
          <div style={{ marginTop: 6 }}>
            Seu perfil não possui autorização para gerenciar usuários da plataforma.
          </div>
        </section>
      </main>
    );
  }

  const users = await listPlatformUsers();
  const candidates = await listCandidates();
  const visibleCandidateIds = !hasUsers ? null : await getVisibleCandidateIdsForSession(session);
  const availableProfiles = !hasUsers
    ? (["administrador"] as const)
    : await getManageableProfilesForSession(session);

  const manageableCandidates =
    visibleCandidateIds === null
      ? candidates
      : candidates.filter((candidate) => visibleCandidateIds.includes(candidate.id_candidato));

  const visibleUsers =
    session?.perfil === "administrador"
      ? users
      : users.filter((user) =>
          user.permissoes.some((permission) =>
            manageableCandidates.some((candidate) => candidate.id_candidato === permission.id_candidato)
          )
        );

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
        <h1 className="title">Cadastro de usuários, perfis e vinculação por candidato</h1>
        <p className="subtitle">
          Cada perfil operacional agora nasce vinculado ao candidato correto. O gestor da campanha
          enxerga apenas o próprio candidato e pode montar sua equipe de operação sem abrir acesso
          ao restante da plataforma.
        </p>
        <div className="hero-meta">
          <span className="pill">
            {access?.mode === "bootstrap"
              ? "Sessão especial de bootstrap"
              : `Perfil ${session?.perfil ?? "interno"}`}
          </span>
          <span className="pill">{visibleUsers.length} usuário(s) visível(is)</span>
          <span className="pill">{manageableCandidates.length} campanha(s) disponível(is)</span>
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
            <h2 className="section-title">Perfis disponíveis</h2>
            <p className="subtitle">
              Escopos operacionais padronizados para produção.
            </p>
          </div>
          <span className="pill">
            {session?.perfil === "administrador" ? "Controle do administrador" : "Controle do gestor"}
          </span>
        </div>
        <div className="grid grid-2">
          {availableProfiles.map((profile) => (
            <article className="card analytics-panel" key={profile}>
              <h3 className="section-title" style={{ marginBottom: 8 }}>
                {PROFILE_LABELS[profile]}
              </h3>
              <p className="subtitle">{PROFILE_SUMMARY[profile]}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">Novo usuário</h2>
            <p className="subtitle">
              Administrador pode cadastrar qualquer perfil. Gestor da campanha pode cadastrar apenas
              operador e analista do próprio candidato.
            </p>
          </div>
          <span className="pill">Cadastro estruturado</span>
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
              <select className="step-input" name="perfil" defaultValue={availableProfiles[0] ?? "operador"}>
                {availableProfiles.map((profile) => (
                  <option key={profile} value={profile}>
                    {PROFILE_LABELS[profile]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="step-note">
            <span>Candidato vinculado</span>
            <select className="step-input" name="idCandidato" defaultValue={manageableCandidates[0]?.id_candidato ?? ""}>
              <option value="">Selecione o candidato vinculado</option>
              {manageableCandidates.map((candidate) => (
                <option key={candidate.id_candidato} value={candidate.id_candidato}>
                  {candidate.id_candidato} | {candidate.nome_urna}
                </option>
              ))}
            </select>
          </label>

          <div className="step-panel-callout">
            <strong>Regras desta tela</strong>
            <div style={{ marginTop: 8 }}>
              Administrador: acesso total e não precisa de vínculo por candidato.
            </div>
            <div style={{ marginTop: 4 }}>
              Gestor da campanha: vínculo obrigatório a um único candidato.
            </div>
            <div style={{ marginTop: 4 }}>
              Operador e analista: vínculo obrigatório e visão isolada ao candidato informado.
            </div>
            <div style={{ marginTop: 4 }}>
              O gestor da campanha não consegue ver nem cadastrar usuários fora do próprio candidato.
            </div>
          </div>

          <div className="step-panel-callout">
            Campanhas disponíveis neste cadastro:{" "}
            {manageableCandidates.map((candidate) => `${candidate.id_candidato} (${candidate.nome_urna})`).join(" | ")}
          </div>

          <div className="actions">
            <button className="button" type="submit">
              Cadastrar usuário
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
                <th>Candidato vinculado</th>
                <th>Capacidades</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.nome}</strong>
                    <div className="mono">{user.email}</div>
                  </td>
                  <td>{PROFILE_LABELS[user.perfil]}</td>
                  <td>
                    {user.ultimo_login_em
                      ? new Intl.DateTimeFormat("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short"
                        }).format(new Date(user.ultimo_login_em))
                      : "sem acesso registrado"}
                  </td>
                  <td>
                    {user.permissoes.length === 0
                      ? "acesso global"
                      : user.permissoes.map((permission) => permission.nome_urna ?? permission.id_candidato).join(" | ")}
                  </td>
                  <td>
                    {user.permissoes.length === 0 ? (
                      <span className="muted">controle global</span>
                    ) : (
                      <div className="analytics-stack">
                        {user.permissoes.map((permission) => (
                          <div key={permission.id} className="step-panel-callout">
                            <strong>{permission.nome_urna ?? permission.id_candidato ?? "Campanha"}</strong>
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
