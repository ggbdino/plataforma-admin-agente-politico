"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  canManagePlatformUsers,
  getDefaultPlatformRoute,
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
  getPermittedCandidateIdsForUser,
  hasAnyPlatformUser,
  type PlatformUserPermissionInput,
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
  const hasUsers = await hasAnyPlatformUser();
  let actingSession = await getCurrentPlatformSession();

  if (!hasUsers) {
    const access = await requireAdminBootstrap();
    actingSession = access.mode === "session" ? access.session : null;
  } else if (!(await canManagePlatformUsers(actingSession))) {
    redirect(
      `/admin/usuarios?feedback=erro&mensagem=${encodeURIComponent(
        "Seu perfil não possui permissão para cadastrar usuários."
      )}`
    );
  }

  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "").trim();
  const perfil = String(formData.get("perfil") ?? "operador").trim() as PlatformUserProfile;
  const idCandidato = String(formData.get("idCandidato") ?? "").trim();

  if (!nome || !email || !senha) {
    redirect(
      `/admin/usuarios?feedback=erro&mensagem=${encodeURIComponent(
        "Preencha nome, e-mail e senha do usuário."
      )}`
    );
  }

  if (!hasUsers && perfil !== "administrador") {
    redirect(
      `/admin/usuarios?feedback=erro&mensagem=${encodeURIComponent(
        "No primeiro cadastro da plataforma, crie inicialmente um usuário administrador."
      )}`
    );
  }

  if (actingSession?.perfil === "gestor_campanha" && !["operador", "analista"].includes(perfil)) {
    redirect(
      `/admin/usuarios?feedback=erro&mensagem=${encodeURIComponent(
        "O gestor da campanha só pode cadastrar operador ou analista."
      )}`
    );
  }

  if (perfil !== "administrador" && !idCandidato) {
    redirect(
      `/admin/usuarios?feedback=erro&mensagem=${encodeURIComponent(
        "Selecione o candidato vinculado para esse perfil."
      )}`
    );
  }

  if (actingSession?.perfil === "gestor_campanha") {
    const candidateIds = await getPermittedCandidateIdsForUser(actingSession.userId);
    if (!candidateIds.includes(idCandidato)) {
      redirect(
        `/admin/usuarios?feedback=erro&mensagem=${encodeURIComponent(
          "O gestor só pode cadastrar usuários vinculados ao próprio candidato."
        )}`
      );
    }
  }

  const permissoes = buildPermissionsForProfile(perfil, idCandidato || null);

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

function buildPermissionsForProfile(
  perfil: PlatformUserProfile,
  idCandidato: string | null
): PlatformUserPermissionInput[] {
  if (perfil === "administrador") {
    return [];
  }

  if (!idCandidato) {
    return [];
  }

  if (perfil === "gestor_campanha") {
    return [
      {
        idCandidato,
        podeVisualizar: true,
        podeImplantar: true,
        podeOperarFunil: true,
        podeOperarEventos: true,
        podeVerKpis: true
      }
    ];
  }

  if (perfil === "operador") {
    return [
      {
        idCandidato,
        podeVisualizar: true,
        podeImplantar: false,
        podeOperarFunil: true,
        podeOperarEventos: true,
        podeVerKpis: true
      }
    ];
  }

  return [
    {
      idCandidato,
      podeVisualizar: true,
      podeImplantar: false,
      podeOperarFunil: false,
      podeOperarEventos: false,
      podeVerKpis: true
    }
  ];
}
