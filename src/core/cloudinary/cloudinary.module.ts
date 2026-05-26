import { Global, Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cloudinaryV2 } from '../utils/upload/cloudinary-client';

export const CLOUDINARY_CLIENT = 'CLOUDINARY_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: CLOUDINARY_CLIENT,
      useFactory: (config: ConfigService) => {
        // Ensure required env vars are present; throws if missing
        const cloudName = config.getOrThrow<string>('CLOUDINARY_CLOUD_NAME');
        const apiKey = config.getOrThrow<string>('CLOUDINARY_API_KEY');
        const apiSecret = config.getOrThrow<string>('CLOUDINARY_API_SECRET');

        // Configure the singleton SDK instance once
        cloudinaryV2.config({
          cloud_name: cloudName,
          api_key: apiKey,
          api_secret: apiSecret,
        });

        return cloudinaryV2;
      },
      inject: [ConfigService],
    } as Provider,
  ],
  exports: [CLOUDINARY_CLIENT],
})
export class CloudinaryModule {}
