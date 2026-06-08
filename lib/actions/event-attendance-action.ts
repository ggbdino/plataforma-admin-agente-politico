"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { getCurrentPlatformSession, hasCampaignAccess } from "@/lib/auth";
import { recordGovernanceEvent } from "@/lib/repositories/governance";
import {
  findCampaignElectorByPhone,
  registerEventAttendanceByPhone
} from "@/lib/repositories/event-attendance";

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
      mensagem: "Seu usuário não possui permissão para controlar a presença de eventos desta campanha."
    });
  }

  if (!eventoId) {
    redirectToEventScreen(redirectTo, {
      feedback: "erro",
      mensagem: "Selecione um evento antes de registrar a presença."
    });
  }

  const electorLookup = await findCampaignElectorByPhone(idCandidato, telefone);
  const normalizedLookupName = normalizeText(electorLookup?.nome);
  const normalizedLookupCity = normalizeText(electorLookup?.cidade);
  const normalizedName = normalizeText(nome);
  const normalizedCity = normalizeText(cidade);

  if (!electorLookup && (!normalizedName || !normalizedCity)) {
    redirectToEventScreen(redirectTo, {
      feedback: "erro",
      mensagem: "Telefone não encontrado na base. Informe nome e cidade para concluir o novo cadastro.",
      telefone
    });
  }

  if (
    electorLookup &&
    (!normalizedLookupName || !normalizedLookupCity) &&
    (!normalizedName || !normalizedCity)
  ) {
    redirectToEventScreen(redirectTo, {
      feedback: "erro",
      mensagem:
        "Telefone localizado na base, mas o cadastro está incompleto. Informe nome e cidade para registrar a presença.",
      telefone,
      nome: normalizedLookupName ?? ""
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
        ? `Presença registrada por telefone no evento ${result.nomeEvento}.`
        : `Cadastro processado fora da janela operacional do evento ${result.nomeEvento}.`,
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
        ? `Presença registrada com sucesso para ${result.nomeEleitor ?? "participante"}.`
        : result.createdNewElector
          ? `Cadastro realizado para ${result.nomeEleitor ?? "novo participante"}, mas fora da janela do evento.`
          : `Telefone localizado na base para ${result.nomeEleitor ?? "participante"}, mas fora da janela do evento. Nenhuma presença foi computada.`,
      telefone: result.telefone,
      nome: result.nomeEleitor ?? ""
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

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
    redirectToEventScreen(redirectTo, {
      feedback: "erro",
      mensagem: message,
      telefone
    });
  }
}

function normalizeText(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
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
