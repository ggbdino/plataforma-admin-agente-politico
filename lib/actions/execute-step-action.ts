"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentPlatformSession } from "@/lib/auth";
import { executeImplantationStep } from "@/lib/services/implantation-service";

export async function executeStepAction(formData: FormData) {
  const idCandidato = String(formData.get("idCandidato") ?? "");
  const codigoEtapa = String(formData.get("codigoEtapa") ?? "");
  const observacao = String(formData.get("observacao") ?? "").trim();
  const nomeCanal = String(formData.get("nome_canal") ?? "").trim();
  const tipoCanal = String(formData.get("tipo_canal") ?? "").trim();
  const identificadorExterno = String(formData.get("identificador_externo") ?? "").trim();
  const urlCanal = String(formData.get("url_canal") ?? "").trim();
  const canaisDivulgacao = String(formData.get("canais_divulgacao") ?? "").trim();
  const telefone = String(formData.get("telefone") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();
  const mensagem = String(formData.get("mensagem") ?? "").trim();
  const temaInteresse = String(formData.get("tema_interesse") ?? "").trim();
  const origemCaptacao = String(formData.get("origem_captacao") ?? "").trim();

  if (!idCandidato || !codigoEtapa) {
    throw new Error("Dados insuficientes para executar a etapa.");
  }

  const session = await getCurrentPlatformSession();

  try {
    await executeImplantationStep({
      idCandidato,
      codigoEtapa,
      executedBy: session?.email ?? "operador@plataforma.local",
      source: "frontend_admin",
      payload: {
        ...(observacao ? { observacao } : {}),
        ...(nomeCanal ? { nome_canal: nomeCanal } : {}),
        ...(tipoCanal ? { tipo_canal: tipoCanal } : {}),
        ...(identificadorExterno ? { identificador_externo: identificadorExterno } : {}),
        ...(urlCanal ? { url_canal: urlCanal } : {}),
        ...(canaisDivulgacao ? { canais_divulgacao: canaisDivulgacao } : {}),
        ...(telefone ? { telefone } : {}),
        ...(nome ? { nome } : {}),
        ...(mensagem ? { mensagem } : {}),
        ...(temaInteresse ? { tema_interesse: temaInteresse } : {}),
        ...(origemCaptacao ? { origem_captacao: origemCaptacao } : {})
      }
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
