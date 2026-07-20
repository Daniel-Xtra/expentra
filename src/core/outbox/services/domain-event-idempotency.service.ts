import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/core/redis/redis.service';

const DOMAIN_HANDLER_TTL_SECONDS = 7 * 24 * 60 * 60;

@Injectable()
export class DomainEventIdempotencyService {
  private readonly logger = new Logger(DomainEventIdempotencyService.name);

  constructor(private readonly redisService: RedisService) {}

  async runOnce(
    eventType: string,
    handlerName: string,
    entityKey: string,
    handler: () => Promise<void>,
  ): Promise<void> {
    const key = `domain-handler:${eventType}:${handlerName}:${entityKey}`;
    const acquired = await this.redisService.setIfNotExists(
      key,
      '1',
      DOMAIN_HANDLER_TTL_SECONDS,
    );

    if (!acquired) {
      this.logger.debug(
        `Skipping duplicate handler ${handlerName} for ${eventType} (${entityKey})`,
      );
      return;
    }

    try {
      await handler();
    } catch (error) {
      await this.redisService.del(key);
      throw error;
    }
  }

  resolveEntityKey(outboxEventId: number): string {
    return String(outboxEventId);
  }
}
