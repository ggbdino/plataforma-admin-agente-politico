"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { getCurrentPlatformSession, hasCampaignAccess } from "@/lib/auth";
import {
  createOutreachTask,
  importOutreachTeamMembers,
  recordOutreachEvidence
} from "@/lib/repositories/campaign-outreach-team";
import { recordGovernanceEvent } from "@/lib/repositories/governance";

export async function importOutreachTeamMembersAction(formData: FormData) {
  const idCandidato = String(formData.get("idCandidato") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? `/gestor/candidato/${idCandidato}/divulgacao`).trim();
  const origemImportacao = String(formData.get("origemImportacao") ?? "importacao_gestor").trim();
  const file = formData.get("arquivoEquipe");
  const session = await getCurrentPlatformSession();
  const hasAccess = await hasCampaignAccess(session, idCandidato, "pode_implantar");

  if (!session || !["gestor_campanha", "administrador"].includes(session.perfil) || !hasAccess) {
    redirect(withFeedback(redirectTo, "erro", "A importação da Equipe de Divulgação é restrita ao gestor da campanha e ao administrador."));
  }

  if (!(file instanceof File) || file.size === 0) {
    redirect(withFeedback(redirectTo, "erro", "Selecione uma planilha CSV com os membros da Equipe de Divulgação."));
  }

  try {
    const text = await file.text();
    const result = await importOutreachTeamMembers({ idCandidato, csvText: text, origemImportacao });
    await recordGovernanceEvent({
      idCandidato,
      escopo: "campanha",
      ator: session.email,
      categoria: "equipe_divulgacao",
      acao: "importar_equipe_divulgacao",
      descricao: `Equipe de Divulgação importada: ${result.importados} novo(s), ${result.atualizados} atualizado(s), ${result.ignorados} ignorado(s).`,
      status: result.ignorados > 0 ? "aviso" : "sucesso",
      origem: "gestor-divulgacao",
      detalhes: result
    });
    revalidateOutreach(idCandidato);
    redirect(withFeedback(redirectTo, "sucesso", `Equipe importada. ${result.importados} novo(s), ${result.atualizados} atualizado(s), ${result.ignorados} ignorado(s).`));
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const message = error instanceof Error ? error.message : "Falha ao importar a Equipe de Divulgação.";
    redirect(withFeedback(redirectTo, "erro", message));
  }
}

export async function createOutreachTaskAction(formData: FormData) {
  const idCandidato = String(formData.get("idCandidato") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? `/gestor/candidato/${idCandidato}/divulgacao`).trim();
  const session = await getCurrentPlatformSession();
  const hasAccess = await hasCampaignAccess(session, idCandidato, "pode_implantar");

  if (!session || !["gestor_campanha", "administrador"].includes(session.perfil) || !hasAccess) {
    redirect(withFeedback(redirectTo, "erro", "A criação de tarefas da Equipe de Divulgação é restrita ao gestor da campanha e ao administrador."));
  }

  try {
    const result = await createOutreachTask({
      idCandidato,
      titulo: String(formData.get("titulo") ?? ""),
      tipoTarefa: String(formData.get("tipoTarefa") ?? "outros"),
      descricao: String(formData.get("descricao") ?? ""),
      localidade: String(formData.get("localidade") ?? ""),
      cidade: String(formData.get("cidade") ?? ""),
      uf: String(formData.get("uf") ?? ""),
      metaQuantidade: String(formData.get("metaQuantidade") ?? "0"),
      dataInicio: String(formData.get("dataInicio") ?? ""),
      dataLimite: String(formData.get("dataLimite") ?? ""),
      memberIds: formData.getAll("membroId").map((value) => String(value)),
      createdByEmail: session.email
    });

    await recordGovernanceEvent({
      idCandidato,
      escopo: "campanha",
      ator: session.email,
      categoria: "equipe_divulgacao",
      acao: "criar_tarefa_divulgacao",
      descricao: `Tarefa de divulgação criada para ${result.totalMembros} membro(s).`,
      status: "sucesso",
      origem: "gestor-divulgacao",
      detalhes: result
    });
    revalidateOutreach(idCandidato);
    redirect(withFeedback(redirectTo, "sucesso", `Tarefa criada para ${result.totalMembros} membro(s) da Equipe de Divulgação.`));
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const message = error instanceof Error ? error.message : "Falha ao criar tarefa de divulgação.";
    redirect(withFeedback(redirectTo, "erro", message));
  }
}

export async function recordOutreachEvidenceAction(formData: FormData) {
  const idCandidato = String(formData.get("idCandidato") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? `/gestor/candidato/${idCandidato}/divulgacao`).trim();
  const session = await getCurrentPlatformSession();
  const hasAccess = await hasCampaignAccess(session, idCandidato, "pode_implantar");

  if (!session || !["gestor_campanha", "administrador"].includes(session.perfil) || !hasAccess) {
    redirect(withFeedback(redirectTo, "erro", "A validação de tarefas é restrita ao gestor da campanha e ao administrador."));
  }

  try {
    await recordOutreachEvidence({
      idCandidato,
      taskId: String(formData.get("taskId") ?? ""),
      memberId: String(formData.get("memberId") ?? "") || null,
      mensagem: String(formData.get("mensagem") ?? ""),
      quantidadeValidada: String(formData.get("quantidadeValidada") ?? "1"),
      canal: "validacao_gestor",
      origem: session.email
    });
    revalidateOutreach(idCandidato);
    redirect(withFeedback(redirectTo, "sucesso", "Evidência registrada e tarefa atualizada."));
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const message = error instanceof Error ? error.message : "Falha ao registrar evidência da tarefa.";
    redirect(withFeedback(redirectTo, "erro", message));
  }
}

function revalidateOutreach(idCandidato: string) {
  revalidatePath(`/gestor/candidato/${idCandidato}`);
  revalidatePath(`/gestor/candidato/${idCandidato}/divulgacao`);
  revalidatePath(`/campanhas/${idCandidato}/inteligencia`);
}

function withFeedback(targetUrl: string, feedback: "sucesso" | "erro", mensagem: string) {
  const separator = targetUrl.includes("?") ? "&" : "?";
  return `${targetUrl}${separator}feedback=${feedback}&mensagem=${encodeURIComponent(mensagem)}`;
}
