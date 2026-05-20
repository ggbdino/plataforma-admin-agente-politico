"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { importCampaignElectorBase } from "@/lib/repositories/elector-import";
import { recalculateCampaignFunnelCycle } from "@/lib/repositories/funnel-cycle";
import { getManagerAccessData } from "@/lib/repositories/implantation";

const MANAGER_MASTER_PASSWORD = "654321";

export async function authenticateCampaignAnalyticsAction(formData: FormData) {
  const idCandidato = String(formData.get("idCandidato") ?? "").trim();
  const senha = String(formData.get("senha") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "").trim() || `/campanhas/${idCandidato}`;

  if (!idCandidato || !senha) {
    redirect(
      `${redirectTo}?feedback=erro&mensagem=${encodeURIComponent(
        "Informe a senha de acesso da campanha."
      )}`
    );
  }

  const accessData = await getManagerAccessData(idCandidato);
  const normalizedPhone = normalizeDigits(accessData?.telefone_responsavel ?? "");

  if (senha !== MANAGER_MASTER_PASSWORD && normalizeDigits(senha) !== normalizedPhone) {
    redirect(
      `${redirectTo}?feedback=erro&mensagem=${encodeURIComponent(
        "Senha inválida para a área operacional da campanha."
      )}`
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(`campaign-analytics-access-${idCandidato}`, "ok", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 8
  });

  redirect(
    `${redirectTo}?feedback=sucesso&mensagem=${encodeURIComponent(
      "Acesso operacional da campanha liberado."
    )}`
  );
}

export async function importCampaignElectorBaseAction(formData: FormData) {
  const idCandidato = String(formData.get("idCandidato") ?? "").trim();
  const redirectTo =
    String(formData.get("redirectTo") ?? "").trim() || `/campanhas/${idCandidato}`;
  const origemCaptacao = String(formData.get("origemCaptacao") ?? "importacao_admin").trim();
  const fileEntry = formData.get("arquivo");
  const cookieStore = await cookies();
  const hasAccess =
    cookieStore.get(`campaign-analytics-access-${idCandidato}`)?.value === "ok";

  if (!hasAccess) {
    redirect(
      `${redirectTo}?feedback=erro&mensagem=${encodeURIComponent(
        "Acesso operacional não autorizado para importar a base."
      )}`
    );
  }

  if (!(fileEntry instanceof File) || fileEntry.size === 0) {
    redirect(
      `${redirectTo}?feedback=erro&mensagem=${encodeURIComponent(
        "Selecione um arquivo CSV com nome, telefone e email."
      )}`
    );
  }

  try {
    const text = await fileEntry.text();
    const result = await importCampaignElectorBase(idCandidato, text, origemCaptacao);

    redirect(
      `${redirectTo}?feedback=sucesso&mensagem=${encodeURIComponent(
        `Base importada com sucesso. ${result.importados} registro(s) novo(s), ${result.atualizados} atualizado(s) e ${result.ignorados} ignorado(s).`
      )}`
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível processar a planilha da base de eleitores.";

    redirect(
      `${redirectTo}?feedback=erro&mensagem=${encodeURIComponent(message)}`
    );
  }
}

export async function recalculateCampaignFunnelCycleAction(formData: FormData) {
  const idCandidato = String(formData.get("idCandidato") ?? "").trim();
  const redirectTo =
    String(formData.get("redirectTo") ?? "").trim() || `/campanhas/${idCandidato}`;
  const cookieStore = await cookies();
  const hasAccess =
    cookieStore.get(`campaign-analytics-access-${idCandidato}`)?.value === "ok";

  if (!hasAccess) {
    redirect(
      `${redirectTo}?feedback=erro&mensagem=${encodeURIComponent(
        "Acesso operacional não autorizado para recalcular o funil."
      )}`
    );
  }

  try {
    const result = await recalculateCampaignFunnelCycle(idCandidato);

    redirect(
      `${redirectTo}?feedback=sucesso&mensagem=${encodeURIComponent(
        `Ciclo do funil recalculado. ${result.eleitores_atualizados} eleitor(es) atualizado(s), ${result.etapa_recalculada} etapa(s), ${result.intencao_recalculada} intenção(ões) e ${result.score_engajamento_recalculado} score(s) de engajamento revisado(s).`
      )}`
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível recalcular o ciclo do funil da campanha.";

    redirect(`${redirectTo}?feedback=erro&mensagem=${encodeURIComponent(message)}`);
  }
}

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "");
}
