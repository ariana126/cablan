import { randomUUID } from 'node:crypto';

import { AuditLoggingModule } from '@audit-logging/infrastructure/audit-logging.module';
import { BomsModule } from '@boms/infrastructure/boms.module';
import { RecordHasDependents } from '@framework/application';
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
import { EditManufacturingInstructionCommand } from '@manufacturing-instructions/application/commands/edit-manufacturing-instruction/edit-manufacturing-instruction.command';
import { Brand } from '@manufacturing-instructions/domain/value/brand.vo';
import { StandardLength } from '@manufacturing-instructions/domain/value/standard-length.vo';
import { ManufacturingInstructionsModule } from '@manufacturing-instructions/infrastructure/manufacturing-instructions.module';
import { ConfigModule } from '@nestjs/config';
import { CommandBus, CqrsModule } from '@nestjs/cqrs';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ProductsModule } from '@products/infrastructure/products.module';
import { Request, Response } from 'express';

// Issue #126 against Postgres, through the app's real module graph (no HTTP):
// the System Admin's correction of a standard BOM in use — its weights,
// brand, standard length, description and active flag — saved with its one
// audit entry, the brand and standard length carried by `boms`' correction
// propagator into its daily BOMs in the edit's one transaction, nothing else
// of them touched; and a change of its composition refused, changing nothing.
// Every case uses fresh ids and names and deletes its own rows; nothing
// truncates.

const UNUSABLE_HASH = '$2b$10$integration.tests.never.log.in.with.this.x';

