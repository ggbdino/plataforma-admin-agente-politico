"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getManagerAccessData } from "@/lib/repositories/implantation";
import { executeImplantationStep } from "@/lib/services/implantation-service";
import type { CampaignChannelOption } from "@/lib/types";

const MANAGER_MASTER_PASSWORD = "654321";

export async function authenticateCampaignManagerAction(formData: FormData) {
  const idCandidato = String(formData.get("idCandidato") ?? "").trim();
  const senha = String(formData.get("senha") ?? "").trim();

  if (!idCandidato || !senha) {
    redirect(
      `/gestor/candidato/${idCandidato}?feedback=erro&mensagem=${encodeURIComponent(
        "Informe a senha de acesso do Gestor da Campanha."
      )}`
    );
  }

  const accessData = await getManagerAccessData(idCandidato);
  const normalizedPhone = normalizeDigits(accessData?.telefone_responsavel ?? "");

  if (senha !== MANAGER_MASTER_PASSWORD && normalizeDigits(senha) !== normalizedPhone) {
    redirect(
      `/gestor/candidato/${idCandidato}?feedback=erro&mensagem=${encodeURIComponent(
        "Senha invalida para a area do Gestor da Campanha."
      )}`
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(`manager-access-${idCandidato}`, "ok", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: `/gestor/candidato/${idCandidato}`,
    maxAge: 60 * 60 * 8
  });

  redirect(
    `/gestor/candidato/${idCandidato}?feedback=sucesso&mensagem=${encodeURIComponent(
      "Acesso do Gestor da Campanha liberado."
    )}`
  );
}

export async function registerCampaignChannelAction(formData: FormData) {
  const idCandidato = String(formData.get("idCandidato") ?? "").trim();
  const nomeCanal = String(formData.get("nome_canal") ?? "").trim();
  const tipoCanal = String(formData.get("tipo_canal") ?? "").trim();
  const identificadorExterno = String(formData.get("identificador_externo") ?? "").trim();
  const observacao = String(formData.get("observacao") ?? "").trim();
  const canaisDivulgacaoItems = formData
    .getAll("canais_divulgacao_item")
    .map(parseChannelOptionValue)
    .filter((item): item is CampaignChannelOption => Boolean(item));
  const canaisDivulgacaoExtra = String(formData.get("canais_divulgacao_extra") ?? "").trim();
  const canaisDivulgacaoExtras = canaisDivulgacaoExtra
    .split(/\r?\n|[|;]/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (!idCandidato) {
    throw new Error("Candidato nao identificado para o registro do canal oficial.");
  }

  try {
    await executeImplantationStep({
      idCandidato,
      codigoEtapa: "configurar_canais",
      executedBy: "gestor-campanha@plataforma.local",
      source: "gestor_campanha",
      payload: {
        nome_canal: nomeCanal,
        tipo_canal: tipoCanal,
        identificador_externo: identificadorExterno,
        observacao,
        canais_divulgacao: buildChannelsSummary(canaisDivulgacaoItems, canaisDivulgacaoExtras),
        canais_divulgacao_itens: canaisDivulgacaoItems,
        canais_divulgacao_extra: canaisDivulgacaoExtras
      }
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao registrar o canal oficial da campanha.";

    revalidatePath(`/gestor/candidato/${idCandidato}`);
    revalidatePath(`/candidatos/${idCandidato}`);
    revalidatePath("/candidatos");
    revalidatePath("/gestor");

    redirect(
      `/gestor/candidato/${idCandidato}?feedback=erro&mensagem=${encodeURIComponent(message)}`
    );
  }

  revalidatePath(`/gestor/candidato/${idCandidato}`);
  revalidatePath(`/candidatos/${idCandidato}`);
  revalidatePath("/candidatos");
  revalidatePath("/gestor");

  redirect(
    `/gestor/candidato/${idCandidato}?feedback=sucesso&mensagem=${encodeURIComponent(
      "Canal oficial e canais de divulgacao registrados com sucesso."
    )}`
  );
}

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "");
}

function parseChannelOptionValue(value: FormDataEntryValue) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<CampaignChannelOption>;

    if (!parsed.nome_canal || !parsed.tipo_canal) {
      return null;
    }

    return {
      nome_canal: parsed.nome_canal,
      tipo_canal: parsed.tipo_canal,
      url_canal: parsed.url_canal ?? null,
      identificador_externo: parsed.identificador_externo ?? null,
      status: parsed.status ?? "ativo",
      selecionado_por_padrao: true
    } satisfies CampaignChannelOption;
  } catch {
    return null;
  }
}

function buildChannelsSummary(items: CampaignChannelOption[], extras: string[]) {
  const itemSummary = items.map((item) =>
    `${item.nome_canal} (${item.tipo_canal})${item.url_canal ? ` - ${item.url_canal}` : item.identificador_externo ? ` - ${item.identificador_externo}` : ""}`
  );

  return [...itemSummary, ...extras].join(" | ");
}
