"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentPlatformSession, hasCampaignAccess } from "@/lib/auth";
import {
  planAndSendCampaignWhatsApp,
  type CampaignWhatsAppAudience
} from "@/lib/repositories/campaign-whatsapp";
import { recordGovernanceEvent } from "@/lib/repositories/governance";

const AUDIENCES = new Set<CampaignWhatsAppAudience>([
  "todos_com_telefone",
  "eleitor_individual",
  "evento_todos",
  "evento_confirmados",
  "evento_presentes"
]);

export async function sendCampaignWhatsAppAction(formData: FormData) {
  const idCandidato = String(formData.get("idCandidato") ?? "").trim();
  const publicoRaw = String(formData.get("publico") ?? "todos_com_telefone").trim() as CampaignWhatsAppAudience;
  const publico = AUDIENCES.has(publicoRaw) ? publicoRaw : "todos_com_telefone";
  const eventoId = String(formData.get("eventoId") ?? "").trim() || null;
  const eleitorUid = String(formData.get("eleitorUid") ?? "").trim() || null;
  const phoneNumberId = String(formData.get("phoneNumberId") ?? "").trim() || null;
  const businessAccountId = String(formData.get("businessAccountId") ?? "").trim() || null;
  const accessToken = String(formData.get("accessToken") ?? "").trim() || null;
  const numeroCampanha = String(formData.get("numeroCampanha") ?? "").trim() || null;
  const padraoMensagem = String(formData.get("padraoMensagem") ?? "").trim() || null;
  const templateName = String(formData.get("templateName") ?? "").trim();
  const languageCode = String(formData.get("languageCode") ?? "pt_BR").trim() || "pt_BR";
  const variaveis = [1, 2, 3, 4, 5]
    .map((index) => String(formData.get(`variavel${index}`) ?? "").trim())
    .filter(Boolean);

  const session = await getCurrentPlatformSession();
  const hasAccess = await hasCampaignAccess(session, idCandidato, "pode_implantar");
  const targetUrl = `/gestor/candidato/${idCandidato}/comunicacao/whatsapp`;

  if (!session || !hasAccess || session.perfil !== "gestor_campanha") {
    redirect(`${targetUrl}?feedback=erro&mensagem=${encodeURIComponent("A remessa de WhatsApp é exclusiva do gestor da campanha.")}`);
  }

  let nextUrl = targetUrl;

  try {
    const result = await planAndSendCampaignWhatsApp({
      idCandidato,
      atorUsuarioId: session.userId,
      atorEmail: session.email,
      publico,
      eventoId,
      eleitorUid,
      phoneNumberId,
      businessAccountId,
      accessToken,
      numeroCampanha,
      padraoMensagem,
      templateName,
      languageCode,
      variaveis
    });

    await recordGovernanceEvent({
      idCandidato,
      escopo: "campanha",
      ator: session.email,
      categoria: "whatsapp_campanha",
      acao: "remessa_whatsapp_registrada",
      descricao: `Remessa WhatsApp ${result.status}: ${result.totalEnviados}/${result.totalDestinatarios} enviada(s).`,
      status: result.totalFalhas > 0 ? "aviso" : "sucesso",
      origem: "gestor-campanha"
    });

    revalidatePath(targetUrl);
    nextUrl = `${targetUrl}?feedback=sucesso&mensagem=${encodeURIComponent(buildSuccessMessage(result))}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao preparar a remessa de WhatsApp.";

    await recordGovernanceEvent({
      idCandidato,
      escopo: "campanha",
      ator: session.email,
      categoria: "whatsapp_campanha",
      acao: "remessa_whatsapp_com_erro",
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
  firstFailureMessage?: string | null;
}) {
  if (result.status === "planejada_sem_provedor") {
    return `Remessa planejada para ${result.totalDestinatarios} destinatário(s). Configure o phone_number_id, token da Meta e template aprovado para habilitar o envio real.`;
  }

  if (result.totalFalhas > 0) {
    const motivo = result.firstFailureMessage ? ` Motivo: ${result.firstFailureMessage}` : "";
    return `Remessa processada pela ${result.provider}. ${result.totalEnviados} enviada(s), ${result.totalFalhas} com falha.${motivo}`;
  }

  return `Remessa processada pela ${result.provider}. ${result.totalEnviados} enviada(s), ${result.totalFalhas} com falha.`;
}


