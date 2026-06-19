import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import {
  clearPlatformSession,
  getPlatformSessionByToken,
  getPermittedCandidateIdsForUser,
  getPlatformUserPermissions,
  hasAnyPlatformUser,
  type PlatformUserSession,
  userHasCampaignPermission
} from "@/lib/repositories/platform-users";

const PLATFORM_SESSION_COOKIE = "platform-admin-session";
const ADMIN_BOOTSTRAP_COOKIE = "platform-admin-bootstrap";

export async function getCurrentPlatformSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(PLATFORM_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const session = await getPlatformSessionByToken(token);

  if (!session) {
    cookieStore.delete(PLATFORM_SESSION_COOKIE);
    return null;
  }

  return session;
}

export async function logoutCurrentPlatformSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(PLATFORM_SESSION_COOKIE)?.value;

  if (token) {
    await clearPlatformSession(token);
  }

  cookieStore.delete(PLATFORM_SESSION_COOKIE);
}

export async function setCurrentPlatformSession(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(PLATFORM_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 8
  });
}

export async function hasCampaignAccess(
  session: PlatformUserSession | null,
  idCandidato: string,
  capability:
    | "pode_visualizar"
    | "pode_implantar"
    | "pode_operar_funil"
    | "pode_operar_eventos"
    | "pode_ver_kpis"
) {
  if (!session) {
    return false;
  }

  return userHasCampaignPermission(session.userId, session.perfil, idCandidato, capability);
}

export async function requireAdminBootstrap() {
  const cookieStore = await cookies();
  const hasUsers = await hasAnyPlatformUser();

  if (!hasUsers) {
    const bootstrap = cookieStore.get(ADMIN_BOOTSTRAP_COOKIE)?.value;
    if (bootstrap === "ok") {
      return { mode: "bootstrap" as const };
    }
  }

  const session = await getCurrentPlatformSession();

  if (!session || session.perfil !== "administrador") {
    redirect("/admin/acesso");
  }

  return { mode: "session" as const, session };
}

export async function requireAuthenticatedPlatformSession() {
  const session = await getCurrentPlatformSession();

  if (!session) {
    redirect("/");
  }

  return session;
}

export async function getDefaultPlatformRoute(session: {
  userId: string;
  perfil: PlatformUserSession["perfil"];
}) {
  if (session.perfil === "administrador") {
    return "/estatisticas";
  }

  const candidateIds = await getPermittedCandidateIdsForUser(session.userId);
  const firstCandidateId = candidateIds[0];

  if (!firstCandidateId) {
    return "/sem-acesso";
  }

  if (session.perfil === "gestor_campanha") {
    return `/gestor/candidato/${firstCandidateId}`;
  }

  if (session.perfil === "operador") {
    return `/campanhas/${firstCandidateId}/conversas`;
  }

  return `/campanhas/${firstCandidateId}/inteligencia`;
}

export async function getVisibleCandidateIdsForSession(session: PlatformUserSession | null) {
  if (!session) {
    return [];
  }

  if (session.perfil === "administrador") {
    return null;
  }

  return getPermittedCandidateIdsForUser(session.userId);
}

export async function canManagePlatformUsers(session: PlatformUserSession | null) {
  return session?.perfil === "administrador" || session?.perfil === "gestor_campanha";
}

export async function getManageableProfilesForSession(session: PlatformUserSession | null) {
  if (!session) {
    return [];
  }

  if (session.perfil === "administrador") {
    return ["administrador", "gestor_campanha", "operador", "analista"] as const;
  }

  if (session.perfil === "gestor_campanha") {
    return ["operador", "analista"] as const;
  }

  return [] as const;
}

export async function getPrimaryCandidateIdForSession(session: PlatformUserSession | null) {
  if (!session || session.perfil === "administrador") {
    return null;
  }

  const permissions = await getPlatformUserPermissions(session.userId);
  return permissions.find((permission) => permission.id_candidato)?.id_candidato ?? null;
}

export async function setAdminBootstrapAllowed() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_BOOTSTRAP_COOKIE, "ok", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/admin",
    maxAge: 60 * 30
  });
}

export function validateAdminBootstrapCode(code: string) {
  const expected = env.adminBootstrapCode || "GAPCONSULT2026";
  return code.trim() === expected;
}
