"use server";

import { redirect } from "next/navigation";
import { getCurrentPlatformSession } from "@/lib/auth";
import { env } from "@/lib/env";
import { triggerN8nWebhook } from "@/lib/n8n";
import { recordGovernanceEvent } from "@/lib/repositories/governance";

const WORKFLOW_METADATA = {
  candidato_sync: {
    method: "GET" as const,
    descricao: "Sincronização do cadastro-base do candidato."
  },
  qrcode_canais: {
    method: "GET" as const,
    descricao: "Geração ou atualização do QR Code e dos canais do agente."
  },
  governanca: {
    method: "GET" as const,
    descricao: "Workflow de governança operacional do candidato."
  },
  entrada_eleitor: {
    method: "POST" as const,
    descricao: "Entrada de eleitor no funil conversacional."
  },
  cadencia: {
    method: "POST" as const,
    descricao: "Workflow de cadência e reativação."
  }
};

export async function triggerGovernanceWorkflowAction(formData: FormData) {
  const workflow = String(formData.get("workflow") ?? "").trim() as keyof typeof WORKFLOW_METADATA;
  const idCandidato = String(formData.get("idCandidato") ?? "").trim();
  const redirectTo =
    String(formData.get("redirectTo") ?? "/estatisticas/governanca/workflows").trim();
  const telefone = String(formData.get("telefone") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();
  const mensagem = String(formData.get("mensagem") ?? "").trim();
  const liderId = String(formData.get("liderId") ?? "").trim();
  const recurso = String(formData.get("recurso") ?? "").trim();
  const acao = String(formData.get("acao") ?? "").trim();
  const referenciaId = String(formData.get("referenciaId") ?? "").trim();
  const observacao = String(formData.get("observacao") ?? "").trim();
  const payloadJson = String(formData.get("payloadJson") ?? "").trim();
  const session = await getCurrentPlatformSession();

  if (!session || session.perfil !== "administrador") {
    redirect(
      `${redirectTo}?feedback=erro&mensagem=${encodeURIComponent(
        "Apenas administradores podem iniciar workflows pela governança."
      )}`
    );
  }

  const config = resolveWorkflowConfig(workflow, idCandidato);

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

  if (workflow === "governanca") {
    payload.lider_id = liderId;
    payload.recurso = recurso;
    payload.acao = acao || "upsert";
    payload.referencia_id = referenciaId;
    payload.observacao = observacao;

    if (payloadJson) {
      try {
        const parsed = JSON.parse(payloadJson) as Record<string, unknown>;
        payload.payload_json = JSON.stringify(parsed);
      } catch {
        redirect(
          `${redirectTo}?feedback=erro&mensagem=${encodeURIComponent(
            "Payload JSON inválido para o workflow de governança."
          )}`
        );
      }
    }
  }

  let successMessage = "Workflow iniciado com sucesso a partir da plataforma.";

  try {
    const response = await triggerN8nWebhook({
      path: config.path,
      method: config.method,
      payload
    });

    successMessage = formatWorkflowSuccessMessage(workflow, response, idCandidato || "0001");

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
    const rawMessage =
      error instanceof Error ? error.message : "Falha ao iniciar o workflow do n8n.";
    const message =
      workflow === "candidato_sync" && rawMessage.includes("requested webhook")
        ? "O workflow de sincronização de candidatos ainda não expõe uma URL de produção compatível com a plataforma. Confirme se o nó Webhook está ativo, publicado e com o mesmo path configurado em N8N_WEBHOOK_CANDIDATO_SYNC."
        : rawMessage;

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

  redirect(`${redirectTo}?feedback=sucesso&mensagem=${encodeURIComponent(successMessage)}`);
}

function resolveWorkflowConfig(
  workflow: keyof typeof WORKFLOW_METADATA,
  idCandidato: string
) {
  const metadata = WORKFLOW_METADATA[workflow];
  const normalizedCandidateId = idCandidato || "0001";

  switch (workflow) {
    case "candidato_sync":
      return {
        ...metadata,
        path: env.n8nWebhookCandidateSync
      };
    case "qrcode_canais":
      return {
        ...metadata,
        path:
          normalizedCandidateId === "0001"
            ? env.n8nWebhookQrCodeBrunex
            : `/webhook/agente-politico/${normalizedCandidateId}/qrcode/canais`
      };
    case "governanca":
      return {
        ...metadata,
        path:
          normalizedCandidateId === "0001"
            ? env.n8nWebhookGovernancaBrunex
            : `/webhook/agente-politico/${normalizedCandidateId}/governanca`
      };
    case "entrada_eleitor":
      return {
        ...metadata,
        path:
          normalizedCandidateId === "0001"
            ? env.n8nWebhookFunilBrunex
            : `/webhook/agente-politico/${normalizedCandidateId}/entrada-eleitor`
      };
    case "cadencia":
      return {
        ...metadata,
        path:
          normalizedCandidateId === "0001"
            ? env.n8nWebhookCadenciaBrunex
            : `/webhook/agente-politico/${normalizedCandidateId}/cadencia`
      };
  }
}

function formatWorkflowSuccessMessage(
  workflow: keyof typeof WORKFLOW_METADATA,
  response: unknown,
  idCandidato: string
) {
  if (workflow === "candidato_sync") {
    return formatCandidateSyncMessage(response);
  }

  if (workflow === "qrcode_canais") {
    return formatQrCodeMessage(response, idCandidato);
  }

  if (workflow === "governanca") {
    return formatGovernanceMessage(response);
  }

  if (workflow === "entrada_eleitor") {
    return formatInboundMessage(response, idCandidato);
  }

  if (workflow === "cadencia") {
    return formatCadenciaMessage(response, idCandidato);
  }

  return "Workflow iniciado com sucesso a partir da plataforma.";
}

function formatCandidateSyncMessage(response: unknown) {
  if (!response) {
    return "Sincronização de candidatos concluída.";
  }

  if (typeof response === "object" && response !== null) {
    const payload = response as Record<string, unknown>;

    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message.trim();
    }

    const total = Number(payload.total_processados ?? 0);
    const novos = Number(payload.novos ?? 0);
    const atualizados = Number(payload.atualizados ?? 0);
    const ignorados = Number(payload.ignorados ?? 0);

    if (total > 0) {
      return `Sincronização de candidatos concluída. ${total} registro(s) processado(s): ${novos} novo(s), ${atualizados} atualizado(s) e ${ignorados} sem alteração.`;
    }
  }

  return "Sincronização de candidatos concluída.";
}

function formatQrCodeMessage(response: unknown, idCandidato: string) {
  if (!response) {
    return `QR Code e canais gerados para o candidato ${idCandidato}.`;
  }

  if (typeof response === "object" && response !== null) {
    const payload = response as Record<string, unknown>;

    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message.trim();
    }

    if (payload.base64 || payload.code || payload.pairingCode) {
      const count = Number(payload.count ?? 1);
      return `QR Code gerado para o candidato ${idCandidato}. ${count} material(is) de conexão disponível(is).`;
    }
  }

  return `QR Code e canais gerados para o candidato ${idCandidato}.`;
}

