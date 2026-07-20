import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpenseAttachment } from 'src/database/entities/expense-attachment.entity';
import { Expense } from 'src/database/entities/expense.entity';
import { RECEIPT_STORAGE } from './constants/receipt.constants';
import { RECEIPT_SERVICE } from './contracts/receipt.contract';
import { ReceiptController } from './controllers/receipt.controller';
import { ReceiptService } from './services/receipt.service';
import { CloudinaryReceiptStorage } from './storage/cloudinary-receipt.storage';

@Module({
  imports: [TypeOrmModule.forFeature([Expense, ExpenseAttachment])],
  controllers: [ReceiptController],
  providers: [
    ReceiptService,
    { provide: RECEIPT_SERVICE, useExisting: ReceiptService },
    CloudinaryReceiptStorage,
    { provide: RECEIPT_STORAGE, useExisting: CloudinaryReceiptStorage },
  ],
  exports: [ReceiptService, RECEIPT_SERVICE],
})
export class ReceiptModule {}
