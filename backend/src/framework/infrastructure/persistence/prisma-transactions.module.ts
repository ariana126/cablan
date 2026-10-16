import { Module } from '@nestjs/common';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { ClsModule } from 'nestjs-cls';

import { PrismaModule } from './prisma.module';
import { PrismaService } from './prisma.service';

/**
 * The ambient Prisma transaction (ADR 0007). Registers `nestjs-cls`
 * globally with the transactional plugin, which makes
 * `TransactionHost<TransactionalAdapterPrisma<PrismaService>>` injectable
 * everywhere:
 *
 * - `txHost.withTransaction(fn)` opens an interactive transaction, or
 *   joins the open one (default propagation `Required`). It creates a CLS
 *   context when none is active, so a save outside any request (e.g.
 *   `DefaultAdminSeeder` at boot) works too.
 * - `txHost.tx` is the transaction client inside one, and the plain
 *   `PrismaService` outside.
 *
 * A module of its own, rather than inline in `AppModule`, so the backend
 * integration suite imports exactly this configuration.
 */
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
      plugins: [
        new ClsPluginTransactional({
          imports: [PrismaModule],
          adapter: new TransactionalAdapterPrisma<PrismaService>({
            prismaInjectionToken: PrismaService,
          }),
        }),
      ],
    }),
  ],
})
export class PrismaTransactionsModule {}
