export enum ExportJobType {
  REPORT_SPENDING_XLSX = 'report.spending.xlsx',
  REPORT_SPENDING_PDF = 'report.spending.pdf',
  EXPENSE_PERSONAL_XLSX = 'expense.personal.xlsx',
  EXPENSE_ALL_XLSX = 'expense.all.xlsx',
  EXPENSE_PAYROLL_XLSX = 'expense.payroll.xlsx',
  DEPARTMENT_XLSX = 'department.xlsx',
  DASHBOARD_PERSONAL_XLSX = 'dashboard.personal.xlsx',
  BUDGET_XLSX = 'budget.xlsx',
  APPROVAL_LEVEL_XLSX = 'approval_level.xlsx',
  USER_XLSX = 'user.xlsx',

  REPORT_SPENDING_CSV = 'report.spending.csv',
  EXPENSE_PERSONAL_CSV = 'expense.personal.csv',
  EXPENSE_ALL_CSV = 'expense.all.csv',
  EXPENSE_PAYROLL_CSV = 'expense.payroll.csv',
  DEPARTMENT_CSV = 'department.csv',
  DASHBOARD_PERSONAL_CSV = 'dashboard.personal.csv',
  BUDGET_CSV = 'budget.csv',
  APPROVAL_LEVEL_CSV = 'approval_level.csv',
  USER_CSV = 'user.csv',
}

export type ExportRequest = {
  jobType: ExportJobType;
  params: Record<string, unknown>;
};

export type GeneratedExportFile = {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
};

/** BullMQ payload — no DB row; file is generated then emailed. */
export type ExportJobQueueData = {
  userId: number;
  recipientEmail: string;
  jobType: ExportJobType;
  params: Record<string, unknown>;
  correlationId?: string;
};

export type QueuedExportResult = {
  status: 'queued';
  jobType: ExportJobType;
};
