"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdminBootstrap } from "@/lib/auth";
import {
  deleteAllCandidatesCascade,
  deleteCandidateCascade,
  deleteCandidateElectorsCascade,
  logicallyDeleteCandidate,
  restoreLogicallyDeletedCandidate
} from "@/lib/repositories/admin-candidate-maintenance";
import { recordGovernanceEvent } from "@/lib/repositories/governance";

export async function deleteCandidateAction(formData: FormData) {
  await requireAdminBootstrap();

  const idCandidato = String(formData.get("idCandidato") ?? "").trim();
  const confirmacao = String(formData.get("confirmacao") ?? "").trim();
  const esperado = `EXCLUIR ${idCandidato}`;

  if (!idCandidato) {
    redirectWithError("Selecione um candidato para exclusao administrativa.");
  }

  if (confirmacao !== esperado) {
    redirectWithError(`Confirme a operacao digitando exatamente: ${esperado}`);
  }

  try {
    const result = await deleteCandidateCascade(idCandidato);

    await recordGovernanceEvent({
      idCandidato,
      escopo: "admin",
      ator: "administrador",
      categoria: "saneamento_base",
      acao: "candidato_excluido_definitivo",
      descricao: `Candidato ${idCandidato} removido definitivamente com arquivo de recuperacao ${result.archiveFileName}.`,
      status: "sucesso",
      origem: "platform-admin",
      detalhes: result as Record<string, unknown>
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nao foi possivel excluir o candidato selecionado.";
    redirectWithError(message);
  }

  revalidateAdminPaths();
  redirectWithSuccess(`Candidato removido definitivamente. Arquivo de recuperacao: ${resultMessageArchive(idCandidato)}.`);
}

export async function logicallyDeleteCandidateAction(formData: FormData) {
  await requireAdminBootstrap();

  const idCandidato = String(formData.get("idCandidatoLogico") ?? "").trim();
  const confirmacao = String(formData.get("confirmacaoLogica") ?? "").trim();
  const motivo = String(formData.get("motivoLogico") ?? "").trim();
  const esperado = `ARQUIVAR ${idCandidato}`;

  if (!idCandidato) {
    redirectWithError("Selecione um candidato para exclusao logica.");
  }

  if (confirmacao !== esperado) {
    redirectWithError(`Confirme a operacao digitando exatamente: ${esperado}`);
  }

  try {
    const result = await logicallyDeleteCandidate({ idCandidato, motivo });

    await recordGovernanceEvent({
      idCandidato,
      escopo: "admin",
      ator: "administrador",
      categoria: "saneamento_base",
      acao: "candidato_excluido_logicamente",
      descricao: `Candidato ${idCandidato} arquivado logicamente e removido da operacao regular.`,
      status: "sucesso",
      origem: "platform-admin",
      detalhes: result as Record<string, unknown>
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nao foi possivel arquivar o candidato selecionado.";
    redirectWithError(message);
  }

  revalidateAdminPaths();
  redirectWithSuccess("Candidato arquivado logicamente. A operacao pode ser revertida pelo administrador.");
}

export async function restoreCandidateAction(formData: FormData) {
  await requireAdminBootstrap();

  const idCandidato = String(formData.get("idCandidatoRestaurar") ?? "").trim();
  const confirmacao = String(formData.get("confirmacaoRestaurar") ?? "").trim();
  const esperado = `RESTAURAR ${idCandidato}`;

  if (!idCandidato) {
    redirectWithError("Selecione um candidato arquivado para restaurar.");
  }

  if (confirmacao !== esperado) {
    redirectWithError(`Confirme a operacao digitando exatamente: ${esperado}`);
  }

  try {
    const result = await restoreLogicallyDeletedCandidate(idCandidato);

    await recordGovernanceEvent({
      idCandidato,
      escopo: "admin",
      ator: "administrador",
      categoria: "saneamento_base",
      acao: "candidato_restaurado_exclusao_logica",
      descricao: `Candidato ${idCandidato} restaurado da exclusao logica.`,
      status: "sucesso",
      origem: "platform-admin",
      detalhes: result as Record<string, unknown>
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nao foi possivel restaurar o candidato selecionado.";
    redirectWithError(message);
  }

  revalidateAdminPaths();
  redirectWithSuccess("Candidato restaurado e liberado novamente para operacao.");
}


export async function deleteCandidateElectorsAction(formData: FormData) {
  await requireAdminBootstrap();

  const idCandidato = String(formData.get("idCandidato") ?? "").trim();
  const confirmacao = String(formData.get("confirmacaoEleitores") ?? "").trim();
  const esperado = `EXCLUIR ELEITORES ${idCandidato}`;
  let successMessage = "Eleitores, interacoes e participacoes removidos com arquivo de recuperacao registrado.";

  if (!idCandidato) {
    redirectWithError("Selecione um candidato para excluir os eleitores.");
  }

  if (confirmacao !== esperado) {
    redirectWithError(`Confirme a operacao digitando exatamente: ${esperado}`);
  }

  try {
    const result = await deleteCandidateElectorsCascade(idCandidato);
    successMessage = `Eleitores, interacoes e participacoes removidos com arquivo de recuperacao ${result.archiveFileName}.`;

    await recordGovernanceEvent({
      idCandidato,
      escopo: "admin",
      ator: "administrador",
      categoria: "saneamento_base",
      acao: "eleitores_candidato_excluidos",
      descricao: `Eleitores do candidato ${idCandidato} removidos com arquivo de recuperacao ${result.archiveFileName}.`,
      status: "sucesso",
      origem: "platform-admin",
      detalhes: result as Record<string, unknown>
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nao foi possivel excluir os eleitores do candidato.";
    redirectWithError(message);
  }

  revalidateAdminPaths();
  redirectWithSuccess(successMessage);
}
export async function deleteAllCandidatesAction(formData: FormData) {
  await requireAdminBootstrap();

  const confirmacao = String(formData.get("confirmacaoGlobal") ?? "").trim();

  if (confirmacao !== "EXCLUIR TODOS") {
    redirectWithError("Confirme a operacao global digitando exatamente: EXCLUIR TODOS");
  }

  try {
    const result = await deleteAllCandidatesCascade();

    await recordGovernanceEvent({
      idCandidato: null,
      escopo: "admin",
      ator: "administrador",
      categoria: "saneamento_base",
      acao: "todos_candidatos_excluidos_cascata",
      descricao: `Todos os candidatos e registros vinculados foram removidos com arquivo de recuperacao ${result.archiveFileName}.`,
      status: "sucesso",
      origem: "platform-admin",
      detalhes: result as Record<string, unknown>
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nao foi possivel excluir todos os candidatos.";
    redirectWithError(message);
  }

  revalidateAdminPaths();
  redirectWithSuccess("Toda a base de candidatos foi removida definitivamente com arquivo de recuperacao registrado.");
}

function revalidateAdminPaths() {
  revalidatePath("/");
  revalidatePath("/candidatos");
  revalidatePath("/gestor");
  revalidatePath("/gestora");
  revalidatePath("/estatisticas");
  revalidatePath("/estatisticas/governanca");
  revalidatePath("/estatisticas/governanca/workflows");
  revalidatePath("/admin/candidatos");
  revalidatePath("/admin/usuarios");
}

function redirectWithError(message: string): never {
  redirect(`/admin/candidatos?feedback=erro&mensagem=${encodeURIComponent(message)}`);
}

function redirectWithSuccess(message: string): never {
  redirect(`/admin/candidatos?feedback=sucesso&mensagem=${encodeURIComponent(message)}`);
}

function resultMessageArchive(idCandidato: string) {
  return `consulte a lista de arquivos de recuperacao na pagina de saneamento para ${idCandidato}`;
}
