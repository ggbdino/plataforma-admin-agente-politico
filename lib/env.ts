export const env = {
  databaseUrl: process.env.DATABASE_URL,
  n8nBaseUrl: process.env.N8N_BASE_URL,
  n8nApiKey: process.env.N8N_API_KEY ?? "",
  evolutionApiBaseUrl: process.env.EVOLUTION_API_BASE_URL ?? "",
  evolutionApiKey: process.env.EVOLUTION_API_KEY ?? "",
  evolutionInstancePrefix: process.env.EVOLUTION_INSTANCE_PREFIX ?? "",
  adminBootstrapCode: process.env.ADMIN_BOOTSTRAP_CODE ?? "",
  n8nWebhookCandidateSync:
    process.env.N8N_WEBHOOK_CANDIDATO_SYNC ??
    "/webhook/bdb5c2b3-7308-4f19-993c-d111023bd41b",
  n8nWebhookGovernancaBrunex:
    process.env.N8N_WEBHOOK_GOVERNANCA_BRUNEX ??
    "/webhook/agente-politico/0001/governanca",
  n8nWebhookQrCodeBrunex:
    process.env.N8N_WEBHOOK_QRCODE_BRUNEX ??
    "/webhook/agente-politico/0001/qrcode/canais",
  n8nWebhookFunilBrunex:
    process.env.N8N_WEBHOOK_FUNIL_BRUNEX ??
    "/webhook/agente-politico/0001/entrada-eleitor",
  n8nWebhookCadenciaBrunex:
    process.env.N8N_WEBHOOK_CADENCIA_BRUNEX ??
    "/webhook/agente-politico/0001/cadencia"
};

export function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Variavel obrigatoria ausente: ${name}`);
  }

  return value;
}
