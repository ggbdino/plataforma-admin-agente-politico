import { db } from "@/lib/db";
import type { CandidateListItem } from "@/lib/types";

export async function listCandidates(): Promise<CandidateListItem[]> {
  const result = await db.query<CandidateListItem>(
    `
      select
        c.id_candidato,
        c.nome_urna,
        c.nome_completo,
        c.partido,
        c.cargo_disputado,
        c.estado,
        ic.status_implantacao,
        ic.instancia_evolution,
        ic.numero_agente_oficial,
        ic.qr_code_url,
        ic.atualizado_em::text as implantacao_atualizada_em
      from candidatos c
      left join implantacoes_candidato ic
        on ic.id_candidato = c.id_candidato
      order by c.id_candidato
    `
  );

  return result.rows;
}
