"use server";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { getCurrentPlatformSession, hasCampaignAccess } from "@/lib/auth";
import { createCampaignEvent } from "@/lib/repositories/event-attendance";
import { recordGovernanceEvent } from "@/lib/repositories/governance";

export async function createCampaignEventAction(formData: FormData) {
  const idCandidato = String(formData.get("idCandidato") ?? "").trim();
  const redirectTo = String(
    formData.get("redirectTo") ?? `/gestor/candidato/${idCandidato}/eventos/gestao`
  ).trim();
  const nomeEvento = String(formData.get("nomeEvento") ?? "").trim();
  const dataEvento = String(formData.get("dataEvento") ?? "").trim();
  const tipoEvento = String(formData.get("tipoEvento") ?? "").trim();
  const localNome = String(formData.get("localNome") ?? "").trim();
  const endereco = String(formData.get("endereco") ?? "").trim();
  const cidade = String(formData.get("cidade") ?? "").trim();
  const uf = String(formData.get("uf") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  const capacidadeEstimadaRaw = String(formData.get("capacidadeEstimada") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  const session = await getCurrentPlatformSession();
  const canOperateEvents = await hasCampaignAccess(session, idCandidato, "pode_operar_eventos");
  const canImplant = await hasCampaignAccess(session, idCandidato, "pode_implantar");

  if (!session || (!canOperateEvents && !canImplant)) {
    redirect(
      `${redirectTo}?feedback=erro&mensagem=${encodeURIComponent(
        "Você não possui permissão para cadastrar eventos desta campanha."
      )}`
    );
  }

  try {
    const created = await createCampaignEvent({
      idCandidato,
      nomeEvento,
      dataEvento,
      tipoEvento,
      localNome,
      endereco,
      cidade,
      uf,
      descricao,
      capacidadeEstimada: capacidadeEstimadaRaw ? Number(capacidadeEstimadaRaw) : null,
      status
    });

    await recordGovernanceEvent({
      idCandidato,
      escopo: "campanha",
      ator: session.email,
      categoria: "evento",
      acao: "cadastro_evento",
      descricao: `Evento "${nomeEvento}" cadastrado pela área da gestora.`,
      status: "sucesso",
      origem: "event-management",
      detalhes: {
        evento_id: created.id,
        data_evento: dataEvento,
        cidade,
        uf
      }
    });

    redirect(
      `${redirectTo}?feedback=sucesso&mensagem=${encodeURIComponent(
        `Evento "${nomeEvento}" cadastrado com sucesso.`
      )}${created.id ? `&evento=${encodeURIComponent(created.id)}` : ""}`
    );
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    const message =
      error instanceof Error ? error.message : "Não foi possível cadastrar o evento da campanha.";

    await recordGovernanceEvent({
      idCandidato,
      escopo: "campanha",
      ator: session.email,
      categoria: "evento",
      acao: "cadastro_evento_erro",
      descricao: message,
      status: "erro",
      origem: "event-management"
    });

    redirect(`${redirectTo}?feedback=erro&mensagem=${encodeURIComponent(message)}`);
  }
}
