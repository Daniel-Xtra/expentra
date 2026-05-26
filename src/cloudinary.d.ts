declare module 'cloudinary' {
  export const v2: {
    uploader: {
      upload: (file: string | Buffer, options?: any) => Promise<any>;
      upload_stream: (
        options: any,
        callback: (error: Error | undefined, result: any) => void,
      ) => NodeJS.WritableStream;
      destroy: (publicId: string, options?: any) => Promise<any>;
    };
  };
}
