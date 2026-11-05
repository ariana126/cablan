import { randomUUID } from 'node:crypto';

import { AuditLoggingModule } from '@audit-logging/infrastructure/audit-logging.module';
import { DefineOrderCommand } from '@boms/application/commands/define-order/define-order.command';
import { DeleteOrderCommand } from '@boms/application/commands/delete-order/delete-order.command';
import { EditOrderCommand } from '@boms/application/commands/edit-order/edit-order.command';
import { OrderNumberTaken } from '@boms/application/exceptions';
import { OrderReadRepository } from '@boms/application/service/order-read.repository';
import { StandardBomLookup } from '@boms/application/service/standard-bom-lookup';
import { OrderRepository } from '@boms/domain/service/order.repository';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { BomsModule } from '@boms/infrastructure/boms.module';
import { orderBackfillSql } from '@boms/infrastructure/testing/order-backfill';
import {
  ApplyToRelatedRecords,
  RecordDependencies,
  RecordHasDependents,
} from '@framework/application';
import { Identity, Role } from '@framework/domain';
import {
  ActorContextMiddleware,
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
import { ManufacturingInstructionsModule } from '@manufacturing-instructions/infrastructure/manufacturing-instructions.module';
import { ConfigModule } from '@nestjs/config';
import { CommandBus, CqrsModule } from '@nestjs/cqrs';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ProductsModule } from '@products/infrastructure/products.module';
import { Request, Response } from 'express';

// Orders (issue #101) against Postgres, through the real module graph (no
// HTTP): the System Admin's renumbering of an order in use carried into its
// daily BOMs' `order_number` and nothing else of them; a taken number
// changing nothing; the System Admin's delete taking every daily BOM of the
// order (a re-sample and the BOM it re-samples included) with an audit entry
// each, and Management refused; a standard BOM an order assigns locked; the
// read side's sort and counts; and the `order_backfill` migration's legacy
// carry-over, re-run (idempotent, touching no daily BOM). Every case uses
// fresh values and deletes its own rows; nothing truncates.

const UNUSABLE_HASH = '$2b$10$integration.tests.never.log.in.with.this.x';
const ADMIN = ApplyToRelatedRecords.askedBy(Role.SystemAdmin, true);

function byCode(a: string, b: string): number {
  return a.localeCompare(b);
}

