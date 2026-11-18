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
import { ManufacturingInstructionsModule } from '@manufacturing-instructions/infrastructure/manufacturing-instructions.module';
import { ConfigModule } from '@nestjs/config';
import { CommandBus, CqrsModule, QueryBus } from '@nestjs/cqrs';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { EditProductCommand } from '@products/application/commands/edit-product/edit-product.command';
import { EditProductComponentInput } from '@products/application/commands/product-component.input';
import { GetProductQuery } from '@products/application/queries/get-product/get-product.query';
import { ProductReadModel } from '@products/application/queries/list-products/product.read-model';
import { ProductsModule } from '@products/infrastructure/products.module';
import { Request, Response } from 'express';

// Issue #122 against Postgres, through the app's real module graph (no HTTP):
// a product's component order stored as `position`, and a reordering of a
// product in use — allowed to Management — carried by each module's
// `CompositionOrderPropagator` into its standard and daily BOMs in the edit's
// one transaction, nothing else of those rows touched, with one audit entry
// on the product. Every case uses fresh ids and names and deletes its own
// rows; nothing truncates.

const UNUSABLE_HASH = '$2b$10$integration.tests.never.log.in.with.this.x';

describe("a product's component order", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let commandBus: CommandBus;
  let queryBus: QueryBus;
  let jwt: JwtService;
  let actorMiddleware: ActorContextMiddleware;

  let actorId: string;
  let productIds: string[] = [];
  let standardBomIds: string[] = [];
  let bomIds: string[] = [];

  // Runs `work` the way a request does: through the real
  // ActorContextMiddleware, carrying a bearer token whose `sub` is the actor.
  function asManagement<T>(work: () => Promise<T>): Promise<T> {
    const request = {
      headers: { authorization: `Bearer ${jwt.sign({ sub: actorId })}` },
    } as unknown as Request;
    return new Promise<T>((resolve, reject) => {
      actorMiddleware.use(request, {} as Response, () => {
        work().then(resolve, reject);
      });
    });
  }

  const conductor = { componentId: randomUUID(), name: 'هادی' };
  const insulation = { componentId: randomUUID(), name: 'عایق' };
  const sheath = { componentId: randomUUID(), name: 'روکش' };
  const filler = { componentId: randomUUID(), name: 'پرکننده' };
  const copper = { materialId: randomUUID(), name: 'مس' };
  const zinc = { materialId: randomUUID(), name: 'روی' };
  const pvc = { materialId: randomUUID(), name: 'PVC' };
  const pe = { materialId: randomUUID(), name: 'PE' };

  const materialsOf = new Map([
    [conductor.componentId, [copper, zinc]],
    [insulation.componentId, [pvc]],
    [sheath.componentId, [pe]],
    [filler.componentId, [pvc]],
  ]);

  /**
   * A product «هادی، عایق، روکش» (هادی with two materials), a standard BOM of
   * it that also holds «پرکننده», no longer on the product, between its
   * lines, and an approved daily BOM of that standard BOM — written straight
   * into each owning module's tables.
   */
  async function cableInUse() {
    const product = await prisma.product.create({
      data: {
        name: `کابل ${randomUUID()}`,
        components: {
          create: [conductor, insulation, sheath].map((line, position) => ({
            ...line,
            position,
            materials: {
              create: materialsOf
                .get(line.componentId)
                .map((material, materialPosition) => ({
                  ...material,
                  position: materialPosition,
                })),
            },
          })),
        },
      },
    });
    productIds.push(product.id);
    const snapshotLines = [conductor, filler, insulation, sheath];
    const standardBom = await prisma.manufacturingInstruction.create({
      data: {
        miCode: `MI-${randomUUID()}`,
        brand: 'Legrand',
        standardLength: 305,
        active: true,
        productId: product.id,
        productName: product.name,
        components: {
          create: snapshotLines.map((line, position) => ({
            ...line,
            position,
            materials: {
              create: materialsOf
                .get(line.componentId)
                .map((material, materialPosition) => ({
                  ...material,
                  weight: 10 + materialPosition,
                  position: materialPosition,
                })),
            },
          })),
        },
      },
    });
    standardBomIds.push(standardBom.id);
    const bom = await prisma.bom.create({
      data: {
        standardBomId: standardBom.id,
        standardBomMiCode: standardBom.miCode,
        brand: 'Legrand',
        productName: product.name,
        standardLength: 305,
        orderNumber: `ORD-${randomUUID()}`,
        trackingNumber: `TRK-${randomUUID()}`,
        registeredBy: 'نیکروش',
        approvalStatus: 'approved',
        reviewedBy: 'رضایی',
        managementNote: 'تایید شد',
        components: {
          create: snapshotLines.map((line, position) => ({
            ...line,
            position,
            materials: {
              create: materialsOf
                .get(line.componentId)
                .map((material, materialPosition) => ({
                  ...material,
                  weight: 11 + materialPosition,
                  position: materialPosition,
                })),
            },
          })),
        },
      },
    });
    bomIds.push(bom.id);
    return { product, standardBom, bom };
  }

  /** What a client resends for a line it keeps: the ids it was given. */
  function resent(line: {
    componentId: string;
    name: string;
  }): EditProductComponentInput {
    return {
      id: line.componentId,
      name: line.name,
      materials: materialsOf
        .get(line.componentId)
        .map(({ materialId, name }) => ({ id: materialId, name })),
    };
  }

  async function standardBomOrder(standardBomId: string) {
    const lines = await prisma.manufacturingInstructionComponent.findMany({
      where: { manufacturingInstructionId: standardBomId },
      orderBy: { position: 'asc' },
    });
    return lines.map(({ name, position }) => `${position}:${name}`);
  }

  async function dailyBomOrder(bomId: string) {
    const lines = await prisma.bomComponent.findMany({
      where: { bomId },
      orderBy: { position: 'asc' },
      include: { materials: { orderBy: { position: 'asc' } } },
    });
    return lines.map(({ name, position, materials }) => {
      const weights = materials.map(
        (material) => material.name + '=' + String(material.weight),
      );
      return `${position}:${name}(${weights.join(',')})`;
    });
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
    queryBus = moduleRef.get(QueryBus, { strict: false });
    jwt = moduleRef.get(JwtService, { strict: false });
    actorMiddleware = moduleRef.get(ActorContextMiddleware, { strict: false });

    actorId = randomUUID();
    await prisma.user.create({
      data: {
        id: actorId,
        name: `مصطفی ${actorId}`,
        username: `integration-${actorId}`,
        passwordHash: UNUSABLE_HASH,
        role: Role.Management,
      },
    });
  });

  afterEach(async () => {
    await prisma.auditLogEntry.deleteMany({
      where: { recordId: { in: productIds } },
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
    await prisma?.user.deleteMany({ where: { id: actorId } });
    await moduleRef?.close();
  });

  it('is read back as stored, each component with its materials in their order', async () => {
    const { product } = await cableInUse();

    const read = await queryBus.execute<GetProductQuery, ProductReadModel>(
      new GetProductQuery(Identity.fromString(product.id)),
    );

    expect(
      read.components.map(
        ({ name, materials }) =>
          `${name}(${materials.map((material) => material.name).join(',')})`,
      ),
    ).toEqual(['هادی(مس,روی)', 'عایق(PVC)', 'روکش(PE)']);
  });

  it('is changed on a product in use, and every standard and daily BOM of it follows, nothing else of them moving', async () => {
    const { product, standardBom, bom } = await cableInUse();
    const dailyBomBefore = await dailyBomOrder(bom.id);

    await asManagement(() =>
      commandBus.execute(
        new EditProductCommand(Identity.fromString(product.id), undefined, [
          resent(sheath),
          resent(conductor),
          resent(insulation),
        ]),
      ),
    );

    const read = await queryBus.execute<GetProductQuery, ProductReadModel>(
      new GetProductQuery(Identity.fromString(product.id)),
    );
    expect(read.components.map(({ name }) => name)).toEqual([
      'روکش',
      'هادی',
      'عایق',
    ]);
    expect(read.components[1].materials.map(({ name }) => name)).toEqual([
      'مس',
      'روی',
    ]);
    // «پرکننده» is no longer on the product: it keeps its place after the
    // matched lines.
    expect(await standardBomOrder(standardBom.id)).toEqual([
      '0:روکش',
      '1:هادی',
      '2:عایق',
      '3:پرکننده',
    ]);
    expect(await dailyBomOrder(bom.id)).toEqual([
      '0:روکش(PE=11)',
      '1:هادی(مس=11,روی=12)',
      '2:عایق(PVC=11)',
      '3:پرکننده(PVC=11)',
    ]);
    expect(dailyBomBefore).toHaveLength(4);
    const [standardBomAfter, bomAfter] = await Promise.all([
      prisma.manufacturingInstruction.findUniqueOrThrow({
        where: { id: standardBom.id },
      }),
      prisma.bom.findUniqueOrThrow({ where: { id: bom.id } }),
    ]);
    expect(standardBomAfter.updatedAt).toEqual(standardBom.updatedAt);
    expect(bomAfter.updatedAt).toEqual(bom.updatedAt);
    expect(bomAfter.approvalStatus).toBe('approved');
    expect(bomAfter.editHistory).toEqual([]);
  });

  it('is recorded as one edit of the product, its order before and after', async () => {
    const { product, standardBom, bom } = await cableInUse();

    await asManagement(() =>
      commandBus.execute(
        new EditProductCommand(Identity.fromString(product.id), undefined, [
          resent(insulation),
          resent(sheath),
          resent(conductor),
        ]),
      ),
    );

    const entries = await prisma.auditLogEntry.findMany({
      where: { recordId: { in: [product.id, standardBom.id, bom.id] } },
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
    ).toEqual([
      {
        recordType: 'Product',
        action: 'Edited',
        changes: [
          {
            field: 'componentOrder',
            previousValue: 'هادی، عایق، روکش',
            newValue: 'عایق، روکش، هادی',
          },
        ],
      },
    ]);
  });

  it('is left as it was when the same edit also adds a component to a product in use', async () => {
    const { product, standardBom } = await cableInUse();

    await expect(
      asManagement(() =>
        commandBus.execute(
          new EditProductCommand(Identity.fromString(product.id), undefined, [
            resent(sheath),
            resent(conductor),
            resent(insulation),
            { name: 'زره', materials: [{ name: 'فولاد' }] },
          ]),
        ),
      ),
    ).rejects.toBeInstanceOf(RecordHasDependents);

    const read = await queryBus.execute<GetProductQuery, ProductReadModel>(
      new GetProductQuery(Identity.fromString(product.id)),
    );
    expect(read.components.map(({ name }) => name)).toEqual([
      'هادی',
      'عایق',
      'روکش',
    ]);
    expect(await standardBomOrder(standardBom.id)).toEqual([
      '0:هادی',
      '1:پرکننده',
      '2:عایق',
      '3:روکش',
    ]);
  });
});
