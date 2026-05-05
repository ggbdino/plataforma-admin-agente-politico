import { env } from "./env";

export async function triggerN8nWebhook(path: string, payload: Record<string, unknown>) {
  const url = new URL(path, env.n8nBaseUrl).toString();
  const headers: HeadersInit = {
    "Content-Type": "application/json"
  };

  if (env.n8nApiKey) {
    headers["X-N8N-API-KEY"] = env.n8nApiKey;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    cache: "no-store"
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
