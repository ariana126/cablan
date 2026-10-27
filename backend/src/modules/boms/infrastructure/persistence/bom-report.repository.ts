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

import { toApprovalStatus } from './approval-status.column';
import { idsWithLaterRegistration } from './later-registration';

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
// Components and materials in the order the daily BOM defines them (its
// `position` columns, cloned from the standard BOM's order at registration)
// — the order the detail view and the per-BOM export columns rely on.
// Newest registration first; `registrationSequence` orders BOMs registered at
// the same instant (a pinned test clock) the way re-sampling reads "latest".
const NEWEST_REGISTRATION_FIRST: Prisma.BomOrderByWithRelationInput[] = [
  { createdAt: 'desc' },
  { registrationSequence: 'desc' },
];

const ORDERED_COMPOSITION = {
  components: {
    orderBy: { position: 'asc' },
    include: { materials: { orderBy: { position: 'asc' } } },
  },
} as const;

@Injectable()
export class PrismaBomReportRepository implements BomReportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async search(criteria: BomReportCriteria): Promise<BomReportSearchResult> {
    const where = toWhereInput(criteria.filters);
    const skip = (criteria.page - 1) * criteria.pageSize;

    const [records, total] = await Promise.all([
      this.prisma.bom.findMany({
        where,
        orderBy: NEWEST_REGISTRATION_FIRST,
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
          approvalStatus: true,
          reviewedBy: true,
          managementNote: true,
        },
      }),
      this.prisma.bom.count({ where }),
    ]);
    const later = await idsWithLaterRegistration(
      this.prisma,
      records.map((record) => record.id),
    );

    const items: BomReportItemRecord[] = records.map((record) => ({
      id: record.id,
      orderNumber: record.orderNumber,
      trackingNumber: record.trackingNumber,
      registeredAt: record.createdAt,
      registeredBy: record.registeredBy,
      standardBomMiCode: record.standardBomMiCode,
      brand: record.brand,
      productName: record.productName,
      approvalStatus: toApprovalStatus(record.approvalStatus),
      reviewedBy: record.reviewedBy,
      managementNote: record.managementNote,
      isLatestOfTrackingNumber: !later.has(record.id),
    }));

    return { items, total };
  }

  async filterOptions(): Promise<BomFilterOptionsRecord> {
    const [
      orderNumbers,
      trackingNumbers,
      brands,
      standardBomMiCodes,
      productNames,
      registeredByUsers,
      components,
      approvalStatuses,
      reviewers,
    ] = await Promise.all([
      this.prisma.bom.findMany({
        distinct: ['orderNumber'],
        select: { orderNumber: true },
        orderBy: { orderNumber: 'asc' },
      }),
      this.prisma.bom.findMany({
        distinct: ['trackingNumber'],
        select: { trackingNumber: true },
        orderBy: { trackingNumber: 'asc' },
      }),
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
      this.prisma.bom.findMany({
        distinct: ['approvalStatus'],
        select: { approvalStatus: true },
        orderBy: { approvalStatus: 'asc' },
      }),
      // Only reviewed BOMs — approved or rejected — have a reviewer; the
      // nulls are not an option.
      this.prisma.bom.findMany({
        where: { reviewedBy: { not: null } },
        distinct: ['reviewedBy'],
        select: { reviewedBy: true },
        orderBy: { reviewedBy: 'asc' },
      }),
    ]);

    return {
      orderNumbers: orderNumbers.map((record) => record.orderNumber),
      trackingNumbers: trackingNumbers.map((record) => record.trackingNumber),
      brands: brands.map((record) => record.brand),
      componentNames: components.map((record) => record.name),
      standardBomMiCodes: standardBomMiCodes.map(
        (record) => record.standardBomMiCode,
      ),
      productNames: productNames.map((record) => record.productName),
      registeredByUsers: registeredByUsers.map((record) => record.registeredBy),
      approvalStatuses: approvalStatuses.map((record) =>
        toApprovalStatus(record.approvalStatus),
      ),
      reviewers: reviewers.flatMap((record) =>
        record.reviewedBy === null ? [] : [record.reviewedBy],
      ),
    };
  }

  async findDetailById(id: Identity): Promise<BomDetailRecord | null> {
    const record = await this.prisma.bom.findUnique({
      where: { id: id.asString() },
      include: ORDERED_COMPOSITION,
    });
    if (!record) {
      return null;
    }
    const later = await idsWithLaterRegistration(this.prisma, [record.id]);

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
      approvalStatus: toApprovalStatus(record.approvalStatus),
      reviewedBy: record.reviewedBy,
      managementNote: record.managementNote,
      isLatestOfTrackingNumber: !later.has(record.id),
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
      orderBy: NEWEST_REGISTRATION_FIRST,
      include: ORDERED_COMPOSITION,
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
    approvalStatus: toApprovalStatus(record.approvalStatus),
    reviewedBy: record.reviewedBy,
    managementNote: record.managementNote,
    components: record.components.map((component) => ({
      name: component.name,
      materials: component.materials.map((material) => ({
        name: material.name,
        weight: material.weight,
      })),
    })),
  };
}