describe("the System Admin's correction of a standard BOM in use", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let commandBus: CommandBus;
  let jwt: JwtService;
  let actorMiddleware: ActorContextMiddleware;

  let adminId: string;
  let productIds: string[] = [];
  let standardBomIds: string[] = [];
  let bomIds: string[] = [];

  // Runs `work` the way a request does: through the real
  // ActorContextMiddleware, carrying a bearer token whose `sub` is the actor.
  function asSystemAdmin<T>(work: () => Promise<T>): Promise<T> {
    const request = {
      headers: { authorization: `Bearer ${jwt.sign({ sub: adminId })}` },
    } as unknown as Request;
    return new Promise<T>((resolve, reject) => {
      actorMiddleware.use(request, {} as Response, () => {
        work().then(resolve, reject);
      });
    });
  }

  const core = { componentId: randomUUID(), name: 'مغزی' };
  const sheath = { componentId: randomUUID(), name: 'روکش' };
  const copper = { materialId: randomUUID(), name: 'مسی' };
  const pvc = { materialId: randomUUID(), name: 'PVC' };

  /**
   * A product «مغزی (مسی)، روکش (PVC)» and a standard BOM of it — LEGRAND,
   * 500, مسی weighing 100 and PVC 7 — written straight into each owning
   * module's tables.
   */
  async function standardBom() {
    const product = await prisma.product.create({
      data: {
        name: `کابل ${randomUUID()}`,
        components: {
          create: [
            { ...core, position: 0, materials: { create: [{ ...copper }] } },
            { ...sheath, position: 1, materials: { create: [{ ...pvc }] } },
          ],
        },
      },
    });
    productIds.push(product.id);
    const created = await prisma.manufacturingInstruction.create({
      data: {
        miCode: `MI-${randomUUID()}`,
        brand: 'LEGRAND',
        standardLength: 500,
        active: true,
        description: 'شرح اولیه',
        productId: product.id,
        productName: product.name,
        components: {
          create: [
            {
              ...core,
              position: 0,
              materials: { create: [{ ...copper, weight: 100 }] },
            },
            {
              ...sheath,
              position: 1,
              materials: { create: [{ ...pvc, weight: 7 }] },
            },
          ],
        },
      },
    });
    standardBomIds.push(created.id);
    return created;
  }

  /** A daily BOM of `standardBomId` under review state `review`. */
  async function dailyBomOf(
    {
      id,
      miCode,
      productName,
    }: { id: string; miCode: string; productName: string },
    review: {
      approvalStatus: string;
      reviewedBy?: string;
      managementNote?: string;
    },
  ) {
    const bom = await prisma.bom.create({
      data: {
        standardBomId: id,
        standardBomMiCode: miCode,
        brand: 'LEGRAND',
        productName,
        standardLength: 500,
        orderNumber: `ORD-${randomUUID()}`,
        trackingNumber: `TRK-${randomUUID()}`,
        registeredBy: 'نیکروش',
        ...review,
        editHistory: [
          {
            editedBy: 'نیکروش',
            editedAt: '2026-11-01T08:30:00.000Z',
            reason: 'اصلاح وزن',
            changes: [
              {
                field: 'materialWeight:مغزی:مسی',
                previousValue: '110',
                newValue: '111',
              },
            ],
          },
        ],
        components: {
          create: [
            {
              ...core,
              position: 0,
              materials: { create: [{ ...copper, weight: 111, position: 0 }] },
            },
            {
              ...sheath,
              position: 1,
              materials: { create: [{ ...pvc, weight: 8, position: 0 }] },
            },
          ],
        },
      },
    });
    bomIds.push(bom.id);
    return bom;
  }

  function dailyBomRow(id: string) {
    return prisma.bom.findUniqueOrThrow({
      where: { id },
      include: {
        components: {
          orderBy: { position: 'asc' },
          include: { materials: { orderBy: { position: 'asc' } } },
        },
      },
    });
  }

  function correction(
    standardBomId: string,
    components = [
      {
        componentId: core.componentId,
        materials: [{ materialId: copper.materialId, weight: 105 }],
      },
      {
        componentId: sheath.componentId,
        materials: [{ materialId: pvc.materialId, weight: 7 }],
      },
    ],
  ) {
    return new EditManufacturingInstructionCommand(
      Identity.fromString(standardBomId),
      Role.SystemAdmin,
      undefined,
      Brand.fromString('Schneider'),
      StandardLength.of(480),
      'شرح اصلاح شده',
      false,
      components,
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

    adminId = randomUUID();
    await prisma.user.create({
      data: {
        id: adminId,
        name: `یاشار ${adminId}`,
        username: `integration-${adminId}`,
        passwordHash: UNUSABLE_HASH,
        role: Role.SystemAdmin,
      },
    });
  });

  afterEach(async () => {
    await prisma.auditLogEntry.deleteMany({
      where: { recordId: { in: [...standardBomIds, ...bomIds] } },
    });
    await prisma.bom.deleteMany({ where: { id: { in: bomIds } } });
    await prisma.manufacturingInstruction.deleteMany({
      where: { id: { in: standardBomIds } },
    });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    productIds = [];
    standardBomIds = [];
    bomIds = [];
  });

  afterAll(async () => {
    await prisma?.user.deleteMany({ where: { id: adminId } });
    await moduleRef?.close();
  });

  it('is saved, with one audit entry carrying each changed field and weight before and after', async () => {
    const corrected = await standardBom();
    await dailyBomOf(corrected, { approvalStatus: 'pending' });

    await asSystemAdmin(() => commandBus.execute(correction(corrected.id)));

    const stored = await prisma.manufacturingInstruction.findUniqueOrThrow({
      where: { id: corrected.id },
      include: {
        components: {
          orderBy: { position: 'asc' },
          include: { materials: true },
        },
      },
    });
    expect({
      miCode: stored.miCode,
      brand: stored.brand,
      standardLength: stored.standardLength,
      description: stored.description,
      active: stored.active,
      weights: stored.components.map(
        ({ name, materials }) => `${name}:${materials[0].weight}`,
      ),
    }).toEqual({
      miCode: corrected.miCode,
      brand: 'Schneider',
      standardLength: 480,
      description: 'شرح اصلاح شده',
      active: false,
      weights: ['مغزی:105', 'روکش:7'],
    });
    const entries = await prisma.auditLogEntry.findMany({
      where: { recordId: corrected.id },
      include: { changes: { orderBy: { position: 'asc' } } },
    });
    expect(
      entries.map(({ recordType, action, actorName, changes }) => ({
        recordType,
        action,
        actorName,
        changes: changes.map(({ field, previousValue, newValue }) => ({
          field,
          previousValue,
          newValue,
        })),
      })),
    ).toEqual([
      {
        recordType: 'StandardBom',
        action: 'Edited',
        actorName: `یاشار ${adminId}`,
        changes: [
          { field: 'brand', previousValue: 'LEGRAND', newValue: 'Schneider' },
          { field: 'standardLength', previousValue: '500', newValue: '480' },
          {
            field: 'description',
            previousValue: 'شرح اولیه',
            newValue: 'شرح اصلاح شده',
          },
          { field: 'active', previousValue: 'true', newValue: 'false' },
          {
            field: 'materialWeight:مغزی:مسی',
            previousValue: '100',
            newValue: '105',
          },
        ],
      },
    ]);
  });

  it('carries the brand and standard length into its daily BOMs, nothing else of them moving and none of them audited', async () => {
    const corrected = await standardBom();
    const daily = await Promise.all([
      dailyBomOf(corrected, {
        approvalStatus: 'approved',
        reviewedBy: 'رضایی',
        managementNote: 'تایید شد',
      }),
      dailyBomOf(corrected, {
        approvalStatus: 'rejected',
        reviewedBy: 'رضایی',
        managementNote: 'وزن مسی زیاد است',
      }),
      dailyBomOf(corrected, { approvalStatus: 'pending' }),
    ]);
    const before = await Promise.all(daily.map(({ id }) => dailyBomRow(id)));

    await asSystemAdmin(() => commandBus.execute(correction(corrected.id)));

    const after = await Promise.all(daily.map(({ id }) => dailyBomRow(id)));
    expect(after).toEqual(
      before.map((row) => ({
        ...row,
        brand: 'Schneider',
        standardLength: 480,
      })),
    );
    expect(
      await prisma.auditLogEntry.count({
        where: { recordId: { in: daily.map(({ id }) => id) } },
      }),
    ).toBe(0);
  });

  it("leaves another standard BOM's daily BOMs as they were", async () => {
    const corrected = await standardBom();
    await dailyBomOf(corrected, { approvalStatus: 'pending' });
    const other = await standardBom();
    const othersDailyBom = await dailyBomOf(other, {
      approvalStatus: 'approved',
      reviewedBy: 'رضایی',
    });
    const before = await dailyBomRow(othersDailyBom.id);

    await asSystemAdmin(() => commandBus.execute(correction(corrected.id)));

    expect(await dailyBomRow(othersDailyBom.id)).toEqual(before);
  });

  it('is refused when it also adds a material to a component, changing nothing anywhere', async () => {
    const corrected = await standardBom();
    const dailyBom = await dailyBomOf(corrected, { approvalStatus: 'pending' });
    const dailyBomBefore = await dailyBomRow(dailyBom.id);

    await expect(
      asSystemAdmin(() =>
        commandBus.execute(
          correction(corrected.id, [
            {
              componentId: core.componentId,
              materials: [{ materialId: copper.materialId, weight: 105 }],
            },
            {
              componentId: sheath.componentId,
              materials: [
                { materialId: pvc.materialId, weight: 7 },
                { materialId: copper.materialId, weight: 1 },
              ],
            },
          ]),
        ),
      ),
    ).rejects.toBeInstanceOf(RecordHasDependents);

    const stored = await prisma.manufacturingInstruction.findUniqueOrThrow({
      where: { id: corrected.id },
      include: { components: { include: { materials: true } } },
    });
    expect(stored.brand).toBe('LEGRAND');
    expect(stored.standardLength).toBe(500);
    expect(stored.updatedAt).toEqual(corrected.updatedAt);
    expect(
      stored.components.flatMap(({ materials }) =>
        materials.map(({ name, weight }) => `${name}:${weight}`),
      ),
    ).toEqual(expect.arrayContaining(['مسی:100', 'PVC:7']));
    expect(
      stored.components.flatMap(({ materials }) => materials),
    ).toHaveLength(2);
    expect(await dailyBomRow(dailyBom.id)).toEqual(dailyBomBefore);
    expect(
      await prisma.auditLogEntry.count({
        where: { recordId: { in: [corrected.id, dailyBom.id] } },
      }),
    ).toBe(0);
  });
});
