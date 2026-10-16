import { DomainEventDispatcher } from '@framework/application';
import { Clock } from '@framework/domain';
import {
  ModelDelegate,
  PrismaEntityRepository,
  PrismaService,
} from '@framework/infrastructure';
import { ManufacturingInstruction } from '@manufacturing-instructions/domain/manufacturing-instruction.aggregate';
import { ManufacturingInstructionRepository } from '@manufacturing-instructions/domain/service/manufacturing-instruction.repository';
import { MiCode } from '@manufacturing-instructions/domain/value/mi-code.vo';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Prisma } from '@prisma/client';

import {
  ManufacturingInstructionComponentRecord,
  ManufacturingInstructionMapper,
  ManufacturingInstructionRecord,
} from './manufacturing-instruction.mapper';

// The full row shape `manufacturingInstruction.findUnique`/`upsert`/`delete` return once
// `components`/`materials` are included — used only inside this file to
// reshape a Prisma result into the flat `ManufacturingInstructionRecord` the domain
// mapper expects.
type ManufacturingInstructionWithComposition =
  Prisma.ManufacturingInstructionGetPayload<{
    include: { components: { include: { materials: true } } };
  }>;

// Components and materials come back in the order the aggregate's arrays
// defined, recorded as `position` by `toNestedCreate` below — Prisma
// guarantees no order on an `include` without an `orderBy`.
const COMPOSITION_INCLUDE = {
  components: {
    orderBy: { position: 'asc' },
    include: { materials: { orderBy: { position: 'asc' } } },
  },
} as const;

function toRecord(
  record: ManufacturingInstructionWithComposition,
): ManufacturingInstructionRecord {
  return {
    id: record.id,
    miCode: record.miCode,
    brand: record.brand,
    standardLength: record.standardLength,
    active: record.active,
    description: record.description,
    productId: record.productId,
    productName: record.productName,
    components: record.components.map((component) => ({
      componentId: component.componentId,
      name: component.name,
      materials: component.materials.map((material) => ({
        materialId: material.materialId,
        name: material.name,
        weight: material.weight,
      })),
    })),
  };
}

function toNestedCreate(components: ManufacturingInstructionComponentRecord[]) {
  return components.map((component, componentPosition) => ({
    componentId: component.componentId,
    name: component.name,
    position: componentPosition,
    materials: {
      create: component.materials.map((material, materialPosition) => ({
        materialId: material.materialId,
        name: material.name,
        weight: material.weight,
        position: materialPosition,
      })),
    },
  }));
}

// `created_at` carries `@default(now())` in the schema as a fallback for any
// path that doesn't set it explicitly, but a Standard BOM's registration must
// not rely on it: Postgres' own `now()` is wall-clock time, which bypasses
// the injected `Clock` port entirely (a `TunableClock` under `NODE_ENV=test`)
// — the same gap `boms/infrastructure/persistence/bom.repository.ts` had for
// `Bom.createdAt` (see its comment). So `createdAt` is stamped here, from the
// clock, on every `create` — never on `update`, since a Standard BOM's
// registration instant is immutable. Pulled out as a pure function (mirroring
// `toNestedCreate` above) so the stamping can be unit-tested without a real
// database.
export function toCreateInput(
  record: ManufacturingInstructionRecord,
  createdAt: Date,
) {
  return {
    id: record.id,
    miCode: record.miCode,
    brand: record.brand,
    standardLength: record.standardLength,
    active: record.active,
    description: record.description,
    productId: record.productId,
    productName: record.productName,
    createdAt,
    components: { create: toNestedCreate(record.components) },
  };
}

/**
 * `ModelDelegate<ManufacturingInstructionRecord>` implemented by hand rather than returned
 * as `tx.manufacturingInstruction` directly, unlike `PrismaComponentRepository`/
 * `PrismaMaterialRepository`: a manufacturing instruction's aggregate spans three tables
 * (`standard_bom`, `standard_bom_component`, `standard_bom_material`) — the
 * same reason `PrismaProductRepository` needs one. This adapter loads/saves
 * the nested shape `ManufacturingInstructionMapper` expects. See
 * `src/modules/manufacturing-instructions/CLAUDE.md`.
 */
