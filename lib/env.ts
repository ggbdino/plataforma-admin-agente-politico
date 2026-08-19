export const env = {
  databaseUrl: process.env.DATABASE_URL,
  n8nBaseUrl: process.env.N8N_BASE_URL,
  n8nWebhookBaseUrl: process.env.N8N_WEBHOOK_BASE_URL ?? process.env.N8N_BASE_URL,
  appForceHttps: process.env.APP_FORCE_HTTPS === "true",
  appPublicBaseUrl: process.env.APP_PUBLIC_BASE_URL ?? "",
  publicEventsBaseUrl:
    process.env.PUBLIC_EVENTS_BASE_URL ??
    process.env.NEXT_PUBLIC_EVENTS_BASE_URL ??
    process.env.APP_PUBLIC_BASE_URL ??
    "https://n8n-plataforma-admin.kb0fgy.easypanel.host",
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
  whatsAppMaxRecipientsPerDispatch: process.env.WHATSAPP_MAX_RECIPIENTS_PER_DISPATCH ?? "20",
  emailProvider: (process.env.EMAIL_PROVIDER ?? "auto").toLowerCase(),
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: process.env.SMTP_PORT ?? "",
  smtpSecure: process.env.SMTP_SECURE === "true",
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPass: process.env.SMTP_PASS ?? "",
  emailHeloDomain: process.env.EMAIL_HELO_DOMAIN ?? "",
  emailMaxRecipientsPerDispatch: process.env.EMAIL_MAX_RECIPIENTS_PER_DISPATCH ?? "100",
  smsProvider: (process.env.SMS_PROVIDER ?? "webhook").toLowerCase(),
  smsWebhookUrl: process.env.SMS_WEBHOOK_URL ?? "",
  smsApiKey: process.env.SMS_API_KEY ?? "",
  smsSenderId: process.env.SMS_SENDER_ID ?? "",
  smsMaxRecipientsPerDispatch: process.env.SMS_MAX_RECIPIENTS_PER_DISPATCH ?? "20",
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
    throw new Error(`Variável obrigatória ausente: ${name}`);
  }

  return value;
}
