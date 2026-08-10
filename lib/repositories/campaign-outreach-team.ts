import { db } from "@/lib/db";

export type OutreachMember = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  uf: string | null;
  bairro: string | null;
  grupo: string | null;
  papel: string | null;
  status: string;
  total_tarefas: number;
  tarefas_concluidas: number;
  percentual_realizacao: number;
};

export type OutreachTask = {
  id: string;
  titulo: string;
  tipo_tarefa: string;
  descricao: string | null;
  localidade: string | null;
  cidade: string | null;
  uf: string | null;
  meta_quantidade: number;
  data_inicio: string | null;
  data_limite: string | null;
  status: string;
  total_membros: number;
  realizado_total: number;
  percentual_realizacao: number;
};

export type OutreachTeamContext = {
  id_candidato: string;
  nome_urna: string;
  numero_agente_oficial: string | null;
  membros: OutreachMember[];
  tarefas: OutreachTask[];
  resumo: {
    total_membros: number;
    membros_ativos: number;
    tarefas_ativas: number;
    tarefas_concluidas: number;
    percentual_realizacao_medio: number;
  };
};

export type OutreachIntelligenceSnapshot = {
  resumo: OutreachTeamContext["resumo"];
  tarefas: OutreachTask[];
  membros: OutreachMember[];
};

type ParsedMember = {
  nome: string;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  uf: string | null;
  bairro: string | null;
  grupo: string | null;
  papel: string | null;
};

const TASK_TYPES = new Set([
  "inserir_contatos",
  "convidar_eventos",
  "captar_eleitores",
  "visitar_locais",
  "participar_reunioes",
  "panfletar",
  "divulgar_localidade",
  "outros"
]);

export async function getOutreachTeamContext(idCandidato: string): Promise<OutreachTeamContext | null> {
  await ensureOutreachTables();

  const candidateResult = await db.query<{ id_candidato: string; nome_urna: string; numero_agente_oficial: string | null }>(
    `
      select c.id_candidato, coalesce(c.nome_urna, c.nome_completo, c.id_candidato) as nome_urna,
             ic.numero_agente_oficial
      from candidatos c
      left join implantacoes_candidato ic on ic.id_candidato = c.id_candidato
      where c.id_candidato = $1
    `,
    [idCandidato]
  );
  const candidate = candidateResult.rows[0];
  if (!candidate) return null;

  const [membersResult, tasksResult] = await Promise.all([
    db.query<OutreachMember>(
      `
        with member_tasks as (
          select
            tm.membro_id,
            count(*)::int as total_tarefas,
            count(*) filter (where tm.status = 'concluida')::int as tarefas_concluidas,
            coalesce(round(avg(tm.percentual_realizacao)::numeric, 2), 0) as percentual_realizacao
          from campanha_divulgacao_tarefa_membros tm
          join campanha_divulgacao_tarefas t on t.id = tm.tarefa_id
          where t.id_candidato = $1
          group by tm.membro_id
        )
        select m.id::text, m.nome, m.telefone, m.email, m.cidade, m.uf, m.bairro, m.grupo, m.papel, m.status,
               coalesce(mt.total_tarefas, 0) as total_tarefas,
               coalesce(mt.tarefas_concluidas, 0) as tarefas_concluidas,
               coalesce(mt.percentual_realizacao, 0) as percentual_realizacao
        from campanha_divulgacao_membros m
        left join member_tasks mt on mt.membro_id = m.id
        where m.id_candidato = $1
        order by m.status desc, lower(m.nome)
      `,
      [idCandidato]
    ),
    db.query<OutreachTask>(
      `
        select t.id::text, t.titulo, t.tipo_tarefa, t.descricao, t.localidade, t.cidade, t.uf,
               t.meta_quantidade, t.data_inicio::text as data_inicio, t.data_limite::text as data_limite, t.status,
               count(tm.membro_id)::int as total_membros,
               coalesce(sum(tm.realizado_quantidade), 0)::int as realizado_total,
               case
                 when coalesce(t.meta_quantidade, 0) <= 0 then coalesce(round(avg(tm.percentual_realizacao)::numeric, 2), 0)
                 else least(round((coalesce(sum(tm.realizado_quantidade), 0)::numeric / greatest(t.meta_quantidade, 1)::numeric) * 100, 2), 100)
               end as percentual_realizacao
        from campanha_divulgacao_tarefas t
        left join campanha_divulgacao_tarefa_membros tm on tm.tarefa_id = t.id
        where t.id_candidato = $1
        group by t.id
        order by case t.status when 'ativa' then 1 when 'planejada' then 2 when 'concluida' then 3 else 4 end,
                 coalesce(t.data_limite, t.criado_em) asc
      `,
      [idCandidato]
    )
  ]);

  const tarefasAtivas = tasksResult.rows.filter((task) => task.status !== "concluida" && task.status !== "cancelada");
  const tarefasConcluidas = tasksResult.rows.filter((task) => task.status === "concluida");
  const percentualRealizacaoMedio = tasksResult.rows.length === 0
    ? 0
    : Number((tasksResult.rows.reduce((sum, task) => sum + Number(task.percentual_realizacao || 0), 0) / tasksResult.rows.length).toFixed(2));

  return {
    id_candidato: candidate.id_candidato,
    nome_urna: candidate.nome_urna,
    numero_agente_oficial: candidate.numero_agente_oficial,
    membros: membersResult.rows,
    tarefas: tasksResult.rows,
    resumo: {
      total_membros: membersResult.rows.length,
      membros_ativos: membersResult.rows.filter((member) => member.status === "ativo").length,
      tarefas_ativas: tarefasAtivas.length,
      tarefas_concluidas: tarefasConcluidas.length,
      percentual_realizacao_medio: percentualRealizacaoMedio
    }
  };
}