class ManufacturingInstructionDelegate implements ModelDelegate<ManufacturingInstructionRecord> {
  constructor(
    private readonly db: Prisma.TransactionClient,
    private readonly clock: Clock,
  ) {}

  async findUnique(args: {
    where: { id: string };
  }): Promise<ManufacturingInstructionRecord | null> {
    const record = await this.db.manufacturingInstruction.findUnique({
      where: args.where,
      include: COMPOSITION_INCLUDE,
    });
    return record ? toRecord(record) : null;
  }

  async upsert(args: {
    where: { id: string };
    create: ManufacturingInstructionRecord;
    update: Omit<ManufacturingInstructionRecord, 'id'>;
  }): Promise<ManufacturingInstructionRecord> {
    const { where, create, update } = args;
    // `ManufacturingInstruction.edit()` discards the previous composition
    // in full rather than merging with it — this mirrors that literally,
    // deleting the existing `standard_bom_component` rows (cascading to
    // `standard_bom_material`) before recreating the composition the
    // aggregate now holds. Runs on the transaction
    // `PrismaEntityRepository.save()` opened (ADR 0007).
    await this.db.manufacturingInstructionComponent.deleteMany({
      where: { manufacturingInstructionId: where.id },
    });
    const saved = await this.db.manufacturingInstruction.upsert({
      where,
      create: toCreateInput(create, this.clock.now()),
      update: {
        miCode: update.miCode,
        brand: update.brand,
        standardLength: update.standardLength,
        active: update.active,
        description: update.description,
        productId: update.productId,
        productName: update.productName,
        components: { create: toNestedCreate(update.components) },
      },
      include: COMPOSITION_INCLUDE,
    });
    return toRecord(saved);
  }

  async delete(args: {
    where: { id: string };
  }): Promise<ManufacturingInstructionRecord> {
    // `onDelete: Cascade` on `standard_bom_component`/`standard_bom_material`
    // removes the rest of the composition; the master `Component`/`Material`
    // rows (and the `Product`) those lines/ids point at are untouched — they
    // are standalone aggregates with their own lifecycle.
    const record = await this.db.manufacturingInstruction.delete({
      where: args.where,
      include: COMPOSITION_INCLUDE,
    });
    return toRecord(record);
  }
}

@Injectable()
export class PrismaManufacturingInstructionRepository
  extends PrismaEntityRepository<
    ManufacturingInstruction,
    ManufacturingInstructionRecord
  >
  implements ManufacturingInstructionRepository
{
  constructor(
    txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    dispatcher: DomainEventDispatcher,
    private readonly clock: Clock,
  ) {
    super(txHost, dispatcher);
  }

  protected delegate(): ModelDelegate<ManufacturingInstructionRecord> {
    return new ManufacturingInstructionDelegate(this.txHost.tx, this.clock);
  }

  protected toDomain(
    record: ManufacturingInstructionRecord,
  ): ManufacturingInstruction {
    return ManufacturingInstructionMapper.toDomain(record);
  }

  protected toPersistence(
    entity: ManufacturingInstruction,
  ): ManufacturingInstructionRecord {
    return ManufacturingInstructionMapper.toPersistence(entity);
  }

  async findByMiCode(miCode: MiCode): Promise<ManufacturingInstruction | null> {
    const record = await this.txHost.tx.manufacturingInstruction.findUnique({
      where: { miCode: miCode.asString() },
      include: COMPOSITION_INCLUDE,
    });
    return record ? this.toDomain(toRecord(record)) : null;
  }

  async list(): Promise<ManufacturingInstruction[]> {
    const records = await this.txHost.tx.manufacturingInstruction.findMany({
      include: COMPOSITION_INCLUDE,
    });
    return records.map((record) => this.toDomain(toRecord(record)));
  }
}