// A meeting point for `parties` concurrent callers: each call resolves once
// all have called, or after `timeoutMs` — whichever comes first.
function rendezvous(parties: number, timeoutMs: number): () => Promise<void> {
  let arrived = 0;
  let release: (() => void) | undefined;
  const allArrived = new Promise<void>((resolve) => {
    release = resolve;
  });
  return () => {
    arrived += 1;
    if (arrived === parties) {
      release?.();
    }
    return Promise.race([
      allArrived,
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  };
}

// An MI code as an order's read model carries it, from its standard BOM.
function assignment(of: {
  miCode: string;
  productId: string;
  productName: string;
}) {
  return {
    miCode: of.miCode,
    productId: of.productId,
    productName: of.productName,
  };
}

describe('orders', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let commandBus: CommandBus;
  let jwt: JwtService;
  let actorMiddleware: ActorContextMiddleware;
  let orderReads: OrderReadRepository;
  let orders: OrderRepository;
  let lookup: StandardBomLookup;
  let recordDependencies: RecordDependencies;
  let actorId: string;

  let standardBomIds: string[] = [];
  let bomIds: string[] = [];
  let orderNumbers: string[] = [];

  function execute<T = void>(command: object): Promise<T> {
    return commandBus.execute(command);
  }

  // As a request does: through the real ActorContextMiddleware.
  function asActor<T>(work: () => Promise<T>): Promise<T> {
    const request = {
      headers: { authorization: `Bearer ${jwt.sign({ sub: actorId })}` },
    } as unknown as Request;
    return new Promise<T>((resolve, reject) => {
      actorMiddleware.use(request, {} as Response, () => {
        work().then(resolve, reject);
      });
    });
  }

  async function orderNumberOfBom(id: string): Promise<string> {
    const bom = await prisma.bom.findUniqueOrThrow({ where: { id } });
    return bom.orderNumber;
  }

  async function orderRead(id: Identity) {
    const order = await orderReads.findById(id);
    return {
      orderNumber: order?.orderNumber,
      miCodes: order?.miCodes.map(({ miCode }) => miCode),
    };
  }

  async function runBackfill(): Promise<void> {
    await prisma.$executeRawUnsafe(orderBackfillSql());
  }

  async function idsAmong(ids: string[]): Promise<string[]> {
    const rows = await prisma.bom.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    return rows.map(({ id }) => id);
  }

  function freshOrderNumber(): string {
    const orderNumber = `ORD-${randomUUID()}`;
    orderNumbers.push(orderNumber);
    return orderNumber;
  }

  async function standardBom() {
    const created = await prisma.manufacturingInstruction.create({
      data: {
        miCode: `MI-${randomUUID()}`,
        brand: 'Legrand',
        standardLength: 305,
        active: true,
        productId: randomUUID(),
        productName: `کابل ${randomUUID()}`,
      },
    });
    standardBomIds.push(created.id);
    return created;
  }

  type StandardBomRow = Awaited<ReturnType<typeof standardBom>>;

  // A daily BOM written straight into `bom`, as a legacy one would be.
  async function dailyBom(
    orderNumber: string,
    of: StandardBomRow,
    extra: { resampledFromId?: string; approved?: boolean } = {},
  ) {
    const bom = await prisma.bom.create({
      data: {
        standardBomId: of.id,
        standardBomMiCode: of.miCode,
        brand: of.brand,
        productName: of.productName,
        standardLength: of.standardLength,
        orderNumber,
        trackingNumber: `TRK-${randomUUID()}`,
        registeredBy: 'نیکروش',
        resampledFromId: extra.resampledFromId ?? null,
        ...(extra.approved
          ? {
              approvalStatus: 'approved',
              reviewedBy: 'مصطفی',
              managementNote: null,
            }
          : {}),
        editHistory: [
          {
            editedBy: 'نیکروش',
            editedAt: '2026-01-01T00:00:00.000Z',
            reason: 'وزن اشتباه',
            changes: ['شماره ردیابی از TRK-1 به TRK-2 تغییر کرد'],
          },
        ],
        components: {
          create: [
            {
              componentId: randomUUID(),
              name: 'مغزی',
              materials: {
                create: [{ materialId: randomUUID(), name: 'مس', weight: 3 }],
              },
            },
          ],
        },
      },
    });
    bomIds.push(bom.id);
    return bom;
  }

  async function definedOrder(orderNumber: string, ...of: StandardBomRow[]) {
    const id = await asActor(() =>
      execute<string>(
        new DefineOrderCommand(
          OrderNumber.fromString(orderNumber),
          of.map((standard) => standard.miCode),
        ),
      ),
    );
    return Identity.fromString(id);
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
        ProductsModule,
        ManufacturingInstructionsModule,
        BomsModule,
        AuditLoggingModule,
      ],
    }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaService, { strict: false });
    commandBus = moduleRef.get(CommandBus, { strict: false });
    jwt = moduleRef.get(JwtService, { strict: false });
    actorMiddleware = moduleRef.get(ActorContextMiddleware, { strict: false });
    orderReads = moduleRef.get(OrderReadRepository, { strict: false });
    orders = moduleRef.get(OrderRepository, { strict: false });
    lookup = moduleRef.get(StandardBomLookup, { strict: false });
    recordDependencies = moduleRef.get(RecordDependencies, { strict: false });

    actorId = randomUUID();
    await prisma.user.create({
      data: {
        id: actorId,
        name: `Integration actor ${actorId}`,
        username: `integration-${actorId}`,
        passwordHash: UNUSABLE_HASH,
        role: Role.SystemAdmin,
      },
    });
  });

  afterEach(async () => {
    const orders = await prisma.order.findMany({
      where: { orderNumber: { in: orderNumbers } },
      select: { id: true },
    });
    await prisma.auditLogEntry.deleteMany({
      where: {
        recordId: { in: [...orders.map(({ id }) => id), ...bomIds] },
      },
    });
    await prisma.order.deleteMany({
      where: { orderNumber: { in: orderNumbers } },
    });
    await prisma.bom.deleteMany({ where: { id: { in: bomIds } } });
    await prisma.manufacturingInstruction.deleteMany({
      where: { id: { in: standardBomIds } },
    });
    standardBomIds = [];
    bomIds = [];
    orderNumbers = [];
  });

  afterAll(async () => {
    await prisma?.user.deleteMany({ where: { id: actorId } });
    await moduleRef?.close();
  });

  describe('the System Admin renumbering an order in use', () => {
    it('carries the new number into its daily BOMs and leaves everything else of them alone', async () => {
      const standard = await standardBom();
      const orderNumber = freshOrderNumber();
      const renumbered = freshOrderNumber();
      const orderId = await definedOrder(orderNumber, standard);
      const bom = await dailyBom(orderNumber, standard, { approved: true });
      const other = await dailyBom(freshOrderNumber(), standard);

      await asActor(() =>
        execute(
          new EditOrderCommand(
            orderId,
            OrderNumber.fromString(renumbered),
            undefined,
            ADMIN,
          ),
        ),
      );

      const after = await prisma.bom.findUniqueOrThrow({
        where: { id: bom.id },
      });
      expect(after.orderNumber).toBe(renumbered);
      expect({ ...after, orderNumber: bom.orderNumber }).toEqual(bom);
      expect(await orderNumberOfBom(other.id)).toBe(other.orderNumber);
      const read = await orderRead(orderId);
      expect(read.orderNumber).toBe(renumbered);
      const entries = await prisma.auditLogEntry.findMany({
        where: { recordId: { in: [orderId.asString(), bom.id] } },
        include: { changes: true },
      });
      expect(
        entries.map(({ recordType, action, changes }) => ({
          recordType,
          action,
          changes: changes.map(({ field, previousValue, newValue }) => ({
            field,
            previousValue,
            newValue,
          })),
        })),
      ).toEqual(
        expect.arrayContaining([
          {
            recordType: 'Order',
            action: 'Edited',
            changes: [
              {
                field: 'orderNumber',
                previousValue: orderNumber,
                newValue: renumbered,
              },
            ],
          },
        ]),
      );
      expect(entries.some(({ recordId }) => recordId === bom.id)).toBe(false);
    });

    it('changes nothing anywhere when the new number is taken', async () => {
      const standard = await standardBom();
      const orderNumber = freshOrderNumber();
      const taken = freshOrderNumber();
      const orderId = await definedOrder(orderNumber, standard);
      await definedOrder(taken, standard);
      const bom = await dailyBom(orderNumber, standard);

      await expect(
        asActor(() =>
          execute(
            new EditOrderCommand(
              orderId,
              OrderNumber.fromString(taken),
              undefined,
              ADMIN,
            ),
          ),
        ),
      ).rejects.toBeInstanceOf(OrderNumberTaken);

      expect(await orderNumberOfBom(bom.id)).toBe(orderNumber);
      const read = await orderRead(orderId);
      expect(read.orderNumber).toBe(orderNumber);
    });

    it('is refused when the edit removes an MI code too', async () => {
      const [first, second] = [await standardBom(), await standardBom()];
      const orderNumber = freshOrderNumber();
      const orderId = await definedOrder(orderNumber, first, second);
      await dailyBom(orderNumber, first);

      await expect(
        asActor(() =>
          execute(
            new EditOrderCommand(
              orderId,
              OrderNumber.fromString(freshOrderNumber()),
              [first.miCode],
              ADMIN,
            ),
          ),
        ),
      ).rejects.toBeInstanceOf(RecordHasDependents);
      const read = await orderRead(orderId);
      expect(read.miCodes).toEqual([first.miCode, second.miCode]);
    });
  });

  describe('deleting an order in use', () => {
    it('is refused to Management, deleting nothing', async () => {
      const standard = await standardBom();
      const orderNumber = freshOrderNumber();
      const orderId = await definedOrder(orderNumber, standard);
      const bom = await dailyBom(orderNumber, standard);

      await expect(
        asActor(() =>
          execute(new DeleteOrderCommand(orderId, Role.Management)),
        ),
      ).rejects.toBeInstanceOf(RecordHasDependents);
      expect(await orderReads.findById(orderId)).not.toBeNull();
      expect(
        await prisma.bom.findUnique({ where: { id: bom.id } }),
      ).not.toBeNull();
    });

    it('takes, for the System Admin, every daily BOM of the order with it, a re-sample and what it re-samples included, each with its audit entry', async () => {
      const standard = await standardBom();
      const orderNumber = freshOrderNumber();
      const orderId = await definedOrder(orderNumber, standard);
      const rejected = await dailyBom(orderNumber, standard);
      const resample = await dailyBom(orderNumber, standard, {
        resampledFromId: rejected.id,
      });
      const other = await dailyBom(freshOrderNumber(), standard);

      await asActor(() =>
        execute(new DeleteOrderCommand(orderId, Role.SystemAdmin)),
      );

      expect(await orderReads.findById(orderId)).toBeNull();
      expect(
        await prisma.orderMiCode.count({
          where: { orderId: orderId.asString() },
        }),
      ).toBe(0);
      expect(await idsAmong([rejected.id, resample.id, other.id])).toEqual([
        other.id,
      ]);
      const deletions = await prisma.auditLogEntry.findMany({
        where: {
          recordId: { in: [rejected.id, resample.id, orderId.asString()] },
          action: 'Deleted',
        },
      });
      expect(
        deletions.map(
          ({ recordType, recordId }) => `${recordType}:${recordId}`,
        ),
      ).toEqual(
        expect.arrayContaining([
          `Bom:${rejected.id}`,
          `Bom:${resample.id}`,
          `Order:${orderId.asString()}`,
        ]),
      );
      expect(deletions).toHaveLength(3);
    });
  });

  // A save rewrites every MI-code row; `modify()`'s row lock is what keeps
  // two concurrent additions from losing one. Each change waits until both
  // have loaded the order (or 300 ms pass): unlocked, both load the same MI
  // codes and the later save drops the earlier addition; locked, the second
  // load waits for the first commit, so the wait times out and both land.
  it('keeps both of two MI codes added to one order at the same time, each with its audit entry', async () => {
    const [first, second, third] = [
      await standardBom(),
      await standardBom(),
      await standardBom(),
    ];
    const orderId = await definedOrder(freshOrderNumber(), first);
    const [secondCode, thirdCode] = await lookup.assignable([
      second.miCode,
      third.miCode,
    ]);
    const bothLoaded = rendezvous(2, 300);

    await Promise.all(
      [secondCode, thirdCode].map((added) =>
        asActor(() =>
          orders.modify(orderId, async (order) => {
            await bothLoaded();
            order.addMiCode(added);
          }),
        ),
      ),
    );

    const read = await orderRead(orderId);
    expect(read.miCodes?.toSorted(byCode)).toEqual(
      [first.miCode, second.miCode, third.miCode].toSorted(byCode),
    );
    expect(
      await prisma.auditLogEntry.count({
        where: { recordId: orderId.asString(), action: 'Edited' },
      }),
    ).toBe(2);
  });

  it('locks a standard BOM an order assigns, naming the order', async () => {
    const standard = await standardBom();
    const orderNumber = freshOrderNumber();
    await definedOrder(orderNumber, standard);

    expect(
      await recordDependencies.dependentsOf({
        type: 'StandardBom',
        id: standard.id,
      }),
    ).toEqual([{ kind: 'order', count: 1, names: [orderNumber] }]);
  });

  it('reads orders sorted by number, MI codes in assignment order, with their daily-BOM counts', async () => {
    const [first, second] = [await standardBom(), await standardBom()];
    const later = `${freshOrderNumber()}-b`;
    orderNumbers.push(later);
    const earlier = later.replace(/-b$/, '-a');
    orderNumbers.push(earlier);
    await definedOrder(later, second, first);
    await definedOrder(earlier, first);
    await dailyBom(later, first);
    await dailyBom(later, second);

    const orders = await orderReads.list();
    const read = orders.filter(({ orderNumber }) =>
      [earlier, later].includes(orderNumber),
    );

    expect(
      read.map(({ orderNumber, miCodes, dailyBomCount }) => ({
        orderNumber,
        miCodes: miCodes.map(({ miCode }) => miCode),
        dailyBomCount,
      })),
    ).toEqual([
      { orderNumber: earlier, miCodes: [first.miCode], dailyBomCount: 0 },
      {
        orderNumber: later,
        miCodes: [second.miCode, first.miCode],
        dailyBomCount: 2,
      },
    ]);
  });

  describe('the order_backfill migration (the legacy carry-over)', () => {
    it('makes one order per order number with each MI code its daily BOMs used, once, touching no daily BOM', async () => {
      const [first, second] = [await standardBom(), await standardBom()];
      const legacy = freshOrderNumber();
      const otherLegacy = freshOrderNumber();
      const boms = [
        await dailyBom(legacy, first, { approved: true }),
        await dailyBom(legacy, first),
        await dailyBom(legacy, second),
        await dailyBom(otherLegacy, first),
      ];

      await runBackfill();
      await runBackfill();

      const orders = await orderReads.list();
      const carried = orders
        .filter(({ orderNumber }) =>
          [legacy, otherLegacy].includes(orderNumber),
        )
        .map(({ orderNumber, miCodes, dailyBomCount }) => ({
          orderNumber,
          miCodes: miCodes.map(({ miCode, productId, productName }) => ({
            miCode,
            productId,
            productName,
          })),
          dailyBomCount,
        }));
      expect(carried).toEqual(
        [
          {
            orderNumber: legacy,
            miCodes: [assignment(first), assignment(second)],
            dailyBomCount: 3,
          },
          {
            orderNumber: otherLegacy,
            miCodes: [assignment(first)],
            dailyBomCount: 1,
          },
        ].toSorted((a, b) => (a.orderNumber < b.orderNumber ? -1 : 1)),
      );
      expect(
        await prisma.bom.findMany({
          where: { id: { in: boms.map(({ id }) => id) } },
          orderBy: { registrationSequence: 'asc' },
        }),
      ).toEqual(boms);
    });

    it('adds to an order already defined only the MI codes it lacks', async () => {
      const [first, second] = [await standardBom(), await standardBom()];
      const orderNumber = freshOrderNumber();
      const orderId = await definedOrder(orderNumber, first);
      await dailyBom(orderNumber, first);
      await dailyBom(orderNumber, second);

      await runBackfill();

      const read = await orderRead(orderId);
      expect(read.miCodes).toEqual([first.miCode, second.miCode]);
    });
  });
});
