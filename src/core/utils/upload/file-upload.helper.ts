import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { uploadFileToCloudinary } from './cloudinary';

/** In-memory multipart file shape (Nest multer + memory storage). */
export type MemoryUploadedFile = {
  fieldname?: string;
  originalname: string;
  encoding?: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

type HttpRequestWithUploads = Request & {
  files?: Record<string, MemoryUploadedFile[]>;
  file?: MemoryUploadedFile;
};

export const FILE_UPLOAD_CONFIG = {
  /** Must match `RECEIPT_MAX_FILE_BYTES` in receipt.constants.ts */
  MAX_FILE_SIZE: 3.5 * 1024 * 1024, // 3.5MB in bytes
  ALLOWED_FILE_TYPES: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/pdf',
  ] as const,
  ALLOWED_FILE_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.pdf'] as const,
  MIN_FILE_SIZE: 1,
  MAGIC_NUMBERS: {
    'image/jpeg': [0xff, 0xd8, 0xff],
    'image/jpg': [0xff, 0xd8, 0xff],
    'image/png': [0x89, 0x50, 0x4e, 0x47],
    'application/pdf': [0x25, 0x50, 0x44, 0x46],
  } as const,
};

function getFileExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex < 0) {
    return '';
  }
  return filename.toLowerCase().substring(dotIndex);
}

function isAllowedMimeType(mimetype: string): boolean {
  return (FILE_UPLOAD_CONFIG.ALLOWED_FILE_TYPES as readonly string[]).includes(
    mimetype,
  );
}

function isAllowedExtension(extension: string): boolean {
  return (
    FILE_UPLOAD_CONFIG.ALLOWED_FILE_EXTENSIONS as readonly string[]
  ).includes(extension);
}

function magicNumbersForMime(mimetype: string): readonly number[] | undefined {
  switch (mimetype) {
    case 'image/jpeg':
    case 'image/jpg':
      return FILE_UPLOAD_CONFIG.MAGIC_NUMBERS['image/jpeg'];
    case 'image/png':
      return FILE_UPLOAD_CONFIG.MAGIC_NUMBERS['image/png'];
    case 'application/pdf':
      return FILE_UPLOAD_CONFIG.MAGIC_NUMBERS['application/pdf'];
    default:
      return undefined;
  }
}

function validateMagicNumber(file: MemoryUploadedFile): boolean {
  const magicNumbers = magicNumbersForMime(file.mimetype);
  if (!magicNumbers) {
    return true;
  }

  if (file.buffer.length < magicNumbers.length) {
    return false;
  }

  for (let i = 0; i < magicNumbers.length; i++) {
    if (file.buffer[i] !== magicNumbers[i]) {
      return false;
    }
  }

  return true;
}

export const fileFilter: NonNullable<MulterOptions['fileFilter']> = (
  _req,
  file,
  callback,
) => {
  const fileExtension = getFileExtension(file.originalname);
  if (!isAllowedExtension(fileExtension)) {
    return callback(
      new Error(
        `Invalid file extension. Allowed extensions: ${FILE_UPLOAD_CONFIG.ALLOWED_FILE_EXTENSIONS.join(', ')}`,
      ),
      false,
    );
  }

  if (!isAllowedMimeType(file.mimetype)) {
    return callback(
      new Error(
        `Invalid file type. Allowed types: ${FILE_UPLOAD_CONFIG.ALLOWED_FILE_EXTENSIONS.join(', ')}`,
      ),
      false,
    );
  }

  callback(null, true);
};

@Injectable()
export class FileValidationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<HttpRequestWithUploads>();
    const files = request.files;

    if (!files) {
      throw new BadRequestException(
        'No files were uploaded. Please upload at least one file.',
      );
    }

    let hasAnyFiles = false;
    for (const [, fileArray] of Object.entries(files)) {
      if (fileArray && fileArray.length > 0) {
        hasAnyFiles = true;
      }
    }

    if (!hasAnyFiles) {
      throw new BadRequestException(
        'No files were uploaded. Please upload at least one file.',
      );
    }

    this.validateFiles(files);
    return next.handle();
  }

  private validateFiles(files: Record<string, MemoryUploadedFile[]>): void {
    const emptyFiles: string[] = [];
    const invalidFormatFiles: string[] = [];
    const oversizedFiles: string[] = [];

    for (const [fieldName, fileArray] of Object.entries(files)) {
      if (!fileArray?.length) {
        continue;
      }

      for (const file of fileArray) {
        if (!file.buffer?.length) {
          emptyFiles.push(`${fieldName}: ${file.originalname}`);
        }

        if (file.size === 0) {
          emptyFiles.push(`${fieldName}: ${file.originalname}`);
        }

        if (file.size > FILE_UPLOAD_CONFIG.MAX_FILE_SIZE) {
          oversizedFiles.push(
            `${fieldName}: ${file.originalname} (${(file.size / (1024 * 1024)).toFixed(2)}MB)`,
          );
        }

        const fileExtension = getFileExtension(file.originalname);
        if (!isAllowedExtension(fileExtension)) {
          invalidFormatFiles.push(
            `${fieldName}: ${file.originalname} (${fileExtension})`,
          );
        }

        if (!isAllowedMimeType(file.mimetype)) {
          invalidFormatFiles.push(
            `File ${file.originalname} in field ${fieldName} has unsupported format (${file.mimetype}). Allowed formats: ${FILE_UPLOAD_CONFIG.ALLOWED_FILE_EXTENSIONS.join(', ')}`,
          );
        }

        if (!validateMagicNumber(file)) {
          invalidFormatFiles.push(
            `File ${file.originalname} in field ${fieldName} failed magic number validation. File content does not match declared type.`,
          );
        }
      }
    }

    const errors: string[] = [];
    if (emptyFiles.length > 0) {
      errors.push(`Empty files: ${emptyFiles.join(', ')}`);
    }
    if (invalidFormatFiles.length > 0) {
      errors.push(
        `Unsupported file formats: ${invalidFormatFiles.join(', ')}. Allowed formats: ${FILE_UPLOAD_CONFIG.ALLOWED_FILE_EXTENSIONS.join(', ')}`,
      );
    }
    if (oversizedFiles.length > 0) {
      errors.push(
        `Files too large: ${oversizedFiles.join(', ')}. Maximum size: ${FILE_UPLOAD_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`,
      );
    }

    if (errors.length > 0) {
      throw new BadRequestException(
        `File validation failed:\n${errors.join('\n')}`,
      );
    }
  }
}

