import { Module, Global } from '@nestjs/common';
import { RateLimiterService } from './rate-limiter.service';
import { RedisModule } from '../redis/redis.module';
import { RateLimitGuard } from './guards/rate-limit.guard';

@Global()
@Module({
  imports: [RedisModule],
  exports: [RateLimiterService, RateLimitGuard],
  providers: [RateLimiterService, RateLimitGuard],
})
export class RateLimiterModule {}
