import { randomUUID } from 'node:crypto';

import { AuditLogRepository } from '@audit-logging/application/service/audit-log.repository';
import { AuditLoggingModule } from '@audit-logging/infrastructure/audit-logging.module';
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
import { AddPmPlanItemCommand } from '@maintenance/application/commands/add-pm-plan-item/add-pm-plan-item.command';
import { ImportPmPlansCommand } from '@maintenance/application/commands/import-pm-plans/import-pm-plans.command';
import { RegisterEquipmentCommand } from '@maintenance/application/commands/register-equipment/register-equipment.command';
import { RegisterMaintenanceActivityCommand } from '@maintenance/application/commands/register-maintenance-activity/register-maintenance-activity.command';
import { PmPlanImportPreview } from '@maintenance/application/service/pm-plan-import-result';
import { MaintenanceActivityRepository } from '@maintenance/domain/service/maintenance-activity.repository';
import { ActivitySpecialty } from '@maintenance/domain/value/activity-specialty.vo';
import { CalendarDate } from '@maintenance/domain/value/calendar-date.vo';
import { EquipmentName } from '@maintenance/domain/value/equipment-name.vo';
import { IntervalUnit } from '@maintenance/domain/value/interval-unit';
import { MaintenanceActivityName } from '@maintenance/domain/value/maintenance-activity-name.vo';
import { MaintenanceModule } from '@maintenance/infrastructure/maintenance.module';
import { ConfigModule } from '@nestjs/config';
import { CommandBus, CqrsModule } from '@nestjs/cqrs';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Request, Response } from 'express';
import writeXlsxFile from 'write-excel-file/node';

// What a unit spec cannot show about the bulk import of PM plans (issue
// #127): a real `.xlsx` read through the real reader, and a confirmed import
// adding every new item — across several pieces of equipment, each with its
// audit entry — or, when any write fails, none of them — and never undoing a
// change to those plans committed by another request meanwhile. Runs against the test
// stack's Postgres; every case uses fresh names and deletes its own rows.

const UNUSABLE_HASH = '$2b$10$integration.tests.never.log.in.with.this.x';

