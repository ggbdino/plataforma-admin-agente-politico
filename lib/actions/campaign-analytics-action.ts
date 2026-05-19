"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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
        "Senha invalida para a area operacional da campanha."
      )}`
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(`campaign-analytics-access-${idCandidato}`, "ok", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: `/campanhas/${idCandidato}`,
    maxAge: 60 * 60 * 8
  });

  redirect(
    `${redirectTo}?feedback=sucesso&mensagem=${encodeURIComponent(
      "Acesso operacional da campanha liberado."
    )}`
  );
}

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "");
}
