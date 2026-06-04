import { db } from "@/lib/db";
import { ensureElectorEnrichmentColumns } from "@/lib/repositories/elector-schema";

type ParsedElectorRow = {
  nome: string;
  telefone: string;
  email: string;
  cidade: string;
  uf: string;
  grupo_interesse: string;
};

type ExistingElectorRow = {
  eleitor_uid: string;
  nome: string | null;
  telefone: string | null;
  email?: string | null;
  cidade?: string | null;
  uf?: string | null;
  grupo_interesse?: string | null;
};

type ImportSummary = {
  importados: number;
  atualizados: number;
  ignorados: number;
};

type OptionalElectorColumns = {
  hasEmailColumn: boolean;
  hasCityColumn: boolean;
  hasUfColumn: boolean;
  hasGroupColumn: boolean;
};

export async function importCampaignElectorBase(
  idCandidato: string,
  rawFileContents: string,
  origemCaptacao = "importacao_admin"
): Promise<ImportSummary> {
  await ensureElectorEnrichmentColumns();
  const rows = parseElectorCsv(rawFileContents);

  if (rows.length === 0) {
    throw new Error(
      "Arquivo sem linhas válidas para importação. Revise o conteúdo e confirme se há dados abaixo do cabeçalho."
    );
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
    const availableColumns: OptionalElectorColumns = {
      hasEmailColumn: columns.has("email"),
      hasCityColumn: columns.has("cidade"),
      hasUfColumn: columns.has("uf"),
      hasGroupColumn: columns.has("grupo_interesse")
    };

    let importados = 0;
    let atualizados = 0;
    let ignorados = 0;
    const seenImportKeys = new Set<string>();

    for (const row of rows) {
      if (!row.telefone && !row.email) {
        ignorados += 1;
        continue;
      }

      const importKey = buildImportKey(row.telefone, row.email);

      if (importKey && seenImportKeys.has(importKey)) {
        ignorados += 1;
        continue;
      }

      if (importKey) {
        seenImportKeys.add(importKey);
      }

      const lookup = await client.query<ExistingElectorRow>(
        buildLookupQuery(
          availableColumns.hasEmailColumn,
          Boolean(row.telefone),
          Boolean(row.email)
        ),
        buildLookupValues(idCandidato, row.telefone, row.email)
      );

      if (lookup.rows[0]?.eleitor_uid) {
        if (isSameElectorData(lookup.rows[0], row, availableColumns.hasEmailColumn)) {
          ignorados += 1;
          continue;
        }

        const updateStatement = buildUpdateStatement(
          lookup.rows[0].eleitor_uid,
          row,
          origemCaptacao,
          availableColumns
        );
        await client.query(updateStatement.query, updateStatement.values);
        atualizados += 1;
        continue;
      }

      const insertStatement = buildInsertStatement(
        idCandidato,
        row,
        origemCaptacao,
        availableColumns
      );
      await client.query(insertStatement.query, insertStatement.values);
      importados += 1;
    }

    if (importados === 0 && atualizados === 0) {
      throw new Error(
        "Nenhum registro foi aproveitado na importação. O arquivo foi lido, mas todas as linhas foram ignoradas por duplicidade, ausência de telefone/email ou repetição exata da base já cadastrada."
      );
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
  const cidadeIndex = findHeaderIndex(headers, ["cidade", "municipio", "município"]);
  const ufIndex = findHeaderIndex(headers, ["uf", "estado"]);
  const grupoIndex = findHeaderIndex(headers, [
    "grupo",
    "grupo interesse",
    "grupo_interesse",
    "segmento"
  ]);

  if (nomeIndex < 0 && telefoneIndex < 0 && emailIndex < 0) {
    throw new Error(
      "Estrutura inválida do arquivo. Use um CSV com cabeçalho contendo ao menos uma das colunas nome, telefone ou email."
    );
  }

  return lines.slice(1).map((line) => {
    const values = splitDelimitedLine(line, delimiter);

    return {
      nome: sanitizeCell(values[nomeIndex]),
      telefone: normalizePhone(values[telefoneIndex]),
      email: normalizeEmail(values[emailIndex]),
      cidade: sanitizeCell(values[cidadeIndex]),
      uf: normalizeUf(values[ufIndex]),
      grupo_interesse: normalizeGroup(values[grupoIndex])
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

function normalizeUf(value: string | undefined) {
  return sanitizeCell(value).toUpperCase().slice(0, 2);
}

function normalizeGroup(value: string | undefined) {
  return sanitizeCell(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s-]+/g, "_");
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
      select eleitor_uid, nome, telefone${hasEmailColumn ? ", email" : ""}, cidade, uf, grupo_interesse
      from eleitores
      where id_candidato = $1
        and 1 = 0
      limit 1
    `;
  }

  return `
    select eleitor_uid, nome, telefone${hasEmailColumn ? ", email" : ""}, cidade, uf, grupo_interesse
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

function buildUpdateStatement(
  eleitorUid: string,
  row: ParsedElectorRow,
  origemCaptacao: string,
  columns: OptionalElectorColumns
) {
  const values: Array<string | null> = [eleitorUid];
  const assignments: string[] = [];

  const pushParam = (value: string | null) => {
    values.push(value);
    return `$${values.length}`;
  };

  const nomeParam = pushParam(row.nome || null);
  assignments.push(`nome = case when nullif(${nomeParam}, '') is not null then ${nomeParam} else nome end`);

  const telefoneParam = pushParam(row.telefone || null);
  assignments.push(
    `telefone = case when nullif(${telefoneParam}, '') is not null then ${telefoneParam} else telefone end`
  );

  if (columns.hasEmailColumn) {
    const emailParam = pushParam(row.email || null);
    assignments.push(
      `email = case when nullif(${emailParam}, '') is not null then lower(${emailParam}) else email end`
    );
  }

  if (columns.hasCityColumn) {
    const cityParam = pushParam(row.cidade || null);
    assignments.push(
      `cidade = case when nullif(${cityParam}, '') is not null then ${cityParam} else cidade end`
    );
    assignments.push(
      `origem_cidade = case when nullif(${cityParam}, '') is not null then 'importacao_base' else origem_cidade end`
    );
  }

  if (columns.hasUfColumn) {
    const ufParam = pushParam(row.uf || null);
    assignments.push(`uf = case when nullif(${ufParam}, '') is not null then ${ufParam} else uf end`);
  }

  if (columns.hasGroupColumn) {
    const groupParam = pushParam(row.grupo_interesse || null);
    assignments.push(
      `grupo_interesse = case when nullif(${groupParam}, '') is not null then ${groupParam} else grupo_interesse end`
    );
    assignments.push(
      `origem_grupo = case when nullif(${groupParam}, '') is not null then 'importacao_base' else origem_grupo end`
    );
  }

  const origemParam = pushParam(origemCaptacao || null);
  assignments.push(
    `origem_captacao = case when coalesce(nullif(origem_captacao, ''), '') = '' then ${origemParam} else origem_captacao end`
  );
  assignments.push("atualizado_em = now()");

  return {
    query: `
      update eleitores
      set ${assignments.join(",\n          ")}
      where eleitor_uid = $1
    `,
    values
  };
}

function buildInsertStatement(
  idCandidato: string,
  row: ParsedElectorRow,
  origemCaptacao: string,
  columns: OptionalElectorColumns
) {
  const eleitorUid = crypto.randomUUID();
  const eleitorId = row.telefone || row.email || eleitorUid;

  const insertColumns = ["eleitor_uid", "eleitor_id", "id_candidato", "nome", "telefone"];
  const values: Array<string | null> = [
    eleitorUid,
    eleitorId,
    idCandidato,
    row.nome || "Eleitor importado",
    row.telefone || null
  ];

  if (columns.hasEmailColumn) {
    insertColumns.push("email");
    values.push(row.email || null);
  }

  if (columns.hasCityColumn) {
    insertColumns.push("cidade", "origem_cidade");
    values.push(row.cidade || null, row.cidade ? "importacao_base" : null);
  }

  if (columns.hasUfColumn) {
    insertColumns.push("uf");
    values.push(row.uf || null);
  }

  if (columns.hasGroupColumn) {
    insertColumns.push("grupo_interesse", "origem_grupo");
    values.push(row.grupo_interesse || null, row.grupo_interesse ? "importacao_base" : null);
  }

  insertColumns.push("origem_captacao", "etapa_funil");
  values.push(origemCaptacao, "novo_lead");

  const placeholders = values.map((_, index) => `$${index + 1}`);

  return {
    query: `
      insert into eleitores (${insertColumns.join(", ")}, criado_em, atualizado_em)
      values (${placeholders.join(", ")}, now(), now())
    `,
    values
  };
}

function buildImportKey(telefone: string, email: string) {
  if (telefone) {
    return `telefone:${telefone}`;
  }

  if (email) {
    return `email:${email}`;
  }

  return "";
}

function isSameElectorData(
  existing: ExistingElectorRow,
  incoming: ParsedElectorRow,
  hasEmailColumn: boolean
) {
  const sameName = normalizeComparableValue(existing.nome) === normalizeComparableValue(incoming.nome);
  const samePhone =
    normalizeComparableValue(existing.telefone) === normalizeComparableValue(incoming.telefone);
  const sameEmail = hasEmailColumn
    ? normalizeComparableValue(existing.email) === normalizeComparableValue(incoming.email)
    : true;
  const sameCity = normalizeComparableValue(existing.cidade) === normalizeComparableValue(incoming.cidade);
  const sameUf = normalizeComparableValue(existing.uf) === normalizeComparableValue(incoming.uf);
  const sameGroup =
    normalizeComparableValue(existing.grupo_interesse) ===
    normalizeComparableValue(incoming.grupo_interesse);

  return sameName && samePhone && sameEmail && sameCity && sameUf && sameGroup;
}

function normalizeComparableValue(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}
