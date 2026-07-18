import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { CorrelationModule } from './correlation/correlation.module';
import { CorrelationIdMiddleware } from './middleware/correlation-id.middleware';

@Module({
  imports: [CorrelationModule],
})
export class CoreHttpModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
