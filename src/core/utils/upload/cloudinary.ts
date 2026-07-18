import { Readable } from 'stream';
import { v2 as cloudinaryV2 } from 'cloudinary';

export type CloudinaryResourceType = 'image' | 'video' | 'raw' | 'auto';

export type CloudinaryUploadResult = {
  public_id: string;
  secure_url: string;
  resource_type?: string;
  bytes?: number;
};

export function cloudinaryResourceTypeForMime(
  mimeType: string,
): 'image' | 'raw' {
  return mimeType === 'application/pdf' ? 'raw' : 'image';
}

function toCloudinaryUploadResult(value: unknown): CloudinaryUploadResult {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('public_id' in value) ||
    !('secure_url' in value)
  ) {
    throw new Error('Cloudinary returned an invalid upload response');
  }

  const record = value as Record<string, unknown>;
  const publicId = record.public_id;
  const secureUrl = record.secure_url;

  if (typeof publicId !== 'string' || typeof secureUrl !== 'string') {
    throw new Error('Cloudinary returned an incomplete upload response');
  }

  return {
    public_id: publicId,
    secure_url: secureUrl,
    resource_type:
      typeof record.resource_type === 'string'
        ? record.resource_type
        : undefined,
    bytes: typeof record.bytes === 'number' ? record.bytes : undefined,
  };
}

/**
 * Upload a file using a local file path, URL, or file buffer.
 */
export const uploadFileToCloudinary = async (
  file: string | Buffer,
  folder: string = 'default',
): Promise<CloudinaryUploadResult | undefined> => {
  try {
    if (Buffer.isBuffer(file)) {
      return await uploadBufferToCloudinary(file, folder);
    }

    const result: unknown = await cloudinaryV2.uploader.upload(file, {
      folder,
    });
    return toCloudinaryUploadResult(result);
  } catch (err) {
    const error = err as Error;
    console.error('Error uploading file:', error.message);
    return undefined;
  }
};

export const deleteCloudinaryAsset = async (
  publicId: string,
  resourceType: CloudinaryResourceType = 'image',
): Promise<void> => {
  await cloudinaryV2.uploader.destroy(publicId, {
    resource_type: resourceType,
  });
};

export const openCloudinaryUrlStream = async (
  secureUrl: string,
): Promise<Readable> => {
  const response = await fetch(secureUrl);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to fetch Cloudinary asset (${response.status})`);
  }
  return Readable.fromWeb(
    response.body as import('stream/web').ReadableStream<Uint8Array>,
  );
};

export const uploadBufferToCloudinary = async (
  buffer: Buffer,
  folder: string = 'default',
  resource_type: CloudinaryResourceType = 'auto',
  format?: string,
  extraUploadOptions?: Record<string, unknown>,
): Promise<CloudinaryUploadResult> => {
  return new Promise((resolve, reject) => {
    const handleUploadComplete = (
      error: Error | undefined,
      rawResult: unknown,
    ): void => {
      if (error) {
        console.error('Error uploading buffer:', error);
        reject(new Error('Failed to upload buffer to Cloudinary.'));
        return;
      }
      if (!rawResult) {
        reject(new Error('Cloudinary returned an undefined result.'));
        return;
      }
      try {
        resolve(toCloudinaryUploadResult(rawResult));
      } catch (parseError) {
        const message =
          parseError instanceof Error
            ? parseError.message
            : 'Invalid Cloudinary upload response';
        reject(new Error(message));
      }
    };

    const uploadStream = cloudinaryV2.uploader.upload_stream(
      {
        resource_type,
        ...(format && { format }),
        folder,
        ...extraUploadOptions,
      },
      handleUploadComplete,
    );

    const readableBuffer = new Readable();
    readableBuffer.push(buffer);
    readableBuffer.push(null);
    readableBuffer.pipe(uploadStream);
  });
};
