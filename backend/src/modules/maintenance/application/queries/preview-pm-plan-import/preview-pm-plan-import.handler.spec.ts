import { PmPlanImportFileUnreadable } from '@maintenance/application/exceptions';
import { MaintenanceWorld } from '@maintenance/application/support/maintenance-world';
import { StubPmPlanWorkbookReader } from '@maintenance/application/support/stub-pm-plan-workbook-reader';
import { PmPlanSheetCell } from '@maintenance/domain/service/pm-plan-import-check';

import { PreviewPmPlanImportHandler } from './preview-pm-plan-import.handler';
import { PreviewPmPlanImportQuery } from './preview-pm-plan-import.query';

const FILE = Buffer.from('xlsx');
const OIL_CHANGE = 'تعویض روغن';
const PANEL_CHECK = 'بررسی تابلو برق';
const COMPRESSOR = 'کمپرسور هوا';

function pmSheet(name: string, ...rows: PmPlanSheetCell[][]) {
  return {
    name,
    cells: [
      ['تجهیز', 'اولین موعد', OIL_CHANGE, PANEL_CHECK],
      [null, null, 30, 7],
      ...rows,
    ],
  };
}

function makeSut(reader: StubPmPlanWorkbookReader) {
  const world = new MaintenanceWorld('2026-11-19');
  const compressor = world.equipment(COMPRESSOR);
  const oilChange = world.activity(OIL_CHANGE);
  const panelCheck = world.activity(PANEL_CHECK);
  const sut = new PreviewPmPlanImportHandler(
    reader,
    world.equipmentRepository,
    world.activityRepository,
  );
  return { sut, world, compressor, oilChange, panelCheck };
}

describe('PreviewPmPlanImportHandler', () => {
  it('describes the items it would add, storing nothing', async () => {
    const { sut, world, compressor, oilChange, panelCheck } = makeSut(
      StubPmPlanWorkbookReader.holding(
        pmSheet('pm', [COMPRESSOR, '1405/08/30', '+', '+']),
      ),
    );

    const preview = await sut.execute(new PreviewPmPlanImportQuery(FILE));

    expect(preview).toEqual({
      sheetName: 'pm',
      counts: { toCreate: 2, alreadyExisting: 0, conflicts: 0, errors: 0 },
      errors: [],
      toCreate: [
        {
          cell: 'C3',
          equipmentId: compressor.id.asString(),
          equipmentName: COMPRESSOR,
          activityId: oilChange.id.asString(),
          activityName: OIL_CHANGE,
          intervalDays: 30,
          firstDueDate: '2026-11-21',
        },
        {
          cell: 'D3',
          equipmentId: compressor.id.asString(),
          equipmentName: COMPRESSOR,
          activityId: panelCheck.id.asString(),
          activityName: PANEL_CHECK,
          intervalDays: 7,
          firstDueDate: '2026-11-21',
        },
      ],
      alreadyExisting: [],
      conflicts: [],
    });
    expect(compressor.activePlanItems()).toEqual([]);
    expect(world.equipmentRepository.savedEvents).toEqual([]);
  });

  it('describes each error with its sheet, place, value and Persian reason', async () => {
    const { sut } = makeSut(
      StubPmPlanWorkbookReader.holding(
        pmSheet(
          'pm',
          [COMPRESSOR, '1405/13/01', '+', null],
          ['کمپرسور باد', '1405/08/30', 'x', null],
        ),
      ),
    );

    const preview = await sut.execute(new PreviewPmPlanImportQuery(FILE));

    expect(preview.counts.errors).toBe(3);
    expect(preview.errors).toEqual([
      {
        sheet: 'pm',
        cell: 'B3',
        row: 3,
        column: 'B',
        value: '1405/13/01',
        reason: 'invalid-jalali-date',
        message: 'تاریخ شمسی نامعتبر است',
      },
      {
        sheet: 'pm',
        cell: 'A4',
        row: 4,
        column: 'A',
        value: 'کمپرسور باد',
        reason: 'equipment-not-found',
        message: 'تجهیز تعریف نشده است',
      },
      {
        sheet: 'pm',
        cell: 'C4',
        row: 4,
        column: 'C',
        value: 'x',
        reason: 'invalid-mark',
        message: 'علامت نامعتبر است',
      },
    ]);
  });

  it('describes an active item as already existing, or as a conflict with what differs', async () => {
    const { sut, world, compressor, oilChange, panelCheck } = makeSut(
      StubPmPlanWorkbookReader.holding(
        pmSheet('pm', [COMPRESSOR, '1405/08/30', '+', '+']),
      ),
    );
    world.planItem(compressor, oilChange, 30, '2026-11-21');
    world.planItem(compressor, panelCheck, 15, '2026-09-23');

    const preview = await sut.execute(new PreviewPmPlanImportQuery(FILE));

    expect(preview.counts).toEqual({
      toCreate: 0,
      alreadyExisting: 1,
      conflicts: 1,
      errors: 0,
    });
    expect(preview.alreadyExisting.map((item) => item.cell)).toEqual(['C3']);
    expect(preview.conflicts).toEqual([
      {
        cell: 'D3',
        equipmentId: compressor.id.asString(),
        equipmentName: COMPRESSOR,
        activityId: panelCheck.id.asString(),
        activityName: PANEL_CHECK,
        intervalDays: 7,
        firstDueDate: '2026-11-21',
        existingIntervalDays: 15,
        existingFirstDueDate: '2026-09-23',
        differences: ['intervalDays', 'firstDueDate'],
      },
    ]);
  });

  it('reads the sheet named pm, whatever its case and spaces, over the first one', async () => {
    const { sut } = makeSut(
      StubPmPlanWorkbookReader.holding(
        { name: 'راهنما', cells: [['این برگه راهنماست']] },
        pmSheet(' PM ', [COMPRESSOR, '1405/08/30', '+', null]),
      ),
    );

    const preview = await sut.execute(new PreviewPmPlanImportQuery(FILE));

    expect(preview.sheetName).toBe(' PM ');
    expect(preview.counts.toCreate).toBe(1);
  });

  it('reads the first sheet when none is named pm', async () => {
    const { sut } = makeSut(
      StubPmPlanWorkbookReader.holding(
        pmSheet('برنامه', [COMPRESSOR, '1405/08/30', '+', null]),
        { name: 'دیگر', cells: [] },
      ),
    );

    const preview = await sut.execute(new PreviewPmPlanImportQuery(FILE));

    expect(preview.sheetName).toBe('برنامه');
    expect(preview.counts.toCreate).toBe(1);
  });

  it('refuses a workbook without a sheet as unreadable', async () => {
    const { sut } = makeSut(StubPmPlanWorkbookReader.holding());

    await expect(
      sut.execute(new PreviewPmPlanImportQuery(FILE)),
    ).rejects.toBeInstanceOf(PmPlanImportFileUnreadable);
  });
});
