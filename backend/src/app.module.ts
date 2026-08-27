import { BomsModule } from '@boms/infrastructure/boms.module';
import { ComponentsModule } from '@components/infrastructure/components.module';
import {
  AuthModule,
  ClockModule,
  EmailModule,
  HealthModule,
  PrismaModule,
  TestingModule,
} from '@framework/infrastructure';
import { IdentityModule } from '@identity/infrastructure/identity.module';
import { MaterialsModule } from '@materials/infrastructure/materials.module';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
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
    ...(process.env.NODE_ENV === 'test' ? [TestingModule] : []),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
