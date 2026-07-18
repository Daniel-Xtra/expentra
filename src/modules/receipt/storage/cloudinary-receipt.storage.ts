import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import type { Readable } from 'stream';
import { ConfigService } from '@nestjs/config';
import type {
  CloudinaryStoredReceipt,
  IReceiptStorage,
  ReceiptStorageReadInput,
  ReceiptStorageUploadInput,
} from './receipt-storage.interface';
import {
  buildSignedCloudinaryDownloadUrl,
  cloudinaryFormatFromMime,
  cloudinaryResourceTypeForMime,
  CloudinaryUploadResult,
  uploadBufferToCloudinary,
  openCloudinaryUrlStream,
  deleteCloudinaryAsset,
} from 'src/core/utils/upload/cloudinary';

@Injectable()
export class CloudinaryReceiptStorage implements IReceiptStorage {
  constructor(private readonly configService: ConfigService) {}

  private get folder(): string {
    return this.configService.get<string>(
      'CLOUDINARY_RECEIPT_FOLDER',
      'expentra/receipts',
    );
  }

  async uploadReceipt(
    input: ReceiptStorageUploadInput,
  ): Promise<CloudinaryStoredReceipt> {
    const resourceType = cloudinaryResourceTypeForMime(input.mimeType);
    const format =
      resourceType === 'raw' && input.mimeType === 'application/pdf'
        ? 'pdf'
        : undefined;

    try {
      const result: CloudinaryUploadResult = await uploadBufferToCloudinary(
        input.buffer,
        this.folder,
        resourceType,
        format,
        {
          public_id: input.publicId,
          overwrite: false,
          type: 'private',
        },
      );

      return {
        publicId: result.public_id,
        resourceType: result.resource_type ?? resourceType,
        bytes: result.bytes ?? input.buffer.length,
      };
    } catch {
      throw new InternalServerErrorException(
        'Failed to upload receipt to Cloudinary',
      );
    }
  }

  async openReadStream(input: ReceiptStorageReadInput): Promise<Readable> {
    if (!input.objectKey?.trim()) {
      throw new BadRequestException('Receipt has no object key');
    }

    const resourceType =
      input.resourceType === 'raw' || input.resourceType === 'image'
        ? input.resourceType
        : cloudinaryResourceTypeForMime(input.mimeType);

    try {
      const signedUrl = buildSignedCloudinaryDownloadUrl(
        input.objectKey,
        {
          resourceType,
          format: cloudinaryFormatFromMime(input.mimeType),
          deliveryType: 'private',
          ttlSeconds: 15 * 60,
        },
      );
      return await openCloudinaryUrlStream(signedUrl);
    } catch {
      throw new InternalServerErrorException('Failed to download receipt');
    }
  }

  async delete(publicId: string, resourceType: string): Promise<void> {
    const normalized =
      resourceType === 'raw' || resourceType === 'image'
        ? resourceType
        : cloudinaryResourceTypeForMime('application/pdf');

    try {
      await deleteCloudinaryAsset(publicId, normalized, 'private');
    } catch {
      throw new InternalServerErrorException(
        'Failed to delete receipt from Cloudinary',
      );
    }
  }
}
