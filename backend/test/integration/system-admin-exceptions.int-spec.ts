import { randomUUID } from 'node:crypto';

import { BomsModule } from '@boms/infrastructure/boms.module';
import { ApplyToRelatedRecords, UnitOfWork } from '@framework/application';
import { EntityNotFound, Identity, Role } from '@framework/domain';
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
import { AddPmPlanItemCommand } from '@maintenance/application/commands/add-pm-plan-item/add-pm-plan-item.command';
import { DeactivatePmPlanItemCommand } from '@maintenance/application/commands/deactivate-pm-plan-item/deactivate-pm-plan-item.command';
import { DeleteEquipmentCommand } from '@maintenance/application/commands/delete-equipment/delete-equipment.command';
import { DeletePmPlanItemCommand } from '@maintenance/application/commands/delete-pm-plan-item/delete-pm-plan-item.command';
import { EditMaintenanceActivityCommand } from '@maintenance/application/commands/edit-maintenance-activity/edit-maintenance-activity.command';
import { RecordMaintenanceExecutionCommand } from '@maintenance/application/commands/record-maintenance-execution/record-maintenance-execution.command';
import { RegisterEquipmentCommand } from '@maintenance/application/commands/register-equipment/register-equipment.command';
import { RegisterMaintenanceActivityCommand } from '@maintenance/application/commands/register-maintenance-activity/register-maintenance-activity.command';
import { RenameEquipmentCommand } from '@maintenance/application/commands/rename-equipment/rename-equipment.command';
import { RetireEquipmentCommand } from '@maintenance/application/commands/retire-equipment/retire-equipment.command';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { MaintenanceExecutionRepository } from '@maintenance/domain/service/maintenance-execution.repository';
import { ActivitySpecialty } from '@maintenance/domain/value/activity-specialty.vo';
import { CalendarDate } from '@maintenance/domain/value/calendar-date.vo';
import { EquipmentName } from '@maintenance/domain/value/equipment-name.vo';
import { IntervalUnit } from '@maintenance/domain/value/interval-unit';
import { MaintenanceActivityName } from '@maintenance/domain/value/maintenance-activity-name.vo';
import { ServiceBreak } from '@maintenance/domain/value/service-break.vo';
import { MaintenanceModule } from '@maintenance/infrastructure/maintenance.module';
import { ManufacturingInstructionsModule } from '@manufacturing-instructions/infrastructure/manufacturing-instructions.module';
import { ConfigModule } from '@nestjs/config';
import { CommandBus, CqrsModule } from '@nestjs/cqrs';
import { Test, TestingModule } from '@nestjs/testing';
import { EditMaterialCommand } from '@products/application/commands/edit-material/edit-material.command';
import { EditProductCommand } from '@products/application/commands/edit-product/edit-product.command';
import { MaterialCodeAlreadyExists } from '@products/application/exceptions';
import { Material } from '@products/domain/material.aggregate';
import { MaterialRepository } from '@products/domain/service/material.repository';
import { MaterialCode } from '@products/domain/value/material-code.vo';
import { MaterialName } from '@products/domain/value/material-name.vo';
import { ProductName } from '@products/domain/value/product-name.vo';
import { ProductsModule } from '@products/infrastructure/products.module';

// Issue #110 against Postgres, through the app's real module graph (no
// HTTP): the System Admin's correction of a record in use carried by every
// module's `CorrectionPropagator` into its own snapshots, in the edit's one
// transaction, and nothing else of those rows touched; a uniqueness clash
// changing nothing anywhere; deleting retired equipment and an inactive plan
// row with what hangs off them; and equipment's service breaks and restart
// segments round-tripping. Every case uses fresh ids and names and deletes
// its own rows; nothing truncates. No actor is in context, so no audit entry
// is written.

const UNUSABLE_HASH = '$2b$10$integration.tests.never.log.in.with.this.x';
const ADMIN = ApplyToRelatedRecords.askedBy(Role.SystemAdmin, true);
const date = (value: string) => CalendarDate.fromString(value);

