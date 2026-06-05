"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
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
    redirectToEventScreen(redirectTo, {
      feedback: "erro",
      mensagem: "Seu usuario nao possui permissao para controlar presenca de eventos desta campanha."
    });
  }

  if (!eventoId) {
    redirectToEventScreen(redirectTo, {
      feedback: "erro",
      mensagem: "Selecione um evento antes de registrar a presenca."
    });
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
        ? `Presenca registrada por telefone no evento ${result.nomeEvento}.`
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

    redirectToEventScreen(redirectTo, {
      feedback: "sucesso",
      mensagem: result.linkedToEvent
        ? `Presenca registrada para ${result.nomeEleitor ?? "participante"}.`
        : `Cadastro realizado para ${result.nomeEleitor ?? "novo participante"}, mas fora da janela do evento.`,
      telefone: result.telefone,
      nome: result.nomeEleitor ?? ""
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    const message =
      error instanceof Error ? error.message : "Falha ao registrar a presenca no evento.";

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
    redirectToEventScreen(redirectTo, {
      feedback: "erro",
      mensagem: message,
      telefone
    });
  }
}

function redirectToEventScreen(
  target: string,
  params: {
    feedback: string;
    mensagem: string;
    telefone?: string;
    nome?: string;
  }
): never {
  const [pathAndQuery, hashFragment] = target.split("#");
  const [pathname, search = ""] = pathAndQuery.split("?");
  const nextParams = new URLSearchParams(search);

  nextParams.set("feedback", params.feedback);
  nextParams.set("mensagem", params.mensagem);

  if (params.telefone) {
    nextParams.set("telefone", params.telefone);
  }

  if (params.nome) {
    nextParams.set("nome", params.nome);
  }

  const nextUrl = `${pathname}?${nextParams.toString()}${hashFragment ? `#${hashFragment}` : ""}`;
  redirect(nextUrl);
}
