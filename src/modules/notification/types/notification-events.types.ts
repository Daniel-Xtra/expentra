export type ExpenseSubmittedEvent = {
  expenseId: number;
  userId: number;
};

export type ExpenseApprovedEvent = {
  expenseId: number;
  userId: number;
  approverId: number;
};

export type ExpenseRejectedEvent = {
  expenseId: number;
  userId: number;
  approverId: number;
  comment: string;
};

export type ExpensePendingFinanceEvent = {
  expenseId: number;
  userId: number;
  approverId: number;
};

export type ExpenseEscalatedEvent = {
  expenseId: number;
  userId: number;
  status: string;
};

export type ExpenseReimbursedEvent = {
  expenseId: number;
  userId: number;
  financeId: number;
};

export type AuthEmailVerificationEvent = {
  userId: number;
  email: string;
  firstName?: string;
  verifyToken: string;
};

export type AuthPasswordResetEvent = {
  userId: number;
  email: string;
  resetToken: string;
  firstName?: string;
};
