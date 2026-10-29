import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';

import { UnitOfWork } from '../../application/service/unit-of-work';
import { PrismaService } from './prisma.service';

// Prisma's interactive-transaction defaults (5 s to run, 2 s to start) are
// tuned for a single save; a unit of work may apply a whole bulk import —
// a few hundred rows — and wait behind another holding the same lock.
const TRANSACTION_OPTIONS = { timeout: 60_000, maxWait: 10_000 };

/**
 * `UnitOfWork` over the ambient Prisma transaction (ADR 0007): the work runs
 * inside `txHost.withTransaction()`, which every repository's `save()` and
 * `delete()` then join. `runExclusively` first takes
 * `pg_advisory_xact_lock(hashtext(lockKey))` on that transaction, so Postgres
 * queues every other unit of work holding the same key until this one
 * commits or rolls back, and releases it then by itself.
 */
@Injectable()
export class PrismaUnitOfWork extends UnitOfWork {
  constructor(
    private readonly txHost: TransactionHost<
      TransactionalAdapterPrisma<PrismaService>
    >,
  ) {
    super();
  }

  run<T>(work: () => Promise<T>): Promise<T> {
    return this.txHost.withTransaction(TRANSACTION_OPTIONS, work);
  }

  runExclusively<T>(lockKey: string, work: () => Promise<T>): Promise<T> {
    return this.txHost.withTransaction(TRANSACTION_OPTIONS, async () => {
      await this.txHost.tx
        .$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
      return work();
    });
  }
}
