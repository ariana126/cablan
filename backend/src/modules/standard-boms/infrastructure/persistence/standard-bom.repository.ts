import { Clock } from '@framework/domain';
import {
  ModelDelegate,
  PrismaEntityRepository,
  PrismaService,
} from '@framework/infrastructure';
import { Injectable } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { Prisma, PrismaClient } from '@prisma/client';
import { StandardBomRepository } from '@standard-boms/domain/service/standard-bom.repository';
import { StandardBom } from '@standard-boms/domain/standard-bom.aggregate';
import { MiCode } from '@standard-boms/domain/value/mi-code.vo';

import {
  StandardBomComponentRecord,
  StandardBomMapper,
  StandardBomRecord,
} from './standard-bom.mapper';

// The full row shape `standardBom.findUnique`/`upsert`/`delete` return once
// `components`/`materials` are included — used only inside this file to
// reshape a Prisma result into the flat `StandardBomRecord` the domain
// mapper expects.
type StandardBomWithComposition = Prisma.StandardBomGetPayload<{
  include: { components: { include: { materials: true } } };
}>;

const COMPOSITION_INCLUDE = {
  components: { include: { materials: true } },
} as const;

function toRecord(record: StandardBomWithComposition): StandardBomRecord {
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

function toNestedCreate(components: StandardBomComponentRecord[]) {
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
// path that doesn't set it explicitly, but a Standard BOM's registration must
// not rely on it: Postgres' own `now()` is wall-clock time, which bypasses
// the injected `Clock` port entirely (a `TunableClock` under `NODE_ENV=test`)
// — the same gap `boms/infrastructure/persistence/bom.repository.ts` had for
// `Bom.createdAt` (see its comment). So `createdAt` is stamped here, from the
// clock, on every `create` — never on `update`, since a Standard BOM's
// registration instant is immutable. Pulled out as a pure function (mirroring
// `toNestedCreate` above) so the stamping can be unit-tested without a real
// database.
export function toCreateInput(record: StandardBomRecord, createdAt: Date) {
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
 * `ModelDelegate<StandardBomRecord>` implemented by hand rather than passed
 * as `prisma.standardBom` directly, unlike `PrismaComponentRepository`/
 * `PrismaMaterialRepository`: a standard BOM's aggregate spans three tables
 * (`standard_bom`, `standard_bom_component`, `standard_bom_material`) — the
 * same reason `PrismaProductRepository` needs one. This adapter loads/saves
 * the nested shape `StandardBomMapper` expects. See
 * `src/modules/standard-boms/CLAUDE.md`.
 */
class StandardBomDelegate implements ModelDelegate<StandardBomRecord> {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly clock: Clock,
  ) {}

  async findUnique(args: {
    where: { id: string };
  }): Promise<StandardBomRecord | null> {
    const record = await this.prisma.standardBom.findUnique({
      where: args.where,
      include: COMPOSITION_INCLUDE,
    });
    return record ? toRecord(record) : null;
  }

  async upsert(args: {
    where: { id: string };
    create: StandardBomRecord;
    update: Omit<StandardBomRecord, 'id'>;
  }): Promise<StandardBomRecord> {
    const { where, create, update } = args;
    const saved = await this.prisma.$transaction(async (tx) => {
      // `StandardBom.updateComponents()` discards the previous composition
      // in full rather than merging with it — this mirrors that literally,
      // deleting the standard BOM's existing `standard_bom_component` rows
      // (cascading to `standard_bom_material`) before recreating the
      // composition the aggregate now holds. A no-op the first time a
      // standard BOM is saved, since nothing yet references its
      // (not-yet-existing) id.
      await tx.standardBomComponent.deleteMany({
        where: { standardBomId: where.id },
      });
      return tx.standardBom.upsert({
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
    });
    return toRecord(saved);
  }

  async delete(args: { where: { id: string } }): Promise<StandardBomRecord> {
    // `onDelete: Cascade` on `standard_bom_component`/`standard_bom_material`
    // removes the rest of the composition; the master `Component`/`Material`
    // rows (and the `Product`) those lines/ids point at are untouched — they
    // are standalone aggregates owned by their own modules.
    const record = await this.prisma.standardBom.delete({
      where: args.where,
      include: COMPOSITION_INCLUDE,
    });
    return toRecord(record);
  }
}

@Injectable()
export class PrismaStandardBomRepository
  extends PrismaEntityRepository<StandardBom, StandardBomRecord>
  implements StandardBomRepository
{
  constructor(
    private readonly prisma: PrismaService,
    clock: Clock,
    eventBus: EventBus,
  ) {
    super(new StandardBomDelegate(prisma, clock), eventBus);
  }

  protected toDomain(record: StandardBomRecord): StandardBom {
    return StandardBomMapper.toDomain(record);
  }

  protected toPersistence(entity: StandardBom): StandardBomRecord {
    return StandardBomMapper.toPersistence(entity);
  }

  async findByMiCode(miCode: MiCode): Promise<StandardBom | null> {
    const record = await this.prisma.standardBom.findUnique({
      where: { miCode: miCode.asString() },
      include: COMPOSITION_INCLUDE,
    });
    return record ? this.toDomain(toRecord(record)) : null;
  }

  async list(): Promise<StandardBom[]> {
    const records = await this.prisma.standardBom.findMany({
      include: COMPOSITION_INCLUDE,
    });
    return records.map((record) => this.toDomain(toRecord(record)));
  }
}
