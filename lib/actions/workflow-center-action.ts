"use server";

import { redirect } from "next/navigation";
import { getCurrentPlatformSession } from "@/lib/auth";
import { triggerN8nWebhook } from "@/lib/n8n";
import { recordGovernanceEvent } from "@/lib/repositories/governance";

const WORKFLOW_MAP = {
  candidato_sync: {
    path: "/webhook/candidato-sync",
    method: "POST" as const,
    descricao: "Sincronização do cadastro-base do candidato."
  },
  qrcode_canais: {
    path: "/webhook/agente-politico/0001/qrcode/canais",
    method: "GET" as const,
    descricao: "Geração ou atualização do QR Code e dos canais do agente."
  },
  governanca: {
    path: "/webhook/agente-politico/0001/governanca",
    method: "POST" as const,
    descricao: "Workflow de governança operacional do candidato."
  },
  entrada_eleitor: {
    path: "/webhook/agente-politico/0001/entrada-eleitor",
    method: "POST" as const,
    descricao: "Entrada de eleitor no funil conversacional."
  },
  cadencia: {
    path: "/webhook/agente-politico/0001/cadencia",
    method: "POST" as const,
    descricao: "Workflow de cadência e reativação."
  }
};

export async function triggerGovernanceWorkflowAction(formData: FormData) {
  const workflow = String(formData.get("workflow") ?? "").trim() as keyof typeof WORKFLOW_MAP;
  const idCandidato = String(formData.get("idCandidato") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "/estatisticas/governanca/workflows").trim();
  const telefone = String(formData.get("telefone") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();
  const mensagem = String(formData.get("mensagem") ?? "").trim();
  const session = await getCurrentPlatformSession();

  if (!session || session.perfil !== "administrador") {
    redirect(
      `${redirectTo}?feedback=erro&mensagem=${encodeURIComponent(
        "Apenas administradores podem iniciar workflows pela governança."
      )}`
    );
  }

  const config = WORKFLOW_MAP[workflow];

  if (!config) {
    redirect(
      `${redirectTo}?feedback=erro&mensagem=${encodeURIComponent(
        "Workflow não identificado para execução."
      )}`
    );
  }

  const payload: Record<string, unknown> = {
    id_candidato: idCandidato || "0001"
  };

  if (telefone) payload.telefone = telefone;
  if (nome) payload.nome = nome;
  if (mensagem) payload.mensagem = mensagem;

  try {
    const response = await triggerN8nWebhook({
      path: config.path,
      method: config.method,
      payload
    });

    await recordGovernanceEvent({
      idCandidato: idCandidato || null,
      escopo: "admin",
      ator: session.email,
      categoria: "workflow_n8n",
      acao: workflow,
      descricao: `${config.descricao} iniciada pela plataforma.`,
      status: "sucesso",
      origem: "workflow-center",
      detalhes: response as Record<string, unknown>
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao iniciar o workflow do n8n.";

    await recordGovernanceEvent({
      idCandidato: idCandidato || null,
      escopo: "admin",
      ator: session.email,
      categoria: "workflow_n8n",
      acao: `${workflow}_erro`,
      descricao: message,
      status: "erro",
      origem: "workflow-center"
    });

    redirect(`${redirectTo}?feedback=erro&mensagem=${encodeURIComponent(message)}`);
  }

  redirect(
    `${redirectTo}?feedback=sucesso&mensagem=${encodeURIComponent(
      "Workflow iniciado com sucesso a partir da plataforma."
    )}`
  );
}
