import { randomUUID } from 'node:crypto';

import { DeleteBomCommand } from '@boms/application/commands/delete-bom/delete-bom.command';
import { BomReportRepository } from '@boms/application/service/bom-report.repository';
import { Bom } from '@boms/domain/bom.aggregate';
import { BomRepository } from '@boms/domain/service/bom.repository';
import { BomComponentLine } from '@boms/domain/value/bom-component-line.vo';
import { BomEditContext } from '@boms/domain/value/bom-edit-context.vo';
import { BomEditSource } from '@boms/domain/value/bom-edit-source';
import { BomEditor } from '@boms/domain/value/bom-editor.vo';
import { BomMaterialLine } from '@boms/domain/value/bom-material-line.vo';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { TrackingNumber } from '@boms/domain/value/tracking-number.vo';
import { Weight } from '@boms/domain/value/weight.vo';
import { BomsModule } from '@boms/infrastructure/boms.module';
import { RecordHasDependents } from '@framework/application';
import { DisplayNameProvider, Identity, Role } from '@framework/domain';
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
import { DeleteUserCommand } from '@identity/application/commands/delete-user/delete-user.command';
import { UpdateUserCommand } from '@identity/application/commands/update-user/update-user.command';
import { IdentityModule } from '@identity/infrastructure/identity.module';
import { AddPmPlanItemCommand } from '@maintenance/application/commands/add-pm-plan-item/add-pm-plan-item.command';
import { DeactivatePmPlanItemCommand } from '@maintenance/application/commands/deactivate-pm-plan-item/deactivate-pm-plan-item.command';
import { RecordMaintenanceExecutionCommand } from '@maintenance/application/commands/record-maintenance-execution/record-maintenance-execution.command';
import { RegisterEquipmentCommand } from '@maintenance/application/commands/register-equipment/register-equipment.command';
import { RegisterMaintenanceActivityCommand } from '@maintenance/application/commands/register-maintenance-activity/register-maintenance-activity.command';
import { RenameEquipmentCommand } from '@maintenance/application/commands/rename-equipment/rename-equipment.command';
import { RenameMaintenanceActivityCommand } from '@maintenance/application/commands/rename-maintenance-activity/rename-maintenance-activity.command';
import { MaintenanceExecutionRepository } from '@maintenance/domain/service/maintenance-execution.repository';
import { CalendarDate } from '@maintenance/domain/value/calendar-date.vo';
import { EquipmentName } from '@maintenance/domain/value/equipment-name.vo';
import { IntervalUnit } from '@maintenance/domain/value/interval-unit';
import { MaintenanceActivityName } from '@maintenance/domain/value/maintenance-activity-name.vo';
import { MaintenanceModule } from '@maintenance/infrastructure/maintenance.module';
import { EditManufacturingInstructionCommand } from '@manufacturing-instructions/application/commands/edit-manufacturing-instruction/edit-manufacturing-instruction.command';
import { ManufacturingInstructionsModule } from '@manufacturing-instructions/infrastructure/manufacturing-instructions.module';
import { ConfigModule } from '@nestjs/config';
import { CommandBus, CqrsModule } from '@nestjs/cqrs';
import { Test, TestingModule } from '@nestjs/testing';
import { DeleteMaterialCommand } from '@products/application/commands/delete-material/delete-material.command';
import { DeleteProductCommand } from '@products/application/commands/delete-product/delete-product.command';
import { EditComponentCommand } from '@products/application/commands/edit-component/edit-component.command';
import { Component } from '@products/domain/component.aggregate';
import { Material } from '@products/domain/material.aggregate';
import { ComponentRepository } from '@products/domain/service/component.repository';
import { MaterialRepository } from '@products/domain/service/material.repository';
import { ComponentName } from '@products/domain/value/component-name.vo';
import { MaterialCode } from '@products/domain/value/material-code.vo';
import { MaterialName } from '@products/domain/value/material-name.vo';
import { ProductsModule } from '@products/infrastructure/products.module';

