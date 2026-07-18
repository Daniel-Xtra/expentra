import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { AuthUser } from 'src/core/decorators/auth-user.decorator';
import { EntityReferencePipe } from 'src/core/pipes/entity-reference.pipe';
import type { IAuthUser } from 'src/definition';
import {
  PermissionAction,
  PermissionResource,
  RequirePermission,
} from 'src/modules/authorization';
import { IResponse, successRequestResponse } from 'src/core/utils/helper';
import {
  RECEIPT_SERVICE,
  type IReceiptService,
} from '../contracts/receipt.contract';
import { toReceiptResponse } from '../mappers/receipt-response.mapper';
import type { UploadedReceiptFile } from '../types/receipt.types';
import {
  createFileInterceptor,
  type MemoryUploadedFile,
  SingleFileValidationInterceptor,
} from 'src/core/utils/upload/file-upload.helper';

@Controller({
  path: 'expenses/:expenseReference/receipts',
  version: '1',
})
export class ReceiptController {
  constructor(
    @Inject(RECEIPT_SERVICE) private readonly receiptService: IReceiptService,
  ) {}

  @Post('upload')
  @RequirePermission(PermissionAction.CREATE, PermissionResource.RECEIPT)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    createFileInterceptor('file'),
    new SingleFileValidationInterceptor(),
  )
  async uploadReceipt(
    @AuthUser() authUser: IAuthUser,
    @Param('expenseReference', EntityReferencePipe)
    expenseReference: string,
    @UploadedFile() file: MemoryUploadedFile | undefined,
  ): Promise<IResponse> {
    const uploaded: UploadedReceiptFile = this.toUploadedFile(file);
    const response = await this.receiptService.uploadReceipt(
      authUser,
      expenseReference,
      uploaded,
    );

    return successRequestResponse(
      'Receipt uploaded successfully.',
      toReceiptResponse(response, expenseReference),
    );
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.RECEIPT)
  async list(
    @AuthUser() authUser: IAuthUser,
    @Param('expenseReference', EntityReferencePipe)
    expenseReference: string,
  ) {
    const result = await this.receiptService.list(authUser, expenseReference);

    return successRequestResponse(
      'Receipts fetched successfully',
      result.data.map((receipt) =>
        toReceiptResponse(receipt, expenseReference),
      ),
    );
  }

  @Get('view')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.RECEIPT)
  async viewByObjectKey(
    @AuthUser() authUser: IAuthUser,
    @Param('expenseReference', EntityReferencePipe)
    expenseReference: string,
    @Query('objectKey') objectKey: string,
  ) {
    const { stream, fileName, mimeType } =
      await this.receiptService.viewByObjectKey(
        authUser,
        expenseReference,
        objectKey,
      );

    return new StreamableFile(stream, {
      type: mimeType,
      disposition: `inline; filename="${fileName}"`,
    });
  }

  @Get(':receiptReference/download')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.RECEIPT)
  async download(
    @AuthUser() authUser: IAuthUser,
    @Param('expenseReference', EntityReferencePipe)
    expenseReference: string,
    @Param('receiptReference', EntityReferencePipe)
    receiptReference: string,
  ) {
    const { stream, fileName, mimeType } = await this.receiptService.download(
      authUser,
      expenseReference,
      receiptReference,
    );

    return new StreamableFile(stream, {
      type: mimeType,
      disposition: `attachment; filename="${fileName}"`,
    });
  }

  @Delete(':receiptReference')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.DELETE, PermissionResource.RECEIPT)
  async remove(
    @AuthUser() authUser: IAuthUser,
    @Param('expenseReference', EntityReferencePipe)
    expenseReference: string,
    @Param('receiptReference', EntityReferencePipe)
    receiptReference: string,
  ) {
    await this.receiptService.remove(
      authUser,
      expenseReference,
      receiptReference,
    );

    return successRequestResponse('Receipt deleted successfully');
  }

  private toUploadedFile(
    file: MemoryUploadedFile | undefined,
  ): UploadedReceiptFile {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Receipt file is required');
    }

    return {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    };
  }
}