export async function getOutreachIntelligenceSnapshot(idCandidato: string): Promise<OutreachIntelligenceSnapshot> {
  const context = await getOutreachTeamContext(idCandidato);
  return {
    resumo: context?.resumo ?? {
      total_membros: 0,
      membros_ativos: 0,
      tarefas_ativas: 0,
      tarefas_concluidas: 0,
      percentual_realizacao_medio: 0
    },
    tarefas: context?.tarefas ?? [],
    membros: context?.membros ?? []
  };
}

export async function importOutreachTeamMembers(input: {
  idCandidato: string;
  csvText: string;
  origemImportacao: string;
}) {
  await ensureOutreachTables();
  const parsed = parseMembersCsv(input.csvText);
  let importados = 0;
  let atualizados = 0;
  let ignorados = 0;
  const ignoradosPorMotivo: Record<string, number> = {};

  for (const member of parsed) {
    if (!member.nome || !member.telefone) {
      ignorados += 1;
      ignoradosPorMotivo.nome_ou_telefone_obrigatorio = (ignoradosPorMotivo.nome_ou_telefone_obrigatorio ?? 0) + 1;
      continue;
    }

    const result = await db.query<{ inserted: boolean }>(
      `
        insert into campanha_divulgacao_membros (
          id_candidato, nome, telefone, email, cidade, uf, bairro, grupo, papel, status, origem_importacao, atualizado_em
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ativo', $10, now())
        on conflict (id_candidato, telefone) where telefone is not null
        do update set
          nome = excluded.nome,
          email = coalesce(excluded.email, campanha_divulgacao_membros.email),
          cidade = coalesce(excluded.cidade, campanha_divulgacao_membros.cidade),
          uf = coalesce(excluded.uf, campanha_divulgacao_membros.uf),
          bairro = coalesce(excluded.bairro, campanha_divulgacao_membros.bairro),
          grupo = coalesce(excluded.grupo, campanha_divulgacao_membros.grupo),
          papel = coalesce(excluded.papel, campanha_divulgacao_membros.papel),
          status = 'ativo',
          origem_importacao = excluded.origem_importacao,
          atualizado_em = now()
        returning (xmax = 0) as inserted
      `,
      [
        input.idCandidato,
        member.nome,
        member.telefone,
        member.email,
        member.cidade,
        member.uf,
        member.bairro,
        member.grupo,
        member.papel,
        input.origemImportacao
      ]
    );

    if (result.rows[0]?.inserted) importados += 1;
    else atualizados += 1;
  }

  return { importados, atualizados, ignorados, ignoradosPorMotivo };
}

