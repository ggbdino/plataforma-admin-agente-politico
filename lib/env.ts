function required(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Variavel obrigatoria ausente: ${name}`);
  }

  return value;
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  n8nBaseUrl: required("N8N_BASE_URL"),
  n8nApiKey: process.env.N8N_API_KEY ?? "",
  n8nWebhookCandidateSync: process.env.N8N_WEBHOOK_CANDIDATO_SYNC ?? "/webhook/candidato-sync",
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
