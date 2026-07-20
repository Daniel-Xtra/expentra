import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

export const RECEIPT_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
]);

export const RECEIPT_ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg'];

/** Must match `FILE_UPLOAD_CONFIG.MAX_FILE_SIZE` in file-upload.helper.ts */
export const RECEIPT_MAX_FILE_BYTES = 3.5 * 1024 * 1024;

export const RECEIPT_STORAGE = Symbol('RECEIPT_STORAGE');

export const receiptFileFilter: MulterOptions['fileFilter'] = (
  _req,
  file,
  callback,
) => {
  const extension = file.originalname
    .toLowerCase()
    .substring(file.originalname.lastIndexOf('.'));

  if (!RECEIPT_ALLOWED_EXTENSIONS.includes(extension)) {
    return callback(
      new Error(
        `Invalid file extension. Allowed: ${RECEIPT_ALLOWED_EXTENSIONS.join(', ')}`,
      ),
      false,
    );
  }

  if (!RECEIPT_ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return callback(new Error('Receipt must be PDF, PNG, JPG, or JPEG'), false);
  }

  callback(null, true);
};
