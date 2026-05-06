import { db } from "@/lib/db";
import { triggerN8nWebhook } from "@/lib/n8n";
import type { StepExecutionMode } from "@/lib/types";

type ExecuteStepInput = {
  idCandidato: string;
  codigoEtapa: string;
  executedBy: string;
  source: string;
  payload: Record<string, unknown>;
};

const STEP_TO_WEBHOOK: Record<
  string,
  {
    path: string;
    method?: "GET" | "POST";
    mode: StepExecutionMode;
  } | null
> = {
  cadastro_candidato: { path: "/webhook/candidato-sync", method: "POST", mode: "webhook" },
  configurar_canais: { path: "/webhook/agente-politico/0001/governanca", method: "GET", mode: "webhook" },
  gerar_qrcode: { path: "/webhook/agente-politico/0001/qrcode/canais", method: "GET", mode: "webhook" },
  configurar_evolution: null,
  validar_inbound: { path: "/webhook/agente-politico/0001/entrada-eleitor", method: "GET", mode: "webhook" },
  validar_outbound: null,
  ativar_campanha: null
};

export async function executeImplantationStep(input: ExecuteStepInput) {
  const client = await db.connect();
  let executionId: string | null = null;

  try {
    await client.query("begin");

    const implantationResult = await client.query<{
      implantacao_id: string;
      etapa_id: string;
      nome_etapa: string;
    }>(
      `
        select
          ic.id as implantacao_id,
          iec.id as etapa_id,
          iec.nome_etapa
        from implantacoes_candidato ic
        join implantacao_etapas_candidato iec
          on iec.implantacao_id = ic.id
        where ic.id_candidato = $1
          and iec.codigo_etapa = $2
      `,
      [input.idCandidato, input.codigoEtapa]
    );

    const implantation = implantationResult.rows[0];

    if (!implantation) {
      throw new Error("Etapa de implantacao nao encontrada para o candidato.");
    }

    const previousStepsResult = await client.query<{
      codigo_etapa: string;
      nome_etapa: string;
      status_etapa: string;
    }>(
      `
        select codigo_etapa, nome_etapa, status_etapa
        from implantacao_etapas_candidato
        where id_candidato = $1
          and ordem < (
            select ordem
            from implantacao_etapas_candidato
            where id_candidato = $1
              and codigo_etapa = $2
          )
        order by ordem
      `,
      [input.idCandidato, input.codigoEtapa]
    );

    const blockingStep = previousStepsResult.rows.find((step) => step.status_etapa !== "concluida");

    if (blockingStep) {
      throw new Error(
        `Execute antes a etapa ${blockingStep.nome_etapa} para respeitar a sequencia da implantacao.`
      );
    }

    const executionResult = await client.query<{ id: string }>(
      `
        insert into execucoes_implantacao (
          implantacao_id,
          etapa_id,
          id_candidato,
          tipo_execucao,
          status_execucao,
          origem,
          payload_enviado,
          iniciado_em
        )
        values ($1, $2, $3, 'execucao_etapa', 'iniciada', $4, $5::jsonb, now())
        returning id
      `,
      [
        implantation.implantacao_id,
        implantation.etapa_id,
        input.idCandidato,
        input.source,
        JSON.stringify({
          ...input.payload,
          executado_por: input.executedBy
        })
      ]
    );

    await client.query(
      `
        update implantacao_etapas_candidato
        set
          status_etapa = 'em_andamento',
          executado_em = now(),
          mensagem_status = 'Etapa em execucao',
          atualizado_em = now()
        where id = $1
      `,
      [implantation.etapa_id]
    );

    await client.query("commit");

    executionId = executionResult.rows[0].id;
    const webhookConfig = STEP_TO_WEBHOOK[input.codigoEtapa];

    if (!webhookConfig) {
      const manualMessage = getManualStepMessage(input.codigoEtapa);

      await markExecutionFinished({
        executionId,
        idCandidato: input.idCandidato,
        codigoEtapa: input.codigoEtapa,
        status: "concluida",
        message: manualMessage,
        responsePayload: { manual: true, codigo_etapa: input.codigoEtapa }
      });

      if (input.codigoEtapa === "ativar_campanha") {
        await db.query(
          `
            update implantacoes_candidato
            set
              status_implantacao = 'ativo',
              atualizado_em = now()
            where id_candidato = $1
          `,
          [input.idCandidato]
        );
      }

      return {
        status: "concluido",
        codigo_etapa: input.codigoEtapa,
        mensagem: manualMessage
      };
    }

    const defaultPayload = buildDefaultPayload(input.idCandidato, input.codigoEtapa);
    const responsePayload = await triggerN8nWebhook({
      path: webhookConfig.path,
      method: webhookConfig.method ?? "POST",
      payload: {
        ...defaultPayload,
        ...input.payload
      }
    });

    await markExecutionFinished({
      executionId,
      idCandidato: input.idCandidato,
      codigoEtapa: input.codigoEtapa,
      status: "concluida",
      message: `Etapa ${implantation.nome_etapa} executada com sucesso.`,
      responsePayload
    });

    return {
      status: "concluido",
      codigo_etapa: input.codigoEtapa,
      mensagem: `Etapa ${implantation.nome_etapa} executada com sucesso.`,
      detalhes: responsePayload
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);

    if (executionId) {
      const message =
        error instanceof Error ? error.message : "Falha inesperada ao executar a etapa.";

      await markExecutionFinished({
        executionId,
        idCandidato: input.idCandidato,
        codigoEtapa: input.codigoEtapa,
        status: "com_erro",
        message,
        responsePayload: {
          erro: message
        }
      }).catch(() => undefined);
    }

    throw error;
  } finally {
    client.release();
  }
}

function buildDefaultPayload(idCandidato: string, codigoEtapa: string) {
  if (codigoEtapa === "validar_inbound") {
    return {
      id_candidato: idCandidato,
      telefone: "5561981297840",
      nome: "Eleitor Teste",
      mensagem: "Teste de inbound do candidato.",
      tema_interesse: "geral",
      consentimento_lgpd: true,
      origem_captacao: "whatsapp"
    };
  }

  return {
    id_candidato: idCandidato
  };
}

async function markExecutionFinished(input: {
  executionId: string;
  idCandidato: string;
  codigoEtapa: string;
  status: "concluida" | "com_erro";
  message: string;
  responsePayload: unknown;
}) {
  const statusExecucao = input.status === "concluida" ? "concluida" : "com_erro";

  await db.query(
    `
      update execucoes_implantacao
      set
        status_execucao = $2,
        resposta_resumida = $3::jsonb,
        finalizado_em = now()
      where id = $1
    `,
    [input.executionId, statusExecucao, JSON.stringify(input.responsePayload ?? {})]
  );

  await db.query(
    `
      update implantacao_etapas_candidato
      set
        status_etapa = $3,
        finalizado_em = now(),
        mensagem_status = $4,
        atualizado_em = now()
      where id_candidato = $1
        and codigo_etapa = $2
    `,
    [input.idCandidato, input.codigoEtapa, input.status, input.message]
  );
}

function getManualStepMessage(codigoEtapa: string) {
  switch (codigoEtapa) {
    case "configurar_evolution":
      return "Etapa registrada como manual. Configure a instancia Evolution dedicada do candidato.";
    case "validar_outbound":
      return "Etapa registrada como manual/agendada. A validacao outbound depende do schedule da cadencia.";
    case "ativar_campanha":
      return "Campanha marcada como ativa no painel administrativo.";
    default:
      return "Etapa registrada como manual ou dependente de configuracao externa.";
  }
}