describe('PM plan import', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let commandBus: CommandBus;
  let auditLog: AuditLogRepository;
  let activityRepository: MaintenanceActivityRepository;
  let jwt: JwtService;
  let actorMiddleware: ActorContextMiddleware;
  let actorId: string;
  let equipmentIds: string[] = [];
  let activityIds: string[] = [];

  function execute<T>(command: object): Promise<T> {
    const request = {
      headers: { authorization: `Bearer ${jwt.sign({ sub: actorId })}` },
    } as unknown as Request;
    return new Promise<T>((resolve, reject) => {
      actorMiddleware.use(request, {} as Response, () => {
        commandBus.execute<object, T>(command).then(resolve, reject);
      });
    });
  }

  async function registeredEquipment(name: string): Promise<string> {
    const { id } = await execute<{ id: string }>(
      new RegisterEquipmentCommand(EquipmentName.fromString(name)),
    );
    equipmentIds.push(id);
    return id;
  }

  async function registeredActivity(name: string): Promise<string> {
    const { id } = await execute<{ id: string }>(
      new RegisterMaintenanceActivityCommand(
        MaintenanceActivityName.fromString(name),
        ActivitySpecialty.mechanical(),
      ),
    );
    activityIds.push(id);
    return id;
  }

  /** Two pieces of equipment, two activities, and the sheet marking three items. */
  async function arrange() {
    const compressor = `کمپرسور ${randomUUID()}`;
    const extruder = `اکسترودر ${randomUUID()}`;
    const oilChange = `تعویض روغن ${randomUUID()}`;
    const panelCheck = `بررسی تابلو ${randomUUID()}`;
    const compressorId = await registeredEquipment(compressor);
    const extruderId = await registeredEquipment(extruder);
    const oilChangeId = await registeredActivity(oilChange);
    await registeredActivity(panelCheck);
    const file = await writeXlsxFile([
      {
        sheet: 'pm',
        data: [
          ['تجهیز', 'اولین موعد', oilChange, panelCheck],
          [null, null, 30, 7],
          [compressor, '1405/08/30', '+', '+'],
          [extruder, '1405/9/30', null, '+'],
        ],
      },
    ]).toBuffer();
    return { file, compressorId, extruderId, oilChangeId };
  }

  function planItemsOf(equipmentId: string) {
    return prisma.pmPlanItem.findMany({
      where: { equipmentId },
      orderBy: { position: 'asc' },
    });
  }

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
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
        MaintenanceModule,
        AuditLoggingModule,
      ],
    }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaService, { strict: false });
    commandBus = moduleRef.get(CommandBus, { strict: false });
    auditLog = moduleRef.get(AuditLogRepository, { strict: false });
    activityRepository = moduleRef.get(MaintenanceActivityRepository, {
      strict: false,
    });
    jwt = moduleRef.get(JwtService, { strict: false });
    actorMiddleware = moduleRef.get(ActorContextMiddleware, { strict: false });

    actorId = randomUUID();
    await prisma.user.create({
      data: {
        id: actorId,
        name: `یاشار ${actorId}`,
        username: `integration-${actorId}`,
        passwordHash: UNUSABLE_HASH,
        role: Role.SystemAdmin,
      },
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    const planItems = await prisma.pmPlanItem.findMany({
      where: { equipmentId: { in: equipmentIds } },
      select: { id: true },
    });
    await prisma.auditLogEntry.deleteMany({
      where: {
        recordId: {
          in: [
            ...equipmentIds,
            ...activityIds,
            ...planItems.map((row) => row.id),
          ],
        },
      },
    });
    await prisma.equipment.deleteMany({ where: { id: { in: equipmentIds } } });
    await prisma.maintenanceActivity.deleteMany({
      where: { id: { in: activityIds } },
    });
    equipmentIds = [];
    activityIds = [];
  });

  afterAll(async () => {
    await prisma?.user.deleteMany({ where: { id: actorId } });
    await moduleRef?.close();
  });

  it('adds every new item across the equipment, each with its audit entry', async () => {
    const { file, compressorId, extruderId } = await arrange();

    const result = await execute<PmPlanImportPreview>(
      new ImportPmPlansCommand(file),
    );

    expect(result.counts.toCreate).toBe(3);
    const compressorItems = await planItemsOf(compressorId);
    const extruderItems = await planItemsOf(extruderId);
    expect(
      [...compressorItems, ...extruderItems].map((item) => item.schedule),
    ).toEqual([
      [{ startDueDate: '2026-11-21', intervalDays: 30 }],
      [{ startDueDate: '2026-11-21', intervalDays: 7 }],
      [{ startDueDate: '2026-12-21', intervalDays: 7 }],
    ]);
    const entries = await prisma.auditLogEntry.findMany({
      where: {
        recordId: {
          in: [...compressorItems, ...extruderItems].map((item) => item.id),
        },
      },
    });
    expect(
      entries.map((entry) => [entry.recordType, entry.action, entry.actorId]),
    ).toEqual([
      ['PmPlanItem', 'Registered', actorId],
      ['PmPlanItem', 'Registered', actorId],
      ['PmPlanItem', 'Registered', actorId],
    ]);
  });

  it('adds nothing at all when a later write fails', async () => {
    const { file, compressorId, extruderId } = await arrange();
    const record = auditLog.record.bind(
      auditLog,
    ) as AuditLogRepository['record'];
    // The compressor's two items are saved and audited first; the
    // extruder's audit entry then fails.
    jest
      .spyOn(auditLog, 'record')
      .mockImplementationOnce(record)
      .mockImplementationOnce(record)
      .mockRejectedValueOnce(new Error('audit store unavailable'));

    await expect(execute(new ImportPmPlansCommand(file))).rejects.toThrow(
      'audit store unavailable',
    );

    expect(await planItemsOf(compressorId)).toEqual([]);
    expect(await planItemsOf(extruderId)).toEqual([]);
  });

  it('keeps a change to a plan committed by another request after the import first read it', async () => {
    const { file, extruderId, oilChangeId } = await arrange();
    const { id: earlierItemId } = await execute<{ id: string }>(
      new AddPmPlanItemCommand(
        Identity.fromString(extruderId),
        Identity.fromString(oilChangeId),
        15,
        IntervalUnit.Days,
        CalendarDate.fromString('2026-07-01'),
      ),
    );
    const list = activityRepository.list.bind(
      activityRepository,
    ) as MaintenanceActivityRepository['list'];
    // Once the import has read the plans, another request deactivates the
    // extruder's earlier row and commits — on its own connection.
    jest.spyOn(activityRepository, 'list').mockImplementationOnce(async () => {
      await prisma.pmPlanItem.update({
        where: { id: earlierItemId },
        data: { deactivatedAt: new Date('2026-11-19T08:00:00Z') },
      });
      return list();
    });

    await execute(new ImportPmPlansCommand(file));

    const earlier = await prisma.pmPlanItem.findUniqueOrThrow({
      where: { id: earlierItemId },
    });
    expect(earlier.deactivatedAt).toEqual(new Date('2026-11-19T08:00:00Z'));
    expect(await planItemsOf(extruderId)).toHaveLength(2);
  });
});
