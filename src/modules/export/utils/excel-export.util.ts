import ExcelJS from 'exceljs';
import type { GeneratedExportFile } from '../types/export.types';

export const EXCEL_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function sheetNameFromFileName(fileName: string): string {
  const baseName = fileName.replace(/\.[^.]+$/, '') || 'Export';
  return baseName.replace(/[*?:/\\[\]]/g, ' ').slice(0, 31);
}

export async function excelExportFromCsv(
  csv: string,
  fileName: string,
): Promise<GeneratedExportFile> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetNameFromFileName(fileName));
  const rows = parseCsv(csv);

  worksheet.addRows(rows);

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle' };

  const columnCount = Math.max(...rows.map((row) => row.length), 0);
  for (let index = 1; index <= columnCount; index += 1) {
    const maxLength = rows.reduce(
      (max, row) => Math.max(max, String(row[index - 1] ?? '').length),
      10,
    );
    const column = worksheet.getColumn(index);
    column.width = Math.min(Math.max(maxLength + 2, 12), 40);
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return {
    buffer: Buffer.from(buffer),
    fileName,
    mimeType: EXCEL_MIME_TYPE,
  };
}
