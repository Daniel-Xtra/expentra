import type { Writable } from 'stream';

export type CloudinaryV2Client = {
  config(options: {
    cloud_name?: string;
    api_key?: string;
    api_secret?: string;
  }): void;
  uploader: {
    upload(file: string, options?: Record<string, unknown>): Promise<unknown>;
    upload_stream(
      options: Record<string, unknown>,
      callback: (error: Error | undefined, result: unknown) => void,
    ): Writable;
    destroy(
      publicId: string,
      options?: Record<string, unknown>,
    ): Promise<unknown>;
  };
};

function loadCloudinaryV2(): CloudinaryV2Client {
  // CommonJS entry; keeps typed surface without relying on package export resolution in ESLint.

  const pkg = require('cloudinary') as { v2: CloudinaryV2Client };
  return pkg.v2;
}

export const cloudinaryV2 = loadCloudinaryV2();
