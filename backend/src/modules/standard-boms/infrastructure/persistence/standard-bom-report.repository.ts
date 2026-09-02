import { Identity } from '@framework/domain';
import { PrismaService } from '@framework/infrastructure';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  StandardBomExportRecord,
  StandardBomFilterOptionsRecord,
  StandardBomReportCriteria,
  StandardBomReportFilters,
  StandardBomReportItemRecord,
  StandardBomReportRepository,
  StandardBomReportSearchResult,
} from '@standard-boms/application/service/standard-bom-report.repository';

// The read-side counterpart to `PrismaStandardBomRepository`: queries the
// `standard_bom`/`standard_bom_component` tables directly for a projected,
// paginated, filtered shape instead of loading every StandardBom aggregate
// (with its full composition) and slicing it in memory — the same reason
// `PrismaBomReportRepository` earns its own port in `boms/`. See
// `src/modules/standard-boms/CLAUDE.md` and
// `src/modules/boms/CLAUDE.md`.
//
// Every method here bypasses `StandardBomMapper`/`StandardBom.fromPersistence()`
// entirely: the shapes returned are plain records for the application layer's
// read models to map, never the domain aggregate.
@Injectable()
export class PrismaStandardBomReportRepository implements StandardBomReportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async search(
    criteria: StandardBomReportCriteria,
  ): Promise<StandardBomReportSearchResult> {
    const where = toWhereInput(criteria.filters);
    const skip = (criteria.page - 1) * criteria.pageSize;
    const orderBy =
      criteria.sortBy === 'productName'
        ? [
            {
              productName:
                criteria.sortDir === 'desc'
                  ? ('desc' as const)
                  : ('asc' as const),
            },
            {
              miCode:
                criteria.sortDir === 'desc'
                  ? ('desc' as const)
                  : ('asc' as const),
            },
          ]
        : { miCode: 'asc' as const };

    const [records, total] = await Promise.all([
      this.prisma.standardBom.findMany({
        where,
        orderBy,
        skip,
        take: criteria.pageSize,
        select: {
          id: true,
          miCode: true,
          brand: true,
          productName: true,
          active: true,
        },
      }),
      this.prisma.standardBom.count({ where }),
    ]);

    const items: StandardBomReportItemRecord[] = records.map((record) => ({
      id: record.id,
      miCode: record.miCode,
      brand: record.brand,
      productName: record.productName,
      active: record.active,
    }));

    return { items, total };
  }

  async filterOptions(): Promise<StandardBomFilterOptionsRecord> {
    const [brands, productNames, components, actives, miCodes] =
      await Promise.all([
        this.prisma.standardBom.findMany({
          distinct: ['brand'],
          select: { brand: true },
        }),
        this.prisma.standardBom.findMany({
          distinct: ['productName'],
          select: { productName: true },
        }),
        this.prisma.standardBomComponent.findMany({
          distinct: ['name'],
          select: { name: true },
        }),
        this.prisma.standardBom.findMany({
          distinct: ['active'],
          select: { active: true },
        }),
        this.prisma.standardBom.findMany({
          distinct: ['miCode'],
          select: { miCode: true },
        }),
      ]);

    return {
      brands: brands.map((record) => record.brand),
      productNames: productNames.map((record) => record.productName),
      componentNames: components.map((record) => record.name),
      activeStatuses: actives
        .map((record) => record.active)
        .toSorted((a, b) => {
          if (a === b) return 0;
          return a ? 1 : -1;
        }),
      miCodes: miCodes.map((record) => record.miCode),
    };
  }

  async findDetailById(
    id: Identity,
  ): Promise<StandardBomReportItemRecord | null> {
    const record = await this.prisma.standardBom.findUnique({
      where: { id: id.asString() },
      select: {
        id: true,
        miCode: true,
        brand: true,
        productName: true,
        active: true,
      },
    });
    if (!record) {
      return null;
    }
    return {
      id: record.id,
      miCode: record.miCode,
      brand: record.brand,
      productName: record.productName,
      active: record.active,
    };
  }

  // The export set ("خروجی اکسل آنالیز های استاندارد"): every standard BOM
  // matching `filters`, unpaginated, with its full composition included —
  // reusing the same `toWhereInput()` translation `search()` uses, so the
  // filtered set exported here is always the same set `search()` would page
  // through. Mirrors `PrismaBomReportRepository.exportRecords()` in `boms/`.
  // See src/modules/standard-boms/CLAUDE.md.
  async exportRecords(
    filters: StandardBomReportFilters,
  ): Promise<StandardBomExportRecord[]> {
    const where = toWhereInput(filters);

    const records = await this.prisma.standardBom.findMany({
      where,
      orderBy: { miCode: 'asc' },
      include: { components: { include: { materials: true } } },
    });

    return records.map((record) => toExportRecord(record));
  }
}

// The full row shape `standardBom.findMany` returns once
// `components`/`materials` are included — pulled out as its own type,
// mirroring `PrismaBomReportRepository`'s `BomWithComposition`, so
// `toExportRecord` below can be unit-tested without a real database.
type StandardBomWithComposition = Prisma.StandardBomGetPayload<{
  include: { components: { include: { materials: true } } };
}>;

export function toExportRecord(
  record: StandardBomWithComposition,
): StandardBomExportRecord {
  return {
    miCode: record.miCode,
    brand: record.brand,
    standardLength: record.standardLength,
    active: record.active,
    productName: record.productName,
    description: record.description,
    components: record.components.map((component) => ({
      name: component.name,
      materials: component.materials.map((material) => ({
        name: material.name,
        weight: material.weight,
      })),
    })),
  };
}

function toWhereInput(
  filters: StandardBomReportFilters,
): Prisma.StandardBomWhereInput {
  const where: Prisma.StandardBomWhereInput = {};

  if (filters.brands !== undefined) {
    where.brand = { in: filters.brands };
  }
  if (filters.activeStatuses !== undefined) {
    // Prisma doesn't support `in` on a non-nullable boolean, but `activeStatuses`
    // is a list with at most two elements (`[true]`, `[false]`, or both). When both
    // are selected, no filter is needed (all rows match); when only one is
    // selected, use equals. An empty list means "match nothing".
    if (filters.activeStatuses.length === 0) {
      where.id = '__never__';
    } else if (filters.activeStatuses.length === 1) {
      where.active = filters.activeStatuses[0];
    }
  }
  if (filters.productNames !== undefined) {
    where.productName = { in: filters.productNames };
  }
  if (filters.componentNames !== undefined) {
    where.components = { some: { name: { in: filters.componentNames } } };
  }
  if (filters.miCodes !== undefined) {
    where.miCode = { in: filters.miCodes };
  }

  return where;
}
