import { Bom } from '@boms/domain/bom.aggregate';
import { BomRepository } from '@boms/domain/service/bom.repository';
import { Clock } from '@framework/domain';
import {
  ModelDelegate,
  PrismaEntityRepository,
  PrismaService,
} from '@framework/infrastructure';
import { Injectable } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { Prisma, PrismaClient } from '@prisma/client';

import { BomComponentRecord, BomMapper, BomRecord } from './bom.mapper';

// The full row shape `bom.findUnique`/`upsert`/`delete` return once
// `components`/`materials` are included — used only inside this file to
// reshape a Prisma result into the flat `BomRecord` the domain mapper
// expects.
type BomWithComposition = Prisma.BomGetPayload<{
  include: { components: { include: { materials: true } } };
}>;

const COMPOSITION_INCLUDE = {
  components: { include: { materials: true } },
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
  return components.map((component) => ({
    componentId: component.componentId,
    name: component.name,
    materials: {
      create: component.materials.map((material) => ({
        materialId: material.materialId,
        name: material.name,
        weight: material.weight,
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
    createdAt,
    components: { create: toNestedCreate(record.components) },
  };
}

/**
 * `ModelDelegate<BomRecord>` implemented by hand rather than passed as
 * `prisma.bom` directly, unlike `PrismaComponentRepository`/
 * `PrismaMaterialRepository`: a daily BOM's aggregate spans three tables
 * (`bom`, `bom_component`, `bom_material`) — the same reason
 * `PrismaStandardBomRepository` needs one. This adapter loads/saves the
 * nested shape `BomMapper` expects. See src/modules/boms/CLAUDE.md.
 */
class BomDelegate implements ModelDelegate<BomRecord> {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly clock: Clock,
  ) {}

  async findUnique(args: { where: { id: string } }): Promise<BomRecord | null> {
    const record = await this.prisma.bom.findUnique({
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
    const saved = await this.prisma.$transaction(async (tx) => {
      // `Bom.updateComponents()` discards the previous composition in full
      // rather than merging with it — this mirrors that literally, deleting
      // the daily BOM's existing `bom_component` rows (cascading to
      // `bom_material`) before recreating the composition the aggregate now
      // holds. A no-op the first time a daily BOM is saved, since nothing
      // yet references its (not-yet-existing) id.
      await tx.bomComponent.deleteMany({ where: { bomId: where.id } });
      return tx.bom.upsert({
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
          components: { create: toNestedCreate(update.components) },
        },
        include: COMPOSITION_INCLUDE,
      });
    });
    return toRecord(saved);
  }

  async delete(args: { where: { id: string } }): Promise<BomRecord> {
    // `onDelete: Cascade` on `bom_component`/`bom_material` removes the rest
    // of the composition; the master `Component`/`Material` rows (and the
    // standard BOM) those lines/ids point at are untouched — they are
    // standalone aggregates owned by their own modules.
    const record = await this.prisma.bom.delete({
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
    private readonly prisma: PrismaService,
    clock: Clock,
    eventBus: EventBus,
  ) {
    super(new BomDelegate(prisma, clock), eventBus);
  }

  protected toDomain(record: BomRecord): Bom {
    return BomMapper.toDomain(record);
  }

  protected toPersistence(entity: Bom): BomRecord {
    return BomMapper.toPersistence(entity);
  }

  async list(): Promise<Bom[]> {
    const records = await this.prisma.bom.findMany({
      include: COMPOSITION_INCLUDE,
    });
    return records.map((record) => this.toDomain(toRecord(record)));
  }
}
