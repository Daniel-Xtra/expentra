import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';
import { AuthContextCacheService } from '../auth/auth-context-cache.service';

@Global()
@Module({
  providers: [RedisService, AuthContextCacheService],
  exports: [RedisService, AuthContextCacheService],
})
export class RedisModule {}