@Injectable()
export class SingleFileValidationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<HttpRequestWithUploads>();
    const file = request.file;

    if (!file) {
      throw new BadRequestException('A file must be uploaded');
    }

    this.validateSingleFile(file, 'uploaded_file');
    return next.handle();
  }

  private validateSingleFile(
    file: MemoryUploadedFile,
    fieldName: string,
  ): void {
    const errors: string[] = [];

    if (!file.buffer?.length) {
      errors.push(`File ${file.originalname} in field ${fieldName} is empty`);
    }

    if (file.size === 0) {
      errors.push(
        `File ${file.originalname} in field ${fieldName} has zero size`,
      );
    }

    if (file.size > FILE_UPLOAD_CONFIG.MAX_FILE_SIZE) {
      errors.push(
        `File ${file.originalname} in field ${fieldName} is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Maximum size: ${FILE_UPLOAD_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`,
      );
    }

    if (!isAllowedMimeType(file.mimetype)) {
      errors.push(
        `File ${file.originalname} in field ${fieldName} has unsupported format (${file.mimetype}). Allowed formats: ${FILE_UPLOAD_CONFIG.ALLOWED_FILE_EXTENSIONS.join(', ')}`,
      );
    }

    const fileExtension = getFileExtension(file.originalname);
    if (!isAllowedExtension(fileExtension)) {
      errors.push(
        `File ${file.originalname} in field ${fieldName} has unsupported extension (${fileExtension}). Allowed extensions: ${FILE_UPLOAD_CONFIG.ALLOWED_FILE_EXTENSIONS.join(', ')}`,
      );
    }

    if (!validateMagicNumber(file)) {
      errors.push(
        `File ${file.originalname} in field ${fieldName} failed magic number validation. File content does not match declared type.`,
      );
    }

    if (errors.length > 0) {
      throw new BadRequestException(
        `File validation failed:\n${errors.join('\n')}`,
      );
    }
  }
}

export const validateFilesNotEmpty = (
  files: Record<string, MemoryUploadedFile[]>,
): void => {
  const emptyFiles: string[] = [];

  for (const [fieldName, fileArray] of Object.entries(files)) {
    if (!fileArray?.length) {
      continue;
    }

    for (const file of fileArray) {
      if (!file.buffer?.length || file.size === 0) {
        emptyFiles.push(`${fieldName}: ${file.originalname}`);
      }
    }
  }

  if (emptyFiles.length > 0) {
    throw new BadRequestException(
      `The following files are empty and cannot be uploaded: ${emptyFiles.join(', ')}`,
    );
  }
};

export const validateSingleFileNotEmpty = (
  file: MemoryUploadedFile,
  fieldName: string,
): void => {
  if (!file.buffer?.length) {
    throw new BadRequestException(
      `File ${file.originalname} in field ${fieldName} is empty and cannot be uploaded`,
    );
  }

  if (file.size === 0) {
    throw new BadRequestException(
      `File ${file.originalname} in field ${fieldName} has zero size and cannot be uploaded`,
    );
  }
};

export const createFileFieldsInterceptor = (
  fields: Array<{ name: string; maxCount?: number }>,
) =>
  FileFieldsInterceptor(fields, {
    limits: { fileSize: FILE_UPLOAD_CONFIG.MAX_FILE_SIZE },
    fileFilter,
  });

export const createFileInterceptor = (fieldName: string) =>
  FileInterceptor(fieldName, {
    limits: { fileSize: FILE_UPLOAD_CONFIG.MAX_FILE_SIZE },
    fileFilter,
  });

export const getFileSizeError = (): string =>
  `File size exceeds the maximum limit of ${FILE_UPLOAD_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`;

export const getFileTypeError = (): string =>
  `Invalid file type. Allowed types: ${FILE_UPLOAD_CONFIG.ALLOWED_FILE_EXTENSIONS.join(', ')}`;

export const getEmptyFileError = (): string =>
  'File cannot be empty. Please ensure the file contains data before uploading.';

export const uploadSingleDocument = async (
  file: MemoryUploadedFile,
  folder: string,
): Promise<string> => {
  if (!file.buffer?.length) {
    throw new BadRequestException(
      `File ${file.originalname} is empty and cannot be uploaded`,
    );
  }

  const uploadResult = await uploadFileToCloudinary(file.buffer, folder);
  const url = uploadResult?.secure_url;

  if (!url) {
    throw new BadRequestException(
      `Upload failed for file ${file.originalname}`,
    );
  }

  return url;
};
