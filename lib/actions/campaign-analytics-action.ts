"use server";

import { redirect } from "next/navigation";
import { getCurrentPlatformSession, hasCampaignAccess } from "@/lib/auth";
import { importCampaignElectorBase } from "@/lib/repositories/elector-import";
import { recalculateCampaignFunnelCycle } from "@/lib/repositories/funnel-cycle";
import { recordGovernanceEvent } from "@/lib/repositories/governance";

export async function importCampaignElectorBaseAction(formData: FormData) {
  const idCandidato = String(formData.get("idCandidato") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "").trim() || `/campanhas/${idCandidato}`;
  const origemCaptacao = String(formData.get("origemCaptacao") ?? "importacao_admin").trim();
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
    const text = await fileEntry.text();
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
    } registro(s) processado(s): ${result.importados} novo(s), ${result.atualizados} atualizado(s) e ${result.ignorados} ignorado(s).`;
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
