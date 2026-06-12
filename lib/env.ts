export const env = {
  databaseUrl: process.env.DATABASE_URL,
  n8nBaseUrl: process.env.N8N_BASE_URL,
  n8nWebhookBaseUrl: process.env.N8N_WEBHOOK_BASE_URL ?? process.env.N8N_BASE_URL,
  publicEventsBaseUrl:
    process.env.PUBLIC_EVENTS_BASE_URL ??
    process.env.NEXT_PUBLIC_EVENTS_BASE_URL ??
    "https://gapconsult.com.br",
  n8nApiKey: process.env.N8N_API_KEY ?? "",
  evolutionApiBaseUrl: process.env.EVOLUTION_API_BASE_URL ?? "",
  evolutionApiKey: process.env.EVOLUTION_API_KEY ?? "",
  evolutionInstancePrefix: process.env.EVOLUTION_INSTANCE_PREFIX ?? "",
  metaWhatsAppEnabled: process.env.META_WHATSAPP_ENABLED === "true",
  metaWhatsAppGraphApiVersion: process.env.META_WHATSAPP_GRAPH_API_VERSION ?? "v23.0",
  metaWhatsAppBaseUrl: process.env.META_WHATSAPP_BASE_URL ?? "https://graph.facebook.com",
  metaWhatsAppAccessToken: process.env.META_WHATSAPP_ACCESS_TOKEN ?? "",
  metaWhatsAppAppSecret: process.env.META_WHATSAPP_APP_SECRET ?? "",
  metaWhatsAppVerifyToken: process.env.META_WHATSAPP_VERIFY_TOKEN ?? "",
  metaWhatsAppBusinessAccountId: process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID ?? "",
  metaWhatsAppPhoneNumberId: process.env.META_WHATSAPP_PHONE_NUMBER_ID ?? "",
  adminBootstrapCode: process.env.ADMIN_BOOTSTRAP_CODE ?? "",
  n8nWebhookCandidateSync:
    process.env.N8N_WEBHOOK_CANDIDATO_SYNC ?? "/webhook/candidato-sync",
  n8nWebhookGovernancaBrunex:
    process.env.N8N_WEBHOOK_GOVERNANCA_BRUNEX ??
    "/webhook/agente-politico/governanca/atualizacao",
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
