import {
  BomDetailRecord,
  BomExportRecord,
  BomFilterOptionsRecord,
  BomReportCriteria,
  BomReportFilters,
  BomReportItemRecord,
  BomReportRepository,
  BomReportSearchResult,
} from '@boms/application/service/bom-report.repository';
import { Identity } from '@framework/domain';
import { PrismaService } from '@framework/infrastructure';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

// The read-side counterpart to `PrismaBomRepository`: queries the `bom`
// table directly for a projected, paginated, filtered shape instead of
// loading every `Bom` aggregate and slicing it in memory. This is the first
// genuinely paginated query in the codebase — see
// src/modules/boms/CLAUDE.md and `handbook:architecture-guideline` for why
// that earns its own port rather than another method on `BomRepository`.
//
// Every method here bypasses `Bom.fromPersistence()`/`BomMapper` entirely:
// the shapes returned are plain records for the application layer's read
// models to map, never the domain aggregate.
@Injectable()
export class PrismaBomReportRepository implements BomReportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async search(criteria: BomReportCriteria): Promise<BomReportSearchResult> {
    const where = toWhereInput(criteria.filters);
    const skip = (criteria.page - 1) * criteria.pageSize;

    const [records, total] = await Promise.all([
      this.prisma.bom.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: criteria.pageSize,
        select: {
          id: true,
          orderNumber: true,
          trackingNumber: true,
          createdAt: true,
          registeredBy: true,
          standardBomMiCode: true,
          brand: true,
          productName: true,
        },
      }),
      this.prisma.bom.count({ where }),
    ]);

    const items: BomReportItemRecord[] = records.map((record) => ({
      id: record.id,
      orderNumber: record.orderNumber,
      trackingNumber: record.trackingNumber,
      registeredAt: record.createdAt,
      registeredBy: record.registeredBy,
      standardBomMiCode: record.standardBomMiCode,
      brand: record.brand,
      productName: record.productName,
    }));

    return { items, total };
  }

  async filterOptions(): Promise<BomFilterOptionsRecord> {
    const [
      brands,
      standardBomMiCodes,
      productNames,
      registeredByUsers,
      components,
    ] = await Promise.all([
      this.prisma.bom.findMany({
        distinct: ['brand'],
        select: { brand: true },
      }),
      this.prisma.bom.findMany({
        distinct: ['standardBomMiCode'],
        select: { standardBomMiCode: true },
      }),
      this.prisma.bom.findMany({
        distinct: ['productName'],
        select: { productName: true },
      }),
      this.prisma.bom.findMany({
        distinct: ['registeredBy'],
        select: { registeredBy: true },
      }),
      this.prisma.bomComponent.findMany({
        distinct: ['name'],
        select: { name: true },
      }),
    ]);

    return {
      brands: brands.map((record) => record.brand),
      componentNames: components.map((record) => record.name),
      standardBomMiCodes: standardBomMiCodes.map(
        (record) => record.standardBomMiCode,
      ),
      productNames: productNames.map((record) => record.productName),
      registeredByUsers: registeredByUsers.map((record) => record.registeredBy),
    };
  }

  async findDetailById(id: Identity): Promise<BomDetailRecord | null> {
    const record = await this.prisma.bom.findUnique({
      where: { id: id.asString() },
      include: { components: { include: { materials: true } } },
    });
    if (!record) {
      return null;
    }

    return {
      id: record.id,
      standardBomId: record.standardBomId,
      standardBomMiCode: record.standardBomMiCode,
      brand: record.brand,
      productName: record.productName,
      standardLength: record.standardLength,
      orderNumber: record.orderNumber,
      trackingNumber: record.trackingNumber,
      registeredBy: record.registeredBy,
      registeredAt: record.createdAt,
      description: record.description,
      components: record.components.map((component) => ({
        id: component.componentId,
        name: component.name,
        materials: component.materials.map((material) => ({
          id: material.materialId,
          name: material.name,
          weight: material.weight,
        })),
      })),
    };
  }

  // The export set ("خروجی اکسل آنالیز های روزانه"): every daily BOM
  // matching `filters`, unpaginated, with its full composition included —
  // reusing the same `toWhereInput()` translation `search()` uses, so the
  // filtered set exported here is always the same set `search()` would page
  // through. See src/modules/boms/CLAUDE.md.
  async exportRecords(filters: BomReportFilters): Promise<BomExportRecord[]> {
    const where = toWhereInput(filters);

    const records = await this.prisma.bom.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { components: { include: { materials: true } } },
    });

    return records.map((record) => toExportRecord(record));
  }
}

// The full row shape `bom.findMany` returns once `components`/`materials`
// are included — pulled out as its own type, mirroring `PrismaBomRepository`'s
// `BomWithComposition`, so `toExportRecord` below can be unit-tested without
// a real database.
type BomWithComposition = Prisma.BomGetPayload<{
  include: { components: { include: { materials: true } } };
}>;

export function toExportRecord(record: BomWithComposition): BomExportRecord {
  return {
    orderNumber: record.orderNumber,
    trackingNumber: record.trackingNumber,
    registeredAt: record.createdAt,
    registeredBy: record.registeredBy,
    standardBomMiCode: record.standardBomMiCode,
    brand: record.brand,
    standardLength: record.standardLength,
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

// `in: []` — Prisma's translation of "match nothing" — is exactly what an
// empty-array filter value produces here, since a `where` clause is only
// added at all when the filter key is present (`undefined` means
// unfiltered): the caller-visible absent-vs-empty distinction documented on
// `BomReportFilters` falls directly out of this, with no extra branching.
function toWhereInput(filters: BomReportFilters): Prisma.BomWhereInput {
  const where: Prisma.BomWhereInput = {};

  if (filters.brands !== undefined) {
    where.brand = { in: filters.brands };
  }
  if (filters.standardBomMiCodes !== undefined) {
    where.standardBomMiCode = { in: filters.standardBomMiCodes };
  }
  if (filters.productNames !== undefined) {
    where.productName = { in: filters.productNames };
  }
  if (filters.registeredByUsers !== undefined) {
    where.registeredBy = { in: filters.registeredByUsers };
  }
  if (filters.componentNames !== undefined) {
    where.components = { some: { name: { in: filters.componentNames } } };
  }
  if (
    filters.registeredAtFrom !== undefined ||
    filters.registeredAtTo !== undefined
  ) {
    where.createdAt = {
      ...(filters.registeredAtFrom === undefined
        ? {}
        : { gte: filters.registeredAtFrom }),
      ...(filters.registeredAtTo === undefined
        ? {}
        : { lte: filters.registeredAtTo }),
    };
  }

  return where;
}
