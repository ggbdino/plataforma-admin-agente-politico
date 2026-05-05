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

  return {
    cabecalho: headerResult.rows[0],
    etapas: stepsResult.rows
  };
}
