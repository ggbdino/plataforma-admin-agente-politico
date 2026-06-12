import { env, getRequiredEnv } from "./env";

type TriggerWebhookInput = {
  path: string;
  payload: Record<string, unknown>;
  method?: "GET" | "POST";
};

export async function triggerN8nWebhook({
  path,
  payload,
  method = "POST"
}: TriggerWebhookInput) {
  const webhookBaseUrl = env.n8nWebhookBaseUrl?.trim() || getRequiredEnv("N8N_BASE_URL");
  const url = new URL(path, webhookBaseUrl).toString();
  const headers: HeadersInit = method === "POST" ? { "Content-Type": "application/json" } : {};

  const requestUrl =
    method === "GET"
      ? new URL(
          `${url}${url.includes("?") ? "&" : "?"}${new URLSearchParams(
            Object.entries(payload).reduce<Record<string, string>>((acc, [key, value]) => {
              acc[key] = String(value);
              return acc;
            }, {})
          ).toString()}`
        ).toString()
      : url;

  const response = await fetch(requestUrl, {
    method,
    headers,
    body: method === "POST" ? JSON.stringify(payload) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(45_000)
  });

  const text = await response.text();
  let data: unknown = text;

  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      `Falha ao chamar workflow do n8n (${response.status}): ${typeof data === "string" ? data : JSON.stringify(data)}`
    );
  }

  return data;
}
