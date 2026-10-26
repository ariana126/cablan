import { randomUUID } from 'node:crypto';

import { AuditLoggingModule } from '@audit-logging/infrastructure/audit-logging.module';
import {
  BomDashboardRepository,
  ProductDashboardSummaryRecord,
} from '@boms/application/service/bom-dashboard.repository';
import { Bom } from '@boms/domain/bom.aggregate';
import { BomRepository } from '@boms/domain/service/bom.repository';
import { ApprovalStatus } from '@boms/domain/value/approval-status';
import { BomComponentLine } from '@boms/domain/value/bom-component-line.vo';
import { BomMaterialLine } from '@boms/domain/value/bom-material-line.vo';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { TrackingNumber } from '@boms/domain/value/tracking-number.vo';
import { Weight } from '@boms/domain/value/weight.vo';
import { BomsModule } from '@boms/infrastructure/boms.module';
import { Identity } from '@framework/domain';
import {
  ActorContextModule,
  AuthModule,
  ClockModule,
  DomainEventsModule,
  EmailModule,
  PrismaModule,
  PrismaService,
  PrismaTransactionsModule,
} from '@framework/infrastructure';
import { IdentityModule } from '@identity/infrastructure/identity.module';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { Test, TestingModule } from '@nestjs/testing';

// The dashboard's approval filters against real Postgres. The `where` they
// build is the report's own `toWhereInput` (whose `''` reviewer case
// `bom-approval.int-spec.ts` pins); what only a database can show is that the
// product list's `groupBy` counts and dates only the matching daily BOMs, and
// that `''` and `[]` keep their meaning on both reads. Every case uses a fresh
// standard BOM for a fresh product id and deletes its own rows; nothing
// truncates. Daily BOMs are saved with no actor in context, so no audit entry
// is written.
function rowOf(
  rows: ProductDashboardSummaryRecord[],
  productId: string,
): ProductDashboardSummaryRecord | undefined {
  return rows.find((row) => row.productId === productId);
}

