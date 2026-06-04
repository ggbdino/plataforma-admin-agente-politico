import { db } from "@/lib/db";
import { ensureElectorEnrichmentColumns } from "@/lib/repositories/elector-schema";
import type { CampaignEventAttendanceContext, CampaignEventAttendanceItem } from "@/lib/types";

type EventRow = CampaignEventAttendanceItem;

export async function getCampaignEventAttendanceContext(
  idCandidato: string
): Promise<CampaignEventAttendanceContext | null> {
  await ensureElectorEnrichmentColumns();

  const candidateResult = await db.query<{
    id_candidato: string;
    nome_urna: string;
    numero_agente_oficial: string | null;
  }>(
    `
      select
        c.id_candidato,
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
    return null;
  }

  const eventsResult = await db.query<EventRow>(
    `
      select
        e.id::text as id,
        e.nome_evento,
        e.tipo_evento,
        e.data_evento::text as data_evento,
        e.local_nome,
        e.cidade,
        e.uf,
        e.status,
        count(*) filter (
          where p.status_participacao in ('confirmado', 'confirmada')
        )::int as total_confirmados,
        count(*) filter (
          where p.status_participacao in ('presente', 'compareceu')
        )::int as total_presentes
      from eventos_campanha e
      left join participacoes_eventos p
        on p.evento_id = e.id
      where e.id_candidato = $1
      group by e.id
      order by
        case when e.status = 'ativo' then 0 else 1 end,
        e.data_evento desc
      limit 20
    `,
    [idCandidato]
  );

  return {
    id_candidato: candidate.id_candidato,
    nome_urna: candidate.nome_urna,
    numero_agente_oficial: candidate.numero_agente_oficial,
    eventos: eventsResult.rows
  };
}

export async function registerEventAttendanceByPhone(input: {
  idCandidato: string;
  eventoId: string;
  telefone: string;
  nome?: string;
  statusParticipacao: "confirmado" | "presente";
  observacao?: string;
}) {
  await ensureElectorEnrichmentColumns();

  const telefone = normalizePhone(input.telefone);

  if (!telefone) {
    throw new Error("Informe um telefone válido para registrar a participação no evento.");
  }

  const eventResult = await db.query<{
    id: string;
    nome_evento: string;
    cidade: string | null;
    uf: string | null;
  }>(
    `
      select
        id::text as id,
        nome_evento,
        cidade,
        uf
      from eventos_campanha
      where id = $1::uuid
        and id_candidato = $2
      limit 1
    `,
    [input.eventoId, input.idCandidato]
  );

  const event = eventResult.rows[0];

  if (!event) {
    throw new Error("Evento não encontrado para esta campanha.");
  }

  const client = await db.connect();

  try {
    await client.query("begin");

    const electorResult = await client.query<{
      eleitor_uid: string;
      nome: string | null;
    }>(
      `
        select eleitor_uid, nome
        from eleitores
        where id_candidato = $1
          and telefone = $2
        limit 1
      `,
      [input.idCandidato, telefone]
    );

    let eleitorUid = electorResult.rows[0]?.eleitor_uid ?? null;

    if (!eleitorUid) {
      eleitorUid = crypto.randomUUID();

      await client.query(
        `
          insert into eleitores (
            eleitor_uid,
            eleitor_id,
            id_candidato,
            nome,
            telefone,
            cidade,
            uf,
            origem_captacao,
            origem_cidade,
            etapa_funil,
            criado_em,
            atualizado_em
          )
          values (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            'evento_presencial',
            case when nullif($6, '') is not null then 'evento_presencial' else null end,
            'novo_lead',
            now(),
            now()
          )
        `,
        [
          eleitorUid,
          telefone,
          input.idCandidato,
          input.nome?.trim() || "Participante do evento",
          telefone,
          event.cidade,
          event.uf
        ]
      );
    } else if (!electorResult.rows[0]?.nome && input.nome?.trim()) {
      await client.query(
        `
          update eleitores
          set
            nome = $2,
            atualizado_em = now()
          where eleitor_uid = $1
        `,
        [eleitorUid, input.nome.trim()]
      );
    }

    await client.query(
      `
        insert into participacoes_eventos (
          evento_id,
          eleitor_uid,
          eleitor_id,
          id_candidato,
          status_participacao,
          origem_registro,
          canal_registro,
          observacao,
          metadata,
          registrado_em
        )
        values (
          $1::uuid,
          $2,
          $3,
          $4,
          $5,
          'controle_presenca',
          'painel_evento',
          $6,
          $7::jsonb,
          now()
        )
        on conflict (evento_id, eleitor_uid)
        do update set
          status_participacao = excluded.status_participacao,
          origem_registro = excluded.origem_registro,
          canal_registro = excluded.canal_registro,
          observacao = coalesce(excluded.observacao, participacoes_eventos.observacao),
          metadata = coalesce(participacoes_eventos.metadata, '{}'::jsonb) || excluded.metadata,
          registrado_em = now()
      `,
      [
        input.eventoId,
        eleitorUid,
        telefone,
        input.idCandidato,
        input.statusParticipacao,
        input.observacao?.trim() || null,
        JSON.stringify({
          nome_informado: input.nome?.trim() || null,
          telefone_informado: telefone
        })
      ]
    );

    await client.query("commit");

    return {
      nomeEvento: event.nome_evento,
      eleitorUid,
      telefone
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

function normalizePhone(value: string) {
  return String(value ?? "").replace(/\D/g, "");
}
