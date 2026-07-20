import type { IAuthUser } from 'src/definition';
import type {
  ReceiptDownload,
  ReceiptListResult,
  UploadedReceiptFile,
} from '../types/receipt.types';
import type { ExpenseAttachment } from 'src/database/entities/expense-attachment.entity';

export const RECEIPT_SERVICE = Symbol('RECEIPT_SERVICE');

export interface IReceiptService {
  uploadReceipt(
    authUser: IAuthUser,
    expenseReference: string,
    file: UploadedReceiptFile,
  ): Promise<ExpenseAttachment>;
  list(
    authUser: IAuthUser,
    expenseReference: string,
  ): Promise<ReceiptListResult>;
  findOneByReference(
    authUser: IAuthUser,
    expenseReference: string,
    receiptReference: string,
  ): Promise<ExpenseAttachment>;
  download(
    authUser: IAuthUser,
    expenseReference: string,
    receiptReference: string,
  ): Promise<ReceiptDownload>;
  viewByObjectKey(
    authUser: IAuthUser,
    expenseReference: string,
    objectKey: string,
  ): Promise<ReceiptDownload>;
  remove(
    authUser: IAuthUser,
    expenseReference: string,
    receiptReference: string,
  ): Promise<void>;
}
