import { db } from "@/lib/db";
import { triggerN8nWebhook } from "@/lib/n8n";
import type { CampaignChannelOption, StepExecutionMode } from "@/lib/types";

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
  configurar_canais: null,
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
      if (input.codigoEtapa === "configurar_canais") {
        await upsertCandidateChannel(input.idCandidato, input.payload);
      }

      const manualMessage = getManualStepMessage(input.codigoEtapa, input.payload);

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

function getManualStepMessage(codigoEtapa: string, payload: Record<string, unknown>) {
  const origemExecucao =
    typeof payload.origem_execucao === "string" ? payload.origem_execucao : "admin";
  const observacao =
    typeof payload.observacao === "string" && payload.observacao.trim().length > 0
      ? ` Observacao do gestor: ${payload.observacao.trim()}`
      : "";

  switch (codigoEtapa) {
    case "configurar_canais":
      return `Canal oficial do Agente Politico registrado no painel, com QR Code vinculado ao telefone da campanha e canais de divulgacao orientados para esse contato. Atualizacao realizada pela ${origemExecucao === "gestor_campanha" ? "Area da Gestora da Campanha" : "administracao"}.${
        observacao
      }`;
    case "configurar_evolution":
      return `Etapa registrada como manual. Configure a instancia Evolution dedicada do candidato.${observacao}`;
    case "validar_outbound":
      return `Etapa registrada como manual/agendada. A validacao outbound depende do schedule da cadencia.${observacao}`;
    case "ativar_campanha":
      return `Campanha marcada como ativa no painel administrativo.${observacao}`;
    default:
      return `Etapa registrada como manual ou dependente de configuracao externa.${observacao}`;
  }
}

async function upsertCandidateChannel(
  idCandidato: string,
  payload: Record<string, unknown>
) {
  const nomeCanal =
    typeof payload.nome_canal === "string" && payload.nome_canal.trim().length > 0
      ? payload.nome_canal.trim()
      : null;
  const tipoCanal =
    typeof payload.tipo_canal === "string" && payload.tipo_canal.trim().length > 0
      ? payload.tipo_canal.trim()
      : null;
  const identificadorExterno =
    typeof payload.identificador_externo === "string" && payload.identificador_externo.trim().length > 0
      ? payload.identificador_externo.trim()
      : null;
  const urlCanal =
    typeof payload.url_canal === "string" && payload.url_canal.trim().length > 0
      ? payload.url_canal.trim()
      : "";
  const canaisDivulgacao =
    typeof payload.canais_divulgacao === "string" && payload.canais_divulgacao.trim().length > 0
      ? payload.canais_divulgacao.trim()
      : null;
  const canaisDivulgacaoItens = normalizeChannelItems(payload.canais_divulgacao_itens);
  const canaisDivulgacaoExtras = normalizeExtraChannelItems(payload.canais_divulgacao_extra);
  const normalizedPhone = normalizeCampaignPhone(identificadorExterno);
  const normalizedWhatsappUrl = normalizeWhatsappUrl(urlCanal, normalizedPhone);

  if (!nomeCanal || !tipoCanal || !identificadorExterno) {
    throw new Error(
      "Preencha nome do canal oficial, tipo do canal e numero oficial da campanha para concluir esta etapa."
    );
  }

  if (tipoCanal !== "whatsapp_agente") {
    throw new Error("O canal oficial da campanha deve permanecer como whatsapp_agente.");
  }

  if (!normalizedPhone) {
    throw new Error(
      "Informe um numero oficial valido para a campanha, contendo apenas digitos com DDD e codigo do pais quando necessario."
    );
  }

  if (!normalizedWhatsappUrl) {
    throw new Error("Nao foi possivel derivar o link oficial do WhatsApp a partir do numero informado.");
  }

  const updateResult = await db.query<{ id: string }>(
    `
      update canais_integracao
      set
        nome_canal = $2,
        tipo_canal = $3,
        identificador_externo = $4::text,
        url_canal = $5::text,
        status = 'ativo',
        origem_dados = 'plataforma_admin',
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'origem_interface', 'plataforma_admin',
          'exibir_em_qrcode', true,
          'papel_canal', 'canal_oficial_funil',
          'qrcode_vinculado', true,
          'numero_oficial_campanha', $4::text,
          'canais_divulgacao', $6::text
        ),
        atualizado_em = now()
      where id_candidato = $1
        and tipo_canal = $3
      returning id
    `,
    [idCandidato, nomeCanal, tipoCanal, normalizedPhone, normalizedWhatsappUrl, canaisDivulgacao]
  );

  let officialChannelId: string;

  if (updateResult.rowCount && updateResult.rowCount > 0) {
    officialChannelId = updateResult.rows[0].id;
  } else {
    const insertResult = await db.query<{ id: string }>(
      `
        insert into canais_integracao (
          id_candidato,
          nome_canal,
          tipo_canal,
          identificador_externo,
          url_canal,
          status,
          origem_dados,
          metadata
        )
        values (
          $1,
          $2,
          $3,
          $4::text,
          $5::text,
          'ativo',
          'plataforma_admin',
          jsonb_build_object(
            'origem_interface', 'plataforma_admin',
            'exibir_em_qrcode', true,
            'papel_canal', 'canal_oficial_funil',
            'qrcode_vinculado', true,
            'numero_oficial_campanha', $4::text,
            'canais_divulgacao', $6::text
          )
        )
        returning id
      `,
      [idCandidato, nomeCanal, tipoCanal, normalizedPhone, normalizedWhatsappUrl, canaisDivulgacao]
    );

    officialChannelId = insertResult.rows[0].id;
  }

  await syncDisseminationChannels(
    idCandidato,
    officialChannelId,
    [...canaisDivulgacaoItens, ...canaisDivulgacaoExtras]
  );

  return officialChannelId;
}

