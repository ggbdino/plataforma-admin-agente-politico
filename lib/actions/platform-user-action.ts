"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  getCurrentPlatformSession,
  logoutCurrentPlatformSession,
  requireAdminBootstrap,
  setAdminBootstrapAllowed,
  setCurrentPlatformSession,
  validateAdminBootstrapCode
} from "@/lib/auth";
import {
  authenticatePlatformUser,
  createPlatformSession,
  createPlatformUser,
  type PlatformUserProfile
} from "@/lib/repositories/platform-users";
import { recordGovernanceEvent } from "@/lib/repositories/governance";

export async function authenticateAdminBootstrapAction(formData: FormData) {
  const codigo = String(formData.get("codigo") ?? "").trim();

  if (!validateAdminBootstrapCode(codigo)) {
    redirect(
      `/admin/acesso?feedback=erro&mensagem=${encodeURIComponent(
        "Código especial do administrador inválido."
      )}`
    );
  }

  await setAdminBootstrapAllowed();

  redirect(
    `/admin/usuarios?feedback=sucesso&mensagem=${encodeURIComponent(
      "Entrada especial do administrador liberada."
    )}`
  );
}

export async function createPlatformUserAction(formData: FormData) {
  await requireAdminBootstrap();

  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "").trim();
  const perfil = String(formData.get("perfil") ?? "operador").trim() as PlatformUserProfile;
  const permissoesRaw = String(formData.get("permissoes") ?? "").trim();

  if (!nome || !email || !senha) {
    redirect(
      `/admin/usuarios?feedback=erro&mensagem=${encodeURIComponent(
        "Preencha nome, e-mail e senha do usuário."
      )}`
    );
  }

  const permissoes = permissoesRaw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [idCandidato, escopo] = line.split(":").map((value) => value.trim());
      const isGestor = escopo === "gestor";
      return {
        idCandidato: idCandidato || null,
        podeVisualizar: true,
        podeImplantar: isGestor || perfil === "administrador",
        podeOperarFunil: true,
        podeOperarEventos: isGestor || perfil === "administrador",
        podeVerKpis: true
      };
    });

  try {
    const userId = await createPlatformUser({
      nome,
      email,
      senha,
      perfil,
      permissoes
    });

    await recordGovernanceEvent({
      idCandidato: null,
      escopo: "admin",
      ator: "administrador",
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
  redirect(
    `/admin/usuarios?feedback=sucesso&mensagem=${encodeURIComponent(
      "Usuário e permissões cadastrados com sucesso."
    )}`
  );
}

export async function authenticatePlatformAreaAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "").trim();
  const contexto = String(formData.get("contexto") ?? "campanha").trim();
  const idCandidato = String(formData.get("idCandidato") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "/").trim();

  const user = await authenticatePlatformUser(email, senha);

  if (!user) {
    redirect(
      `${redirectTo}?feedback=erro&mensagem=${encodeURIComponent(
        "Usuário ou senha inválidos para este acesso."
      )}`
    );
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

  redirect(
    `${redirectTo}?feedback=sucesso&mensagem=${encodeURIComponent(
      "Acesso autenticado com sucesso."
    )}`
  );
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
