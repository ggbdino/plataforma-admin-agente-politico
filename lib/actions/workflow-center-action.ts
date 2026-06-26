"use server";

import { redirect } from "next/navigation";
import { getCurrentPlatformSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { createOrConnectEvolutionInstance } from "@/lib/evolution";
import { triggerN8nWebhook } from "@/lib/n8n";
import { recordGovernanceEvent } from "@/lib/repositories/governance";
import { generateCandidateWorkflowBundle } from "@/lib/services/candidate-workflow-generator";

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
    method: "GET" as const,
    descricao: "Entrada de eleitor no funil conversacional."
  },
  cadencia: {
    method: "GET" as const,
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
  const recurso = String(formData.get("recurso") ?? "agenda").trim();
  const acao = String(formData.get("acao") ?? "").trim();
  const referenciaId = String(formData.get("referenciaId") ?? "").trim();
  const observacao = String(formData.get("observacao") ?? "").trim();
  const payloadJson = String(formData.get("payloadJson") ?? "").trim();
  const governanceNome = String(formData.get("governanceNome") ?? "").trim();
  const governanceDescricao = String(formData.get("governanceDescricao") ?? "").trim();
  const governanceDataInicio = String(formData.get("governanceDataInicio") ?? "").trim();
  const governanceDataFim = String(formData.get("governanceDataFim") ?? "").trim();
  const governanceLocalNome = String(formData.get("governanceLocalNome") ?? "").trim();
  const governanceEnderecoOuUrl = String(formData.get("governanceEnderecoOuUrl") ?? "").trim();
  const governanceCidade = String(formData.get("governanceCidade") ?? "").trim();
  const governanceUf = String(formData.get("governanceUf") ?? "").trim();
  const governanceCanalConfirmacao = String(formData.get("governanceCanalConfirmacao") ?? "").trim();
  const governanceTipo = String(formData.get("governanceTipo") ?? "").trim();
  const governanceStatus = String(formData.get("governanceStatus") ?? "").trim();
  const governanceCapacidade = String(formData.get("governanceCapacidade") ?? "").trim();
  const session = await getCurrentPlatformSession();
  const redirectBase = buildRedirectBase(redirectTo, idCandidato);

  if (!session || session.perfil !== "administrador") {
    redirectWithParams(redirectBase, {
      feedback: "erro",
      mensagem: "Apenas administradores podem iniciar workflows pela governança."
    });
  }

  const adminSession = session as NonNullable<typeof session>;

  await ensureWorkflowCenterOperationalColumns();

  const config = resolveWorkflowConfig(workflow, idCandidato);

  if (!config) {
    redirectWithParams(redirectBase, {
      feedback: "erro",
      mensagem: "Workflow não identificado para execução."
    });
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

    if (
      governanceNome ||
      governanceDescricao ||
      governanceDataInicio ||
      governanceDataFim ||
      governanceLocalNome ||
      governanceEnderecoOuUrl ||
      governanceCidade ||
      governanceUf ||
      governanceCanalConfirmacao ||
      governanceTipo ||
      governanceStatus ||
      governanceCapacidade
    ) {
      payload.payload_json = JSON.stringify(
        buildGovernancePayload({
          recurso,
          nome: governanceNome,
          descricao: governanceDescricao,
          dataInicio: governanceDataInicio,
          dataFim: governanceDataFim,
          localNome: governanceLocalNome,
          enderecoOuUrl: governanceEnderecoOuUrl,
          cidade: governanceCidade,
          uf: governanceUf,
          canalConfirmacao: governanceCanalConfirmacao,
          tipo: governanceTipo,
          status: governanceStatus,
          capacidade: governanceCapacidade,
          operador: adminSession.email
        })
      );
    } else if (payloadJson) {
      try {
        const parsed = JSON.parse(payloadJson) as Record<string, unknown>;
        payload.payload_json = JSON.stringify(parsed);
      } catch {
        redirectWithParams(redirectBase, {
          feedback: "erro",
          mensagem: "Payload JSON inválido para o workflow de governança."
        });
      }
    }
  }

  let successMessage = "Workflow iniciado com sucesso a partir da plataforma.";

  try {
    const response =
      workflow === "qrcode_canais"
        ? await generateCandidatePairingQr(idCandidato || "0001")
        : await triggerN8nWebhook({
            path: config.path,
            method: config.method,
            payload
          });

    successMessage = formatWorkflowSuccessMessage(workflow, response, idCandidato || "0001");

    await recordGovernanceEvent({
      idCandidato: idCandidato || null,
      escopo: "admin",
      ator: adminSession.email,
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
    const message = buildWorkflowErrorMessage(workflow, rawMessage);

    await recordGovernanceEvent({
      idCandidato: idCandidato || null,
      escopo: "admin",
      ator: adminSession.email,
      categoria: "workflow_n8n",
      acao: `${workflow}_erro`,
      descricao: message,
      status: "erro",
      origem: "workflow-center"
    });

    redirectWithParams(redirectBase, {
      feedback: "erro",
      mensagem: message
    });
  }

  redirectWithParams(redirectBase, {
    feedback: "sucesso",
    mensagem: successMessage
  });
}


export async function updateCandidateOperationalDataAction(formData: FormData) {
  const idCandidato = String(formData.get("idCandidato") ?? "").trim();
  const redirectTo =
    String(formData.get("redirectTo") ?? "/estatisticas/governanca/workflows").trim();
  const nomeUrna = String(formData.get("nome_urna") ?? "").trim();
  const numeroTreTse = String(formData.get("numero_tre_tse") ?? "").trim();
  const rawNumeroAgenteOficial = String(formData.get("numero_agente_oficial") ?? "").trim();
  const redirectBase = buildRedirectBase(redirectTo, idCandidato);
  const session = await getCurrentPlatformSession();

  if (!session || session.perfil !== "administrador") {
    redirectWithParams(redirectBase, {
      feedback: "erro",
      mensagem: "Apenas administradores podem atualizar dados operacionais pela Central."
    });
  }

  if (!idCandidato) {
    redirectWithParams(redirectBase, {
      feedback: "erro",
      mensagem: "Selecione um candidato valido antes de atualizar os dados operacionais."
    });
  }

  if (!nomeUrna) {
    redirectWithParams(redirectBase, {
      feedback: "erro",
      mensagem: "Informe o nome de urna antes de atualizar os dados operacionais."
    });
  }

  const numeroAgenteOficial = rawNumeroAgenteOficial
    ? normalizeCampaignPhone(rawNumeroAgenteOficial)
    : null;

  if (rawNumeroAgenteOficial && !numeroAgenteOficial) {
    redirectWithParams(redirectBase, {
      feedback: "erro",
      mensagem: "Telefone oficial invalido. Informe DDI, DDD e numero, por exemplo 5561999999999."
    });
  }

  const adminSession = session as NonNullable<typeof session>;

  await ensureWorkflowCenterOperationalColumns();

  const currentResult = await db.query<{
    nome_urna: string | null;
    numero_tre_tse: string | null;
    numero_agente_oficial: string | null;
  }>(
    [
      "select c.nome_urna, c.numero_tre_tse, ic.numero_agente_oficial",
      "from candidatos c",
      "left join implantacoes_candidato ic on ic.id_candidato = c.id_candidato",
      "where c.id_candidato = $1",
      "limit 1"
    ].join("\n"),
    [idCandidato]
  );
  const current = currentResult.rows[0];

  if (!current) {
    redirectWithParams(redirectBase, {
      feedback: "erro",
      mensagem: "Candidato nao localizado na base para atualizacao operacional."
    });
  }

  const phoneChanged = Boolean(
    numeroAgenteOficial && numeroAgenteOficial !== current.numero_agente_oficial
  );
  const publicWhatsappUrl = numeroAgenteOficial ? "https://wa.me/" + numeroAgenteOficial : null;
  const publicQrCodeUrl = publicWhatsappUrl
    ? "https://api.qrserver.com/v1/create-qr-code/?size=800x800&data=" +
      encodeURIComponent(publicWhatsappUrl)
    : null;

  await db.query("begin");

  try {
    await db.query(
      [
        "update candidatos",
        "set nome_urna = $2,",
        "    numero_tre_tse = nullif($3, ''),",
        "    telefone_candidato = coalesce($4, telefone_candidato),",
        "    atualizado_em = now()",
        "where id_candidato = $1"
      ].join("\n"),
      [idCandidato, nomeUrna, numeroTreTse, numeroAgenteOficial]
    );

    await db.query(
      [
        "update campanhas",
        "set nome_campanha = $2, atualizado_em = now()",
        "where id_candidato = $1"
      ].join("\n"),
      [idCandidato, "Campanha " + nomeUrna]
    );

    await db.query(
      [
        "insert into implantacoes_candidato (",
        "  id_candidato, status_implantacao, numero_agente_oficial, qr_code_url,",
        "  pairing_qr_code_url, evolution_connection_code, evolution_pairing_code,",
        "  evolution_connection_status, observacoes, atualizado_em",
        ") values (",
        "  $1, 'em_andamento', $2, $3, null, null, null,",
        "  case when $4 then 'telefone_alterado_requer_regerar_qr' else null end,",
        "  'Dados operacionais atualizados pela Central de workflows.', now()",
        ")",
        "on conflict (id_candidato) do update set",
        "  numero_agente_oficial = coalesce(excluded.numero_agente_oficial, implantacoes_candidato.numero_agente_oficial),",
        "  qr_code_url = coalesce(excluded.qr_code_url, implantacoes_candidato.qr_code_url),",
        "  pairing_qr_code_url = case when $4 then null else implantacoes_candidato.pairing_qr_code_url end,",
        "  evolution_connection_code = case when $4 then null else implantacoes_candidato.evolution_connection_code end,",
        "  evolution_pairing_code = case when $4 then null else implantacoes_candidato.evolution_pairing_code end,",
        "  evolution_connection_status = case",
        "    when $4 then 'telefone_alterado_requer_regerar_qr'",
        "    else implantacoes_candidato.evolution_connection_status",
        "  end,",
        "  observacoes = 'Dados operacionais atualizados pela Central de workflows.',",
        "  atualizado_em = now()"
      ].join("\n"),
      [idCandidato, numeroAgenteOficial, publicQrCodeUrl, phoneChanged]
    );

    if (numeroAgenteOficial && publicWhatsappUrl) {
      await db.query(
        [
          "insert into canais_integracao (",
          "  id_candidato, nome_canal, tipo_canal, identificador_externo, url_canal,",
          "  status, selecionado_por_padrao, metadata, atualizado_em",
          ") values (",
          "  $1, 'WhatsApp oficial da campanha', 'whatsapp_agente', $2, $3,",
          "  'ativo', true, jsonb_build_object('qr_code_url', $4, 'origem', 'workflow_center'), now()",
          ")"
        ].join("\n"),
        [idCandidato, numeroAgenteOficial, publicWhatsappUrl, publicQrCodeUrl]
      );
    }

    await db.query("commit");
  } catch (error) {
    await db.query("rollback");
    throw error;
  }

  await recordGovernanceEvent({
    idCandidato,
    escopo: "admin",
    ator: adminSession.email,
    categoria: "dados_operacionais",
    acao: phoneChanged ? "atualizar_dados_e_invalidar_qr" : "atualizar_dados_operacionais",
    descricao: phoneChanged
      ? "Dados operacionais atualizados e QR de pareamento anterior invalidado para regeracao."
      : "Dados operacionais do candidato atualizados pela Central de workflows.",
    status: "sucesso",
    origem: "workflow-center",
    detalhes: {
      nome_urna_anterior: current.nome_urna,
      nome_urna: nomeUrna,
      numero_tre_tse_anterior: current.numero_tre_tse,
      numero_tre_tse: numeroTreTse || null,
      numero_agente_oficial_anterior: current.numero_agente_oficial,
      numero_agente_oficial: numeroAgenteOficial,
      telefone_alterado: phoneChanged
    }
  });

  redirectWithParams(redirectBase, {
    feedback: "sucesso",
    mensagem: phoneChanged
      ? "Dados operacionais atualizados. Como o telefone oficial mudou, gere novamente o QR code de conexao do WhatsApp."
      : "Dados operacionais atualizados com sucesso."
  });
}

export async function generateCandidateWorkflowPackageAction(formData: FormData) {
  const idCandidato = String(formData.get("idCandidato") ?? "").trim();
  const redirectTo =
    String(formData.get("redirectTo") ?? "/estatisticas/governanca/workflows").trim();
  const redirectBase = buildRedirectBase(redirectTo, idCandidato);
  const session = await getCurrentPlatformSession();

  if (!session || session.perfil !== "administrador") {
    redirectWithParams(redirectBase, {
      feedback: "erro",
      mensagem: "Apenas administradores podem gerar os pacotes de workflows por candidato."
    });
  }

  if (!idCandidato) {
    redirectWithParams(redirectBase, {
      feedback: "erro",
      mensagem: "Selecione um candidato válido antes de gerar o pacote de workflows."
    });
  }

  const adminSession = session as NonNullable<typeof session>;

  const candidateResult = await db.query<{
    id_candidato: string;
    nome_urna: string | null;
    nome_completo: string | null;
  }>(
    `
      select
        id_candidato,
        nome_urna,
        nome_completo
      from candidatos
      where id_candidato = $1
      limit 1
    `,
    [idCandidato]
  );

  const candidate = candidateResult.rows[0];

  if (!candidate) {
    redirectWithParams(redirectBase, {
      feedback: "erro",
      mensagem: "Candidato não localizado na base para geração dos workflows."
    });
  }

  const candidateName =
    String(candidate.nome_urna ?? "").trim() ||
    String(candidate.nome_completo ?? "").trim() ||
    candidate.id_candidato;

  try {
    const result = await generateCandidateWorkflowBundle({
      id: candidate.id_candidato,
      nome: candidateName
    });

    const generatedFileNames = result.generatedFiles.map((file) => file.fileName);
    const successMessage =
      `Pacote de workflows do candidato ${candidateName} gerado com sucesso. ` +
      `Foram preparados ${generatedFileNames.length} arquivo(s) nos diretórios workflows e external-workflows-snapshot do repositório local. ` +
      `Próximo passo: importar no n8n os fluxos ${generatedFileNames.join(", ")}.`;

    await recordGovernanceEvent({
      idCandidato: candidate.id_candidato,
      escopo: "admin",
      ator: adminSession.email,
      categoria: "workflow_templates",
      acao: "gerar_workflows_candidato",
      descricao: `Pacote local de workflows preparado para ${candidateName}.`,
      status: "sucesso",
      origem: "workflow-center",
      detalhes: {
        candidato: result.candidate,
        arquivos: generatedFileNames,
        manifesto: result.manifestPath,
        diretorio_workflows: result.workflowsDir,
        diretorio_snapshot: result.snapshotDir
      }
    });

    redirectWithParams(redirectBase, {
      feedback: "sucesso",
      mensagem: successMessage
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Falha ao gerar os workflows locais do candidato.";

    await recordGovernanceEvent({
      idCandidato: candidate.id_candidato,
      escopo: "admin",
      ator: adminSession.email,
      categoria: "workflow_templates",
      acao: "gerar_workflows_candidato_erro",
      descricao: message,
      status: "erro",
      origem: "workflow-center"
    });

    redirectWithParams(redirectBase, {
      feedback: "erro",
      mensagem: message
    });
  }
}


async function ensureWorkflowCenterOperationalColumns() {
  await db.query(`
    alter table candidatos
      add column if not exists numero_tre_tse text,
      add column if not exists telefone_candidato text
  `);

  await db.query(`
    alter table implantacoes_candidato
      add column if not exists qr_code_url text,
      add column if not exists pairing_qr_code_url text,
      add column if not exists evolution_connection_code text,
      add column if not exists evolution_pairing_code text,
      add column if not exists evolution_connection_status text
  `);

  await db.query(`
    alter table canais_integracao
      add column if not exists selecionado_por_padrao boolean not null default false,
      add column if not exists metadata jsonb not null default '{}'::jsonb,
      add column if not exists atualizado_em timestamptz not null default now()
  `);
}

function normalizeCampaignPhone(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length < 12 || digits.length > 13) {
    return null;
  }

  return digits;
}

function buildRedirectBase(redirectTo: string, idCandidato: string) {
  return appendSearchParams(
    redirectTo,
    idCandidato
      ? {
          candidato: idCandidato
        }
      : {}
  );
}

function redirectWithParams(basePath: string, params: Record<string, string>) {
  redirect(appendSearchParams(basePath, params));
}

function appendSearchParams(basePath: string, params: Record<string, string>) {
  const [pathname, currentSearch = ""] = basePath.split("?");
  const searchParams = new URLSearchParams(currentSearch);

  for (const [key, value] of Object.entries(params)) {
    const normalizedValue = value.trim();
    if (normalizedValue) {
      searchParams.set(key, normalizedValue);
    }
  }

  const queryString = searchParams.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
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

function buildWorkflowErrorMessage(
  workflow: keyof typeof WORKFLOW_METADATA,
  rawMessage: string
) {
  if (workflow === "candidato_sync" && rawMessage.includes("requested webhook")) {
    return "O workflow de sincronização de candidatos ainda não expõe uma URL de produção compatível com a plataforma. Confirme se o nó Webhook está ativo, publicado com método GET, usando o path /webhook/candidato-sync e se a plataforma está apontando para N8N_WEBHOOK_BASE_URL no domínio do serviço n8n_webhook.";
  }

  if (workflow === "candidato_sync" && rawMessage.includes("Error in workflow")) {
    return "O workflow de sincronizacao da planilha respondeu com erro interno no n8n. Enquanto ele e ajustado no n8n, use o painel Dados operacionais do candidato para atualizar nome de urna, numero, telefone oficial e depois regerar o QR code.";
  }

  if (workflow === "governanca" && rawMessage.includes("requested webhook")) {
    return "O workflow de governança ainda não está publicado no path de produção esperado pela plataforma. Confirme se o fluxo do candidato está ativo no n8n e se o webhook usa o caminho /webhook/agente-politico/{id_candidato}/governanca ou, no caso do cadastro-base antigo, o valor configurado em N8N_WEBHOOK_GOVERNANCA_BRUNEX.";
  }

  if (workflow === "entrada_eleitor" && rawMessage.includes("requested webhook")) {
    return "O workflow de entrada de eleitor não está publicado com o método e o path esperados pela plataforma. Reimporte o fluxo do candidato, ative o webhook e confirme o caminho /webhook/agente-politico/{id_candidato}/entrada-eleitor.";
  }

  if (workflow === "cadencia" && rawMessage.includes("requested webhook")) {
    return "O workflow de cadência não está publicado com o método e o path esperados pela plataforma. Reimporte o fluxo do candidato, ative o webhook e confirme o caminho /webhook/agente-politico/{id_candidato}/cadencia.";
  }

  return rawMessage;
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
      return `QR de conexão do WhatsApp gerado para o candidato ${idCandidato}. ${count} material(is) de pareamento disponível(is).`;
    }
  }

  return `QR de conexão do WhatsApp gerado para o candidato ${idCandidato}.`;
}

function formatGovernanceMessage(response: unknown) {
  if (!response) {
    return "Governança da agenda concluída.";
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

  return "Governança da agenda concluída.";
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
    const resposta = String(payload.mensagem_resposta ?? "").trim();

    return `Entrada de eleitor processada para o candidato ${idCandidato}${eleitorId ? `. Eleitor: ${eleitorId}.` : "."}${etapa ? ` Etapa sugerida: ${etapa}.` : ""}${resposta ? ` Resposta do sistema: ${resposta}` : ""}`;
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

async function generateCandidatePairingQr(idCandidato: string) {
  const candidateResult = await db.query<{
    nome_urna: string;
    numero_agente_oficial: string | null;
  }>(
    `
      select
        c.nome_urna,
        ic.numero_agente_oficial
      from candidatos c
      left join implantacoes_candidato ic
        on ic.id_candidato = c.id_candidato
      where c.id_candidato = $1
    `,
    [idCandidato]
  );

  const candidate = candidateResult.rows[0];

  if (!candidate) {
    throw new Error("Candidato não localizado para gerar o QR de conexão do WhatsApp.");
  }

  if (!candidate.numero_agente_oficial) {
    throw new Error(
      "Registre antes o número oficial da campanha na implantação para gerar o QR de conexão do WhatsApp."
    );
  }

  const result = await createOrConnectEvolutionInstance({
    idCandidato,
    nomeUrna: candidate.nome_urna,
    numeroOficial: candidate.numero_agente_oficial
  });

  await db.query(`
    alter table implantacoes_candidato
      add column if not exists pairing_qr_code_url text,
      add column if not exists evolution_connection_code text,
      add column if not exists evolution_pairing_code text,
      add column if not exists evolution_connection_status text
  `);

  await db.query(
    `
      update implantacoes_candidato
      set
        instancia_evolution = $2,
        numero_agente_oficial = $3,
        webhook_inbound_url = $4,
        webhook_outbound_url = $5,
        pairing_qr_code_url = $6,
        evolution_connection_code = $7,
        evolution_pairing_code = $8,
        evolution_connection_status = $9,
        atualizado_em = now()
      where id_candidato = $1
    `,
    [
      idCandidato,
      result.instanceName,
      result.numeroOficial,
      result.webhookInboundUrl,
      result.webhookOutboundUrl,
      result.qrCodeUrl,
      result.connectionCode,
      result.pairingCode,
      result.connectionStatus
    ]
  );

  return {
    ...result,
    message: `QR de conexão do WhatsApp gerado para o candidato ${idCandidato}. Abra-o na etapa 2 para vincular a nova linha ao webhook da campanha.`
  };
}

function buildGovernancePayload(input: {
  recurso: string;
  nome: string;
  descricao: string;
  dataInicio: string;
  dataFim: string;
  localNome: string;
  enderecoOuUrl: string;
  cidade: string;
  uf: string;
  canalConfirmacao: string;
  tipo: string;
  status: string;
  capacidade: string;
  operador: string;
}) {
  const metadata = {
    origem_interface: "plataforma_admin",
    operador: input.operador
  };

  if (input.recurso === "evento") {
    return {
      nome_evento: input.nome || "Evento de campanha",
      tipo_evento: input.tipo || "reuniao",
      descricao: input.descricao || "Evento gerado pela plataforma para organização da agenda.",
      data_evento: input.dataInicio,
      local_nome: input.localNome,
      endereco: input.enderecoOuUrl,
      cidade: input.cidade,
      uf: input.uf,
      capacidade_estimada: Number(input.capacidade || 0),
      link_confirmacao: null,
      status: input.status || "ativo",
      metadata
    };
  }

  if (input.recurso === "canal") {
    return {
      nome_canal: input.nome || "Canal de campanha",
      tipo_canal: input.tipo || "whatsapp",
      identificador_externo: input.localNome,
      url_canal: input.enderecoOuUrl,
      status: input.status || "ativo",
      metadata
    };
  }

  return {
    titulo: input.nome || "Agenda de campanha",
    descricao: input.descricao || "Agenda gerada pela plataforma para organização operacional.",
    data_inicio: input.dataInicio,
    data_fim: input.dataFim,
    local_nome: input.localNome,
    endereco: input.enderecoOuUrl,
    cidade: input.cidade,
    uf: input.uf,
    canal_confirmacao: input.canalConfirmacao,
    status: input.status || "planejado",
    metadata
  };
}
