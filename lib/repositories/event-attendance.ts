import type { PoolClient } from "pg";
import { db } from "@/lib/db";
import { ensureElectorEnrichmentColumns } from "@/lib/repositories/elector-schema";
import type {
  CampaignActiveEventSnapshot,
  CampaignAttendanceElectorLookup,
  CampaignEventAttendanceContext,
  CampaignEventAttendanceItem,
  CampaignEventConfirmationContext
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

  const events = await listCampaignEvents(idCandidato);

  return {
    id_candidato: candidate.id_candidato,
    nome_urna: candidate.nome_urna,
    numero_agente_oficial: candidate.numero_agente_oficial,
    qr_code_url: candidate.qr_code_url,
    eventos: events
  };
}

export async function getCampaignEventConfirmationContext(
  idCandidato: string,
  eventId: string
): Promise<CampaignEventConfirmationContext | null> {
  await ensureElectorEnrichmentColumns();

  const result = await db.query<{
    id_candidato: string;
    nome_urna: string;
    nome_completo: string | null;
    partido: string | null;
    cargo_disputado: string | null;
    numero_agente_oficial: string | null;
    qr_code_url: string | null;
    evento_id: string | null;
  }>(
    `
      select
        c.id_candidato,
        c.nome_urna,
        c.nome_completo,
        c.partido,
        c.cargo_disputado,
        ic.numero_agente_oficial,
        coalesce(
          official.metadata ->> 'qr_code_url',
          case
            when official.url_canal is not null and btrim(official.url_canal) <> ''
              then 'https://api.qrserver.com/v1/create-qr-code/?size=800x800&data=' || replace(official.url_canal, '&', '%26')
            else ic.qr_code_url
          end
        ) as qr_code_url,
        e.id::text as evento_id
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
      left join eventos_campanha e
        on e.id_candidato = c.id_candidato
       and e.id = $2::uuid
      where c.id_candidato = $1
      limit 1
    `,
    [idCandidato, eventId]
  );

  const candidate = result.rows[0];

  if (!candidate || !candidate.evento_id) {
    return null;
  }

  const events = await listCampaignEvents(idCandidato, eventId);
  const event = events.find((item) => item.id === eventId) ?? null;

  return {
    id_candidato: candidate.id_candidato,
    nome_urna: candidate.nome_urna,
    nome_completo: candidate.nome_completo,
    partido: candidate.partido,
    cargo_disputado: candidate.cargo_disputado,
    numero_agente_oficial: candidate.numero_agente_oficial,
    qr_code_url: candidate.qr_code_url,
    evento: event
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

export async function findCampaignElectorByPhone(
  idCandidato: string,
  telefoneInformado: string
): Promise<CampaignAttendanceElectorLookup | null> {
  const telefone = normalizePhone(telefoneInformado);

  if (!telefone) {
    return null;
  }

  const result = await db.query<CampaignAttendanceElectorLookup>(
    `
      select
        eleitor_uid,
        nome,
        telefone,
        cidade,
        uf
      from eleitores
      where id_candidato = $1
        and telefone = $2
      limit 1
    `,
    [idCandidato, telefone]
  );

  return result.rows[0] ?? null;
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

  const event = await getScopedEvent(input.idCandidato, input.eventoId);

  if (!event) {
    throw new Error("Evento não encontrado para esta campanha.");
  }

  const client = await db.connect();

  try {
    await client.query("begin");

    const electorState = await upsertElectorForEvent(client, {
      idCandidato: input.idCandidato,
      telefone,
      nome,
      cidadeInformada,
      eventUf: event.uf
    });

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
          electorState.eleitorUid,
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
      nomeEleitor: electorState.nomeAtual,
      telefone,
      createdNewElector: electorState.createdNewElector,
      linkedToEvent: shouldCountAsAttendance
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function registerEventConfirmationByPhone(input: {
  idCandidato: string;
  eventoId: string;
  telefone: string;
  nome: string;
  cidade: string;
  observacao?: string;
}) {
  await ensureElectorEnrichmentColumns();

  const telefone = normalizePhone(input.telefone);
  const nome = normalizeText(input.nome);
  const cidadeInformada = normalizeText(input.cidade);
  const observacao = normalizeText(input.observacao);

  if (!telefone) {
    throw new Error("Informe um telefone válido para confirmar participação.");
  }

  if (!nome || !cidadeInformada) {
    throw new Error("Informe nome, telefone e cidade para confirmar participação no evento.");
  }

  const event = await getScopedEvent(input.idCandidato, input.eventoId);

  if (!event) {
    throw new Error("Evento não encontrado para esta campanha.");
  }

  const client = await db.connect();

  try {
    await client.query("begin");

    const electorState = await upsertElectorForEvent(client, {
      idCandidato: input.idCandidato,
      telefone,
      nome,
      cidadeInformada,
      eventUf: event.uf
    });

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
          'confirmado',
          'pagina_confirmacao_evento',
          'pagina_evento',
          $5,
          $6::jsonb,
          now()
        )
        on conflict (evento_id, eleitor_uid)
        do update set
          status_participacao = case
            when participacoes_eventos.status_participacao in ('presente', 'compareceu')
              then participacoes_eventos.status_participacao
            else 'confirmado'
          end,
          origem_registro = case
            when participacoes_eventos.status_participacao in ('presente', 'compareceu')
              then participacoes_eventos.origem_registro
            else excluded.origem_registro
          end,
          canal_registro = case
            when participacoes_eventos.status_participacao in ('presente', 'compareceu')
              then participacoes_eventos.canal_registro
            else excluded.canal_registro
          end,
          observacao = coalesce(excluded.observacao, participacoes_eventos.observacao),
          metadata = coalesce(participacoes_eventos.metadata, '{}'::jsonb) || excluded.metadata,
          registrado_em = now()
      `,
      [
        input.eventoId,
        electorState.eleitorUid,
        telefone,
        input.idCandidato,
        observacao,
        JSON.stringify({
          nome_informado: nome,
          cidade_informada: cidadeInformada,
          telefone_informado: telefone,
          origem_confirmacao: "pagina_publica_evento"
        })
      ]
    );

    await client.query("commit");

    return {
      nomeEvento: event.nome_evento,
      nomeEleitor: electorState.nomeAtual,
      telefone,
      createdNewElector: electorState.createdNewElector
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

async function listCampaignEvents(idCandidato: string, eventId?: string) {
  const values: string[] = [idCandidato];
  const eventFilter = eventId ? "and e.id = $2::uuid" : "";

  if (eventId) {
    values.push(eventId);
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
        ${eventFilter}
      group by e.id
      order by
        case when e.status = 'ativo' then 0 else 1 end,
        e.data_evento desc
      limit 20
    `,
    values
  );

  return eventsResult.rows;
}

async function getScopedEvent(idCandidato: string, eventId: string) {
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
    [eventId, idCandidato]
  );

  return eventResult.rows[0] ?? null;
}

async function upsertElectorForEvent(
  client: PoolClient,
  input: {
    idCandidato: string;
    telefone: string;
    nome: string | null;
    cidadeInformada: string | null;
    eventUf: string | null;
  }
) {
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
    [input.idCandidato, input.telefone]
  );

  let eleitorUid = electorResult.rows[0]?.eleitor_uid ?? null;
  let createdNewElector = false;

  if (!eleitorUid) {
    if (!input.nome || !input.cidadeInformada) {
      throw new Error(
        "Para novos cadastros, informe nome, telefone e cidade antes de concluir o registro do evento."
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
      [
        eleitorUid,
        input.telefone,
        input.idCandidato,
        input.nome,
        input.telefone,
        input.cidadeInformada,
        input.eventUf
      ]
    );
  } else {
    const currentName = normalizeText(electorResult.rows[0].nome);
    const currentCity = normalizeText(electorResult.rows[0].cidade);

    if (!currentName && input.nome) {
      await client.query(
        `
          update eleitores
          set
            nome = $2,
            atualizado_em = now()
          where eleitor_uid = $1
        `,
        [eleitorUid, input.nome]
      );
    }

    if (!currentCity && input.cidadeInformada) {
      await client.query(
        `
          update eleitores
          set
            cidade = $2,
            origem_cidade = 'evento_presencial',
            atualizado_em = now()
          where eleitor_uid = $1
        `,
        [eleitorUid, input.cidadeInformada]
      );
    }
  }

  return {
    eleitorUid,
    createdNewElector,
    nomeAtual: input.nome ?? electorResult.rows[0]?.nome ?? null
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
