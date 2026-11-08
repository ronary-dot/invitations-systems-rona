import "server-only";
import ExcelJS from "exceljs";

export const MAX_IMPORT_ROWS = 2000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export type Sheet = { headers: string[]; rows: string[][] };

// Reads the first worksheet of an .xlsx file, or a .csv file, into strings.
// The first non-empty row is the header row.
export async function readSpreadsheet(file: File): Promise<Sheet> {
  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  const table = name.endsWith(".csv") || file.type === "text/csv" ? parseCsv(decodeText(buf)) : await readXlsx(buf);
  const nonEmpty = table.filter((r) => r.some((c) => c.trim() !== ""));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };
  const width = Math.max(...nonEmpty.map((r) => r.length));
  const pad = (r: string[]) => Array.from({ length: width }, (_, i) => (r[i] ?? "").trim());
  const [header, ...rows] = nonEmpty.map(pad);
  return { headers: header.map((h, i) => h || `#${i + 1}`), rows: rows.slice(0, MAX_IMPORT_ROWS) };
}

async function readXlsx(buf: Buffer): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const out: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cells[col - 1] = cellText(cell);
    });
    out.push(Array.from(cells, (c) => c ?? ""));
  });
  return out;
}

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v == null) return "";
  // Phone numbers stored as numbers: keep every digit, no exponent.
  if (typeof v === "number") return Number.isInteger(v) ? v.toFixed(0) : String(v);
  try {
    return cell.text ?? "";
  } catch {
    return String(v);
  }
}

function decodeText(buf: Buffer): string {
  let text = new TextDecoder("utf-8").decode(buf);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  // Excel on Hebrew Windows often saves CSV as windows-1255.
  if (text.includes("�")) text = new TextDecoder("windows-1255").decode(buf);
  return text;
}

// RFC 4180-ish CSV with auto-detected delimiter (comma, semicolon or tab).
export function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delim = [",", ";", "\t"].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === delim) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
