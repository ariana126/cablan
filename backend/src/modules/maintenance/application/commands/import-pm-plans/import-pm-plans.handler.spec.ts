import { ImmediateUnitOfWork } from '@framework/application/support/immediate-unit-of-work';
import {
  PmPlanImportFileUnreadable,
  PmPlanImportHasErrors,
} from '@maintenance/application/exceptions';
import { MaintenanceWorld } from '@maintenance/application/support/maintenance-world';
import { StubPmPlanWorkbookReader } from '@maintenance/application/support/stub-pm-plan-workbook-reader';
import { PmPlanItemAdded } from '@maintenance/domain/events/pm-plan-item-added.event';
import { PmPlanSheetCell } from '@maintenance/domain/service/pm-plan-import-check';

import { PM_PLAN_IMPORT_LOCK } from '../../service/pm-plan-import-lock';
import { PM_SNAPSHOT_NAMES_LOCK } from '../../service/pm-snapshot-names-lock';
import { ImportPmPlansCommand } from './import-pm-plans.command';
import { ImportPmPlansHandler } from './import-pm-plans.handler';

const FILE = Buffer.from('xlsx');
const OIL_CHANGE = 'تعویض روغن';
const PANEL_CHECK = 'بررسی تابلو برق';
const COMPRESSOR = 'کمپرسور هوا';
const EXTRUDER = 'اکسترودر 1';

function pmSheet(...rows: PmPlanSheetCell[][]) {
  return {
    name: 'pm',
    cells: [
      ['تجهیز', 'اولین موعد', OIL_CHANGE, PANEL_CHECK],
      [null, null, 30, 7],
      ...rows,
    ],
  };
}

function makeSut(...rows: PmPlanSheetCell[][]) {
  const world = new MaintenanceWorld('2026-11-19');
  const compressor = world.equipment(COMPRESSOR);
  const extruder = world.equipment(EXTRUDER);
  const oilChange = world.activity(OIL_CHANGE);
  const panelCheck = world.activity(PANEL_CHECK);
  const unitOfWork = new ImmediateUnitOfWork();
  const sut = new ImportPmPlansHandler(
    StubPmPlanWorkbookReader.holding(pmSheet(...rows)),
    world.equipmentRepository,
    world.activityRepository,
    unitOfWork,
  );
  return {
    sut,
    world,
    unitOfWork,
    compressor,
    extruder,
    oilChange,
    panelCheck,
  };
}

function addedEvents(world: MaintenanceWorld) {
  return world.equipmentRepository.savedEvents.map((event) => {
    const added = event as PmPlanItemAdded;
    return [
      added.equipmentName,
      added.activityName,
      added.intervalDays,
      added.firstDueDate,
    ];
  });
}

describe('ImportPmPlansHandler', () => {
  it('adds every new item through the equipment’s plan, one plan item added each, and describes them', async () => {
    const { sut, world, unitOfWork } = makeSut(
      [COMPRESSOR, '1405/08/30', '+', '+'],
      [EXTRUDER, '1405/09/30', null, '+'],
    );

    const result = await sut.execute(new ImportPmPlansCommand(FILE));

    expect(addedEvents(world)).toEqual([
      [COMPRESSOR, OIL_CHANGE, 30, '2026-11-21'],
      [COMPRESSOR, PANEL_CHECK, 7, '2026-11-21'],
      [EXTRUDER, PANEL_CHECK, 7, '2026-12-21'],
    ]);
    expect(result.counts).toEqual({
      toCreate: 3,
      alreadyExisting: 0,
      conflicts: 0,
      errors: 0,
    });
    expect(unitOfWork.lockKeysTaken()).toEqual([
      PM_PLAN_IMPORT_LOCK,
      PM_SNAPSHOT_NAMES_LOCK,
    ]);
  });

  it('adds nothing when the sheet has an error, refusing it with every error', async () => {
    const { sut, world, compressor } = makeSut(
      [COMPRESSOR, '1405/08/30', '+', '+'],
      ['کمپرسور باد', '1405/08/30', '+', null],
    );

    const refusal = await sut
      .execute(new ImportPmPlansCommand(FILE))
      .catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(PmPlanImportHasErrors);
    expect((refusal as PmPlanImportHasErrors).errors).toEqual([
      {
        sheet: 'pm',
        cell: 'A4',
        row: 4,
        column: 'A',
        value: 'کمپرسور باد',
        reason: 'equipment-not-found',
        message: 'تجهیز تعریف نشده است',
      },
    ]);
    expect(world.equipmentRepository.savedEvents).toEqual([]);
    expect(compressor.activePlanItems()).toEqual([]);
  });

  it('leaves an item already in force and one in conflict untouched, adding the rest', async () => {
    const { sut, world, compressor, extruder, oilChange, panelCheck } = makeSut(
      [COMPRESSOR, '1405/08/30', '+', '+'],
      [EXTRUDER, '1405/08/30', '+', null],
    );
    world.planItem(compressor, oilChange, 30, '2026-11-21');
    world.planItem(compressor, panelCheck, 15, '2026-11-21');

    const result = await sut.execute(new ImportPmPlansCommand(FILE));

    expect(addedEvents(world)).toEqual([
      [EXTRUDER, OIL_CHANGE, 30, '2026-11-21'],
    ]);
    expect(result.counts).toEqual({
      toCreate: 1,
      alreadyExisting: 1,
      conflicts: 1,
      errors: 0,
    });
    expect(
      compressor
        .activePlanItems()
        .map((item) => item.schedule().intervalDays().asNumber()),
    ).toEqual([30, 15]);
    expect(extruder.activePlanItems()).toHaveLength(1);
  });

  it('adds nothing the second time the same file is imported', async () => {
    const { sut, world } = makeSut([COMPRESSOR, '1405/08/30', '+', null]);
    await sut.execute(new ImportPmPlansCommand(FILE));
    world.equipmentRepository.savedEvents.length = 0;

    const again = await sut.execute(new ImportPmPlansCommand(FILE));

    expect(world.equipmentRepository.savedEvents).toEqual([]);
    expect(again.counts.alreadyExisting).toBe(1);
    expect(again.counts.toCreate).toBe(0);
  });

  it('refuses an unreadable file', async () => {
    const world = new MaintenanceWorld('2026-11-19');
    const sut = new ImportPmPlansHandler(
      StubPmPlanWorkbookReader.unreadable(),
      world.equipmentRepository,
      world.activityRepository,
      new ImmediateUnitOfWork(),
    );

    await expect(
      sut.execute(new ImportPmPlansCommand(FILE)),
    ).rejects.toBeInstanceOf(PmPlanImportFileUnreadable);
  });
});
