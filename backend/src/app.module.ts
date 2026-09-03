import { AuditLoggingModule } from '@audit-logging/infrastructure/audit-logging.module';
import { BomsModule } from '@boms/infrastructure/boms.module';
import { ComponentsModule } from '@components/infrastructure/components.module';
import {
  ActorContextMiddleware,
  ActorContextModule,
  AuthModule,
  ClockModule,
  EmailModule,
  HealthModule,
  PrismaModule,
  TestingModule,
} from '@framework/infrastructure';
import { IdentityModule } from '@identity/infrastructure/identity.module';
import { MaterialsModule } from '@materials/infrastructure/materials.module';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ProductsModule } from '@products/infrastructure/products.module';
import { StandardBomsModule } from '@standard-boms/infrastructure/standard-boms.module';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // `.forRoot()` (rather than a bare `CqrsModule` import) is what marks the
    // module `global: true`, so CommandBus/QueryBus/EventBus resolve in every
    // feature module and in TestingModule without each one re-importing it.
    CqrsModule.forRoot(),
    // Default rate limit for every route; AuthController.login overrides this
    // with a stricter one via @Throttle(), since it's the one unauthenticated,
    // brute-forceable endpoint in the app. This default only needs to catch a
    // single client hammering the API — 100/min was too low for that job and
    // caught legitimate rapid-fire traffic instead (the acceptance suite's own
    // testing endpoints are exempted outright below, via @SkipThrottle, since
    // they're test-harness plumbing that only ever exists in NODE_ENV=test).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 1000 }]),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level:
            config.get('LOG_LEVEL') ??
            (config.get('NODE_ENV') === 'production' ? 'info' : 'debug'),
          transport:
            config.get('NODE_ENV') === 'production'
              ? undefined
              : { target: 'pino-pretty', options: { singleLine: true } },
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'res.headers["set-cookie"]',
              'req.body.password',
              'req.body.confirmPassword',
            ],
            censor: '[REDACTED]',
          },
        },
      }),
    }),
    AuthModule,
    ActorContextModule,
    ClockModule,
    EmailModule,
    PrismaModule,
    HealthModule,
    IdentityModule,
    MaterialsModule,
    ComponentsModule,
    ProductsModule,
    StandardBomsModule,
    BomsModule,
    AuditLoggingModule,
    ...(process.env.NODE_ENV === 'test' ? [TestingModule] : []),
  ],
  controllers: [],
  // Rate limiting exists to blunt abuse from an untrusted, internet-facing
  // client. The test stack is never that — it's driven only by the
  // acceptance suite's own fixtures, which log in and register far more
  // aggressively than any real user (or attacker throttling would catch)
  // ever would in the same window. Same reasoning, same condition, as
  // TestingModule's own gate just above: off for NODE_ENV=test, on
  // everywhere else.
  providers: [
    ...(process.env.NODE_ENV === 'test'
      ? []
      : [{ provide: APP_GUARD, useClass: ThrottlerGuard }]),
  ],
})
export class AppModule implements NestModule {
  // Applies globally, ahead of every route (including public ones — see
  // `ActorContextMiddleware`'s own doc comment for why it never rejects a
  // request), so any application-layer code reading
  // `ActorContext.currentUserId()` later in the same request — currently
  // only `audit-logging`'s projector — sees it populated whenever a bearer
  // token was present.
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ActorContextMiddleware).forRoutes('*');
  }
}
