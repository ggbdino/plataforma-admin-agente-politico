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
  "evento_todos",
  "evento_confirmados",
  "evento_presentes"
]);

export async function sendCampaignEmailAction(formData: FormData) {
  const idCandidato = String(formData.get("idCandidato") ?? "").trim();
  const publicoRaw = String(formData.get("publico") ?? "todos_com_email").trim() as CampaignEmailAudience;
  const publico = AUDIENCES.has(publicoRaw) ? publicoRaw : "todos_com_email";
  const eventoId = String(formData.get("eventoId") ?? "").trim() || null;
  const emailRemetente = String(formData.get("emailRemetente") ?? "").trim() || null;
  const assunto = String(formData.get("assunto") ?? "").trim();
  const mensagem = String(formData.get("mensagem") ?? "").trim();
  const imagemUrl = String(formData.get("imagemUrl") ?? "").trim() || null;
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

  try {
    const result = await planAndSendCampaignEmail({
      idCandidato,
      atorUsuarioId: session.userId,
      atorEmail: session.email,
      publico,
      eventoId,
      emailRemetente,
      assunto,
      mensagem,
      imagemUrl,
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
    redirect(`${targetUrl}?feedback=sucesso&mensagem=${encodeURIComponent(buildSuccessMessage(result))}`);
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
    redirect(`${targetUrl}?feedback=erro&mensagem=${encodeURIComponent(message)}`);
  }
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
