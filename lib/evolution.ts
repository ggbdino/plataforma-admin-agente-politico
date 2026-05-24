import { env, getRequiredEnv } from "./env";

type EvolutionRequestOptions = {
  method: "GET" | "POST";
  path: string;
  body?: Record<string, unknown>;
};

type EvolutionConnectResponse = {
  base64?: string | null;
  code?: string | null;
  pairingCode?: string | null;
  count?: number;
};

export async function createOrConnectEvolutionInstance(input: {
  idCandidato: string;
  nomeUrna: string;
  numeroOficial: string;
}) {
  const instanceName = buildEvolutionInstanceName(input.idCandidato, input.nomeUrna);
  const webhookInboundUrl = buildN8nWebhookUrl(
    `/webhook/agente-politico/${input.idCandidato}/entrada-eleitor`
  );
  const webhookOutboundUrl = buildN8nWebhookUrl(
    `/webhook/agente-politico/${input.idCandidato}/cadencia`
  );

  try {
    await requestEvolution({
      method: "POST",
      path: "/instance/create",
      body: {
        instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
        webhook: {
          url: webhookInboundUrl,
          events: ["messages.upsert"]
        }
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (!message.toLowerCase().includes("already in use")) {
      throw error;
    }
  }

  const connectResponse = (await requestEvolution({
    method: "GET",
    path: `/instance/connect/${instanceName}`
  })) as EvolutionConnectResponse;

  return {
    instanceName,
    numeroOficial: input.numeroOficial,
    webhookInboundUrl,
    webhookOutboundUrl,
    qrCodeUrl: connectResponse.base64 ?? null,
    connectionCode: connectResponse.code ?? null,
    pairingCode: connectResponse.pairingCode ?? null,
    count: Number(connectResponse.count ?? 0)
  };
}

function buildEvolutionInstanceName(idCandidato: string, nomeUrna: string) {
  const normalizedName = normalizeForSlug(nomeUrna || "candidato");
  const prefix = normalizeForSlug(env.evolutionInstancePrefix);
  const candidateId = normalizeForSlug(idCandidato);
  const coreName = [prefix, normalizedName, candidateId].filter(Boolean).join("_");

  return coreName.slice(0, 60);
}

function buildN8nWebhookUrl(path: string) {
  const baseUrl = getRequiredEnv("N8N_BASE_URL").replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${baseUrl}${normalizedPath}`;
}

async function requestEvolution({ method, path, body }: EvolutionRequestOptions) {
  const baseUrl = getRequiredEnv("EVOLUTION_API_BASE_URL").replace(/\/+$/, "");
  const apiKey = getRequiredEnv("EVOLUTION_API_KEY");
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  const response = await fetch(url, {
    method,
    headers: {
      apikey: apiKey,
      "Content-Type": "application/json"
    },
    body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
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
      `Falha ao chamar Evolution API (${response.status}): ${
        typeof data === "string" ? data : JSON.stringify(data)
      }`
    );
  }

  return data;
}

function normalizeForSlug(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
