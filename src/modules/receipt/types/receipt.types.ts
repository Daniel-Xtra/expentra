import type { Readable } from 'stream';
import type { ExpenseAttachment } from 'src/database/entities/expense-attachment.entity';

export type UploadedReceiptFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

export type ReceiptDownload = {
  stream: Readable;
  fileName: string;
  mimeType: string;
};

export type ReceiptResponse = {
  reference: string;
  expenseReference: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  objectKey: string;
  createdAt: Date;
};

export type ReceiptListResult = {
  data: ExpenseAttachment[];
};
