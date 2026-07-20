export type BulkApprovalItemResult = {
  reference: string;
};

export type BulkApprovalFailure = {
  reference: string;
  reason: string;
};

export type BulkApprovalResult = {
  succeeded: BulkApprovalItemResult[];
  failed: BulkApprovalFailure[];
  partialSuccess: boolean;
  allSucceeded: boolean;
};
