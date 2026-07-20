import type { ExpenseAttachment } from 'src/database/entities/expense-attachment.entity';
import type { ReceiptResponse } from '../types/receipt.types';

export function toReceiptResponse(
  attachment: ExpenseAttachment,
  expenseReference?: string,
): ReceiptResponse {
  return {
    reference: attachment.reference,
    expenseReference: expenseReference ?? attachment.expense?.reference ?? '',
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    objectKey: attachment.objectKey,
    createdAt: attachment.createdAt,
  };
}
