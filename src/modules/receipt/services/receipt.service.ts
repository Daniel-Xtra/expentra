import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as path from 'path';
import { Repository } from 'typeorm';
import { ExpenseAttachment } from 'src/database/entities/expense-attachment.entity';
import { Expense } from 'src/database/entities/expense.entity';
import { ExpenseStatus } from 'src/database/entities/expense.enums';
import type { IAuthUser } from 'src/definition';
import { AccessPolicyService } from 'src/modules/authorization';
import { findEntityByReference } from 'src/core/utils/entity-reference.repository';
import { EntityReferencePrefix } from 'src/database/constants/entity-reference-prefix';
import { generateEntityReference } from 'src/database/helpers/entity-reference.util';
import {
  RECEIPT_ALLOWED_MIME_TYPES,
  RECEIPT_MAX_FILE_BYTES,
  RECEIPT_STORAGE,
} from '../constants/receipt.constants';
import type { IReceiptService } from '../contracts/receipt.contract';
import type { IReceiptStorage } from '../storage/receipt-storage.interface';
import type {
  ReceiptDownload,
  ReceiptListResult,
  UploadedReceiptFile,
} from '../types/receipt.types';

@Injectable()
export class ReceiptService implements IReceiptService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(ExpenseAttachment)
    private readonly attachmentRepository: Repository<ExpenseAttachment>,
    @Inject(RECEIPT_STORAGE) private readonly storage: IReceiptStorage,
    private readonly accessPolicy: AccessPolicyService,
  ) {}

  async uploadReceipt(
    authUser: IAuthUser,
    expenseReference: string,
    file: UploadedReceiptFile,
  ): Promise<ExpenseAttachment> {
    this.validateUploadFile(file);
    const expense = await this.loadExpenseForMutation(
      authUser,
      expenseReference,
    );
    const attachmentReference = generateEntityReference(
      EntityReferencePrefix.EXPENSE_ATTACHMENT,
    );
    const safeFileName = this.sanitizeFileName(file.originalname);

    const receiptStorageResult = await this.storage.uploadReceipt({
      buffer: file.buffer,
      mimeType: file.mimetype,
      publicId: attachmentReference,
    });

    try {
      const attachment = this.attachmentRepository.create({
        reference: attachmentReference,
        expenseId: expense.id,
        fileName: safeFileName,
        mimeType: file.mimetype,
        sizeBytes: receiptStorageResult.bytes,
        objectKey: receiptStorageResult.publicId,
        resourceType: receiptStorageResult.resourceType,
        uploadedById: authUser.id,
      });
      return await this.attachmentRepository.save(attachment);
    } catch (error) {
      await this.storage
        .delete(
          receiptStorageResult.publicId,
          receiptStorageResult.resourceType,
        )
        .catch(() => undefined);
      throw error;
    }
  }

  async list(
    authUser: IAuthUser,
    expenseReference: string,
  ): Promise<ReceiptListResult> {
    const expense = await this.loadExpenseForRead(authUser, expenseReference);
    const data = await this.attachmentRepository.find({
      where: { expenseId: expense.id },
      order: { createdAt: 'DESC' },
    });
    return { data };
  }

  async findOneByReference(
    authUser: IAuthUser,
    expenseReference: string,
    receiptReference: string,
  ): Promise<ExpenseAttachment> {
    const expense = await this.loadExpenseForRead(authUser, expenseReference);
    const attachment = await findEntityByReference(
      this.attachmentRepository,
      receiptReference,
      'Receipt not found',
    );
    if (attachment.expenseId !== expense.id) {
      throw new NotFoundException('Receipt not found');
    }
    return attachment;
  }

  async download(
    authUser: IAuthUser,
    expenseReference: string,
    receiptReference: string,
  ): Promise<ReceiptDownload> {
    const attachment = await this.findOneByReference(
      authUser,
      expenseReference,
      receiptReference,
    );
    const stream = await this.storage.openReadStream({
      objectKey: attachment.objectKey,
      mimeType: attachment.mimeType,
      resourceType: attachment.resourceType,
    });
    return {
      stream,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
    };
  }

  async viewByObjectKey(
    authUser: IAuthUser,
    expenseReference: string,
    objectKey: string,
  ): Promise<ReceiptDownload> {
    const normalizedObjectKey = objectKey?.trim();
    if (!normalizedObjectKey) {
      throw new BadRequestException('objectKey is required');
    }

    const expense = await this.loadExpenseForRead(authUser, expenseReference);
    const attachment = await this.attachmentRepository.findOne({
      where: {
        expenseId: expense.id,
        objectKey: normalizedObjectKey,
      },
    });
    if (!attachment) {
      throw new NotFoundException('Receipt not found');
    }

    const stream = await this.storage.openReadStream({
      objectKey: attachment.objectKey,
      mimeType: attachment.mimeType,
      resourceType: attachment.resourceType,
    });
    return {
      stream,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
    };
  }

  async remove(
    authUser: IAuthUser,
    expenseReference: string,
    receiptReference: string,
  ): Promise<void> {
    const expense = await this.loadExpenseForMutation(
      authUser,
      expenseReference,
    );
    const attachment = await this.findOneByReference(
      authUser,
      expenseReference,
      receiptReference,
    );
    await this.storage.delete(
      attachment.objectKey,
      attachment.resourceType,
    );
    await this.attachmentRepository.delete({
      id: attachment.id,
      expenseId: expense.id,
    });
  }

  private validateUploadFile(file: UploadedReceiptFile): void {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Receipt file is required');
    }
    if (file.size > RECEIPT_MAX_FILE_BYTES) {
      throw new BadRequestException(
        `Receipt file must not exceed ${RECEIPT_MAX_FILE_BYTES / (1024 * 1024)}MB`,
      );
    }
    if (!RECEIPT_ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Receipt must be PDF, PNG, JPG, or JPEG');
    }
  }

  private async resolveExpense(expenseReference: string): Promise<Expense> {
    const expense = await findEntityByReference(
      this.expenseRepository,
      expenseReference,
      'Expense not found',
    );
    const loaded = await this.expenseRepository.findOne({
      where: { id: expense.id },
      relations: {
        department: true,
        user: { department: true },
      },
    });
    if (!loaded) {
      throw new NotFoundException('Expense not found');
    }
    return loaded;
  }

  private async loadExpenseForRead(
    authUser: IAuthUser,
    expenseReference: string,
  ): Promise<Expense> {
    const expense = await this.resolveExpense(expenseReference);
    this.accessPolicy.assertCanReadExpense(authUser, expense);
    return expense;
  }

  private async loadExpenseForMutation(
    authUser: IAuthUser,
    expenseReference: string,
  ): Promise<Expense> {
    const expense = await this.loadExpenseForRead(authUser, expenseReference);
    this.assertDraftReceiptAccess(authUser, expense);
    return expense;
  }

  private assertDraftReceiptAccess(
    authUser: IAuthUser,
    expense: Expense,
  ): void {
    if (expense.status !== ExpenseStatus.DRAFT) {
      throw new BadRequestException(
        'Receipts can only be added or removed on draft expenses',
      );
    }

    this.accessPolicy.assertCanManageReceiptOnExpense(authUser, expense);
  }

  private sanitizeFileName(originalName: string): string {
    const base = path.basename(originalName).replace(/[^\w.\- ]+/g, '_');
    return base.slice(0, 255) || 'receipt';
  }
}
