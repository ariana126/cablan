import { DomainEventDispatcher } from '@framework/application';
import {
  AggregateRoot,
  EntityNotFound,
  EntityRepository,
  Identity,
} from '@framework/domain';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';

import { PrismaService } from './prisma.service';

export interface ModelDelegate<PModel> {
  findUnique(args: { where: { id: string } }): Promise<PModel | null>;
  upsert(args: {
    where: { id: string };
    create: PModel;
    update: Omit<PModel, 'id'>;
  }): Promise<PModel>;
  delete(args: { where: { id: string } }): Promise<PModel>;
}

/**
 * Writes an aggregate and delivers its released domain events in **one**
 * Postgres transaction (ADR 0007). `save()`/`delete()` open it with
 * `txHost.withTransaction()`, joining any transaction already open, then
 * write through `delegate()` and await `DomainEventDispatcher.dispatch()`.
 * A subscriber's failure (e.g. the audit projection) rolls the write back.
 *
 * Every Prisma access a subclass makes must go through `this.txHost.tx`
 * (the transaction client inside one, plain `PrismaService` outside), never
 * an injected `PrismaService`, or it runs on another connection outside the
 * transaction.
 */
export abstract class PrismaEntityRepository<
  T extends AggregateRoot,
  PModel extends { id: string },
> extends EntityRepository<T> {
  constructor(
    protected readonly txHost: TransactionHost<
      TransactionalAdapterPrisma<PrismaService>
    >,
    private readonly dispatcher: DomainEventDispatcher,
  ) {
    super();
  }

  /**
   * This aggregate's delegate, built from `this.txHost.tx` on **every**
   * call. Never cache it: the transaction client differs per transaction.
   */
  protected abstract delegate(): ModelDelegate<PModel>;
  protected abstract toDomain(record: PModel): T;
  protected abstract toPersistence(entity: T): PModel;

  async find(id: Identity): Promise<T | null> {
    const record = await this.delegate().findUnique({
      where: { id: id.asString() },
    });
    return record ? this.toDomain(record) : null;
  }

  async get(id: Identity): Promise<T> {
    const entity = await this.find(id);
    if (!entity) throw EntityNotFound.withId(id);
    return entity;
  }

  async save(entity: T): Promise<void> {
    const data = this.toPersistence(entity);
    const { id, ...updateData } = data;
    await this.txHost.withTransaction(async () => {
      await this.delegate().upsert({
        where: { id },
        create: data,
        update: updateData,
      });
      await this.dispatcher.dispatch(entity.releaseEvents());
    });
  }

  /**
   * Hard delete: removes the row outright rather than upserting a flag.
   * Not part of the abstract `EntityRepository` base — most aggregates
   * (e.g. `User`) soft-delete through the ordinary `save()` upsert instead,
   * so this is opt-in per module port (see `MaterialRepository`).
   */
  async delete(entity: T): Promise<void> {
    await this.txHost.withTransaction(async () => {
      await this.delegate().delete({ where: { id: entity.id.asString() } });
      await this.dispatcher.dispatch(entity.releaseEvents());
    });
  }
}