describe('the System Admin’s exceptions to the dependency rule', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let commandBus: CommandBus;
  let materials: MaterialRepository;
  let equipmentRepository: EquipmentRepository;
  let unitOfWork: UnitOfWork;
  let executionRepository: MaintenanceExecutionRepository;

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

  async function registeredMaterial(code = `INT-${randomUUID()}`) {
    const material = Material.register(
      MaterialName.fromString(`مس ${randomUUID()}`),
      MaterialCode.fromString(code),
    );
    materialIds.push(material.id.asString());
    await materials.save(material);
    return material;
  }

  /**
   * A product using `material`, a standard BOM of it and an approved daily BOM
   * of that, each holding its own snapshot of the names — written straight
   * into each owning module's tables.
   */
  async function chainUsing(materialId: string) {
    const componentId = randomUUID();
    componentIds.push(componentId);
    await prisma.component.create({
      data: { id: componentId, name: `مغزی ${randomUUID()}` },
    });
    const product = await prisma.product.create({
      data: {
        name: `کابل ${randomUUID()}`,
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
    productIds.push(product.id);
    const standardBom = await prisma.manufacturingInstruction.create({
      data: {
        miCode: `MI-${randomUUID()}`,
        brand: 'Legrand',
        standardLength: 305,
        active: true,
        productId: product.id,
        productName: product.name,
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
    standardBomIds.push(standardBom.id);
    const editHistory = [
      {
        editedBy: 'نیکروش',
        editedAt: '2026-01-01T00:00:00.000Z',
        reason: 'وزن اشتباه',
        changes: ['وزن جز مغزی مواد اولیه مس از 11 به 12 تغییر کرد'],
      },
    ];
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
        editHistory,
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
    bomIds.push(bom.id);
    return { productId: product.id, standardBomId: standardBom.id, bom };
  }

  async function snapshotsOf(materialId: string) {
    const [productMaterial, standardBomMaterial, bomMaterial] =
      await Promise.all([
        prisma.productMaterial.findFirstOrThrow({ where: { materialId } }),
        prisma.manufacturingInstructionMaterial.findFirstOrThrow({
          where: { materialId },
        }),
        prisma.bomMaterial.findFirstOrThrow({ where: { materialId } }),
      ]);
    return {
      product: productMaterial.name,
      standardBom: standardBomMaterial.name,
      dailyBom: bomMaterial.name,
      dailyBomWeight: bomMaterial.weight,
    };
  }

  async function registeredEquipment(name = `اکسترودر ${randomUUID()}`) {
    const { id } = await execute<{ id: string }>(
      new RegisterEquipmentCommand(EquipmentName.fromString(name)),
    );
    equipmentIds.push(id);
    return id;
  }

  async function registeredActivity() {
    const { id } = await execute<{ id: string }>(
      new RegisterMaintenanceActivityCommand(
        MaintenanceActivityName.fromString(`تعویض روغن ${randomUUID()}`),
        ActivitySpecialty.mechanical(),
      ),
    );
    activityIds.push(id);
    return id;
  }

  async function planItemOf(equipmentId: string, activityId: string) {
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

  async function recordedOn(equipmentId: string, planItemId: string) {
    const performerId = randomUUID();
    await prisma.user.create({
      data: {
        id: performerId,
        name: `مسلمی ${performerId}`,
        username: `integration-${performerId}`,
        passwordHash: UNUSABLE_HASH,
        role: Role.PmInspector,
      },
    });
    userIds.push(performerId);
    const { id } = await execute<{ id: string }>(
      new RecordMaintenanceExecutionCommand(
        Identity.fromString(equipmentId),
        Identity.fromString(planItemId),
        Identity.fromString(performerId),
        undefined,
        null,
      ),
    );
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
    equipmentRepository = moduleRef.get(EquipmentRepository, {
      strict: false,
    });
    unitOfWork = moduleRef.get(UnitOfWork, { strict: false });
    executionRepository = moduleRef.get(MaintenanceExecutionRepository, {
      strict: false,
    });
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

  describe('correcting a record in use', () => {
    it("carries a material's corrected name into the product, the standard BOM and the daily BOM, leaving everything else of them alone", async () => {
      const material = await registeredMaterial();
      const { bom } = await chainUsing(material.id.asString());
      const newCode = `INT-${randomUUID()}`;
      const newName = `مس قرمز ${randomUUID()}`;

      await execute(
        new EditMaterialCommand(
          material.id,
          MaterialName.fromString(newName),
          MaterialCode.fromString(newCode),
          ADMIN,
        ),
      );

      const stored = await prisma.material.findUniqueOrThrow({
        where: { id: material.id.asString() },
      });
      expect([stored.name, stored.code]).toEqual([newName, newCode]);
      expect(await snapshotsOf(material.id.asString())).toEqual({
        product: newName,
        standardBom: newName,
        dailyBom: newName,
        dailyBomWeight: 12,
      });
      const dailyBom = await prisma.bom.findUniqueOrThrow({
        where: { id: bom.id },
      });
      expect({
        approvalStatus: dailyBom.approvalStatus,
        reviewedBy: dailyBom.reviewedBy,
        managementNote: dailyBom.managementNote,
        editHistory: dailyBom.editHistory,
        updatedAt: dailyBom.updatedAt,
      }).toEqual({
        approvalStatus: 'approved',
        reviewedBy: 'رضایی',
        managementNote: 'تایید شد',
        editHistory: bom.editHistory,
        updatedAt: bom.updatedAt,
      });
    });

    it('changes nothing anywhere when the corrected code is taken', async () => {
      const material = await registeredMaterial();
      const taken = await registeredMaterial();
      await chainUsing(material.id.asString());
      const before = await snapshotsOf(material.id.asString());

      await expect(
        execute(
          new EditMaterialCommand(
            material.id,
            MaterialName.fromString(`مس قرمز ${randomUUID()}`),
            taken.code(),
            ADMIN,
          ),
        ),
      ).rejects.toBeInstanceOf(MaterialCodeAlreadyExists);

      const stored = await prisma.material.findUniqueOrThrow({
        where: { id: material.id.asString() },
      });
      expect(stored.name).toBe(material.name().asString());
      expect(await snapshotsOf(material.id.asString())).toEqual(before);
    });

    it('rolls the material and every snapshot back together when its transaction fails', async () => {
      const material = await registeredMaterial();
      await chainUsing(material.id.asString());
      const before = await snapshotsOf(material.id.asString());

      // The correction joins the open transaction; failing it afterwards
      // must undo the material's save and every propagator's rewrite alike.
      await expect(
        unitOfWork.run(async () => {
          await execute(
            new EditMaterialCommand(
              material.id,
              MaterialName.fromString(`مس قرمز ${randomUUID()}`),
              MaterialCode.fromString(`INT-${randomUUID()}`),
              ADMIN,
            ),
          );
          throw new Error('the transaction fails after the correction');
        }),
      ).rejects.toThrow('the transaction fails after the correction');

      const stored = await prisma.material.findUniqueOrThrow({
        where: { id: material.id.asString() },
      });
      expect([stored.name, stored.code]).toEqual([
        material.name().asString(),
        material.code().asString(),
      ]);
      expect(await snapshotsOf(material.id.asString())).toEqual(before);
    });

    it("carries a product's corrected name into its standard and daily BOMs, their updated_at untouched", async () => {
      const material = await registeredMaterial();
      const { productId, standardBomId, bom } = await chainUsing(
        material.id.asString(),
      );
      const standardBom =
        await prisma.manufacturingInstruction.findUniqueOrThrow({
          where: { id: standardBomId },
        });
      const newName = `کابل NYY ${randomUUID()}`;

      await execute(
        new EditProductCommand(
          Identity.fromString(productId),
          ProductName.fromString(newName),
          undefined,
          ADMIN,
        ),
      );

      const [product, correctedStandardBom, dailyBom] = await Promise.all([
        prisma.product.findUniqueOrThrow({ where: { id: productId } }),
        prisma.manufacturingInstruction.findUniqueOrThrow({
          where: { id: standardBomId },
        }),
        prisma.bom.findUniqueOrThrow({ where: { id: bom.id } }),
      ]);
      expect([
        product.name,
        correctedStandardBom.productName,
        dailyBom.productName,
      ]).toEqual([newName, newName, newName]);
      expect(correctedStandardBom.updatedAt).toEqual(standardBom.updatedAt);
      expect(dailyBom.updatedAt).toEqual(bom.updatedAt);
      expect(dailyBom.approvalStatus).toBe('approved');
    });

    it('carries corrected equipment and activity names into the PM plan and the history, retired equipment staying retired', async () => {
      const equipmentId = await registeredEquipment();
      const activityId = await registeredActivity();
      const planItemId = await planItemOf(equipmentId, activityId);
      const executionId = await recordedOn(equipmentId, planItemId);
      await execute(
        new RetireEquipmentCommand(Identity.fromString(equipmentId)),
      );
      const equipmentName = `اکسترودر قدیمی ${randomUUID()}`;
      const activityName = `تعویض روغن موتور ${randomUUID()}`;

      await execute(
        new RenameEquipmentCommand(
          Identity.fromString(equipmentId),
          EquipmentName.fromString(equipmentName),
          ADMIN,
        ),
      );
      await execute(
        new EditMaintenanceActivityCommand(
          Identity.fromString(activityId),
          MaintenanceActivityName.fromString(activityName),
          ActivitySpecialty.mechanical(),
          ADMIN,
        ),
      );

      const [planItem, execution, breaks] = await Promise.all([
        prisma.pmPlanItem.findUniqueOrThrow({ where: { id: planItemId } }),
        prisma.maintenanceExecution.findUniqueOrThrow({
          where: { id: executionId },
        }),
        prisma.equipmentServiceBreak.findMany({ where: { equipmentId } }),
      ]);
      expect(planItem.activityName).toBe(activityName);
      expect([execution.equipmentName, execution.activityName]).toEqual([
        equipmentName,
        activityName,
      ]);
      expect(breaks.map(({ reactivatedAt }) => reactivatedAt)).toEqual([null]);
    });
  });

  describe('deleting', () => {
    it('deletes retired equipment with its plan rows, service breaks and executions, freeing its name, other equipment untouched', async () => {
      const name = `اکسترودر ${randomUUID()}`;
      const equipmentId = await registeredEquipment(name);
      const otherId = await registeredEquipment();
      const activityId = await registeredActivity();
      const planItemId = await planItemOf(equipmentId, activityId);
      const otherItemId = await planItemOf(otherId, activityId);
      await recordedOn(equipmentId, planItemId);
      const keptExecution = await recordedOn(otherId, otherItemId);
      await execute(
        new RetireEquipmentCommand(Identity.fromString(equipmentId)),
      );

      await execute(
        new DeleteEquipmentCommand(Identity.fromString(equipmentId)),
      );

      expect(
        await Promise.all([
          prisma.equipment.count({ where: { id: equipmentId } }),
          prisma.pmPlanItem.count({ where: { equipmentId } }),
          prisma.equipmentServiceBreak.count({ where: { equipmentId } }),
          prisma.maintenanceExecution.count({ where: { equipmentId } }),
        ]),
      ).toEqual([0, 0, 0, 0]);
      expect(
        await prisma.maintenanceExecution.count({
          where: { id: keptExecution },
        }),
      ).toBe(1);
      await expect(registeredEquipment(name)).resolves.toEqual(
        expect.any(String),
      );
    });

    it('deletes an inactive plan row with its executions, the rows after it renumbered so the plan still takes a new row', async () => {
      const equipmentId = await registeredEquipment();
      const first = await registeredActivity();
      const second = await registeredActivity();
      const third = await registeredActivity();
      const firstItem = await planItemOf(equipmentId, first);
      const secondItem = await planItemOf(equipmentId, second);
      await recordedOn(equipmentId, firstItem);
      const keptExecution = await recordedOn(equipmentId, secondItem);
      await execute(
        new DeactivatePmPlanItemCommand(
          Identity.fromString(equipmentId),
          Identity.fromString(firstItem),
        ),
      );

      await execute(
        new DeletePmPlanItemCommand(
          Identity.fromString(equipmentId),
          Identity.fromString(firstItem),
        ),
      );
      const thirdItem = await planItemOf(equipmentId, third);

      const rows = await prisma.pmPlanItem.findMany({
        where: { equipmentId },
        orderBy: { position: 'asc' },
      });
      expect(rows.map(({ id, position }) => [id, position])).toEqual([
        [secondItem, 0],
        [thirdItem, 1],
      ]);
      expect(
        await prisma.maintenanceExecution.findMany({
          where: { equipmentId },
          select: { id: true },
        }),
      ).toEqual([{ id: keptExecution }]);
    });
  });

  describe('deleting one execution twice at once', () => {
    it('refuses the second delete as unknown, not a database error', async () => {
      const equipmentId = await registeredEquipment();
      const activityId = await registeredActivity();
      const planItemId = await planItemOf(equipmentId, activityId);
      const executionId = Identity.fromString(
        await recordedOn(equipmentId, planItemId),
      );
      // Two requests, each having loaded it before either deleted it.
      const first = await executionRepository.get(executionId);
      const second = await executionRepository.get(executionId);
      first.delete();
      second.delete();

      await executionRepository.delete(first);

      await expect(executionRepository.delete(second)).rejects.toBeInstanceOf(
        EntityNotFound,
      );
    });
  });

  describe('service breaks', () => {
    it('round-trips every retirement, its reactivation and a restarted schedule', async () => {
      const equipmentId = await registeredEquipment();
      const activityId = await registeredActivity();
      const planItemId = await planItemOf(equipmentId, activityId);
      const retiredAt = new Date('2026-07-10T05:30:00.000Z');
      const reactivatedAt = new Date('2026-07-20T05:30:00.000Z');
      const retiredAgainAt = new Date('2026-08-05T05:30:00.000Z');

      const equipment = await equipmentRepository.get(
        Identity.fromString(equipmentId),
      );
      equipment.retire(retiredAt);
      equipment.reactivate(reactivatedAt, [
        {
          planItemId: Identity.fromString(planItemId),
          firstDueDate: date('2026-07-25'),
        },
      ]);
      equipment.retire(retiredAgainAt);
      await equipmentRepository.save(equipment);

      const reloaded = await equipmentRepository.get(
        Identity.fromString(equipmentId),
      );
      expect(reloaded.serviceBreaks()).toEqual([
        ServiceBreak.restore(retiredAt, reactivatedAt),
        ServiceBreak.restore(retiredAgainAt, null),
      ]);
      expect(reloaded.isRetired()).toBe(true);
      expect(
        reloaded.planItem(Identity.fromString(planItemId)).schedule(),
      ).toEqual(equipment.planItem(Identity.fromString(planItemId)).schedule());
      const stored = await prisma.pmPlanItem.findUniqueOrThrow({
        where: { id: planItemId },
      });
      expect(stored.schedule).toEqual([
        { startDueDate: '2026-07-01', intervalDays: 7 },
        {
          startDueDate: '2026-07-25',
          intervalDays: 7,
          restartedOn: '2026-07-20',
        },
      ]);
    });

    it('refuses to save equipment loaded before another request deleted it, never bringing it back', async () => {
      const equipmentId = await registeredEquipment();
      const loaded = await equipmentRepository.get(
        Identity.fromString(equipmentId),
      );
      loaded.retire(new Date('2026-07-10T05:30:00.000Z'));
      await prisma.equipment.delete({ where: { id: equipmentId } });

      await expect(equipmentRepository.save(loaded)).rejects.toBeInstanceOf(
        EntityNotFound,
      );
      expect(await prisma.equipment.count({ where: { id: equipmentId } })).toBe(
        0,
      );
    });
  });
});
