import { db } from "@/lib/db";
import type { ImplantationHeader, ImplantationStep } from "@/lib/types";

export async function getCandidateImplantation(idCandidato: string) {
  const headerResult = await db.query<ImplantationHeader>(
    `
      select
        c.id_candidato,
        c.nome_urna,
        c.nome_completo,
        c.partido,
        c.cargo_disputado,
        c.estado,
        ic.status_implantacao,
        ic.ambiente,
        ic.instancia_evolution,
        ic.numero_agente_oficial,
        ic.webhook_inbound_url,
        ic.webhook_outbound_url,
        ic.qr_code_url,
        ic.observacoes,
        ic.atualizado_em::text as atualizado_em
      from candidatos c
      join implantacoes_candidato ic
        on ic.id_candidato = c.id_candidato
      where c.id_candidato = $1
    `,
    [idCandidato]
  );

  if (!headerResult.rows[0]) {
    return null;
  }

  const stepsResult = await db.query<ImplantationStep>(
    `
      select
        codigo_etapa,
        nome_etapa,
        ordem,
        status_etapa,
        workflow_nome,
        webhook_path,
        executado_em::text as executado_em,
        finalizado_em::text as finalizado_em,
        mensagem_status,
        detalhes
      from implantacao_etapas_candidato
      where id_candidato = $1
      order by ordem
    `,
    [idCandidato]
  );

  const reconciledSteps = await reconcileImplantationSteps(
    idCandidato,
    headerResult.rows[0],
    stepsResult.rows
  );

  return {
    cabecalho: headerResult.rows[0],
    etapas: reconciledSteps
  };
}

async function reconcileImplantationSteps(
  idCandidato: string,
  header: ImplantationHeader,
  steps: ImplantationStep[]
) {
  const updates: Array<{
    codigo_etapa: string;
    mensagem: string;
  }> = [];

  const hasCandidateBase =
    Boolean(header.nome_urna) &&
    Boolean(header.nome_completo) &&
    Boolean(header.partido) &&
    Boolean(header.cargo_disputado);

  if (hasCandidateBase) {
    const cadastroStep = steps.find((step) => step.codigo_etapa === "cadastro_candidato");

    if (cadastroStep && cadastroStep.status_etapa !== "concluida") {
      updates.push({
        codigo_etapa: "cadastro_candidato",
        mensagem: "Etapa conciliada automaticamente: candidato ja existente na base de dados."
      });
    }
  }

  if (header.qr_code_url) {
    const qrStep = steps.find((step) => step.codigo_etapa === "gerar_qrcode");

    if (qrStep && qrStep.status_etapa !== "concluida") {
      updates.push({
        codigo_etapa: "gerar_qrcode",
        mensagem: "Etapa conciliada automaticamente: QR Code ja existente para o candidato."
      });
    }
  }

  if (updates.length === 0) {
    return steps;
  }

  for (const update of updates) {
    await db.query(
      `
        update implantacao_etapas_candidato
        set
          status_etapa = 'concluida',
          finalizado_em = coalesce(finalizado_em, now()),
          executado_em = coalesce(executado_em, now()),
          mensagem_status = $3,
          atualizado_em = now()
        where id_candidato = $1
          and codigo_etapa = $2
      `,
      [idCandidato, update.codigo_etapa, update.mensagem]
    );
  }

  return steps.map((step) => {
    const matchedUpdate = updates.find((update) => update.codigo_etapa === step.codigo_etapa);

    if (!matchedUpdate) {
      return step;
    }

    const now = new Date().toISOString();

    return {
      ...step,
      status_etapa: "concluida",
      executado_em: step.executado_em ?? now,
      finalizado_em: step.finalizado_em ?? now,
      mensagem_status: matchedUpdate.mensagem
    };
  });
}
