import crypto from "node:crypto";
import { env } from "./env";

export type MetaWhatsAppConfig = {
  enabled: boolean;
  graphApiVersion: string;
  baseUrl: string;
  accessToken: string;
  appSecret: string;
  verifyToken: string;
  businessAccountId: string;
  phoneNumberId: string;
};

export type MetaWhatsAppMessageInput = {
  to: string;
  type?: "text";
  text: {
    body: string;
    preview_url?: boolean;
  };
};

export function getMetaWhatsAppConfig(): MetaWhatsAppConfig {
  return {
    enabled: env.metaWhatsAppEnabled,
    graphApiVersion: env.metaWhatsAppGraphApiVersion,
    baseUrl: env.metaWhatsAppBaseUrl,
    accessToken: env.metaWhatsAppAccessToken,
    appSecret: env.metaWhatsAppAppSecret,
    verifyToken: env.metaWhatsAppVerifyToken,
    businessAccountId: env.metaWhatsAppBusinessAccountId,
    phoneNumberId: env.metaWhatsAppPhoneNumberId
  };
}

export function isMetaWhatsAppConfigured() {
  const config = getMetaWhatsAppConfig();

  return Boolean(
    config.enabled &&
      config.baseUrl &&
      config.graphApiVersion &&
      config.accessToken &&
      config.phoneNumberId &&
      config.verifyToken
  );
}

export function getMetaWhatsAppMessagesUrl(phoneNumberId = env.metaWhatsAppPhoneNumberId) {
  if (!phoneNumberId) {
    throw new Error("META_WHATSAPP_PHONE_NUMBER_ID ainda não configurado.");
  }

  const normalizedBaseUrl = env.metaWhatsAppBaseUrl.replace(/\/$/, "");
  return `${normalizedBaseUrl}/${env.metaWhatsAppGraphApiVersion}/${phoneNumberId}/messages`;
}

export async function sendMetaWhatsAppTextMessage(input: MetaWhatsAppMessageInput) {
  if (!isMetaWhatsAppConfigured()) {
    throw new Error("Meta Cloud API ainda não configurada no ambiente da plataforma.");
  }

  const response = await fetch(getMetaWhatsAppMessagesUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.metaWhatsAppAccessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.to,
      type: input.type ?? "text",
      text: input.text
    }),
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
      `Falha ao enviar mensagem pela Meta Cloud API (${response.status}): ${typeof data === "string" ? data : JSON.stringify(data)}`
    );
  }

  return data;
}

export function validateMetaWebhookSignature(rawBody: string, signatureHeader: string | null) {
  if (!env.metaWhatsAppAppSecret || !signatureHeader) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", env.metaWhatsAppAppSecret)
    .update(rawBody)
    .digest("hex");

  const receivedSignature = signatureHeader.replace("sha256=", "");

  return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(receivedSignature));
}
