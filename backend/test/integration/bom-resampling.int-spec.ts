import { randomUUID } from 'node:crypto';

import { AuditLoggingModule } from '@audit-logging/infrastructure/audit-logging.module';
import { BomReportRepository } from '@boms/application/service/bom-report.repository';
import { Bom } from '@boms/domain/bom.aggregate';
import { BomRepository } from '@boms/domain/service/bom.repository';
import { ApprovalStatus } from '@boms/domain/value/approval-status';
import { BomComponentLine } from '@boms/domain/value/bom-component-line.vo';
import { BomEditContext } from '@boms/domain/value/bom-edit-context.vo';
import { BomEditSource } from '@boms/domain/value/bom-edit-source';
import { BomEditor } from '@boms/domain/value/bom-editor.vo';
import { BomMaterialLine } from '@boms/domain/value/bom-material-line.vo';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { TrackingNumber } from '@boms/domain/value/tracking-number.vo';
import { Weight } from '@boms/domain/value/weight.vo';
import { BomsModule } from '@boms/infrastructure/boms.module';
import { Identity, Role } from '@framework/domain';
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

// "The latest daily BOM of its tracking number", the fact re-sampling turns
// on, as Postgres answers it — on the write side (`BomRepository`, which
// `ResampleBomHandler` asks) and the read side (`BomReportRepository`'s report
// rows and detail, which the `resamplable` flag is computed from). The test
// stack's clock is pinned, so every BOM here is registered at one instant:
// registration order must come from more than `created_at`. Each case uses a
// fresh tracking number and deletes its own rows; nothing truncates. No actor
// is in context, so no audit entry is written.
describe('daily-BOM re-sampling: the latest daily BOM of a tracking number', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let boms: BomRepository;
  let reports: BomReportRepository;
  let createdBomIds: string[] = [];

  async function registered(
    trackingNumber: string,
    status: ApprovalStatus = ApprovalStatus.Rejected,
  ): Promise<Bom> {
    const bom = Bom.register(
      Identity.new(),
      '0001',
      'Legrand',
      'Integration product',
      305,
      OrderNumber.fromString('ORD-5002'),
      TrackingNumber.fromString(trackingNumber),
      undefined,
      'نیکروش',
      [
        BomComponentLine.of(Identity.new(), 'Core', [
          BomMaterialLine.of(Identity.new(), 'Copper', Weight.ofGrams(12)),
        ]),
      ],
    );
    if (status === ApprovalStatus.Approved) {
      bom.approve('مصطفی');
    }
    if (status === ApprovalStatus.Rejected) {
      bom.reject('مصطفی', 'وزن مس خارج از محدوده است');
    }
    createdBomIds.push(bom.id.asString());
    await boms.save(bom);
    return bom;
  }

  // What the report says of each of the tracking number's BOMs, by id.
  async function reportedLatest(
    trackingNumber: string,
  ): Promise<Record<string, boolean>> {
    const { items } = await reports.search({
      page: 1,
      pageSize: 50,
      filters: { trackingNumbers: [trackingNumber] },
    });
    return Object.fromEntries(
      items.map((item) => [item.id, item.isLatestOfTrackingNumber]),
    );
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
    reports = moduleRef.get(BomReportRepository, { strict: false });
  });

  afterEach(async () => {
    await prisma.bom.deleteMany({ where: { id: { in: createdBomIds } } });
    createdBomIds = [];
  });

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('takes the only daily BOM of a tracking number as its latest', async () => {
    const trackingNumber = `TRK-${randomUUID()}`;
    const only = await registered(trackingNumber);

    expect(await boms.isLatestOfItsTrackingNumber(only.id)).toBe(true);
    expect(await reportedLatest(trackingNumber)).toEqual({
      [only.id.asString()]: true,
    });
    const detail = await reports.findDetailById(only.id);
    expect(detail?.isLatestOfTrackingNumber).toBe(true);
  });

  it('orders daily BOMs registered at the same instant by registration, the second being the latest', async () => {
    const trackingNumber = `TRK-${randomUUID()}`;
    const first = await registered(trackingNumber);
    const second = await registered(trackingNumber, ApprovalStatus.Pending);

    expect(await boms.isLatestOfItsTrackingNumber(first.id)).toBe(false);
    expect(await boms.isLatestOfItsTrackingNumber(second.id)).toBe(true);
    expect(await reportedLatest(trackingNumber)).toEqual({
      [first.id.asString()]: false,
      [second.id.asString()]: true,
    });
    const detail = await reports.findDetailById(first.id);
    expect(detail?.isLatestOfTrackingNumber).toBe(false);
  });

  it('ignores daily BOMs of other tracking numbers registered afterwards', async () => {
    const trackingNumber = `TRK-${randomUUID()}`;
    const source = await registered(trackingNumber);
    await registered(`TRK-${randomUUID()}`);

    expect(await boms.isLatestOfItsTrackingNumber(source.id)).toBe(true);
  });

  it('makes a daily BOM the latest again once the later one’s tracking number is edited away', async () => {
    const trackingNumber = `TRK-${randomUUID()}`;
    const source = await registered(trackingNumber);
    const later = await registered(trackingNumber, ApprovalStatus.Pending);
    // Precondition: not the latest until the later one is edited away.
    expect(await boms.isLatestOfItsTrackingNumber(source.id)).toBe(false);

    await boms.modify(later.id, (bom) =>
      bom.edit(
        bom.orderNumber(),
        TrackingNumber.fromString(`TRK-${randomUUID()}`),
        bom.description(),
        undefined,
        BomEditContext.of(
          'Integration inspector',
          BomEditor.withRole(Role.QcInspector),
          BomEditSource.DailyBoms,
          'شماره ردیابی اشتباه ثبت شده بود',
          new Date('2026-01-01T00:00:00.000Z'),
        ),
      ),
    );

    expect(await boms.isLatestOfItsTrackingNumber(source.id)).toBe(true);
  });

  it('makes a daily BOM the latest again once the later one is deleted', async () => {
    const trackingNumber = `TRK-${randomUUID()}`;
    const source = await registered(trackingNumber);
    const later = await registered(trackingNumber, ApprovalStatus.Pending);
    // Precondition: not the latest until the later one is deleted.
    expect(await reportedLatest(trackingNumber)).toEqual({
      [source.id.asString()]: false,
      [later.id.asString()]: true,
    });

    later.delete();
    await boms.delete(later);

    expect(await reportedLatest(trackingNumber)).toEqual({
      [source.id.asString()]: true,
    });
  });
});
