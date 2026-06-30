"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentPlatformSession, hasCampaignAccess } from "@/lib/auth";
import {
  planAndSendCampaignEmail,
  type CampaignEmailAudience
} from "@/lib/repositories/campaign-email";
import { recordGovernanceEvent } from "@/lib/repositories/governance";

const AUDIENCES = new Set<CampaignEmailAudience>([
  "todos_com_email",
  "eleitor_individual",
  "evento_todos",
  "evento_confirmados",
  "evento_presentes"
]);

export async function sendCampaignEmailAction(formData: FormData) {
  const idCandidato = String(formData.get("idCandidato") ?? "").trim();
  const publicoRaw = String(formData.get("publico") ?? "todos_com_email").trim() as CampaignEmailAudience;
  const publico = AUDIENCES.has(publicoRaw) ? publicoRaw : "todos_com_email";
  const eventoId = String(formData.get("eventoId") ?? "").trim() || null;
  const eleitorUid = String(formData.get("eleitorUid") ?? "").trim() || null;
  const emailRemetente = String(formData.get("emailRemetente") ?? "").trim() || null;
  const assunto = String(formData.get("assunto") ?? "").trim();
  const mensagem = String(formData.get("mensagem") ?? "").trim();
  const imagemUrl = String(formData.get("imagemUrl") ?? "").trim() || null;
  const imagemArquivo = await readImageAttachment(formData.get("imagemArquivo"));
  const incluirQrCode = formData.get("incluirQrCode") === "on";
  const session = await getCurrentPlatformSession();
  const hasAccess = await hasCampaignAccess(session, idCandidato, "pode_implantar");
  const targetUrl = `/gestor/candidato/${idCandidato}/comunicacao/email`;

  if (!session || !hasAccess || session.perfil !== "gestor_campanha") {
    redirect(
      `${targetUrl}?feedback=erro&mensagem=${encodeURIComponent(
        "A remessa de e-mail é exclusiva do gestor da campanha."
      )}`
    );
  }

  let nextUrl = targetUrl;

  try {
    const result = await planAndSendCampaignEmail({
      idCandidato,
      atorUsuarioId: session.userId,
      atorEmail: session.email,
      publico,
      eventoId,
      eleitorUid,
      emailRemetente,
      assunto,
      mensagem,
      imagemUrl,
      imagemArquivo,
      incluirQrCode
    });

    await recordGovernanceEvent({
      idCandidato,
      escopo: "campanha",
      ator: session.email,
      categoria: "email_campanha",
      acao: "remessa_email_registrada",
      descricao: `Remessa de e-mail ${result.status}: ${result.totalEnviados}/${result.totalDestinatarios} enviados.`,
      status: result.totalFalhas > 0 ? "aviso" : "sucesso",
      origem: "gestor-campanha"
    });

    revalidatePath(targetUrl);
    nextUrl = `${targetUrl}?feedback=sucesso&mensagem=${encodeURIComponent(buildSuccessMessage(result))}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao preparar a remessa de e-mail.";

    await recordGovernanceEvent({
      idCandidato,
      escopo: "campanha",
      ator: session.email,
      categoria: "email_campanha",
      acao: "remessa_email_com_erro",
      descricao: message,
      status: "erro",
      origem: "gestor-campanha"
    });

    revalidatePath(targetUrl);
    nextUrl = `${targetUrl}?feedback=erro&mensagem=${encodeURIComponent(message)}`;
  }

  redirect(nextUrl);
}

function buildSuccessMessage(result: {
  status: string;
  totalDestinatarios: number;
  totalEnviados: number;
  totalFalhas: number;
  provider: string;
}) {
  if (result.status === "planejada_sem_provedor") {
    return `Remessa planejada para ${result.totalDestinatarios} destinatário(s). Configure RESEND_API_KEY para habilitar o envio real.`;
  }

  return `Remessa processada pelo provedor ${result.provider}. ${result.totalEnviados} enviada(s), ${result.totalFalhas} com falha.`;
}

async function readImageAttachment(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || value.size === 0) {
    return null;
  }

  const maxBytes = 2 * 1024 * 1024;
  if (value.size > maxBytes) {
    throw new Error("A imagem anexada deve ter no máximo 2 MB.");
  }

  if (!value.type.startsWith("image/")) {
    throw new Error("O arquivo anexado deve ser uma imagem.");
  }

  const buffer = Buffer.from(await value.arrayBuffer());
  return {
    filename: value.name || "imagem-campanha",
    content: buffer.toString("base64"),
    contentType: value.type
  };
}
