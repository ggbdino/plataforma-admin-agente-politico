"use server";

import { redirect } from "next/navigation";
import { getCurrentPlatformSession, hasCampaignAccess } from "@/lib/auth";
import { importCampaignElectorBase } from "@/lib/repositories/elector-import";
import { recalculateCampaignFunnelCycle } from "@/lib/repositories/funnel-cycle";
import { recordGovernanceEvent } from "@/lib/repositories/governance";

export async function importCampaignElectorBaseAction(formData: FormData) {
  const idCandidato = String(formData.get("idCandidato") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "").trim() || `/campanhas/${idCandidato}`;
  const origemCaptacao = String(formData.get("origemCaptacao") ?? "saneamento_importacao").trim();
  const fileEntry = formData.get("arquivo");
  const session = await getCurrentPlatformSession();
  const hasAccess = await hasCampaignAccess(session, idCandidato, "pode_operar_funil");

  if (!hasAccess) {
    await recordGovernanceEvent({
      idCandidato,
      escopo: "campanha",
      ator: session?.email ?? "operacao_campanha",
      categoria: "importacao_base",
      acao: "importacao_negada",
      descricao: "Tentativa de importação bloqueada por acesso operacional ausente.",
      status: "erro",
      origem: "campaign-import"
    });

    redirect(
      `${redirectTo}?operacao=importacao&feedback=erro&mensagem=${encodeURIComponent(
        "Acesso operacional não autorizado para importar a base."
      )}`
    );
  }

  if (!(fileEntry instanceof File) || fileEntry.size === 0) {
    redirect(
      `${redirectTo}?operacao=importacao&feedback=erro&mensagem=${encodeURIComponent(
        "Selecione um arquivo CSV válido com colunas nome, telefone e email."
      )}`
    );
  }

  let successMessage = "";

  try {
    const text = decodeUploadedSpreadsheetText(await fileEntry.arrayBuffer());
    const result = await importCampaignElectorBase(idCandidato, text, origemCaptacao);

    await recordGovernanceEvent({
      idCandidato,
      escopo: "campanha",
      ator: session?.email ?? "administrador",
      categoria: "importacao_base",
      acao: "importacao_concluida",
      descricao: `Importação da base concluída com ${result.importados} novo(s), ${result.atualizados} atualizado(s) e ${result.ignorados} ignorado(s).`,
      status: "sucesso",
      origem: "campaign-import",
      detalhes: result as unknown as Record<string, unknown>
    });

    successMessage = `Base importada com sucesso. ${
      result.importados + result.atualizados + result.ignorados
    } registro(s) processado(s): ${result.importados} novo(s), ${result.atualizados} atualizado(s) e ${result.ignorados} ignorado(s)${formatIgnoredReasons(result.ignorados_por_motivo)}.`;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Não foi possível processar a planilha da base de eleitores.";

    await recordGovernanceEvent({
      idCandidato,
      escopo: "campanha",
      ator: session?.email ?? "administrador",
      categoria: "importacao_base",
      acao: "importacao_com_erro",
      descricao: message,
      status: "erro",
      origem: "campaign-import"
    });

    redirect(`${redirectTo}?operacao=importacao&feedback=erro&mensagem=${encodeURIComponent(message)}`);
  }

  redirect(
    `${redirectTo}?operacao=importacao&feedback=sucesso&mensagem=${encodeURIComponent(successMessage)}`
  );
}

function formatIgnoredReasons(reasons: Record<string, number> | undefined) {
  const entries = Object.entries(reasons ?? {}).filter(([, total]) => total > 0);

  if (!entries.length) {
    return "";
  }

  const labels: Record<string, string> = {
    sem_telefone_e_email: "sem telefone/e-mail",
    duplicado_no_arquivo: "duplicado no arquivo",
    sem_alteracao_na_base: "sem alteracao cadastral"
  };

  return `, motivos: ${entries.map(([reason, total]) => `${total} ${labels[reason] ?? reason}`).join(", ")}`;
}
function decodeUploadedSpreadsheetText(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const utf8Text = decodeText(bytes, "utf-8");

  if (!hasEncodingDamage(utf8Text)) {
    return utf8Text;
  }

  const windowsText = decodeText(bytes, "windows-1252");
  return scoreEncodingDamage(windowsText) < scoreEncodingDamage(utf8Text) ? windowsText : utf8Text;
}

function decodeText(bytes: Uint8Array, encoding: string) {
  return new TextDecoder(encoding).decode(bytes);
}

function hasEncodingDamage(value: string) {
  return scoreEncodingDamage(value) > 0;
}

function scoreEncodingDamage(value: string) {
  const replacementChars = (value.match(/\uFFFD/g) ?? []).length;
  const mojibakeMarkers = (value.match(/\u00C3.|\u00C2.|\u00E2\u20AC|\u00E2\u20AC\u0153|\u00E2\u20AC\u009D|\u00E2\u20AC\u2122|\u00E2\u20AC\u201C|\u00E2\u20AC\u00A2/g) ?? []).length;
  return replacementChars * 3 + mojibakeMarkers;
}

export async function recalculateCampaignFunnelCycleAction(formData: FormData) {
  const idCandidato = String(formData.get("idCandidato") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "").trim() || `/campanhas/${idCandidato}`;
  const session = await getCurrentPlatformSession();
  const hasAccess = await hasCampaignAccess(session, idCandidato, "pode_operar_funil");

  if (!hasAccess) {
    await recordGovernanceEvent({
      idCandidato,
      escopo: "campanha",
      ator: session?.email ?? "operacao_campanha",
      categoria: "recalculo_funil",
      acao: "recalculo_negado",
      descricao: "Tentativa de recalcular o funil sem acesso operacional válido.",
      status: "erro",
      origem: "campaign-funnel"
    });

    redirect(
      `${redirectTo}?operacao=recalculo&feedback=erro&mensagem=${encodeURIComponent(
        "Acesso operacional não autorizado para recalcular o funil."
      )}`
    );
  }

  let successMessage = "";

  try {
    const result = await recalculateCampaignFunnelCycle(idCandidato);

    await recordGovernanceEvent({
      idCandidato,
      escopo: "campanha",
      ator: session?.email ?? "administrador",
      categoria: "recalculo_funil",
      acao: "recalculo_concluido",
      descricao: `Ciclo do funil recalculado para ${result.eleitores_atualizados} eleitor(es).`,
      status: "sucesso",
      origem: "campaign-funnel",
      detalhes: result as unknown as Record<string, unknown>
    });

    successMessage = `Ciclo do funil recalculado com sucesso. ${result.eleitores_processados} eleitor(es) processado(s), ${result.eleitores_atualizados} atualizado(s), ${result.etapa_recalculada} etapa(s), ${result.intencao_recalculada} intenção(ões) e ${result.score_engajamento_recalculado} score(s) de engajamento revisado(s).`;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Não foi possível recalcular o ciclo do funil da campanha.";

    await recordGovernanceEvent({
      idCandidato,
      escopo: "campanha",
      ator: session?.email ?? "administrador",
      categoria: "recalculo_funil",
      acao: "recalculo_com_erro",
      descricao: message,
      status: "erro",
      origem: "campaign-funnel"
    });

    redirect(`${redirectTo}?operacao=recalculo&feedback=erro&mensagem=${encodeURIComponent(message)}`);
  }

  redirect(
    `${redirectTo}?operacao=recalculo&feedback=sucesso&mensagem=${encodeURIComponent(successMessage)}`
  );
}
