"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentPlatformSession, hasCampaignAccess } from "@/lib/auth";
import {
  planAndSendCampaignSms,
  type CampaignSmsAudience
} from "@/lib/repositories/campaign-sms";
import { recordGovernanceEvent } from "@/lib/repositories/governance";

const AUDIENCES = new Set<CampaignSmsAudience>([
  "todos_com_telefone",
  "eleitor_individual",
  "evento_todos",
  "evento_confirmados",
  "evento_presentes"
]);

export async function sendCampaignSmsAction(formData: FormData) {
  const idCandidato = String(formData.get("idCandidato") ?? "").trim();
  const publicoRaw = String(formData.get("publico") ?? "todos_com_telefone").trim() as CampaignSmsAudience;
  const publico = AUDIENCES.has(publicoRaw) ? publicoRaw : "todos_com_telefone";
  const eventoId = String(formData.get("eventoId") ?? "").trim() || null;
  const eleitorUid = String(formData.get("eleitorUid") ?? "").trim() || null;
  const provider = String(formData.get("provider") ?? "webhook").trim() || "webhook";
  const gatewayUrl = String(formData.get("gatewayUrl") ?? "").trim() || null;
  const gatewayApiKey = String(formData.get("gatewayApiKey") ?? "").trim() || null;
  const senderId = String(formData.get("senderId") ?? "").trim() || null;
  const maxRecipientsPerDispatch = String(formData.get("maxRecipientsPerDispatch") ?? "").trim() || null;
  const mensagem = String(formData.get("mensagem") ?? "").trim();
  const session = await getCurrentPlatformSession();
  const hasAccess = await hasCampaignAccess(session, idCandidato, "pode_implantar");
  const targetUrl = `/gestor/candidato/${idCandidato}/comunicacao/sms`;

  if (!session || !hasAccess || session.perfil !== "gestor_campanha") {
    redirect(`${targetUrl}?feedback=erro&mensagem=${encodeURIComponent("A remessa SMS é exclusiva do gestor da campanha.")}`);
  }

  let nextUrl = targetUrl;

  try {
    const result = await planAndSendCampaignSms({
      idCandidato,
      atorUsuarioId: session.userId,
      atorEmail: session.email,
      publico,
      eventoId,
      eleitorUid,
      provider,
      gatewayUrl,
      gatewayApiKey,
      senderId,
      maxRecipientsPerDispatch,
      mensagem
    });

    await recordGovernanceEvent({
      idCandidato,
      escopo: "campanha",
      ator: session.email,
      categoria: "sms_campanha",
      acao: "remessa_sms_registrada",
      descricao: `Remessa SMS ${result.status}: ${result.totalEnviados}/${result.totalDestinatarios} enviada(s).`,
      status: result.totalFalhas > 0 ? "aviso" : "sucesso",
      origem: "gestor-campanha"
    });

    revalidatePath(targetUrl);
    nextUrl = `${targetUrl}?feedback=sucesso&mensagem=${encodeURIComponent(buildSuccessMessage(result))}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao preparar a remessa SMS.";

    await recordGovernanceEvent({
      idCandidato,
      escopo: "campanha",
      ator: session.email,
      categoria: "sms_campanha",
      acao: "remessa_sms_com_erro",
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
    return `Remessa SMS planejada para ${result.totalDestinatarios} destinatário(s). Configure o gateway SMS do candidato para habilitar envio real.`;
  }

  if (result.totalFalhas > 0) {
    const motivo = result.firstFailureMessage ? ` Motivo: ${result.firstFailureMessage}` : "";
    return `Remessa processada pelo provedor ${result.provider}. ${result.totalEnviados} enviada(s), ${result.totalFalhas} com falha.${motivo}`;
  }

  return `Remessa processada pelo provedor ${result.provider}. ${result.totalEnviados} enviada(s), ${result.totalFalhas} com falha.`;
}