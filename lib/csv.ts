export function toCsv(rows: Array<Array<string | number | null | undefined>>) {
  return rows
    .map((row) =>
      row
        .map((value) => escapeCsvValue(value == null ? "" : String(value)))
        .join(",")
    )
    .join("\n");
}

function escapeCsvValue(value: string) {
  if (/[",\n;]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}
