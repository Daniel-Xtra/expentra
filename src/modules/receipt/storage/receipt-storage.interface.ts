export type CloudinaryStoredReceipt = {
  publicId: string;
  resourceType: string;
  bytes: number;
};

export type ReceiptStorageUploadInput = {
  buffer: Buffer;
  mimeType: string;
  publicId: string;
};

export type ReceiptStorageReadInput = {
  objectKey: string;
  mimeType: string;
  resourceType: string;
};

import type { Readable } from 'stream';

export interface IReceiptStorage {
  uploadReceipt(
    input: ReceiptStorageUploadInput,
  ): Promise<CloudinaryStoredReceipt>;
  openReadStream(input: ReceiptStorageReadInput): Promise<Readable>;
  delete(publicId: string, resourceType: string): Promise<void>;
}
