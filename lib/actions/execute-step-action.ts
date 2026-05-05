"use server";

import { revalidatePath } from "next/cache";
import { executeImplantationStep } from "@/lib/services/implantation-service";

export async function executeStepAction(formData: FormData) {
  const idCandidato = String(formData.get("idCandidato") ?? "");
  const codigoEtapa = String(formData.get("codigoEtapa") ?? "");

  if (!idCandidato || !codigoEtapa) {
    throw new Error("Dados insuficientes para executar a etapa.");
  }

  await executeImplantationStep({
    idCandidato,
    codigoEtapa,
    executedBy: "operador@plataforma.local",
    source: "frontend_admin",
    payload: {}
  });

  revalidatePath("/candidatos");
  revalidatePath(`/candidatos/${idCandidato}`);
}
