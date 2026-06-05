"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordGovernanceEvent } from "@/lib/repositories/governance";
import { registerEventConfirmationByPhone } from "@/lib/repositories/event-attendance";

export async function confirmEventAttendanceAction(formData: FormData) {
  const idCandidato = String(formData.get("idCandidato") ?? "").trim();
  const eventoId = String(formData.get("eventoId") ?? "").trim();
  const telefone = String(formData.get("telefone") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();
  const cidade = String(formData.get("cidade") ?? "").trim();
  const observacao = String(formData.get("observacao") ?? "").trim();
  const redirectTo =
    String(formData.get("redirectTo") ?? "").trim() ||
    `/campanhas/${idCandidato}/eventos/${eventoId}/confirmar`;

  try {
    const result = await registerEventConfirmationByPhone({
      idCandidato,
      eventoId,
      telefone,
      nome,
      cidade,
      observacao
    });

    await recordGovernanceEvent({
      idCandidato,
      escopo: "campanha",
      ator: "pagina_confirmacao_evento",
      categoria: "confirmacao_evento",
      acao: "confirmacao_registrada",
      descricao: `Confirmação registrada para o evento ${result.nomeEvento}.`,
      status: "sucesso",
      origem: "pagina-evento",
      detalhes: {
        eventoId,
        telefone: result.telefone,
        createdNewElector: result.createdNewElector
      }
    });

    revalidatePath(`/campanhas/${idCandidato}/eventos/${eventoId}/confirmar`);
    revalidatePath(`/gestor/candidato/${idCandidato}/eventos`);
    revalidatePath(`/campanhas/${idCandidato}`);

    const nextParams = new URLSearchParams({
      feedback: "sucesso",
      mensagem: `Participação confirmada para ${result.nomeEleitor ?? "participante"}.`,
      telefone: result.telefone,
      nome: result.nomeEleitor ?? ""
    });

    redirect(`${redirectTo}?${nextParams.toString()}`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao confirmar participação no evento.";

    await recordGovernanceEvent({
      idCandidato,
      escopo: "campanha",
      ator: "pagina_confirmacao_evento",
      categoria: "confirmacao_evento",
      acao: "confirmacao_com_erro",
      descricao: message,
      status: "erro",
      origem: "pagina-evento"
    });

    revalidatePath(`/campanhas/${idCandidato}/eventos/${eventoId}/confirmar`);

    const nextParams = new URLSearchParams({
      feedback: "erro",
      mensagem: message,
      telefone,
      nome,
      cidade
    });

    redirect(`${redirectTo}?${nextParams.toString()}`);
  }
}