// Each present filter becomes its own entry in `AND`, so no condition can
// overwrite another — two filters that both need an `OR` (as the reviewer one
// does) still combine. `in: []` — Prisma's translation of "match nothing" — is
// exactly what an empty-array filter value produces here, since a condition is
// only added at all when the filter key is present (`undefined` means
// unfiltered): the caller-visible absent-vs-empty distinction documented on
// `BomReportFilters` falls directly out of this, with no extra branching.
// Exported so the translation can be unit-tested without a database.
export function toWhereInput(filters: BomReportFilters): Prisma.BomWhereInput {
  const conditions: Prisma.BomWhereInput[] = [];

  if (filters.orderNumbers !== undefined) {
    conditions.push({ orderNumber: { in: filters.orderNumbers } });
  }
  if (filters.trackingNumbers !== undefined) {
    conditions.push({ trackingNumber: { in: filters.trackingNumbers } });
  }
  if (filters.brands !== undefined) {
    conditions.push({ brand: { in: filters.brands } });
  }
  if (filters.standardBomMiCodes !== undefined) {
    conditions.push({ standardBomMiCode: { in: filters.standardBomMiCodes } });
  }
  if (filters.productNames !== undefined) {
    conditions.push({ productName: { in: filters.productNames } });
  }
  if (filters.registeredByUsers !== undefined) {
    conditions.push({ registeredBy: { in: filters.registeredByUsers } });
  }
  if (filters.approvalStatuses !== undefined) {
    conditions.push({ approvalStatus: { in: filters.approvalStatuses } });
  }
  if (filters.reviewers !== undefined) {
    conditions.push(toReviewerWhere(filters.reviewers));
  }
  if (filters.componentNames !== undefined) {
    conditions.push({
      components: { some: { name: { in: filters.componentNames } } },
    });
  }
  if (
    filters.registeredAtFrom !== undefined ||
    filters.registeredAtTo !== undefined
  ) {
    conditions.push({
      createdAt: {
        ...(filters.registeredAtFrom === undefined
          ? {}
          : { gte: filters.registeredAtFrom }),
        ...(filters.registeredAtTo === undefined
          ? {}
          : { lte: filters.registeredAtTo }),
      },
    });
  }

  return conditions.length === 0 ? {} : { AND: conditions };
}

const NO_REVIEWER = '';

// `''` among the reviewers stands for "no reviewer" — the report's «بدون
// تایید/رد کننده» option, i.e. a pending BOM — and matches
// `reviewed_by IS NULL`, which a SQL `IN` never does. Every other entry is a
// reviewer's name, matching the BOMs that reviewer approved *or* rejected.
// `[]` still matches nothing (`in: []`).
function toReviewerWhere(reviewers: string[]): Prisma.BomWhereInput {
  const names = reviewers.filter((reviewer) => reviewer !== NO_REVIEWER);
  if (!reviewers.includes(NO_REVIEWER)) {
    return { reviewedBy: { in: names } };
  }
  if (names.length === 0) {
    return { reviewedBy: null };
  }
  return { OR: [{ reviewedBy: { in: names } }, { reviewedBy: null }] };
}
