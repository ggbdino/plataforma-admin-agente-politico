"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  canManagePlatformUsers,
  getCurrentPlatformSession,
  getDefaultPlatformRoute,
  logoutCurrentPlatformSession,
  requireAdminBootstrap,
  setAdminBootstrapAllowed,
  setCurrentPlatformSession,
  validateAdminBootstrapCode
} from "@/lib/auth";
import {
  authenticatePlatformUser,
  createPasswordResetToken,
  createPlatformSession,
  createPlatformUser,
  deletePlatformUser,
  getPermittedCandidateIdsForUser,
  hasAnyPlatformUser,
  resetPlatformUserPasswordWithToken,
  updatePlatformUserAssignment,
  updatePlatformUserPassword,
  type PlatformUserPermissionInput,
  type PlatformUserProfile
} from "@/lib/repositories/platform-users";
import { recordGovernanceEvent } from "@/lib/repositories/governance";
import { sendPlatformTransactionalEmail } from "@/lib/services/platform-mailer";

export async function authenticateAdminBootstrapAction(formData: FormData) {
  const codigo = String(formData.get("codigo") ?? "").trim();

  if (!validateAdminBootstrapCode(codigo)) {
    redirect(`/admin/acesso?feedback=erro&mensagem=${encodeURIComponent("Código especial do administrador inválido.")}`);
  }

  await setAdminBootstrapAllowed();
  redirect(`/admin/usuarios?feedback=sucesso&mensagem=${encodeURIComponent("Entrada especial do administrador liberada.")}`);
}

