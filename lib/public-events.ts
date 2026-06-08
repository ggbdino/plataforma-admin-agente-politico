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
  const cutoff = getPublicEventConfirmationCutoff(eventDate);

  return referenceTime.getTime() < cutoff.getTime();
}

function getPublicEventConfirmationCutoff(eventDate: string) {
  const event = new Date(eventDate);
  const cutoff = new Date(event);

  cutoff.setDate(cutoff.getDate() + 1);
  cutoff.setHours(0, 0, 0, 0);

  return cutoff;
}
