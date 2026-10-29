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
import { MaterialImportAlreadyReverted } from '@products/domain/exceptions/material-import-already-reverted.exception';
import { MaterialImport } from '@products/domain/material-import.aggregate';
import { MaterialImportRepository } from '@products/domain/service/material-import.repository';

import {
  MaterialImportMapper,
  MaterialImportRecord,
} from './material-import.mapper';

type MaterialImportWithChanges = Prisma.MaterialImportGetPayload<{
  include: { changes: true };
}>;

const CHANGES_IN_FILE_ORDER = {
  changes: { orderBy: { position: 'asc' } },
} as const;

function toRecord(record: MaterialImportWithChanges): MaterialImportRecord {
  return {
    id: record.id,
    importedAt: record.importedAt,
    revertedAt: record.revertedAt,
    changes: record.changes.map((change) => ({
      kind: change.kind,
      materialId: change.materialId,
      previousName: change.previousName,
      previousCode: change.previousCode,
      name: change.name,
      code: change.code,
    })),
  };
}

/**
 * `ModelDelegate<MaterialImportRecord>` by hand: an import spans
 * `material_import` and its `material_import_change` rows. Built per call
 * from `txHost.tx`, so it runs inside the transaction
 * `PrismaEntityRepository.save()` opened (ADR 0007).
 *
 * An import's changes never change after it is recorded, so the update path
 * of `upsert` only ever sets `reverted_at` — and does so **conditionally**,
 * on a row not yet reverted. A second reversion that raced past every check
 * (it can't, under the advisory lock confirm and revert share, but the row
 * is the last word) updates nothing and is refused as
 * `MaterialImportAlreadyReverted`, rolling its transaction back.
 */
class MaterialImportDelegate implements ModelDelegate<MaterialImportRecord> {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async findUnique(args: {
    where: { id: string };
  }): Promise<MaterialImportRecord | null> {
    const record = await this.db.materialImport.findUnique({
      where: args.where,
      include: CHANGES_IN_FILE_ORDER,
    });
    return record ? toRecord(record) : null;
  }

  async upsert(args: {
    where: { id: string };
    create: MaterialImportRecord;
    update: Omit<MaterialImportRecord, 'id'>;
  }): Promise<MaterialImportRecord> {
    const { where, create, update } = args;
    const existing = await this.db.materialImport.findUnique({ where });
    if (!existing) {
      const created = await this.db.materialImport.create({
        data: {
          id: create.id,
          importedAt: create.importedAt,
          revertedAt: create.revertedAt,
          changes: {
            create: create.changes.map((change, position) => ({
              position,
              ...change,
            })),
          },
        },
        include: CHANGES_IN_FILE_ORDER,
      });
      return toRecord(created);
    }

    // An existing import is only ever saved again by its reversion.
    if (update.revertedAt !== null) {
      const { count } = await this.db.materialImport.updateMany({
        where: { id: where.id, revertedAt: null },
        data: { revertedAt: update.revertedAt },
      });
      if (count === 0) {
        throw MaterialImportAlreadyReverted.withId(where.id);
      }
    }
    return toRecord(
      await this.db.materialImport.findUniqueOrThrow({
        where,
        include: CHANGES_IN_FILE_ORDER,
      }),
    );
  }

  async delete(args: { where: { id: string } }): Promise<MaterialImportRecord> {
    const record = await this.db.materialImport.delete({
      where: args.where,
      include: CHANGES_IN_FILE_ORDER,
    });
    return toRecord(record);
  }
}

@Injectable()
export class PrismaMaterialImportRepository
  extends PrismaEntityRepository<MaterialImport, MaterialImportRecord>
  implements MaterialImportRepository
{
  constructor(
    txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    dispatcher: DomainEventDispatcher,
  ) {
    super(txHost, dispatcher);
  }

  protected delegate(): ModelDelegate<MaterialImportRecord> {
    return new MaterialImportDelegate(this.txHost.tx);
  }

  protected toDomain(record: MaterialImportRecord): MaterialImport {
    return MaterialImportMapper.toDomain(record);
  }

  protected toPersistence(entity: MaterialImport): MaterialImportRecord {
    return MaterialImportMapper.toPersistence(entity);
  }

  async findLatestNotReverted(): Promise<MaterialImport | null> {
    const record = await this.txHost.tx.materialImport.findFirst({
      where: { revertedAt: null },
      orderBy: [{ importedAt: 'desc' }, { sequence: 'desc' }],
      include: CHANGES_IN_FILE_ORDER,
    });
    return record ? this.toDomain(toRecord(record)) : null;
  }
}