describe('daily-BOM dashboard approval filters', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let boms: BomRepository;
  let dashboard: BomDashboardRepository;
  let createdBomIds: string[] = [];
  let createdStandardBomIds: string[] = [];

  // A standard BOM row for a fresh product: the dashboard maps a daily BOM to
  // its product through it. There are no cross-module foreign keys, so the
  // product id need not name a real product.
  async function standardBomOfNewProduct() {
    const standardBom = {
      id: randomUUID(),
      miCode: `MI-${randomUUID()}`,
      productId: randomUUID(),
      productName: `Integration product ${randomUUID()}`,
    };
    await prisma.manufacturingInstruction.create({
      data: {
        ...standardBom,
        brand: 'Legrand',
        standardLength: 305,
        active: true,
      },
    });
    createdStandardBomIds.push(standardBom.id);
    return standardBom;
  }

  // Registers (and, given a reviewer, approves) a daily BOM against the
  // standard BOM, returning its id and the `createdAt` Postgres stamped.
  async function savedBom(
    standardBom: { id: string; miCode: string; productName: string },
    approvedBy?: string,
    numbers?: { orderNumber: string; trackingNumber: string },
  ): Promise<{ id: string; registeredAt: Date }> {
    const bom = Bom.register(
      Identity.fromString(standardBom.id),
      standardBom.miCode,
      'Legrand',
      standardBom.productName,
      305,
      OrderNumber.fromString(numbers?.orderNumber ?? `ORD-${randomUUID()}`),
      TrackingNumber.fromString(
        numbers?.trackingNumber ?? `TRK-${randomUUID()}`,
      ),
      undefined,
      'نیکروش',
      [
        BomComponentLine.of(Identity.new(), 'Core', [
          BomMaterialLine.of(Identity.new(), 'Copper', Weight.ofGrams(12)),
        ]),
      ],
    );
    if (approvedBy !== undefined) {
      bom.approve(approvedBy);
    }
    createdBomIds.push(bom.id.asString());
    await boms.save(bom);
    const row = await prisma.bom.findUniqueOrThrow({
      where: { id: bom.id.asString() },
      select: { createdAt: true },
    });
    return { id: bom.id.asString(), registeredAt: row.createdAt };
  }

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        // The container's environment (.env.test via Compose) is the config.
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        CqrsModule.forRoot(),
        AuthModule,
        ActorContextModule,
        ClockModule,
        EmailModule,
        PrismaModule,
        PrismaTransactionsModule,
        DomainEventsModule,
        IdentityModule,
        BomsModule,
        AuditLoggingModule,
      ],
    }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaService, { strict: false });
    boms = moduleRef.get(BomRepository, { strict: false });
    dashboard = moduleRef.get(BomDashboardRepository, { strict: false });
  });

  afterEach(async () => {
    await prisma.bom.deleteMany({ where: { id: { in: createdBomIds } } });
    await prisma.manufacturingInstruction.deleteMany({
      where: { id: { in: createdStandardBomIds } },
    });
    createdBomIds = [];
    createdStandardBomIds = [];
  });

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('counts and dates a product over its matching daily BOMs only', async () => {
    const standardBom = await standardBomOfNewProduct();
    const approved = await savedBom(standardBom, 'مصطفی');
    const pending = await savedBom(standardBom);

    const unfiltered = await dashboard.listDashboardProducts({});
    const onlyApproved = await dashboard.listDashboardProducts({
      approvalStatuses: [ApprovalStatus.Approved],
    });

    // `createdAt` is Postgres' `now()`, not the test stack's pinned clock, so
    // the two registrations' instants are compared as stored, not assumed.
    const newest = new Date(
      Math.max(approved.registeredAt.getTime(), pending.registeredAt.getTime()),
    );
    expect(rowOf(unfiltered, standardBom.productId)).toEqual(
      expect.objectContaining({ dailyBomCount: 2, lastRegisteredAt: newest }),
    );
    expect(rowOf(onlyApproved, standardBom.productId)).toEqual(
      expect.objectContaining({
        dailyBomCount: 1,
        lastRegisteredAt: approved.registeredAt,
      }),
    );
  });

  it('drops a product none of whose daily BOMs match', async () => {
    const standardBom = await standardBomOfNewProduct();
    await savedBom(standardBom);

    const approvedByMostafa = await dashboard.listDashboardProducts({
      reviewers: ['مصطفی'],
    });
    const nothing = await dashboard.listDashboardProducts({
      approvalStatuses: [],
    });

    expect(rowOf(approvedByMostafa, standardBom.productId)).toBeUndefined();
    expect(rowOf(nothing, standardBom.productId)).toBeUndefined();
  });

  it("reads '' among the reviewers as a daily BOM with no reviewer, on the per-product list", async () => {
    const standardBom = await standardBomOfNewProduct();
    const approved = await savedBom(standardBom, 'مصطفی');
    const pending = await savedBom(standardBom);
    const productId = Identity.fromString(standardBom.productId);

    const noReviewer = await dashboard.listProductDailyBoms(productId, {
      reviewers: [''],
    });
    const mostafaOrNone = await dashboard.listProductDailyBoms(productId, {
      reviewers: ['مصطفی', ''],
    });
    const approvedWithNoApprover = await dashboard.listProductDailyBoms(
      productId,
      { approvalStatuses: [ApprovalStatus.Approved], reviewers: [''] },
    );

    expect(noReviewer.map((record) => record.id)).toEqual([pending.id]);
    expect(mostafaOrNone).toHaveLength(2);
    expect(mostafaOrNone.map((record) => record.id)).toEqual(
      expect.arrayContaining([approved.id, pending.id]),
    );
    // Both filters must hold, and an approved daily BOM always has a reviewer.
    expect(approvedWithNoApprover).toEqual([]);
  });

  it('matches order and tracking numbers by a trimmed, case-insensitive substring', async () => {
    // A token unique to this run keeps the searches from matching other rows.
    const token = randomUUID().slice(0, 8).toUpperCase();
    const standardBom = await standardBomOfNewProduct();
    const first = await savedBom(standardBom, undefined, {
      orderNumber: `ORD-${token}-2001`,
      trackingNumber: `TRK-${token}-6001`,
    });
    const second = await savedBom(standardBom, undefined, {
      orderNumber: `ORD-${token}-2002`,
      trackingNumber: `TRK-${token}-7001`,
    });
    const productId = Identity.fromString(standardBom.productId);

    const byTrackingPrefix = await dashboard.listDashboardProducts({
      trackingNumber: `  trk-${token.toLowerCase()}-600 `,
    });
    const byBothNumbers = await dashboard.listProductDailyBoms(productId, {
      orderNumber: `${token}-200`,
      trackingNumber: '7001',
    });
    const blank = await dashboard.listProductDailyBoms(productId, {
      orderNumber: ' '.repeat(3),
    });

    expect(rowOf(byTrackingPrefix, standardBom.productId)).toEqual(
      expect.objectContaining({
        dailyBomCount: 1,
        lastRegisteredAt: first.registeredAt,
      }),
    );
    expect(byBothNumbers.map((record) => record.id)).toEqual([second.id]);
    expect(blank).toHaveLength(2);
  });
});
