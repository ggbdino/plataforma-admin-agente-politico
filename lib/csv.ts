type CsvOptions = {
  delimiter?: string;
  includeBom?: boolean;
};

export function toCsv(
  rows: Array<Array<string | number | null | undefined>>,
  options: CsvOptions = {}
) {
  const delimiter = options.delimiter ?? ";";
  const includeBom = options.includeBom ?? true;

  const body = rows
    .map((row) =>
      row
        .map((value) => escapeCsvValue(value == null ? "" : String(value), delimiter))
        .join(delimiter)
    )
    .join("\n");

  return `${includeBom ? "\uFEFF" : ""}${body}`;
}

function escapeCsvValue(value: string, delimiter: string) {
  const normalized = normalizeSpreadsheetText(value);

  if (new RegExp(`[\"\\n\\r${escapeForRegex(delimiter)}]`).test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

function normalizeSpreadsheetText(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return value;
  }

  if (looksLikeSpreadsheetSensitiveText(trimmed)) {
    return `="${trimmed}"`;
  }

  return value;
}

function looksLikeSpreadsheetSensitiveText(value: string) {
  return /^(0\d+|\d{11,}|[\d:+\-\/\s]{8,})$/.test(value);
}

function escapeForRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
