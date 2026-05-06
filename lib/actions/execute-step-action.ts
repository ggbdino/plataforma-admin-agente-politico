"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { executeImplantationStep } from "@/lib/services/implantation-service";

export async function executeStepAction(formData: FormData) {
  const idCandidato = String(formData.get("idCandidato") ?? "");
  const codigoEtapa = String(formData.get("codigoEtapa") ?? "");
  const observacao = String(formData.get("observacao") ?? "").trim();

  if (!idCandidato || !codigoEtapa) {
    throw new Error("Dados insuficientes para executar a etapa.");
  }

  try {
    await executeImplantationStep({
      idCandidato,
      codigoEtapa,
      executedBy: "operador@plataforma.local",
      source: "frontend_admin",
      payload: observacao ? { observacao } : {}
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha inesperada ao executar a etapa.";

    revalidatePath("/candidatos");
    revalidatePath(`/candidatos/${idCandidato}`);

    redirect(
      `/candidatos/${idCandidato}?feedback=erro&mensagem=${encodeURIComponent(message)}`
    );
  }

  revalidatePath("/candidatos");
  revalidatePath(`/candidatos/${idCandidato}`);

  redirect(
    `/candidatos/${idCandidato}?feedback=sucesso&mensagem=${encodeURIComponent(
      "Etapa executada com sucesso."
    )}`
  );
}
