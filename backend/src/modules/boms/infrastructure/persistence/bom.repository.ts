import { Bom } from '@boms/domain/bom.aggregate';
import { BomRepository } from '@boms/domain/service/bom.repository';
import { DomainEventDispatcher } from '@framework/application';
import { Clock } from '@framework/domain';
import {
  ModelDelegate,
  PrismaEntityRepository,
  PrismaService,
} from '@framework/infrastructure';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Prisma } from '@prisma/client';

import { BomComponentRecord, BomMapper, BomRecord } from './bom.mapper';

// The full row shape `bom.findUnique`/`upsert`/`delete` return once
// `components`/`materials` are included — used only inside this file to
// reshape a Prisma result into the flat `BomRecord` the domain mapper
// expects.
type BomWithComposition = Prisma.BomGetPayload<{
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

function toRecord(record: BomWithComposition): BomRecord {
  return {
    id: record.id,
    standardBomId: record.standardBomId,
    standardBomMiCode: record.standardBomMiCode,
    brand: record.brand,
    productName: record.productName,
    standardLength: record.standardLength,
    orderNumber: record.orderNumber,
    trackingNumber: record.trackingNumber,
    description: record.description,
    registeredBy: record.registeredBy,
    approvalStatus: record.approvalStatus,
    approvedBy: record.approvedBy,
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

function toNestedCreate(components: BomComponentRecord[]) {
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
// path that doesn't set it explicitly, but a daily BOM's registration must
// not rely on it: Postgres' own `now()` is wall-clock time, which bypasses
// the injected `Clock` port entirely (a `TunableClock` under `NODE_ENV=test`)
// and produces a `registeredAt` the reporting queries' `registeredAtFrom`/
// `registeredAtTo` filters can never match against a test-frozen instant. So
// `createdAt` is stamped here, from the clock, on every `create` — never on
// `update`, since a daily BOM's registration instant is immutable. Pulled out
// as a pure function (mirroring `toNestedCreate` above) so the stamping can
// be unit-tested without a real database.
export function toCreateInput(record: BomRecord, createdAt: Date) {
  return {
    id: record.id,
    standardBomId: record.standardBomId,
    standardBomMiCode: record.standardBomMiCode,
    brand: record.brand,
    productName: record.productName,
    standardLength: record.standardLength,
    orderNumber: record.orderNumber,
    trackingNumber: record.trackingNumber,
    description: record.description,
    registeredBy: record.registeredBy,
    approvalStatus: record.approvalStatus,
    approvedBy: record.approvedBy,
    createdAt,
    components: { create: toNestedCreate(record.components) },
  };
}

/**
 * `ModelDelegate<BomRecord>` implemented by hand rather than returned as
 * `tx.bom` directly, unlike `PrismaComponentRepository`/
 * `PrismaMaterialRepository`: a daily BOM's aggregate spans three tables
 * (`bom`, `bom_component`, `bom_material`) — the same reason
 * `PrismaManufacturingInstructionRepository` needs one. This adapter loads/saves the
 * nested shape `BomMapper` expects. See src/modules/boms/CLAUDE.md.
 */
class BomDelegate implements ModelDelegate<BomRecord> {
  constructor(
    private readonly db: Prisma.TransactionClient,
    private readonly clock: Clock,
  ) {}

  async findUnique(args: { where: { id: string } }): Promise<BomRecord | null> {
    const record = await this.db.bom.findUnique({
      where: args.where,
      include: COMPOSITION_INCLUDE,
    });
    return record ? toRecord(record) : null;
  }

  async upsert(args: {
    where: { id: string };
    create: BomRecord;
    update: Omit<BomRecord, 'id'>;
  }): Promise<BomRecord> {
    const { where, create, update } = args;
    // `Bom.edit()` discards the previous composition in full rather than
    // merging with it — this mirrors that literally, deleting the daily
    // BOM's existing `bom_component` rows (cascading to `bom_material`)
    // before recreating the composition the aggregate now holds. Runs on
    // the transaction `PrismaEntityRepository.save()` opened, so both
    // statements commit or roll back together with the BOM's events'
    // subscribers (ADR 0007).
    await this.db.bomComponent.deleteMany({ where: { bomId: where.id } });
    const saved = await this.db.bom.upsert({
      where,
      create: toCreateInput(create, this.clock.now()),
      update: {
        standardBomId: update.standardBomId,
        standardBomMiCode: update.standardBomMiCode,
        brand: update.brand,
        productName: update.productName,
        standardLength: update.standardLength,
        orderNumber: update.orderNumber,
        trackingNumber: update.trackingNumber,
        description: update.description,
        registeredBy: update.registeredBy,
        approvalStatus: update.approvalStatus,
        approvedBy: update.approvedBy,
        components: { create: toNestedCreate(update.components) },
      },
      include: COMPOSITION_INCLUDE,
    });
    return toRecord(saved);
  }

  async delete(args: { where: { id: string } }): Promise<BomRecord> {
    // `onDelete: Cascade` on `bom_component`/`bom_material` removes the rest
    // of the composition; the master `Component`/`Material` rows (and the
    // standard BOM) those lines/ids point at are untouched — they are
    // standalone aggregates with their own lifecycle.
    const record = await this.db.bom.delete({
      where: args.where,
      include: COMPOSITION_INCLUDE,
    });
    return toRecord(record);
  }
}

@Injectable()
export class PrismaBomRepository
  extends PrismaEntityRepository<Bom, BomRecord>
  implements BomRepository
{
  constructor(
    txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    dispatcher: DomainEventDispatcher,
    private readonly clock: Clock,
  ) {
    super(txHost, dispatcher);
  }

  protected delegate(): ModelDelegate<BomRecord> {
    return new BomDelegate(this.txHost.tx, this.clock);
  }

  protected toDomain(record: BomRecord): Bom {
    return BomMapper.toDomain(record);
  }

  protected toPersistence(entity: Bom): BomRecord {
    return BomMapper.toPersistence(entity);
  }

  async list(): Promise<Bom[]> {
    const records = await this.txHost.tx.bom.findMany({
      include: COMPOSITION_INCLUDE,
    });
    return records.map((record) => this.toDomain(toRecord(record)));
  }
}
