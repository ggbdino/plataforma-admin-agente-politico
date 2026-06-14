"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdminBootstrap } from "@/lib/auth";
import {
  deleteAllCandidatesCascade,
  deleteCandidateCascade
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
      acao: "candidato_excluido_cascata",
      descricao: `Candidato ${idCandidato} removido com todos os dados vinculados.`,
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
  redirectWithSuccess("Candidato e registros vinculados removidos da base com sucesso.");
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
      descricao: "Todos os candidatos e registros vinculados foram removidos da base.",
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
  redirectWithSuccess("Toda a base de candidatos e seus dados relacionados foi removida com sucesso.");
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
