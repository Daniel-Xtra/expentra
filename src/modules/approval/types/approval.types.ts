export type ApproveExpenseInput = {
  comment?: string;
  /** Required when finance approves an over-budget expense. */
  overBudgetAcknowledged?: boolean;
};

export type RejectExpenseInput = {
  comment: string;
};
