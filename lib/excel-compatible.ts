type SpreadsheetValue = string | number | null | undefined;

export function toExcelHtmlSpreadsheet(rows: Array<Array<SpreadsheetValue>>) {
  const tableRows = rows
    .map((row) => {
      if (!row.length) {
        return "<tr><td></td></tr>";
      }

      return (
        "<tr>" +
        row
          .map((value) => {
            const text = normalizeSpreadsheetText(value == null ? "" : String(value));
            return `<td style="mso-number-format:'\\@';">${escapeHtml(text)}</td>`;
          })
          .join("") +
        "</tr>"
      );
    })
    .join("\n");

  return [
    "<!doctype html>",
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">',
    "<head>",
    '<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />',
    "<style>td{font-family:Calibri,Arial,sans-serif;font-size:11pt;}</style>",
    "</head>",
    "<body>",
    "<table>",
    tableRows,
    "</table>",
    "</body>",
    "</html>"
  ].join("\n");
}

export function excelHtmlHeaders(filename: string) {
  return {
    "Content-Type": "application/vnd.ms-excel; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`
  };
}

function normalizeSpreadsheetText(value: string) {
  return value.replace(/\r?\n/g, " ").trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