function normalizeCampaignPhone(value: string | null) {
  const digits = String(value ?? "").replace(/\D/g, "");

  if (digits.length < 10 || digits.length > 14) {
    return null;
  }

  return digits;
}

function normalizeWhatsappUrl(url: string | null, phone: string | null) {
  if (!phone) {
    return null;
  }

  const text = String(url ?? "").trim();

  if (!text) {
    return `https://wa.me/${phone}`;
  }

  const match = text.match(/(?:wa\.me\/|phone=)(\d{10,14})/);

  if (match?.[1]) {
    if (match[1] !== phone) {
      return null;
    }

    return `https://wa.me/${phone}`;
  }

  if (text === `https://wa.me/${phone}` || text === `http://wa.me/${phone}`) {
    return `https://wa.me/${phone}`;
  }

  return null;
}

function normalizeChannelItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const dedupe = new Set<string>();
  const items: CampaignChannelOption[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const channel = item as Partial<CampaignChannelOption>;
    const nomeCanal = String(channel.nome_canal ?? "").trim();
    const tipoCanal = String(channel.tipo_canal ?? "").trim();
    const identificadorExterno = String(channel.identificador_externo ?? "").trim() || null;
    const urlCanal = normalizeGenericUrl(channel.url_canal);

    if (!nomeCanal || !tipoCanal) {
      continue;
    }

    const key = `${tipoCanal}|${identificadorExterno ?? nomeCanal}`;

    if (dedupe.has(key)) {
      continue;
    }

    dedupe.add(key);
    items.push({
      nome_canal: nomeCanal,
      tipo_canal: tipoCanal,
      url_canal: urlCanal,
      identificador_externo: identificadorExterno,
      status: "ativo",
      selecionado_por_padrao: true
    });
  }

  return items;
}

function normalizeExtraChannelItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const dedupe = new Set<string>();
  const items: CampaignChannelOption[] = [];

  for (const item of value) {
    const raw = String(item ?? "").trim();

    if (!raw) {
      continue;
    }

    const key = raw.toLowerCase();

    if (dedupe.has(key)) {
      continue;
    }

    dedupe.add(key);
    items.push({
      nome_canal: raw,
      tipo_canal: "canal_divulgacao",
      url_canal: normalizeGenericUrl(raw),
      identificador_externo: raw,
      status: "ativo",
      selecionado_por_padrao: true
    });
  }

  return items;
}

function normalizeGenericUrl(value: unknown) {
  const text = String(value ?? "").trim();

  if (!text) {
    return null;
  }

  if (text.startsWith("http://") || text.startsWith("https://")) {
    return text;
  }

  if (text.startsWith("@")) {
    return null;
  }

  if (text.includes(".") && !text.includes(" ")) {
    return `https://${text}`;
  }

  return null;
}

async function syncDisseminationChannels(
  idCandidato: string,
  officialChannelId: string,
  channels: CampaignChannelOption[]
) {
  await db.query(
    `
      update canais_integracao
      set
        status = 'inativo',
        atualizado_em = now(),
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'origem_interface', 'plataforma_admin',
          'papel_canal', 'canal_divulgacao',
          'promove_whatsapp_oficial', false,
          'promove_qrcode', false,
          'canal_oficial_id', $2::text
        )
      where id_candidato = $1
        and tipo_canal <> 'whatsapp_agente'
    `,
    [idCandidato, officialChannelId]
  );

  for (const channel of channels) {
    await upsertDisseminationChannel(idCandidato, officialChannelId, channel);
  }
}

async function upsertDisseminationChannel(
  idCandidato: string,
  officialChannelId: string,
  channel: CampaignChannelOption
) {
  const updateResult = await db.query<{ id: string }>(
    `
      update canais_integracao
      set
        nome_canal = $2,
        identificador_externo = $4::text,
        url_canal = $5::text,
        status = 'ativo',
        origem_dados = 'plataforma_admin',
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'origem_interface', 'plataforma_admin',
          'papel_canal', 'canal_divulgacao',
          'promove_whatsapp_oficial', true,
          'promove_qrcode', true,
          'canal_oficial_id', $6::text
        ),
        atualizado_em = now()
      where id_candidato = $1
        and tipo_canal = $3
        and (
          coalesce(identificador_externo, '') = coalesce($4::text, '')
          or nome_canal = $2
        )
      returning id
    `,
    [
      idCandidato,
      channel.nome_canal,
      channel.tipo_canal,
      channel.identificador_externo,
      channel.url_canal,
      officialChannelId
    ]
  );

  if (updateResult.rowCount && updateResult.rowCount > 0) {
    return updateResult.rows[0].id;
  }

  const insertResult = await db.query<{ id: string }>(
    `
      insert into canais_integracao (
        id_candidato,
        nome_canal,
        tipo_canal,
        identificador_externo,
        url_canal,
        status,
        origem_dados,
        metadata
      )
      values (
        $1,
        $2,
        $3,
        $4::text,
        $5::text,
        'ativo',
        'plataforma_admin',
        jsonb_build_object(
          'origem_interface', 'plataforma_admin',
          'papel_canal', 'canal_divulgacao',
          'promove_whatsapp_oficial', true,
          'promove_qrcode', true,
          'canal_oficial_id', $6::text
        )
      )
      returning id
    `,
    [
      idCandidato,
      channel.nome_canal,
      channel.tipo_canal,
      channel.identificador_externo,
      channel.url_canal,
      officialChannelId
    ]
  );

  return insertResult.rows[0].id;
}
