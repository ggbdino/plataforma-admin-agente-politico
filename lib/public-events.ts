import { env } from "@/lib/env";

export function buildPublicEventUrl(path: string) {
  const baseUrl = normalizeBaseUrl(env.publicEventsBaseUrl);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${baseUrl}${normalizedPath}`;
}

function normalizeBaseUrl(value: string) {
  return String(value || "https://gapconsult.com.br").replace(/\/+$/, "");
}

export function isPublicEventConfirmationWindowOpen(
  eventDate: string,
  referenceTime = new Date()
) {
  const eventStart = new Date(eventDate).getTime();
  const now = referenceTime.getTime();
  const fifteenDaysInMs = 15 * 24 * 60 * 60 * 1000;

  return now >= eventStart - fifteenDaysInMs && now < eventStart;
}