export async function createOutreachTask(input: {
  idCandidato: string;
  titulo: string;
  tipoTarefa: string;
  descricao?: string | null;
  localidade?: string | null;
  cidade?: string | null;
  uf?: string | null;
  metaQuantidade?: string | number | null;
  dataInicio?: string | null;
  dataLimite?: string | null;
  memberIds: string[];
  createdByEmail: string;
}) {
  await ensureOutreachTables();
  const titulo = normalizeText(input.titulo);
  if (!titulo) throw new Error("Informe o título da tarefa de divulgação.");

  const tipoTarefa = TASK_TYPES.has(input.tipoTarefa) ? input.tipoTarefa : "outros";
  const metaQuantidade = normalizeNumber(input.metaQuantidade);
  const selectedMemberIds = input.memberIds.filter(Boolean);
  const targetMembers = selectedMemberIds.length > 0
    ? selectedMemberIds
    : await listActiveMemberIds(input.idCandidato);

  if (targetMembers.length === 0) {
    throw new Error("Importe ou selecione pelo menos um membro da Equipe de Divulgação antes de criar a tarefa.");
  }

  const taskResult = await db.query<{ id: string }>(
    `
      insert into campanha_divulgacao_tarefas (
        id_candidato, titulo, tipo_tarefa, descricao, localidade, cidade, uf,
        meta_quantidade, data_inicio, data_limite, status, criado_por_email, atualizado_em
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8,
        nullif($9, '')::timestamptz, nullif($10, '')::timestamptz,
        'ativa', $11, now()
      ) returning id::text as id
    `,
    [
      input.idCandidato,
      titulo,
      tipoTarefa,
      normalizeText(input.descricao),
      normalizeText(input.localidade),
      normalizeText(input.cidade),
      normalizeUf(input.uf),
      metaQuantidade,
      input.dataInicio || null,
      input.dataLimite || null,
      input.createdByEmail
    ]
  );

  const taskId = taskResult.rows[0].id;
  await db.query(
    `
      insert into campanha_divulgacao_tarefa_membros (tarefa_id, membro_id, meta_individual, status, atualizado_em)
      select $1::uuid, id, $3::int, 'pendente', now()
      from campanha_divulgacao_membros
      where id_candidato = $2
        and id::text = any($4::text[])
      on conflict (tarefa_id, membro_id) do nothing
    `,
    [taskId, input.idCandidato, Math.max(Math.ceil(metaQuantidade / Math.max(targetMembers.length, 1)), 0), targetMembers]
  );

  return { taskId, totalMembros: targetMembers.length };
}

export async function recordOutreachEvidence(input: {
  idCandidato: string;
  taskId: string;
  memberPhone?: string | null;
  memberId?: string | null;
  mensagem: string;
  quantidadeValidada?: string | number | null;
  canal?: string | null;
  origem?: string | null;
}) {
  await ensureOutreachTables();
  const member = await resolveEvidenceMember(input.idCandidato, input.memberId, input.memberPhone);
  if (!member) throw new Error("Membro da Equipe de Divulgação não localizado para registrar a evidência.");

  const quantidade = normalizeNumber(input.quantidadeValidada ?? 1);
  await db.query(
    `
      insert into campanha_divulgacao_evidencias (
        tarefa_id, membro_id, canal, mensagem, quantidade_validada, status_validacao, origem, criado_em
      ) values ($1::uuid, $2::uuid, $3, $4, $5, 'validada', $6, now())
    `,
    [input.taskId, member.id, normalizeText(input.canal) || "whatsapp", normalizeText(input.mensagem), quantidade, normalizeText(input.origem) || "whatsapp_candidato"]
  );

  await db.query(
    `
      update campanha_divulgacao_tarefa_membros tm
      set realizado_quantidade = coalesce(tm.realizado_quantidade, 0) + $3,
          percentual_realizacao = case
            when coalesce(tm.meta_individual, 0) <= 0 then 100
            else least(round(((coalesce(tm.realizado_quantidade, 0) + $3)::numeric / greatest(tm.meta_individual, 1)::numeric) * 100, 2), 100)
          end,
          status = case
            when coalesce(tm.meta_individual, 0) <= 0 or coalesce(tm.realizado_quantidade, 0) + $3 >= tm.meta_individual then 'concluida'
            else 'em_andamento'
          end,
          atualizado_em = now()
      where tm.tarefa_id = $1::uuid and tm.membro_id = $2::uuid
    `,
    [input.taskId, member.id, quantidade]
  );
}

async function resolveEvidenceMember(idCandidato: string, memberId?: string | null, memberPhone?: string | null) {
  const normalizedPhone = normalizePhone(memberPhone);
  const result = await db.query<{ id: string }>(
    `
      select id::text as id
      from campanha_divulgacao_membros
      where id_candidato = $1
        and (($2::uuid is not null and id = $2::uuid) or ($3::text is not null and telefone = $3::text))
      limit 1
    `,
    [idCandidato, memberId || null, normalizedPhone]
  );
  return result.rows[0] ?? null;
}

