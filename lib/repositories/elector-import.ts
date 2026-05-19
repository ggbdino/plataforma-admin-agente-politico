import { db } from "@/lib/db";

type ParsedElectorRow = {
  nome: string;
  telefone: string;
  email: string;
};

type ImportSummary = {
  importados: number;
  atualizados: number;
  ignorados: number;
};

export async function importCampaignElectorBase(
  idCandidato: string,
  rawFileContents: string,
  origemCaptacao = "importacao_admin"
): Promise<ImportSummary> {
  const rows = parseElectorCsv(rawFileContents);

  if (rows.length === 0) {
    throw new Error("A planilha nao trouxe linhas validas para importacao.");
  }

  const client = await db.connect();

  try {
    await client.query("begin");

    const columnResult = await client.query<{ column_name: string }>(
      `
        select column_name
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'eleitores'
      `
    );

    const columns = new Set(columnResult.rows.map((row) => row.column_name));
    const hasEmailColumn = columns.has("email");

    let importados = 0;
    let atualizados = 0;
    let ignorados = 0;

    for (const row of rows) {
      if (!row.telefone && !row.email) {
        ignorados += 1;
        continue;
      }

      const lookup = await client.query<{ eleitor_uid: string }>(
        buildLookupQuery(hasEmailColumn, Boolean(row.telefone), Boolean(row.email)),
        buildLookupValues(idCandidato, row.telefone, row.email)
      );

      if (lookup.rows[0]?.eleitor_uid) {
        await client.query(
          buildUpdateQuery(hasEmailColumn),
          buildUpdateValues(
            lookup.rows[0].eleitor_uid,
            row.nome,
            row.telefone,
            row.email,
            origemCaptacao
          )
        );
        atualizados += 1;
        continue;
      }

      await client.query(
        buildInsertQuery(hasEmailColumn),
        buildInsertValues(idCandidato, row, origemCaptacao, hasEmailColumn)
      );
      importados += 1;
    }

    await client.query("commit");

    return {
      importados,
      atualizados,
      ignorados
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

function parseElectorCsv(rawFileContents: string): ParsedElectorRow[] {
  const text = rawFileContents.replace(/^\uFEFF/, "").trim();

  if (!text) {
    return [];
  }

  const delimiter = detectDelimiter(text);
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = splitDelimitedLine(lines[0], delimiter).map(normalizeHeader);
  const nomeIndex = findHeaderIndex(headers, ["nome", "nome completo", "nome_completo"]);
  const telefoneIndex = findHeaderIndex(headers, ["telefone", "celular", "whatsapp", "fone"]);
  const emailIndex = findHeaderIndex(headers, ["email", "e-mail", "mail"]);

  if (nomeIndex < 0 && telefoneIndex < 0 && emailIndex < 0) {
    throw new Error("Nao foi possivel identificar colunas de nome, telefone ou email na planilha.");
  }

  return lines.slice(1).map((line) => {
    const values = splitDelimitedLine(line, delimiter);

    return {
      nome: sanitizeCell(values[nomeIndex]),
      telefone: normalizePhone(values[telefoneIndex]),
      email: normalizeEmail(values[emailIndex])
    };
  });
}

function detectDelimiter(text: string) {
  const header = text.split(/\r?\n/, 1)[0] ?? "";
  const candidates = [";", ",", "\t"];

  return candidates
    .map((delimiter) => ({
      delimiter,
      count: header.split(delimiter).length
    }))
    .sort((left, right) => right.count - left.count)[0]?.delimiter ?? ";";
}

function splitDelimitedLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (insideQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
        continue;
      }

      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === delimiter && !insideQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());

  return values;
}

function normalizeHeader(value: string | undefined) {
  return sanitizeCell(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function findHeaderIndex(headers: string[], aliases: string[]) {
  return headers.findIndex((header) => aliases.includes(header));
}

function sanitizeCell(value: string | undefined) {
  return String(value ?? "").trim();
}

function normalizePhone(value: string | undefined) {
  return sanitizeCell(value).replace(/\D/g, "");
}

function normalizeEmail(value: string | undefined) {
  return sanitizeCell(value).toLowerCase();
}

function buildLookupQuery(hasEmailColumn: boolean, hasPhone: boolean, hasEmail: boolean) {
  const conditions: string[] = [];
  let paramIndex = 2;

  if (hasPhone) {
    conditions.push(`coalesce(telefone, '') = $${paramIndex}`);
    paramIndex += 1;
  }

  if (hasEmailColumn && hasEmail) {
    conditions.push(`lower(coalesce(email, '')) = $${paramIndex}`);
  }

  if (conditions.length === 0) {
    return `
      select eleitor_uid
      from eleitores
      where id_candidato = $1
        and 1 = 0
      limit 1
    `;
  }

  return `
    select eleitor_uid
    from eleitores
    where id_candidato = $1
      and (${conditions.join(" or ")})
    limit 1
  `;
}

function buildLookupValues(idCandidato: string, telefone: string, email: string) {
  const values: string[] = [idCandidato];

  if (telefone) {
    values.push(telefone);
  }

  if (email) {
    values.push(email);
  }

  return values;
}

function buildUpdateQuery(hasEmailColumn: boolean) {
  return `
    update eleitores
    set
      nome = case when nullif($2, '') is not null then $2 else nome end,
      telefone = case when nullif($3, '') is not null then $3 else telefone end,
      ${hasEmailColumn ? "email = case when nullif($4, '') is not null then $4 else email end," : ""}
      origem_captacao = case
        when coalesce(nullif(origem_captacao, ''), '') = '' then $5
        else origem_captacao
      end,
      atualizado_em = now()
    where eleitor_uid = $1
  `;
}

function buildUpdateValues(
  eleitorUid: string,
  nome: string,
  telefone: string,
  email: string,
  origemCaptacao: string
) {
  return [eleitorUid, nome, telefone, email, origemCaptacao];
}

function buildInsertQuery(hasEmailColumn: boolean) {
  const columns = [
    "eleitor_uid",
    "eleitor_id",
    "id_candidato",
    "nome",
    "telefone",
    "origem_captacao",
    "etapa_funil",
    "criado_em",
    "atualizado_em"
  ];

  const valuePlaceholders = [
    "$1",
    "$2",
    "$3",
    "$4",
    "$5",
    "$6",
    "$7",
    "now()",
    "now()"
  ];

  if (hasEmailColumn) {
    columns.splice(5, 0, "email");
    valuePlaceholders.splice(5, 0, "$6");
    valuePlaceholders[6] = "$7";
    valuePlaceholders[7] = "$8";
  }

  return `
    insert into eleitores (${columns.join(", ")})
    values (${valuePlaceholders.join(", ")})
  `;
}

function buildInsertValues(
  idCandidato: string,
  row: ParsedElectorRow,
  origemCaptacao: string,
  hasEmailColumn: boolean
) {
  const eleitorUid = crypto.randomUUID();
  const eleitorId = row.telefone || row.email || eleitorUid;

  const baseValues = [
    eleitorUid,
    eleitorId,
    idCandidato,
    row.nome || "Eleitor importado",
    row.telefone || null,
    origemCaptacao,
    "novo_lead"
  ];

  if (hasEmailColumn) {
    baseValues.splice(5, 0, row.email || null);
  }

  return baseValues;
}
