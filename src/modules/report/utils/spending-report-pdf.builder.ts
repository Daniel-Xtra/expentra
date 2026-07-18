import PDFDocument from 'pdfkit';

type PdfDoc = InstanceType<typeof PDFDocument>;
import type {
  CategorySpendingRow,
  DepartmentSpendingRow,
  ExpenseExportRow,
  SpendingSummaryReport,
} from '../types/report.types';
import { formatNgnFromAmount } from './format-ngn.util';

export type SpendingReportPdfInput = {
  periodLabel: string;
  summary: SpendingSummaryReport;
  categories: CategorySpendingRow[];
  departments: DepartmentSpendingRow[];
  expenses: ExpenseExportRow[];
};

const PAGE_BOTTOM = 750;

export function buildSpendingReportPdf(
  input: SpendingReportPdfInput,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const periodLabel = input.periodLabel;
    const generatedAt = new Date().toISOString();

    doc
      .fontSize(18)
      .text('Expentra Spending Report', { align: 'center' })
      .moveDown(0.3);
    doc
      .fontSize(11)
      .fillColor('#444444')
      .text(`Period: ${periodLabel}`, { align: 'center' })
      .text(`Generated: ${generatedAt}`, { align: 'center' })
      .moveDown(1);

    doc.fillColor('#000000');
    writeSectionTitle(doc, 'Summary');
    doc.fontSize(10);
    doc.text(`Total spend: ${formatNgnFromAmount(input.summary.totalAmount)}`);
    doc.text(`Expense count: ${input.summary.expenseCount}`);
    doc.text(
      `Scope: ${input.summary.byStatus.map((s) => `${s.status} (${s.count})`).join(', ') || 'none'}`,
    );
    doc.moveDown(0.8);

    writeSectionTitle(doc, 'By category');
    writeTableHeader(doc, ['Category', 'Count', 'Total']);
    for (const row of input.categories) {
      ensureSpace(doc, 14);
      doc
        .fontSize(9)
        .text(row.category, 48, doc.y, { width: 180, continued: false });
      const y = doc.y - 12;
      doc.text(String(row.count), 240, y, { width: 80 });
      doc.text(formatNgnFromAmount(row.totalAmount), 330, y, { width: 200 });
      doc.moveDown(0.4);
    }
    if (!input.categories.length) {
      doc.fontSize(9).fillColor('#666666').text('No data').fillColor('#000000');
    }
    doc.moveDown(0.8);

    if (input.departments.length > 0) {
      writeSectionTitle(doc, 'By department');
      writeTableHeader(doc, ['Department', 'Code', 'Count', 'Total']);
      for (const row of input.departments) {
        ensureSpace(doc, 14);
        doc.fontSize(9).text(row.departmentName, 48, doc.y, { width: 160 });
        const y = doc.y - 12;
        doc.text(row.departmentCode, 210, y, { width: 60 });
        doc.text(String(row.count), 280, y, { width: 50 });
        doc.text(formatNgnFromAmount(row.totalAmount), 340, y, { width: 180 });
        doc.moveDown(0.4);
      }
      doc.moveDown(0.8);
    }

    writeSectionTitle(doc, 'Expense detail');
    writeTableHeader(doc, [
      'Title',
      'Amount',
      'Category',
      'Status',
      'Submitted',
    ]);
    for (const row of input.expenses) {
      ensureSpace(doc, 14);
      const submitted = row.submittedAt ? row.submittedAt.slice(0, 10) : '—';
      doc.fontSize(8).text(truncate(row.title, 36), 48, doc.y, { width: 150 });
      const y = doc.y - 11;
      doc.text(formatNgnFromAmount(row.amount), 200, y, { width: 85 });
      doc.text(row.category, 290, y, { width: 70 });
      doc.text(row.status, 365, y, { width: 70 });
      doc.text(submitted, 440, y, { width: 90 });
      doc.moveDown(0.35);
    }
    if (!input.expenses.length) {
      doc
        .fontSize(9)
        .fillColor('#666666')
        .text('No expenses in period')
        .fillColor('#000000');
    }

    doc.end();
  });
}

function writeSectionTitle(doc: PdfDoc, title: string): void {
  ensureSpace(doc, 24);
  doc.fontSize(12).fillColor('#111111').text(title, { underline: true });
  doc.moveDown(0.4);
  doc.fillColor('#000000');
}

function writeTableHeader(doc: PdfDoc, _columns: string[]): void {
  ensureSpace(doc, 16);
  doc.fontSize(8).fillColor('#333333').text(_columns.join('  |  '));
  doc.fillColor('#000000').moveDown(0.3);
}

function ensureSpace(doc: PdfDoc, needed: number): void {
  if (doc.y + needed > PAGE_BOTTOM) {
    doc.addPage();
  }
}

function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1)}…`;
}