async function listActiveMemberIds(idCandidato: string) {
  const result = await db.query<{ id: string }>(
    `select id::text as id from campanha_divulgacao_membros where id_candidato = $1 and status = 'ativo' order by nome`,
    [idCandidato]
  );
  return result.rows.map((row) => row.id);
}

export async function ensureOutreachTables() {
  await db.query(`create extension if not exists pgcrypto`);
  await db.query(`
    create table if not exists campanha_divulgacao_membros (
      id uuid primary key default gen_random_uuid(),
      id_candidato varchar(120) not null references candidatos(id_candidato) on delete cascade,
      nome text not null,
      telefone text,
      email text,
      cidade text,
      uf text,
      bairro text,
      grupo text,
      papel text,
      status text not null default 'ativo',
      origem_importacao text,
      metadata jsonb not null default '{}'::jsonb,
      criado_em timestamptz not null default now(),
      atualizado_em timestamptz not null default now()
    )
  `);
  await db.query(`
    create unique index if not exists campanha_divulgacao_membros_candidato_telefone_idx
    on campanha_divulgacao_membros (id_candidato, telefone)
    where telefone is not null
  `);
  await db.query(`
    create table if not exists campanha_divulgacao_tarefas (
      id uuid primary key default gen_random_uuid(),
      id_candidato varchar(120) not null references candidatos(id_candidato) on delete cascade,
      titulo text not null,
      tipo_tarefa text not null,
      descricao text,
      localidade text,
      cidade text,
      uf text,
      meta_quantidade integer not null default 0,
      data_inicio timestamptz,
      data_limite timestamptz,
      status text not null default 'ativa',
      criado_por_email text,
      criado_em timestamptz not null default now(),
      atualizado_em timestamptz not null default now()
    )
  `);
  await db.query(`
    create table if not exists campanha_divulgacao_tarefa_membros (
      tarefa_id uuid not null references campanha_divulgacao_tarefas(id) on delete cascade,
      membro_id uuid not null references campanha_divulgacao_membros(id) on delete cascade,
      meta_individual integer not null default 0,
      realizado_quantidade integer not null default 0,
      percentual_realizacao numeric not null default 0,
      status text not null default 'pendente',
      atualizado_em timestamptz not null default now(),
      primary key (tarefa_id, membro_id)
    )
  `);
  await db.query(`
    create table if not exists campanha_divulgacao_evidencias (
      id uuid primary key default gen_random_uuid(),
      tarefa_id uuid not null references campanha_divulgacao_tarefas(id) on delete cascade,
      membro_id uuid not null references campanha_divulgacao_membros(id) on delete cascade,
      canal text not null default 'whatsapp',
      mensagem text,
      quantidade_validada integer not null default 1,
      status_validacao text not null default 'pendente',
      origem text,
      criado_em timestamptz not null default now()
    )
  `);
}

function parseMembersCsv(text: string): ParsedMember[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const delimiter = lines[0].includes(";") ? ";" : ",";
  const headers = splitCsvLine(lines[0], delimiter).map(normalizeHeader);

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line, delimiter);
    const row = new Map<string, string>();
    headers.forEach((header, index) => row.set(header, values[index] ?? ""));
    return {
      nome: normalizeText(row.get("nome") || row.get("nome_completo")) || "",
      telefone: normalizePhone(row.get("telefone") || row.get("celular") || row.get("whatsapp")),
      email: normalizeText(row.get("email") || row.get("e_mail")),
      cidade: normalizeText(row.get("cidade")),
      uf: normalizeUf(row.get("uf") || row.get("estado")),
      bairro: normalizeText(row.get("bairro") || row.get("regiao")),
      grupo: normalizeText(row.get("grupo")),
      papel: normalizeText(row.get("papel") || row.get("funcao"))
    };
  });
}

function splitCsvLine(line: string, delimiter: string) {
  const result: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === delimiter && !quoted) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  result.push(current.trim());
  return result;
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeText(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function normalizeUf(value: unknown) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

function normalizePhone(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55") && digits.length >= 12 && digits.length <= 13) return digits;
  if (digits.length >= 10 && digits.length <= 11) return `55${digits}`;
  return digits.length >= 8 ? digits : null;
}

function normalizeNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.trunc(parsed);
}
