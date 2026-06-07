import { env } from "@/lib/env";

export function buildPublicEventUrl(path: string) {
  const baseUrl = normalizeBaseUrl(env.publicEventsBaseUrl);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${baseUrl}${normalizedPath}`;
}

function normalizeBaseUrl(value: string) {
  return String(value || "https://n8n-plataforma-admin.kb0fgy.easypanel.host").replace(/\/+$/, "");
}
