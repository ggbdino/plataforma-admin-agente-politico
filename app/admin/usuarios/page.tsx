import Link from "next/link";
import { PasswordInput } from "@/components/password-input";
import {
  canManagePlatformUsers,
  getCurrentPlatformSession,
  getManageableProfilesForSession,
  getVisibleCandidateIdsForSession,
  requireAdminBootstrap
} from "@/lib/auth";
import {
  adminDeletePlatformUserAction,
  adminUpdatePlatformUserAssignmentAction,
  adminUpdatePlatformUserPasswordAction,
  createPlatformUserAction
} from "@/lib/actions/platform-user-action";
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
    "Visualiza conversas, opera relacionamento e funil, controla entrada em eventos e telão, sem acesso aos dados estatísticos.",
  analista:
    "Consulta gráficos e indicadores estatísticos do candidato vinculado, sem eventos, conversas nominais ou operação administrativa."
} as const;

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const query = searchParams ? await searchParams : undefined;
  const hasUsers = await hasAnyPlatformUser();
  const access = !hasUsers ? await requireAdminBootstrap() : null;
  const session = access?.mode === "session" ? access.session : await getCurrentPlatformSession();

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
  const isAdministrator = session?.perfil === "administrador";

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
          Cada perfil operacional nasce vinculado ao candidato correto. O administrador pode operar todos
          os usuários da plataforma; o gestor enxerga apenas a própria campanha e sua equipe operacional.
        </p>
        <div className="hero-meta">
          <span className="pill">
            {access?.mode === "bootstrap" ? "Sessão especial de bootstrap" : `Perfil ${session?.perfil ?? "interno"}`}
          </span>
          <span className="pill">{visibleUsers.length} usuário(s) visível(is)</span>
          <span className="pill">{manageableCandidates.length} campanha(s) disponível(is)</span>
        </div>
        <div className="actions" style={{ marginTop: 18 }}>
          <Link className="button secondary" href="/estatisticas/governanca">
            Voltar para governança
          </Link>
          <Link className="button secondary" href="/admin/candidatos">
            Saneamento de base
          </Link>
        </div>
      </section>

      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">Perfis disponíveis</h2>
            <p className="subtitle">Escopos operacionais padronizados para produção.</p>
          </div>
          <span className="pill">{isAdministrator ? "Controle do administrador" : "Controle do gestor"}</span>
        </div>
        <div className="grid grid-2">
          {availableProfiles.map((profile) => (
            <article className="card analytics-panel" key={profile}>
              <h3 className="section-title" style={{ marginBottom: 8 }}>{PROFILE_LABELS[profile]}</h3>
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
              Administrador pode cadastrar qualquer perfil e vincular a qualquer candidato. Gestor da campanha pode cadastrar apenas operador e analista do próprio candidato.
            </p>
          </div>
          <span className="pill">Cadastro estruturado</span>
        </div>
        <form action={createPlatformUserAction} className="manager-auth-form">
          <div className="step-form-grid">
            <label className="step-note"><span>Nome</span><input className="step-input" name="nome" required type="text" /></label>
            <label className="step-note"><span>E-mail</span><input className="step-input" name="email" required type="email" /></label>
            <label className="step-note"><span>Senha inicial</span><PasswordInput minLength={8} name="senha" required /></label>
            <label className="step-note">
              <span>Perfil</span>
              <select className="step-input" name="perfil" defaultValue={availableProfiles[0] ?? "operador"}>
                {availableProfiles.map((profile) => <option key={profile} value={profile}>{PROFILE_LABELS[profile]}</option>)}
              </select>
            </label>
          </div>
          <label className="step-note">
            <span>Candidato vinculado</span>
            <select className="step-input" name="idCandidato" defaultValue={manageableCandidates[0]?.id_candidato ?? ""}>
              <option value="">Selecione o candidato vinculado</option>
              {manageableCandidates.map((candidate) => (
                <option key={candidate.id_candidato} value={candidate.id_candidato}>{candidate.id_candidato} | {candidate.nome_urna}</option>
              ))}
            </select>
          </label>
          <div className="step-panel-callout">
            Administrador não precisa de vínculo por candidato quando o perfil também for administrador. Todos os demais perfis exigem vínculo com uma campanha.
          </div>
          <div className="actions"><button className="button" type="submit">Cadastrar usuário</button></div>
        </form>
      </section>

      {isAdministrator ? (
        <section className="card analytics-panel" style={{ marginBottom: 20 }}>
          <div className="section-heading">
            <div>
              <h2 className="section-title">Manutenção administrativa de usuários</h2>
              <p className="subtitle">Altere perfil, vínculo, senha ou exclua usuários da plataforma.</p>
            </div>
            <span className="pill">Exclusivo do administrador</span>
          </div>
          <div className="grid grid-3">
            <form action={adminUpdatePlatformUserAssignmentAction} className="manager-auth-form card analytics-panel">
              <h3 className="section-title">Alterar perfil e vínculo</h3>
              <label className="step-note"><span>Usuário</span>{renderUserSelect(visibleUsers)}</label>
              <label className="step-note">
                <span>Novo perfil</span>
                <select className="step-input" name="perfil" defaultValue="operador">
                  {(Object.keys(PROFILE_LABELS) as Array<keyof typeof PROFILE_LABELS>).map((profile) => <option key={profile} value={profile}>{PROFILE_LABELS[profile]}</option>)}
                </select>
              </label>
              <label className="step-note"><span>Candidato</span>{renderCandidateSelect(manageableCandidates)}</label>
              <button className="button" type="submit">Atualizar vínculo</button>
            </form>

            <form action={adminUpdatePlatformUserPasswordAction} className="manager-auth-form card analytics-panel">
              <h3 className="section-title">Alterar senha</h3>
              <label className="step-note"><span>Usuário</span>{renderUserSelect(visibleUsers)}</label>
              <label className="step-note"><span>Nova senha</span><PasswordInput minLength={8} name="senha" required /></label>
              <div className="step-panel-callout">As sessões abertas do usuário serão encerradas.</div>
              <button className="button" type="submit">Alterar senha</button>
            </form>

            <form action={adminDeletePlatformUserAction} className="manager-auth-form card analytics-panel">
              <h3 className="section-title">Excluir usuário</h3>
              <label className="step-note"><span>Usuário</span>{renderUserSelect(visibleUsers.filter((user) => user.id !== session?.userId))}</label>
              <div className="step-panel-callout">A exclusão remove permissões e sessões. O próprio administrador logado não pode se excluir.</div>
              <button className="button danger-button" type="submit">Excluir usuário</button>
            </form>
          </div>
        </section>
      ) : null}

      <section className="card">
        <h2 className="section-title">Usuários cadastrados</h2>
        <div className="table-responsive">
          <table className="table analytics-table">
            <thead>
              <tr>
                <th>Usuário</th><th>Perfil</th><th>Status</th><th>Último login</th><th>Candidato vinculado</th><th>Capacidades</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((user) => (
                <tr key={user.id}>
                  <td><strong>{user.nome}</strong><div className="mono">{user.email}</div></td>
                  <td>{PROFILE_LABELS[user.perfil]}</td>
                  <td>{user.status}</td>
                  <td>{user.ultimo_login_em ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(user.ultimo_login_em)) : "sem acesso registrado"}</td>
                  <td>{user.permissoes.length === 0 ? "acesso global" : user.permissoes.map((permission) => permission.nome_urna ?? permission.id_candidato).join(" | ")}</td>
                  <td>
                    {user.permissoes.length === 0 ? <span className="muted">controle global</span> : (
                      <div className="analytics-stack">
                        {user.permissoes.map((permission) => (
                          <div key={permission.id} className="step-panel-callout">
                            <strong>{permission.nome_urna ?? permission.id_candidato ?? "Campanha"}</strong>
                            <div className="muted">
                              visualizar: {permission.pode_visualizar ? "sim" : "não"} | implantar: {permission.pode_implantar ? "sim" : "não"} | funil: {permission.pode_operar_funil ? "sim" : "não"} | eventos: {permission.pode_operar_eventos ? "sim" : "não"} | KPIs: {permission.pode_ver_kpis ? "sim" : "não"}
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

function renderUserSelect(users: Array<{ id: string; nome: string; email: string }>) {
  return (
    <select className="step-input" name="userId" required>
      <option value="">Selecione o usuário</option>
      {users.map((user) => <option key={user.id} value={user.id}>{user.nome} | {user.email}</option>)}
    </select>
  );
}

function renderCandidateSelect(candidates: Array<{ id_candidato: string; nome_urna: string | null }>) {
  return (
    <select className="step-input" name="idCandidato">
      <option value="">Sem vínculo para administrador</option>
      {candidates.map((candidate) => <option key={candidate.id_candidato} value={candidate.id_candidato}>{candidate.id_candidato} | {candidate.nome_urna}</option>)}
    </select>
  );
}
