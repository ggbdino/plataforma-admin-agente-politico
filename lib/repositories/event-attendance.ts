import { db } from "@/lib/db";
import { ensureElectorEnrichmentColumns } from "@/lib/repositories/elector-schema";
import type {
  CampaignActiveEventSnapshot,
  CampaignEventAttendanceContext,
  CampaignEventAttendanceItem
} from "@/lib/types";

type EventRow = CampaignEventAttendanceItem;

export async function getCampaignEventAttendanceContext(
  idCandidato: string
): Promise<CampaignEventAttendanceContext | null> {
  await ensureElectorEnrichmentColumns();

  const candidateResult = await db.query<{
    id_candidato: string;
    nome_urna: string;
    numero_agente_oficial: string | null;
    qr_code_url: string | null;
  }>(
    `
      select
        c.id_candidato,
        c.nome_urna,
        ic.numero_agente_oficial,
        coalesce(
          official.metadata ->> 'qr_code_url',
          case
            when official.url_canal is not null and btrim(official.url_canal) <> ''
              then 'https://api.qrserver.com/v1/create-qr-code/?size=800x800&data=' || replace(official.url_canal, '&', '%26')
            else ic.qr_code_url
          end
        ) as qr_code_url
      from candidatos c
      left join implantacoes_candidato ic
        on ic.id_candidato = c.id_candidato
      left join lateral (
        select
          url_canal,
          metadata
        from canais_integracao ci
        where ci.id_candidato = c.id_candidato
          and ci.tipo_canal = 'whatsapp_agente'
        order by ci.atualizado_em desc
        limit 1
      ) official on true
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
    qr_code_url: candidate.qr_code_url,
    eventos: eventsResult.rows
  };
}

export async function getActiveCampaignEvent(
  idCandidato: string,
  referenceTime = new Date()
): Promise<CampaignActiveEventSnapshot> {
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
        and e.data_evento <= $2::timestamptz
        and e.data_evento + interval '4 hours' >= $2::timestamptz
        and coalesce(e.status, 'ativo') <> 'cancelado'
      group by e.id
      order by
        case when e.status = 'ativo' then 0 else 1 end,
        e.data_evento desc
      limit 1
    `,
    [idCandidato, referenceTime.toISOString()]
  );

  return {
    ativo: eventsResult.rows.length > 0,
    evento: eventsResult.rows[0] ?? null
  };
}

export async function registerEventAttendanceByPhone(input: {
  idCandidato: string;
  eventoId: string;
  telefone: string;
  nome?: string;
  cidade?: string;
  observacao?: string;
}) {
  await ensureElectorEnrichmentColumns();

  const telefone = normalizePhone(input.telefone);
  const nome = normalizeText(input.nome);
  const cidadeInformada = normalizeText(input.cidade);
  const observacao = normalizeText(input.observacao);

  if (!telefone) {
    throw new Error("Informe um telefone válido para registrar a participação no evento.");
  }

  const eventResult = await db.query<{
    id: string;
    nome_evento: string;
    cidade: string | null;
    uf: string | null;
    data_evento: string;
  }>(
    `
      select
        id::text as id,
        nome_evento,
        cidade,
        uf,
        data_evento::text as data_evento
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
      cidade: string | null;
    }>(
      `
        select eleitor_uid, nome, cidade
        from eleitores
        where id_candidato = $1
          and telefone = $2
        limit 1
      `,
      [input.idCandidato, telefone]
    );

    let eleitorUid = electorResult.rows[0]?.eleitor_uid ?? null;
    let createdNewElector = false;

    if (!eleitorUid) {
      if (!nome || !cidadeInformada) {
        throw new Error(
          "Para novos cadastros, informe nome, telefone e cidade antes de concluir a entrada no evento."
        );
      }

      eleitorUid = crypto.randomUUID();
      createdNewElector = true;

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
            'evento_presencial',
            'novo_lead',
            now(),
            now()
          )
        `,
        [eleitorUid, telefone, input.idCandidato, nome, telefone, cidadeInformada, event.uf]
      );
    } else {
      const currentName = normalizeText(electorResult.rows[0].nome);
      const currentCity = normalizeText(electorResult.rows[0].cidade);

      if (!currentName && nome) {
        await client.query(
          `
            update eleitores
            set
              nome = $2,
              atualizado_em = now()
            where eleitor_uid = $1
          `,
          [eleitorUid, nome]
        );
      }

      if (!currentCity && cidadeInformada) {
        await client.query(
          `
            update eleitores
            set
              cidade = $2,
              origem_cidade = 'evento_presencial',
              atualizado_em = now()
            where eleitor_uid = $1
          `,
          [eleitorUid, cidadeInformada]
        );
      }
    }

    const shouldCountAsAttendance = isInsideAttendanceWindow(event.data_evento);

    if (shouldCountAsAttendance) {
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
            'presente',
            'controle_presenca',
            'painel_evento',
            $5,
            $6::jsonb,
            now()
          )
          on conflict (evento_id, eleitor_uid)
          do update set
            status_participacao = 'presente',
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
          observacao,
          JSON.stringify({
            nome_informado: nome,
            cidade_informada: cidadeInformada,
            telefone_informado: telefone,
            janela_evento: "presente_automatico"
          })
        ]
      );
    }

    await client.query("commit");

    return {
      nomeEvento: event.nome_evento,
      telefone,
      createdNewElector,
      linkedToEvent: shouldCountAsAttendance
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function confirmActiveEventAttendanceByPhone(input: {
  idCandidato: string;
  telefone: string;
  nome?: string;
  cidade?: string;
  observacao?: string;
  confirmouParticipacao?: boolean;
}) {
  const activeEvent = await getActiveCampaignEvent(input.idCandidato);

  if (!activeEvent.evento) {
    return {
      eventoAtivo: false,
      presencaRegistrada: false,
      evento: null,
      motivo: "nenhum_evento_ativo"
    };
  }

  if (!input.confirmouParticipacao) {
    return {
      eventoAtivo: true,
      presencaRegistrada: false,
      evento: activeEvent.evento,
      motivo: "confirmacao_nao_informada"
    };
  }

  const result = await registerEventAttendanceByPhone({
    idCandidato: input.idCandidato,
    eventoId: activeEvent.evento.id,
    telefone: input.telefone,
    nome: input.nome,
    cidade: input.cidade,
    observacao: input.observacao
  });

  return {
    eventoAtivo: true,
    presencaRegistrada: result.linkedToEvent,
    evento: activeEvent.evento,
    motivo: result.linkedToEvent ? "presenca_confirmada" : "fora_da_janela",
    resultado: result
  };
}

function normalizePhone(value: string) {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeText(value: string | undefined | null) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function isInsideAttendanceWindow(eventDate: string) {
  const eventTime = new Date(eventDate).getTime();
  const now = Date.now();
  const fourHoursInMs = 4 * 60 * 60 * 1000;

  return now >= eventTime && now <= eventTime + fourHoursInMs;
}
