"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentPlatformSession, hasCampaignAccess } from "@/lib/auth";
import {
  planAndSendCampaignSms,
  saveCampaignSmsConfig,
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

export async function saveCampaignSmsConfigAction(formData: FormData) {
  const idCandidato = String(formData.get("idCandidato") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? `/gestor/candidato/${idCandidato}`).trim();
  const provider = String(formData.get("provider") ?? "webhook").trim() || "webhook";
  const gatewayUrl = String(formData.get("gatewayUrl") ?? "").trim() || null;
  const gatewayApiKey = String(formData.get("gatewayApiKey") ?? "").trim() || null;
  const senderId = String(formData.get("senderId") ?? "").trim() || null;
  const maxRecipientsPerDispatch = String(formData.get("maxRecipientsPerDispatch") ?? "").trim() || null;
  const session = await getCurrentPlatformSession();
  const hasAccess = await hasCampaignAccess(session, idCandidato, "pode_implantar");
  const targetUrl = buildRedirectUrl(redirectTo, idCandidato);

  if (!session || !hasAccess || !["gestor_campanha", "administrador"].includes(session.perfil)) {
    redirect(withFeedback(targetUrl, "erro", "A configuração SMS é restrita ao gestor da campanha e ao administrador."));
  }

  if (!idCandidato) {
    redirect(withFeedback(targetUrl, "erro", "Selecione um candidato antes de configurar o gateway SMS."));
  }

  try {
    await saveCampaignSmsConfig({
      idCandidato,
      provider,
      gatewayUrl,
      gatewayApiKey,
      senderId,
      maxRecipientsPerDispatch
    });

    await recordGovernanceEvent({
      idCandidato,
      escopo: session.perfil === "administrador" ? "admin" : "campanha",
      ator: session.email,
      categoria: "sms_campanha",
      acao: "configurar_gateway_sms",
      descricao: "Configuração do gateway SMS do candidato atualizada.",
      status: "sucesso",
      origem: session.perfil === "administrador" ? "workflow-center" : "gestor-campanha"
    });

    revalidatePath(`/gestor/candidato/${idCandidato}`);
    revalidatePath(`/gestor/candidato/${idCandidato}/comunicacao/sms`);
    revalidatePath("/estatisticas/governanca/workflows");
    redirect(withFeedback(targetUrl, "sucesso", "Gateway SMS do candidato configurado com sucesso."));
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Falha ao configurar o gateway SMS.";

    await recordGovernanceEvent({
      idCandidato,
      escopo: session.perfil === "administrador" ? "admin" : "campanha",
      ator: session.email,
      categoria: "sms_campanha",
      acao: "configurar_gateway_sms_erro",
      descricao: message,
      status: "erro",
      origem: session.perfil === "administrador" ? "workflow-center" : "gestor-campanha"
    });

    revalidatePath(targetUrl);
    redirect(withFeedback(targetUrl, "erro", message));
  }
}

function withFeedback(targetUrl: string, feedback: "sucesso" | "erro", mensagem: string) {
  const separator = targetUrl.includes("?") ? "&" : "?";
  return `${targetUrl}${separator}feedback=${feedback}&mensagem=${encodeURIComponent(mensagem)}`;
}
function buildRedirectUrl(redirectTo: string, idCandidato: string) {
  if (!idCandidato || redirectTo.includes("?")) return redirectTo;
  if (redirectTo === "/estatisticas/governanca/workflows") {
    return `${redirectTo}?candidato=${encodeURIComponent(idCandidato)}`;
  }
  return redirectTo;
}
function isNextRedirectError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const possibleRedirect = error as { digest?: unknown; message?: unknown };
  return (
    (typeof possibleRedirect.digest === "string" && possibleRedirect.digest.startsWith("NEXT_REDIRECT")) ||
    possibleRedirect.message === "NEXT_REDIRECT"
  );
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
    return `Remessa SMS planejada para ${result.totalDestinatarios} destinatário(s). Confirme com o administrador se o workflow SMS do candidato foi importado e ativado no n8n.`;
  }

  if (result.totalFalhas > 0) {
    const motivo = result.firstFailureMessage ? ` Motivo: ${result.firstFailureMessage}` : "";
    return `Remessa processada pelo provedor ${result.provider}. ${result.totalEnviados} enviada(s), ${result.totalFalhas} com falha.${motivo}`;
  }

  return `Remessa processada pelo provedor ${result.provider}. ${result.totalEnviados} enviada(s), ${result.totalFalhas} com falha.`;
}