// Issue #94 against Postgres: a record another record references can be
// neither edited nor deleted, whichever module holds the reference. The
// protected records live upstream of their referrers (`boms` →
// `manufacturing-instructions` → `products`), so each refusal here is
// answered by another module's `DependentsProbe`, reading its own tables,
// through the framework's `RecordDependencies` — the app's real module graph,
// no HTTP. It also pins that deleting a user, or changing their role, leaves
// every history record naming them as it was: those names are snapshots.
// Every case uses fresh ids and names and deletes its own rows; nothing
// truncates. No actor is in context, so no audit entry is written.

const UNUSABLE_HASH = '$2b$10$integration.tests.never.log.in.with.this.x';

function refusalOf(work: Promise<unknown>): Promise<RecordHasDependents> {
  return work.then(
    () => {
      throw new Error('expected the record to be locked');
    },
    (error: unknown) => {
      expect(error).toBeInstanceOf(RecordHasDependents);
      return error as RecordHasDependents;
    },
  );
}

function dailyBom(orderNumber: string, registeredBy = 'نیکروش'): Bom {
  return Bom.register(
    Identity.new(),
    'MI',
    'Legrand',
    'کابل',
    305,
    OrderNumber.fromString(orderNumber),
    TrackingNumber.fromString(`TRK-${randomUUID()}`),
    undefined,
    registeredBy,
    [
      BomComponentLine.of(Identity.new(), 'مغزی', [
        BomMaterialLine.of(Identity.new(), 'مس', Weight.ofGrams(12)),
      ]),
    ],
  );
}

