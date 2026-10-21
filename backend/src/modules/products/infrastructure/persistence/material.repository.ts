import { DomainEventDispatcher } from '@framework/application';
import {
  ModelDelegate,
  PrismaEntityRepository,
  PrismaService,
} from '@framework/infrastructure';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Prisma } from '@prisma/client';
import { MaterialCodeAlreadyExists } from '@products/application/exceptions';
import { Material } from '@products/domain/material.aggregate';
import { MaterialRepository } from '@products/domain/service/material.repository';
import { MaterialCode } from '@products/domain/value/material-code.vo';
import { MaterialName } from '@products/domain/value/material-name.vo';

import { MaterialMapper, MaterialRecord } from './material.mapper';

/**
 * Whether `error` is Postgres refusing a write on the unique index over
 * `column`. Through the `PrismaPg` driver adapter, P2002 names the columns at
 * `meta.driverAdapterError.cause.constraint.fields`, not at `meta.target`.
 */
function isUniqueViolationOn(error: unknown, column: string): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return false;
  }
  const meta = error.meta as
    | {
        driverAdapterError?: {
          cause?: { constraint?: { fields?: string[] } };
        };
      }
    | undefined;
  const fields = meta?.driverAdapterError?.cause?.constraint?.fields ?? [];
  return fields.includes(column);
}

@Injectable()
export class PrismaMaterialRepository
  extends PrismaEntityRepository<Material, MaterialRecord>
  implements MaterialRepository
{
  constructor(
    txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    dispatcher: DomainEventDispatcher,
  ) {
    super(txHost, dispatcher);
  }

  /**
   * The handlers reject a taken code before saving; this is the backstop for
   * two writes that both passed that check. The unique index refuses the
   * second, and it surfaces as the same `MaterialCodeAlreadyExists` (a 409)
   * rather than a raw Prisma error (a 500).
   */
  async save(entity: Material): Promise<void> {
    try {
      await super.save(entity);
    } catch (error) {
      if (isUniqueViolationOn(error, 'code')) {
        throw MaterialCodeAlreadyExists.withCode(entity.code());
      }
      throw error;
    }
  }

  protected delegate(): ModelDelegate<MaterialRecord> {
    return this.txHost.tx.material;
  }

  protected toDomain(record: MaterialRecord): Material {
    return MaterialMapper.toDomain(record);
  }

  protected toPersistence(entity: Material): MaterialRecord {
    return MaterialMapper.toPersistence(entity);
  }

  async findByName(name: MaterialName): Promise<Material | null> {
    const record = await this.txHost.tx.material.findUnique({
      where: { name: name.asString() },
    });
    return record ? this.toDomain(record) : null;
  }

  async findByCode(code: MaterialCode): Promise<Material | null> {
    const record = await this.txHost.tx.material.findUnique({
      where: { code: code.asString() },
    });
    return record ? this.toDomain(record) : null;
  }

  async list(): Promise<Material[]> {
    const records = await this.txHost.tx.material.findMany();
    return records.map((record) => this.toDomain(record));
  }
}
