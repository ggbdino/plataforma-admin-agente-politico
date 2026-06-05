"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentPlatformSession, hasCampaignAccess } from "@/lib/auth";
import { recordGovernanceEvent } from "@/lib/repositories/governance";
import { registerEventAttendanceByPhone } from "@/lib/repositories/event-attendance";

export async function registerEventAttendanceByPhoneAction(formData: FormData) {
  const idCandidato = String(formData.get("idCandidato") ?? "").trim();
  const redirectTo =
    String(formData.get("redirectTo") ?? "").trim() || `/gestor/candidato/${idCandidato}/eventos`;
  const eventoId = String(formData.get("eventoId") ?? "").trim();
  const telefone = String(formData.get("telefone") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();
  const cidade = String(formData.get("cidade") ?? "").trim();
  const observacao = String(formData.get("observacao") ?? "").trim();
  const session = await getCurrentPlatformSession();
  const canOperateEvents = await hasCampaignAccess(session, idCandidato, "pode_operar_eventos");
  const canImplant = await hasCampaignAccess(session, idCandidato, "pode_implantar");

  if (!canOperateEvents && !canImplant) {
    redirect(
      `${redirectTo}?feedback=erro&mensagem=${encodeURIComponent(
        "Seu usuário não possui permissão para controlar presença de eventos desta campanha."
      )}`
    );
  }

  if (!eventoId) {
    redirect(
      `${redirectTo}?feedback=erro&mensagem=${encodeURIComponent(
        "Selecione um evento antes de registrar a presença."
      )}`
    );
  }

  try {
    const result = await registerEventAttendanceByPhone({
      idCandidato,
      eventoId,
      telefone,
      nome,
      cidade,
      observacao
    });

    await recordGovernanceEvent({
      idCandidato,
      escopo: "campanha",
      ator: session?.email ?? "controle_evento",
      categoria: "presenca_evento",
      acao: result.linkedToEvent ? "presenca_registrada" : "cadastro_evento_fora_janela",
      descricao: result.linkedToEvent
        ? `Presença registrada por telefone no evento ${result.nomeEvento}.`
        : `Cadastro realizado fora da janela operacional do evento ${result.nomeEvento}.`,
      status: "sucesso",
      origem: "gestora-eventos",
      detalhes: {
        eventoId,
        telefone: result.telefone,
        createdNewElector: result.createdNewElector,
        linkedToEvent: result.linkedToEvent
      }
    });

    revalidatePath(`/gestor/candidato/${idCandidato}/eventos`);
    revalidatePath(`/campanhas/${idCandidato}`);

    redirect(
      `${redirectTo}?feedback=sucesso&mensagem=${encodeURIComponent(
        result.linkedToEvent
          ? "Presença registrada com sucesso para este evento."
          : "Contato cadastrado, mas fora da janela do evento. A presença não foi computada."
      )}`
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao registrar a presença no evento.";

    await recordGovernanceEvent({
      idCandidato,
      escopo: "campanha",
      ator: session?.email ?? "controle_evento",
      categoria: "presenca_evento",
      acao: "presenca_com_erro",
      descricao: message,
      status: "erro",
      origem: "gestora-eventos"
    });

    revalidatePath(`/gestor/candidato/${idCandidato}/eventos`);
    redirect(`${redirectTo}?feedback=erro&mensagem=${encodeURIComponent(message)}`);
  }
}
