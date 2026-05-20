"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentPlatformSession, hasCampaignAccess } from "@/lib/auth";
import { executeImplantationStep } from "@/lib/services/implantation-service";
import { recordGovernanceEvent } from "@/lib/repositories/governance";
import type { CampaignChannelOption } from "@/lib/types";

export async function registerCampaignChannelAction(formData: FormData) {
  const idCandidato = String(formData.get("idCandidato") ?? "").trim();
  const nomeCanal = String(formData.get("nome_canal") ?? "").trim();
  const tipoCanal = String(formData.get("tipo_canal") ?? "").trim();
  const identificadorExterno = String(formData.get("identificador_externo") ?? "").trim();
  const observacao = String(formData.get("observacao") ?? "").trim();
  const canaisDivulgacaoItems = formData
    .getAll("canais_divulgacao_item")
    .map(parseChannelOptionValue)
    .filter(Boolean) as CampaignChannelOption[];
  const canaisDivulgacaoExtra = String(formData.get("canais_divulgacao_extra") ?? "").trim();
  const canaisDivulgacaoExtras = canaisDivulgacaoExtra
    .split(/\r?\n|[|;]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const session = await getCurrentPlatformSession();
  const hasAccess = await hasCampaignAccess(session, idCandidato, "pode_implantar");

  if (!hasAccess) {
    redirect(
      `/gestor/candidato/${idCandidato}?feedback=erro&mensagem=${encodeURIComponent(
        "Seu usuário não possui permissão para alterar o canal oficial desta campanha."
      )}`
    );
  }

  if (!idCandidato) {
    throw new Error("Candidato não identificado para o registro do canal oficial.");
  }

  try {
    await executeImplantationStep({
      idCandidato,
      codigoEtapa: "configurar_canais",
      executedBy: session?.email ?? "gestor-campanha@plataforma.local",
      source: "gestor_campanha",
      payload: {
        nome_canal: nomeCanal,
        tipo_canal: tipoCanal,
        identificador_externo: identificadorExterno,
        origem_execucao: "gestor_campanha",
        observacao,
        canais_divulgacao: buildChannelsSummary(canaisDivulgacaoItems, canaisDivulgacaoExtras),
        canais_divulgacao_itens: canaisDivulgacaoItems,
        canais_divulgacao_extra: canaisDivulgacaoExtras
      }
    });

    await recordGovernanceEvent({
      idCandidato,
      escopo: "campanha",
      ator: session?.email ?? "gestor_campanha",
      categoria: "canal_oficial",
      acao: "canal_oficial_atualizado",
      descricao: "Canal oficial e canais de divulgação registrados a partir da área da gestora.",
      status: "sucesso",
      origem: "gestora-campanha"
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao registrar o canal oficial da campanha.";

    await recordGovernanceEvent({
      idCandidato,
      escopo: "campanha",
      ator: session?.email ?? "gestor_campanha",
      categoria: "canal_oficial",
      acao: "canal_oficial_com_erro",
      descricao: message,
      status: "erro",
      origem: "gestora-campanha"
    });

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
      "Canal oficial e canais de divulgação registrados com sucesso."
    )}`
  );
}

function parseChannelOptionValue(value: FormDataEntryValue): CampaignChannelOption | null {
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
    };
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