export async function createPlatformUserAction(formData: FormData) {
  const hasUsers = await hasAnyPlatformUser();
  let actingSession = await getCurrentPlatformSession();

  if (!hasUsers) {
    const access = await requireAdminBootstrap();
    actingSession = access.mode === "session" ? access.session : null;
  } else if (!(await canManagePlatformUsers(actingSession))) {
    redirect(`/admin/usuarios?feedback=erro&mensagem=${encodeURIComponent("Seu perfil não possui permissão para cadastrar usuários.")}`);
  }

  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "").trim();
  const perfil = String(formData.get("perfil") ?? "operador").trim() as PlatformUserProfile;
  const idCandidato = String(formData.get("idCandidato") ?? "").trim();

  if (!nome || !email || !senha) {
    redirect(`/admin/usuarios?feedback=erro&mensagem=${encodeURIComponent("Preencha nome, e-mail e senha do usuário.")}`);
  }

  if (!hasUsers && perfil !== "administrador") {
    redirect(`/admin/usuarios?feedback=erro&mensagem=${encodeURIComponent("No primeiro cadastro da plataforma, crie inicialmente um usuário administrador.")}`);
  }

  if (actingSession?.perfil === "gestor_campanha" && !["operador", "analista"].includes(perfil)) {
    redirect(`/admin/usuarios?feedback=erro&mensagem=${encodeURIComponent("O gestor da campanha só pode cadastrar operador ou analista.")}`);
  }

  if (perfil !== "administrador" && !idCandidato) {
    redirect(`/admin/usuarios?feedback=erro&mensagem=${encodeURIComponent("Selecione o candidato vinculado para esse perfil.")}`);
  }

  if (actingSession?.perfil === "gestor_campanha") {
    const candidateIds = await getPermittedCandidateIdsForUser(actingSession.userId);
    if (!candidateIds.includes(idCandidato)) {
      redirect(`/admin/usuarios?feedback=erro&mensagem=${encodeURIComponent("O gestor só pode cadastrar usuários vinculados ao próprio candidato.")}`);
    }
  }

  const permissoes = buildPermissionsForProfile(perfil, idCandidato || null);

  try {
    const userId = await createPlatformUser({ nome, email, senha, perfil, permissoes });

    await recordGovernanceEvent({
      idCandidato: null,
      escopo: "admin",
      ator: actingSession?.email ?? "administrador",
      categoria: "cadastro_usuarios",
      acao: "usuario_criado",
      descricao: `Usuário ${email} criado com perfil ${perfil}.`,
      status: "sucesso",
      origem: "platform-admin",
      detalhes: { userId, perfil, permissoes } as Record<string, unknown>
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível cadastrar o usuário.";
    redirect(`/admin/usuarios?feedback=erro&mensagem=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin/usuarios");
  redirect(`/admin/usuarios?feedback=sucesso&mensagem=${encodeURIComponent("Usuário e permissões cadastrados com sucesso.")}`);
}

export async function authenticatePlatformAreaAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "").trim();
  const contexto = String(formData.get("contexto") ?? "campanha").trim();
  const idCandidato = String(formData.get("idCandidato") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "/").trim();

  const user = await authenticatePlatformUser(email, senha);

  if (!user) {
    redirect(`${redirectTo}?feedback=erro&mensagem=${encodeURIComponent("Usuário ou senha inválidos para este acesso.")}`);
  }

  const { rawToken } = await createPlatformSession({
    id: user.id,
    nome: user.nome,
    email: user.email,
    perfil: user.perfil
  });

  await setCurrentPlatformSession(rawToken);

  await recordGovernanceEvent({
    idCandidato: idCandidato || null,
    escopo: contexto === "governanca" ? "admin" : "campanha",
    ator: user.email,
    categoria: "acesso_perfilado",
    acao: "login_concluido",
    descricao: `Acesso autenticado na área ${contexto}.`,
    status: "sucesso",
    origem: "platform-auth"
  });

  const targetRoute =
    redirectTo === "/" || redirectTo === "/acesso"
      ? await getDefaultPlatformRoute({ userId: user.id, perfil: user.perfil })
      : redirectTo;

  redirect(`${targetRoute}?feedback=sucesso&mensagem=${encodeURIComponent("Acesso autenticado com sucesso.")}`);
}

export async function logoutPlatformAreaAction() {
  const session = await getCurrentPlatformSession();

  if (session) {
    await recordGovernanceEvent({
      idCandidato: null,
      escopo: "admin",
      ator: session.email,
      categoria: "acesso_perfilado",
      acao: "logout_concluido",
      descricao: "Sessão encerrada pelo usuário.",
      status: "sucesso",
      origem: "platform-auth"
    });
  }

  await logoutCurrentPlatformSession();
  redirect("/");
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const target = "/recuperar-senha";

  if (!email) {
    redirect(`${target}?feedback=erro&mensagem=${encodeURIComponent("Informe o e-mail cadastrado.")}`);
  }

  const reset = await createPasswordResetToken(email);

  if (reset) {
    const resetUrl = `${await getRequestOrigin()}/redefinir-senha?token=${reset.rawToken}`;
    const html = buildPasswordResetHtml(reset.user.nome, resetUrl);
    const text = buildPasswordResetText(reset.user.nome, resetUrl);
    const provider = await sendPlatformTransactionalEmail({
      toEmail: reset.user.email,
      toName: reset.user.nome,
      subject: "Recuperação de senha da Plataforma Administrativa",
      html,
      text
    });

    await recordGovernanceEvent({
      idCandidato: null,
      escopo: "admin",
      ator: reset.user.email,
      categoria: "recuperacao_senha",
      acao: "link_recuperacao_solicitado",
      descricao: `Link de recuperação solicitado. Provedor: ${provider}.`,
      status: provider === "sem_provedor" ? "aviso" : "sucesso",
      origem: "platform-auth"
    });
  }

  redirect(`${target}?feedback=sucesso&mensagem=${encodeURIComponent("Se o e-mail estiver cadastrado e ativo, enviaremos um link para redefinir a senha.")}`);
}

export async function resetPasswordAction(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  const senha = String(formData.get("senha") ?? "").trim();
  const confirmarSenha = String(formData.get("confirmarSenha") ?? "").trim();

  if (!token || senha.length < 8 || senha !== confirmarSenha) {
    redirect(`/redefinir-senha?token=${encodeURIComponent(token)}&feedback=erro&mensagem=${encodeURIComponent("Informe uma senha com pelo menos 8 caracteres e confirme corretamente.")}`);
  }

  const success = await resetPlatformUserPasswordWithToken(token, senha);

  if (!success) {
    redirect(`/redefinir-senha?feedback=erro&mensagem=${encodeURIComponent("Link inválido, expirado ou já utilizado.")}`);
  }

  redirect(`/?feedback=sucesso&mensagem=${encodeURIComponent("Senha redefinida com sucesso. Entre novamente no sistema.")}`);
}

export async function adminUpdatePlatformUserPasswordAction(formData: FormData) {
  const session = await requireAdministratorSession();
  const userId = String(formData.get("userId") ?? "").trim();
  const senha = String(formData.get("senha") ?? "").trim();

  if (!userId || senha.length < 8) {
    redirect(`/admin/usuarios?feedback=erro&mensagem=${encodeURIComponent("Informe o usuário e uma nova senha com pelo menos 8 caracteres.")}`);
  }

  await updatePlatformUserPassword(userId, senha);
  await recordGovernanceEvent({
    idCandidato: null,
    escopo: "admin",
    ator: session.email,
    categoria: "cadastro_usuarios",
    acao: "senha_usuario_alterada",
    descricao: `Senha do usuário ${userId} alterada pelo administrador.`,
    status: "sucesso",
    origem: "platform-admin"
  });

  revalidatePath("/admin/usuarios");
  redirect(`/admin/usuarios?feedback=sucesso&mensagem=${encodeURIComponent("Senha alterada e sessões do usuário encerradas.")}`);
}

export async function adminDeletePlatformUserAction(formData: FormData) {
  const session = await requireAdministratorSession();
  const userId = String(formData.get("userId") ?? "").trim();

  if (!userId || userId === session.userId) {
    redirect(`/admin/usuarios?feedback=erro&mensagem=${encodeURIComponent("Não é possível excluir o próprio usuário administrador nesta operação.")}`);
  }

  await deletePlatformUser(userId);
  await recordGovernanceEvent({
    idCandidato: null,
    escopo: "admin",
    ator: session.email,
    categoria: "cadastro_usuarios",
    acao: "usuario_excluido",
    descricao: `Usuário ${userId} excluído pelo administrador.`,
    status: "sucesso",
    origem: "platform-admin"
  });

  revalidatePath("/admin/usuarios");
  redirect(`/admin/usuarios?feedback=sucesso&mensagem=${encodeURIComponent("Usuário excluído com sucesso.")}`);
}

export async function adminUpdatePlatformUserAssignmentAction(formData: FormData) {
  const session = await requireAdministratorSession();
  const userId = String(formData.get("userId") ?? "").trim();
  const perfil = String(formData.get("perfil") ?? "operador").trim() as PlatformUserProfile;
  const idCandidato = String(formData.get("idCandidato") ?? "").trim();

  if (!userId) {
    redirect(`/admin/usuarios?feedback=erro&mensagem=${encodeURIComponent("Selecione o usuário que será alterado.")}`);
  }

  if (perfil !== "administrador" && !idCandidato) {
    redirect(`/admin/usuarios?feedback=erro&mensagem=${encodeURIComponent("Selecione o candidato vinculado ao usuário.")}`);
  }

  await updatePlatformUserAssignment({
    userId,
    perfil,
    permissoes: buildPermissionsForProfile(perfil, idCandidato || null)
  });

  await recordGovernanceEvent({
    idCandidato: idCandidato || null,
    escopo: "admin",
    ator: session.email,
    categoria: "cadastro_usuarios",
    acao: "usuario_vinculo_alterado",
    descricao: `Usuário ${userId} alterado para perfil ${perfil}.`,
    status: "sucesso",
    origem: "platform-admin"
  });

  revalidatePath("/admin/usuarios");
  redirect(`/admin/usuarios?feedback=sucesso&mensagem=${encodeURIComponent("Perfil e vínculo do usuário atualizados com sucesso.")}`);
}

async function requireAdministratorSession() {
  const session = await getCurrentPlatformSession();

  if (!session || session.perfil !== "administrador") {
    redirect(`/admin/usuarios?feedback=erro&mensagem=${encodeURIComponent("A operação é exclusiva do administrador da plataforma.")}`);
  }

  return session;
}

function buildPermissionsForProfile(
  perfil: PlatformUserProfile,
  idCandidato: string | null
): PlatformUserPermissionInput[] {
  if (perfil === "administrador" || !idCandidato) {
    return [];
  }

  if (perfil === "gestor_campanha") {
    return [{ idCandidato, podeVisualizar: true, podeImplantar: true, podeOperarFunil: true, podeOperarEventos: true, podeVerKpis: true }];
  }

  if (perfil === "operador") {
    return [{ idCandidato, podeVisualizar: true, podeImplantar: false, podeOperarFunil: true, podeOperarEventos: true, podeVerKpis: false }];
  }

  return [{ idCandidato, podeVisualizar: true, podeImplantar: false, podeOperarFunil: false, podeOperarEventos: false, podeVerKpis: true }];
}

async function getRequestOrigin() {
  const requestHeaders = await headers();
  const proto = requestHeaders.get("x-forwarded-proto") ?? "https";
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

function buildPasswordResetHtml(nome: string, resetUrl: string) {
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#123;line-height:1.5"><p>Olá, ${escapeHtml(nome)}.</p><p>Recebemos uma solicitação para redefinir sua senha na Plataforma Administrativa do Agente Político.</p><p><a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:10px 14px;background:#0b61a4;color:#fff;text-decoration:none;border-radius:6px">Redefinir senha</a></p><p>O link expira em 1 hora. Se você não solicitou essa alteração, ignore esta mensagem.</p></body></html>`;
}

function buildPasswordResetText(nome: string, resetUrl: string) {
  return `Olá, ${nome}.\n\nRecebemos uma solicitação para redefinir sua senha na Plataforma Administrativa do Agente Político.\n\nAcesse o link abaixo para criar uma nova senha. O link expira em 1 hora.\n\n${resetUrl}\n\nSe você não solicitou essa alteração, ignore esta mensagem.`;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}