function formatGovernanceMessage(response: unknown) {
  if (!response) {
    return "Workflow de governança concluído.";
  }

  if (typeof response === "object" && response !== null) {
    const payload = response as Record<string, unknown>;

    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message.trim();
    }

    const recurso = String(payload.recurso ?? "").trim();
    const referenciaId = String(payload.referencia_id ?? "").trim();

    if (recurso) {
      return `Governança concluída para o recurso ${recurso}${referenciaId ? `. Referência: ${referenciaId}.` : "."}`;
    }
  }

  return "Workflow de governança concluído.";
}

function formatInboundMessage(response: unknown, idCandidato: string) {
  if (!response) {
    return `Entrada de eleitor processada para o candidato ${idCandidato}.`;
  }

  if (typeof response === "object" && response !== null) {
    const payload = response as Record<string, unknown>;

    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message.trim();
    }

    const eleitorId = String(payload.eleitor_id ?? "").trim();
    const etapa = String(payload.etapa ?? "").trim();

    return `Entrada de eleitor processada para o candidato ${idCandidato}${eleitorId ? `. Eleitor: ${eleitorId}.` : "."}${etapa ? ` Etapa sugerida: ${etapa}.` : ""}`;
  }

  return `Entrada de eleitor processada para o candidato ${idCandidato}.`;
}

function formatCadenciaMessage(response: unknown, idCandidato: string) {
  if (!response) {
    return `Cadência executada para o candidato ${idCandidato}.`;
  }

  if (typeof response === "object" && response !== null) {
    const payload = response as Record<string, unknown>;

    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message.trim();
    }

    const total = Number(payload.total_processados ?? payload.total_elegiveis ?? 0);
    const enviados = Number(payload.enviados ?? total);

    if (total > 0) {
      return `Cadência executada para o candidato ${idCandidato}. ${total} registro(s) processado(s), ${enviados} pronto(s) para ação.`;
    }
  }

  return `Cadência executada para o candidato ${idCandidato}.`;
}