describe('record dependencies: a referenced record is locked', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let commandBus: CommandBus;
  let materials: MaterialRepository;
  let components: ComponentRepository;
  let boms: BomRepository;
  let bomReports: BomReportRepository;
  let executions: MaintenanceExecutionRepository;
  let displayNames: DisplayNameProvider;

  let materialIds: string[] = [];
  let componentIds: string[] = [];
  let productIds: string[] = [];
  let standardBomIds: string[] = [];
  let bomIds: string[] = [];
  let equipmentIds: string[] = [];
  let activityIds: string[] = [];
  let userIds: string[] = [];

  function execute<T = void>(command: object): Promise<T> {
    return commandBus.execute(command);
  }

  async function registeredMaterial(): Promise<Material> {
    const material = Material.register(
      MaterialName.fromString(`مس ${randomUUID()}`),
      MaterialCode.fromString(`INT-${randomUUID()}`),
    );
    materialIds.push(material.id.asString());
    await materials.save(material);
    return material;
  }

  async function registeredComponent(): Promise<Component> {
    const component = Component.register(
      ComponentName.fromString(`مغزی ${randomUUID()}`),
    );
    componentIds.push(component.id.asString());
    await components.save(component);
    return component;
  }

  // The three referencing records, written straight into each owning
  // module's tables — the probes read rows, whichever path wrote them.
  async function productUsing(
    componentId: string,
    materialId: string,
    name = `کابل ${randomUUID()}`,
  ): Promise<string> {
    const { id } = await prisma.product.create({
      data: {
        name,
        components: {
          create: [
            {
              componentId,
              name: 'مغزی',
              materials: { create: [{ materialId, name: 'مس' }] },
            },
          ],
        },
      },
    });
    productIds.push(id);
    return id;
  }

  async function standardBomOf(
    productId: string,
    componentId: string,
    materialId: string,
    miCode = `MI-${randomUUID()}`,
  ): Promise<string> {
    const { id } = await prisma.manufacturingInstruction.create({
      data: {
        miCode,
        brand: 'Legrand',
        standardLength: 305,
        active: true,
        productId,
        productName: 'کابل',
        components: {
          create: [
            {
              componentId,
              name: 'مغزی',
              materials: { create: [{ materialId, name: 'مس', weight: 12 }] },
            },
          ],
        },
      },
    });
    standardBomIds.push(id);
    return id;
  }

  async function dailyBomOf(
    standardBomId: string,
    componentId: string,
    materialId: string,
    orderNumber = `ORD-${randomUUID()}`,
  ): Promise<string> {
    const { id } = await prisma.bom.create({
      data: {
        standardBomId,
        standardBomMiCode: 'MI',
        brand: 'Legrand',
        productName: 'کابل',
        standardLength: 305,
        orderNumber,
        trackingNumber: `TRK-${randomUUID()}`,
        registeredBy: 'نیکروش',
        components: {
          create: [
            {
              componentId,
              name: 'مغزی',
              materials: { create: [{ materialId, name: 'مس', weight: 12 }] },
            },
          ],
        },
      },
    });
    bomIds.push(id);
    return id;
  }

  async function savedBom(bom: Bom): Promise<Bom> {
    bomIds.push(bom.id.asString());
    await boms.save(bom);
    return bom;
  }

  async function registeredEquipment(): Promise<string> {
    const { id } = await execute<{ id: string }>(
      new RegisterEquipmentCommand(
        EquipmentName.fromString(`پرس ${randomUUID()}`),
      ),
    );
    equipmentIds.push(id);
    return id;
  }

  async function registeredActivity(): Promise<string> {
    const { id } = await execute<{ id: string }>(
      new RegisterMaintenanceActivityCommand(
        MaintenanceActivityName.fromString(`تعویض روغن ${randomUUID()}`),
      ),
    );
    activityIds.push(id);
    return id;
  }

  async function planItemOf(
    equipmentId: string,
    activityId: string,
  ): Promise<string> {
    const { id } = await execute<{ id: string }>(
      new AddPmPlanItemCommand(
        Identity.fromString(equipmentId),
        Identity.fromString(activityId),
        7,
        IntervalUnit.Days,
        CalendarDate.fromString('2026-07-01'),
      ),
    );
    return id;
  }

  async function user(role: Role): Promise<string> {
    const id = randomUUID();
    await prisma.user.create({
      data: {
        id,
        name: `مسلمی ${id}`,
        username: `integration-${id}`,
        passwordHash: UNUSABLE_HASH,
        role,
      },
    });
    userIds.push(id);
    return id;
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
        MaintenanceModule,
      ],
    }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaService, { strict: false });
    commandBus = moduleRef.get(CommandBus, { strict: false });
    materials = moduleRef.get(MaterialRepository, { strict: false });
    components = moduleRef.get(ComponentRepository, { strict: false });
    boms = moduleRef.get(BomRepository, { strict: false });
    bomReports = moduleRef.get(BomReportRepository, { strict: false });
    executions = moduleRef.get(MaintenanceExecutionRepository, {
      strict: false,
    });
    displayNames = moduleRef.get(DisplayNameProvider, { strict: false });
  });

  afterEach(async () => {
    await prisma.bom.deleteMany({ where: { id: { in: bomIds } } });
    await prisma.manufacturingInstruction.deleteMany({
      where: { id: { in: standardBomIds } },
    });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.component.deleteMany({ where: { id: { in: componentIds } } });
    await prisma.material.deleteMany({ where: { id: { in: materialIds } } });
    await prisma.maintenanceExecution.deleteMany({
      where: { equipmentId: { in: equipmentIds } },
    });
    await prisma.equipment.deleteMany({ where: { id: { in: equipmentIds } } });
    await prisma.maintenanceActivity.deleteMany({
      where: { id: { in: activityIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    materialIds = [];
    componentIds = [];
    productIds = [];
    standardBomIds = [];
    bomIds = [];
    equipmentIds = [];
    activityIds = [];
    userIds = [];
  });

  afterAll(async () => {
    await moduleRef?.close();
  });

  it("refuses deleting a material that another module's records use, naming each, and allows it once they are gone", async () => {
    const material = await registeredMaterial();
    const component = await registeredComponent();
    const productId = await productUsing(
      component.id.asString(),
      material.id.asString(),
      'کابل NYY',
    );
    const standardBomId = await standardBomOf(
      productId,
      component.id.asString(),
      material.id.asString(),
      `MI-100-${randomUUID()}`,
    );
    const orderNumber = `ORD-${randomUUID()}`;
    const bomId = await dailyBomOf(
      standardBomId,
      component.id.asString(),
      material.id.asString(),
      orderNumber,
    );

    const refusal = await refusalOf(
      execute(new DeleteMaterialCommand(material.id)),
    );

    expect(refusal.reference).toEqual({
      type: 'Material',
      id: material.id.asString(),
    });
    expect(refusal.dependents.map((dependent) => dependent.kind)).toEqual([
      'product',
      'standard-bom',
      'daily-bom',
    ]);
    expect(refusal.dependents[0]).toEqual({
      kind: 'product',
      count: 1,
      names: ['کابل NYY'],
    });
    expect(refusal.dependents[2]).toEqual({
      kind: 'daily-bom',
      count: 1,
      names: [orderNumber],
    });
    expect(await materials.find(material.id)).not.toBeNull();

    // Free again once every reference is gone — and deleting it deletes
    // nothing else.
    await prisma.bom.delete({ where: { id: bomId } });
    await prisma.manufacturingInstruction.delete({
      where: { id: standardBomId },
    });
    await prisma.product.delete({ where: { id: productId } });
    await execute(new DeleteMaterialCommand(material.id));

    expect(await materials.find(material.id)).toBeNull();
    expect(await components.find(component.id)).not.toBeNull();
  });

  it('refuses renaming a component a product, a standard BOM and a daily BOM use', async () => {
    const material = await registeredMaterial();
    const component = await registeredComponent();
    const productId = await productUsing(
      component.id.asString(),
      material.id.asString(),
    );
    const standardBomId = await standardBomOf(
      productId,
      component.id.asString(),
      material.id.asString(),
    );
    await dailyBomOf(
      standardBomId,
      component.id.asString(),
      material.id.asString(),
    );

    const refusal = await refusalOf(
      execute(
        new EditComponentCommand(
          component.id,
          ComponentName.fromString(`نام دیگر ${randomUUID()}`),
        ),
      ),
    );

    expect(refusal.dependents.map((dependent) => dependent.count)).toEqual([
      1, 1, 1,
    ]);
    const kept = await components.get(component.id);
    expect(kept.name().asString()).toBe(component.name().asString());
  });

  it("refuses deleting a product a standard BOM references, keeping the product's row", async () => {
    const material = await registeredMaterial();
    const component = await registeredComponent();
    const productId = await productUsing(
      component.id.asString(),
      material.id.asString(),
    );
    const miCode = `MI-${randomUUID()}`;
    await standardBomOf(
      productId,
      component.id.asString(),
      material.id.asString(),
      miCode,
    );

    const refusal = await refusalOf(
      execute(new DeleteProductCommand(Identity.fromString(productId))),
    );

    expect(refusal.dependents).toEqual([
      { kind: 'standard-bom', count: 1, names: [miCode] },
    ]);
    expect(
      await prisma.product.findUnique({ where: { id: productId } }),
    ).not.toBeNull();
  });

  it('refuses switching off a standard BOM a daily BOM references', async () => {
    const material = await registeredMaterial();
    const component = await registeredComponent();
    const productId = await productUsing(
      component.id.asString(),
      material.id.asString(),
    );
    const standardBomId = await standardBomOf(
      productId,
      component.id.asString(),
      material.id.asString(),
    );
    const orderNumber = `ORD-${randomUUID()}`;
    await dailyBomOf(
      standardBomId,
      component.id.asString(),
      material.id.asString(),
      orderNumber,
    );

    const refusal = await refusalOf(
      execute(
        new EditManufacturingInstructionCommand(
          Identity.fromString(standardBomId),
          undefined,
          undefined,
          undefined,
          undefined,
          false,
        ),
      ),
    );

    expect(refusal.dependents).toEqual([
      { kind: 'daily-bom', count: 1, names: [orderNumber] },
    ]);
    const stored = await prisma.manufacturingInstruction.findUniqueOrThrow({
      where: { id: standardBomId },
    });
    expect(stored.active).toBe(true);
  });

  it('persists the re-sample link, and refuses deleting a re-sampled daily BOM until its re-sample is gone', async () => {
    const orderNumber = `ORD-${randomUUID()}`;
    const source = dailyBom(orderNumber);
    source.reject('مصطفی', 'وزن مس خارج از محدوده است');
    await savedBom(source);
    const resample = await savedBom(
      source.resample(
        true,
        source.standardBomId(),
        'Legrand',
        'کابل',
        305,
        source.components(),
        undefined,
        'یاشار',
      ),
    );

    const stored = await prisma.bom.findUniqueOrThrow({
      where: { id: resample.id.asString() },
    });
    expect(stored.resampledFromId).toBe(source.id.asString());
    const loaded = await boms.get(resample.id);
    expect(loaded.resampledFromId()).toEqual(source.id);

    const refusal = await refusalOf(execute(new DeleteBomCommand(source.id)));
    expect(refusal.dependents).toEqual([
      { kind: 'resampled-daily-bom', count: 1, names: [orderNumber] },
    ]);
    expect(await boms.find(source.id)).not.toBeNull();

    await execute(new DeleteBomCommand(resample.id));
    await execute(new DeleteBomCommand(source.id));
    expect(await boms.find(source.id)).toBeNull();
  });

  it('refuses renaming equipment and an activity whose only plan item is deactivated', async () => {
    const equipmentId = await registeredEquipment();
    const activityId = await registeredActivity();
    const itemId = await planItemOf(equipmentId, activityId);
    await execute(
      new DeactivatePmPlanItemCommand(
        Identity.fromString(equipmentId),
        Identity.fromString(itemId),
      ),
    );
    const { name: equipmentName } = await prisma.equipment.findUniqueOrThrow({
      where: { id: equipmentId },
    });

    const equipmentRefusal = await refusalOf(
      execute(
        new RenameEquipmentCommand(
          Identity.fromString(equipmentId),
          EquipmentName.fromString(`نام دیگر ${randomUUID()}`),
        ),
      ),
    );
    const activityRefusal = await refusalOf(
      execute(
        new RenameMaintenanceActivityCommand(
          Identity.fromString(activityId),
          MaintenanceActivityName.fromString(`نام دیگر ${randomUUID()}`),
        ),
      ),
    );

    const pmPlanOfThisEquipment = [
      { kind: 'equipment-pm-plan', count: 1, names: [equipmentName] },
    ];
    expect(equipmentRefusal.dependents).toEqual(pmPlanOfThisEquipment);
    expect(activityRefusal.dependents).toEqual(pmPlanOfThisEquipment);
  });

  it("keeps every name a user's history records after the user is re-roled and deleted", async () => {
    const adminId = await user(Role.SystemAdmin);
    const historyUserId = await user(Role.Management);
    const name = await displayNames.getName(Identity.fromString(historyUserId));

    // A daily BOM they registered, corrected and reviewed …
    const bom = dailyBom(`ORD-${randomUUID()}`, name);
    bom.edit(
      bom.orderNumber(),
      bom.trackingNumber(),
      'اصلاح شد',
      undefined,
      BomEditContext.of(
        name,
        BomEditor.withRole(Role.Management),
        BomEditSource.DailyBoms,
        'خطای ثبت',
        new Date('2026-01-01T00:00:00.000Z'),
      ),
    );
    bom.reject(name, 'وزن مس خارج از محدوده است');
    await savedBom(bom);
    // … and a PM job they performed.
    const equipmentId = await registeredEquipment();
    const itemId = await planItemOf(equipmentId, await registeredActivity());
    await execute(
      new RecordMaintenanceExecutionCommand(
        Identity.fromString(equipmentId),
        Identity.fromString(itemId),
        Identity.fromString(historyUserId),
        undefined,
      ),
    );

    await execute(
      new UpdateUserCommand(
        Identity.fromString(historyUserId),
        Identity.fromString(adminId),
        undefined,
        undefined,
        undefined,
        Role.QcInspector,
      ),
    );
    await execute(new DeleteUserCommand(Identity.fromString(historyUserId)));

    const detail = await bomReports.findDetailById(bom.id);
    expect(detail).not.toBeNull();
    expect(detail?.registeredBy).toBe(name);
    expect(detail?.reviewedBy).toBe(name);
    expect(detail?.editHistory.map((record) => record.editedBy())).toEqual([
      name,
    ]);
    const [execution] = await executions.forEquipment(
      Identity.fromString(equipmentId),
    );
    expect(execution.performedByName()).toBe(name);
  });
});
