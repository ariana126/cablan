import { Equipment } from '../equipment.aggregate';
import { MaintenanceActivity } from '../maintenance-activity.aggregate';
import { ActivitySpecialty } from '../value/activity-specialty.vo';
import { CalendarDate } from '../value/calendar-date.vo';
import { EquipmentName } from '../value/equipment-name.vo';
import { IntervalDays } from '../value/interval-days.vo';
import { MaintenanceActivityName } from '../value/maintenance-activity-name.vo';
import {
  PmPlanImportCheck,
  PmPlanImportError,
  PmPlanSheetCell,
} from './pm-plan-import-check';

type Grid = PmPlanSheetCell[][];

const OIL_CHANGE = 'تعویض روغن';
const PANEL_CHECK = 'بررسی تابلو برق';
const COMPRESSOR = 'کمپرسور هوا';
const EXTRUDER = 'اکسترودر 1';

// 1405/08/30 is 2026-11-21; 1405/09/30 is 2026-12-21.
const ON_1405_08_30 = '1405/08/30';

function equipmentNamed(name: string): Equipment {
  const equipment = Equipment.register(EquipmentName.fromString(name));
  equipment.releaseEvents();
  return equipment;
}

function activityNamed(name: string): MaintenanceActivity {
  const activity = MaintenanceActivity.register(
    MaintenanceActivityName.fromString(name),
    ActivitySpecialty.mechanical(),
  );
  activity.releaseEvents();
  return activity;
}

/** The background: two pieces of equipment and two activities, no plans. */
function arrange() {
  const compressor = equipmentNamed(COMPRESSOR);
  const extruder = equipmentNamed(EXTRUDER);
  const oilChange = activityNamed(OIL_CHANGE);
  const panelCheck = activityNamed(PANEL_CHECK);
  return {
    compressor,
    extruder,
    oilChange,
    panelCheck,
    equipment: [compressor, extruder],
    activities: [oilChange, panelCheck],
  };
}

function inPlan(
  equipment: Equipment,
  activity: MaintenanceActivity,
  intervalDays: number,
  firstDueDate: string,
): void {
  equipment.addPlanItem(
    activity,
    IntervalDays.of(intervalDays),
    CalendarDate.fromString(firstDueDate),
  );
  equipment.releaseEvents();
}

/** The sheet's layout: names, then intervals, then one row per equipment. */
function sheet(
  activities: PmPlanSheetCell[],
  intervals: PmPlanSheetCell[],
  ...rows: PmPlanSheetCell[][]
): Grid {
  return [
    ['تجهیز', 'اولین موعد', ...activities],
    [null, null, ...intervals],
    ...rows,
  ];
}

function check(grid: Grid, world = arrange()): PmPlanImportCheck {
  return PmPlanImportCheck.of(grid, world.equipment, world.activities);
}

function errorAt(
  cell: string,
  value: string,
  reason: PmPlanImportError['reason'],
): PmPlanImportError {
  const column = [...cell]
    .filter((char) => char >= 'A' && char <= 'Z')
    .join('');
  const row = Number(cell.slice(column.length));
  return { cell, row, column, value, reason };
}

describe('PmPlanImportCheck', () => {
  describe('a valid +', () => {
    it('is an item to create, first due on its row’s date and repeating every its column’s interval', () => {
      const world = arrange();

      const sut = check(
        sheet(
          [OIL_CHANGE, PANEL_CHECK],
          [30, 7],
          [COMPRESSOR, ON_1405_08_30, '+', '+'],
        ),
        world,
      );

      expect(sut.errors).toEqual([]);
      expect(
        sut.toCreate.map((item) => ({
          cell: item.cell,
          equipment: item.equipment,
          activity: item.activity,
          intervalDays: item.intervalDays.asNumber(),
          firstDueDate: item.firstDueDate.asString(),
        })),
      ).toEqual([
        {
          cell: 'C3',
          equipment: world.compressor,
          activity: world.oilChange,
          intervalDays: 30,
          firstDueDate: '2026-11-21',
        },
        {
          cell: 'D3',
          equipment: world.compressor,
          activity: world.panelCheck,
          intervalDays: 7,
          firstDueDate: '2026-11-21',
        },
      ]);
    });

    it('reads a first due date with a one-digit day as the zero-padded one', () => {
      const sut = check(
        sheet([OIL_CHANGE], [30], [COMPRESSOR, '1405/10/1', '+']),
      );

      expect(sut.toCreate[0].firstDueDate.asString()).toBe('2026-12-22');
    });

    it('reads a spreadsheet date cell as the Jalali date it shows', () => {
      const sut = check(
        sheet(
          [OIL_CHANGE],
          [30],
          [COMPRESSOR, new Date(Date.UTC(2026, 10, 21)), '+'],
        ),
      );

      expect(sut.toCreate[0].firstDueDate.asString()).toBe('2026-11-21');
    });

    it('accepts a first due date in the past', () => {
      const sut = check(
        sheet([OIL_CHANGE], [30], [COMPRESSOR, '1400/01/01', '+']),
      );

      expect(sut.errors).toEqual([]);
      expect(sut.toCreate).toHaveLength(1);
    });

    it('matches names trimmed and with Persian digits normalised, and a mark trimmed', () => {
      const world = arrange();

      const sut = check(
        sheet(
          [` ${OIL_CHANGE} `],
          ['۳۰'],
          ['  اکسترودر ۱ ', '۱۴۰۵/۰۸/۳۰', ' + '],
        ),
        world,
      );

      expect(sut.errors).toEqual([]);
      expect(sut.toCreate.map((item) => item.equipment)).toEqual([
        world.extruder,
      ]);
      expect(sut.toCreate[0].intervalDays.asNumber()).toBe(30);
    });

    it('is created beside a deactivated earlier row of the same activity', () => {
      const world = arrange();
      inPlan(world.compressor, world.oilChange, 30, '2026-11-21');
      world.compressor.deactivatePlanItem(
        world.compressor.planItems()[0].id,
        new Date('2026-11-25T08:00:00Z'),
      );
      world.compressor.releaseEvents();

      const sut = check(
        sheet([OIL_CHANGE], [30], [COMPRESSOR, ON_1405_08_30, '+']),
        world,
      );

      expect(sut.toCreate).toHaveLength(1);
      expect(sut.alreadyExisting).toEqual([]);
    });
  });

  describe('an empty crossing', () => {
    it('creates nothing', () => {
      const sut = check(
        sheet(
          [OIL_CHANGE, PANEL_CHECK],
          [30, 7],
          [COMPRESSOR, ON_1405_08_30, '+', null],
        ),
      );

      expect(
        sut.toCreate.map((item) => item.activity.name().asString()),
      ).toEqual([OIL_CHANGE]);
    });
  });

  describe('an active item already in the plan', () => {
    it('with the same interval and first due date is already existing', () => {
      const world = arrange();
      inPlan(world.compressor, world.oilChange, 30, '2026-11-21');

      const sut = check(
        sheet([OIL_CHANGE], [30], [COMPRESSOR, ON_1405_08_30, '+']),
        world,
      );

      expect(sut.toCreate).toEqual([]);
      expect(sut.conflicts).toEqual([]);
      expect(sut.alreadyExisting.map((item) => item.cell)).toEqual(['C3']);
    });

    it('with another interval is a conflict on the interval', () => {
      const world = arrange();
      inPlan(world.compressor, world.oilChange, 15, '2026-11-21');

      const sut = check(
        sheet([OIL_CHANGE], [30], [COMPRESSOR, ON_1405_08_30, '+']),
        world,
      );

      expect(sut.toCreate).toEqual([]);
      expect(
        sut.conflicts.map((conflict) => ({
          cell: conflict.cell,
          existingIntervalDays: conflict.existingIntervalDays.asNumber(),
          existingFirstDueDate: conflict.existingFirstDueDate.asString(),
          differences: conflict.differences,
        })),
      ).toEqual([
        {
          cell: 'C3',
          existingIntervalDays: 15,
          existingFirstDueDate: '2026-11-21',
          differences: ['intervalDays'],
        },
      ]);
    });

    it('with another first due date is a conflict on the first due date', () => {
      const world = arrange();
      inPlan(world.compressor, world.oilChange, 30, '2026-09-23');

      const sut = check(
        sheet([OIL_CHANGE], [30], [COMPRESSOR, ON_1405_08_30, '+']),
        world,
      );

      expect(sut.conflicts[0].differences).toEqual(['firstDueDate']);
    });

    it('with both different lists both differences', () => {
      const world = arrange();
      inPlan(world.compressor, world.oilChange, 15, '2026-09-23');

      const sut = check(
        sheet([OIL_CHANGE], [30], [COMPRESSOR, ON_1405_08_30, '+']),
        world,
      );

      expect(sut.conflicts[0].differences).toEqual([
        'intervalDays',
        'firstDueDate',
      ]);
    });

    it('is compared by its current interval', () => {
      const world = arrange();
      inPlan(world.compressor, world.oilChange, 15, '2026-11-21');
      world.compressor.changePlanItemInterval(
        world.compressor.planItems()[0].id,
        IntervalDays.of(30),
        CalendarDate.fromString('2026-12-06'),
      );
      world.compressor.releaseEvents();

      const sut = check(
        sheet([OIL_CHANGE], [30], [COMPRESSOR, ON_1405_08_30, '+']),
        world,
      );

      expect(sut.alreadyExisting).toHaveLength(1);
    });
  });

  describe('errors', () => {
    it('reports unknown activity and equipment names, ordered by row then column', () => {
      const sut = check(
        sheet(
          [OIL_CHANGE, 'روغن کاری'],
          [30, 7],
          [COMPRESSOR, ON_1405_08_30, '+', '+'],
          ['کمپرسور باد', ON_1405_08_30, '+', null],
        ),
      );

      expect(sut.errors).toEqual([
        errorAt('D1', 'روغن کاری', 'activity-not-found'),
        errorAt('A4', 'کمپرسور باد', 'equipment-not-found'),
      ]);
    });

    it('reports an unknown name whether or not its row or column holds a +', () => {
      const sut = check(
        sheet(
          [OIL_CHANGE, 'روغن کاری'],
          [30, 7],
          [COMPRESSOR, ON_1405_08_30, '+', null],
          ['کمپرسور باد', ON_1405_08_30, null, null],
        ),
      );

      expect(sut.errors.map((error) => error.reason)).toEqual([
        'activity-not-found',
        'equipment-not-found',
      ]);
    });

    it.each([
      ['an impossible month', '1405/13/01'],
      ['a Gregorian date', '2026-11-21'],
    ])('reports %s as an invalid Jalali date', (_case, date) => {
      const sut = check(sheet([OIL_CHANGE], [30], [COMPRESSOR, date, '+']));

      expect(sut.errors).toEqual([errorAt('B3', date, 'invalid-jalali-date')]);
      expect(sut.toCreate).toEqual([]);
    });

    it('reports an empty first due date of a row holding a +', () => {
      const sut = check(sheet([OIL_CHANGE], [30], [COMPRESSOR, null, '+']));

      expect(sut.errors).toEqual([
        errorAt('B3', '', 'first-due-date-required'),
      ]);
    });

    it('accepts an empty first due date of a row holding no +', () => {
      const sut = check(
        sheet(
          [OIL_CHANGE],
          [30],
          [COMPRESSOR, ON_1405_08_30, '+'],
          [EXTRUDER, null, null],
        ),
      );

      expect(sut.errors).toEqual([]);
    });

    it('reports an empty interval of a column holding a +', () => {
      const sut = check(
        sheet([OIL_CHANGE], [null], [COMPRESSOR, ON_1405_08_30, '+']),
      );

      expect(sut.errors).toEqual([errorAt('C2', '', 'interval-required')]);
    });

    it('accepts an empty interval of a column holding no +', () => {
      const sut = check(
        sheet(
          [OIL_CHANGE, PANEL_CHECK],
          [30, null],
          [COMPRESSOR, ON_1405_08_30, '+', null],
        ),
      );

      expect(sut.errors).toEqual([]);
    });

    it.each([
      ['zero', 0, '0'],
      ['a negative number', -7, '-7'],
      ['a decimal', 1.5, '1.5'],
      ['a word', 'سی', 'سی'],
      ['more than a hundred years', 36_501, '36501'],
    ])(
      'reports an interval of %s as not a positive integer',
      (_case, interval, text) => {
        const sut = check(
          sheet([OIL_CHANGE], [interval], [COMPRESSOR, ON_1405_08_30, '+']),
        );

        expect(sut.errors).toEqual([
          errorAt('C2', text, 'interval-not-positive-integer'),
        ]);
      },
    );

    it('reports any mark other than + as invalid', () => {
      const sut = check(
        sheet(
          [OIL_CHANGE, PANEL_CHECK],
          [30, 7],
          [COMPRESSOR, ON_1405_08_30, 'x', '+'],
        ),
      );

      expect(sut.errors).toEqual([errorAt('C3', 'x', 'invalid-mark')]);
      expect(sut.toCreate.map((item) => item.cell)).toEqual(['D3']);
    });

    it('reports retired equipment whose row holds a +', () => {
      const world = arrange();
      world.compressor.retire(new Date('2026-11-01T08:00:00Z'));
      world.compressor.releaseEvents();

      const sut = check(
        sheet([OIL_CHANGE], [30], [COMPRESSOR, ON_1405_08_30, '+']),
        world,
      );

      expect(sut.errors).toEqual([
        errorAt('A3', COMPRESSOR, 'equipment-retired'),
      ]);
      expect(sut.toCreate).toEqual([]);
    });

    it('accepts retired equipment whose row holds no +', () => {
      const world = arrange();
      world.compressor.retire(new Date('2026-11-01T08:00:00Z'));
      world.compressor.releaseEvents();

      const sut = check(
        sheet(
          [OIL_CHANGE],
          [30],
          [COMPRESSOR, ON_1405_08_30, null],
          [EXTRUDER, ON_1405_08_30, '+'],
        ),
        world,
      );

      expect(sut.errors).toEqual([]);
    });

    it('reports a duplicate equipment name on every cell holding it', () => {
      const sut = check(
        sheet(
          [OIL_CHANGE],
          [30],
          [COMPRESSOR, ON_1405_08_30, '+'],
          [`${COMPRESSOR} `, '1405/09/01', '+'],
        ),
      );

      expect(sut.errors).toEqual([
        errorAt('A3', COMPRESSOR, 'duplicate-equipment-in-file'),
        errorAt('A4', COMPRESSOR, 'duplicate-equipment-in-file'),
      ]);
      expect(sut.toCreate).toEqual([]);
    });

    it('reports a duplicate activity name on every cell holding it', () => {
      const sut = check(
        sheet(
          [OIL_CHANGE, OIL_CHANGE],
          [30, 15],
          [COMPRESSOR, ON_1405_08_30, '+', null],
        ),
      );

      expect(sut.errors).toEqual([
        errorAt('C1', OIL_CHANGE, 'duplicate-activity-in-file'),
        errorAt('D1', OIL_CHANGE, 'duplicate-activity-in-file'),
      ]);
    });

    it('reports a missing equipment name on a row holding a +', () => {
      const sut = check(sheet([OIL_CHANGE], [30], [null, ON_1405_08_30, '+']));

      expect(sut.errors).toEqual([
        errorAt('A3', '', 'equipment-name-required'),
      ]);
    });

    it('reports a missing activity name on a column holding a +', () => {
      const sut = check(
        sheet(
          [OIL_CHANGE, null],
          [30, 7],
          [COMPRESSOR, ON_1405_08_30, '+', '+'],
        ),
      );

      expect(sut.errors).toEqual([errorAt('D1', '', 'activity-name-required')]);
      expect(sut.toCreate.map((item) => item.cell)).toEqual(['C3']);
    });

    it('ignores rows and columns past the last content', () => {
      const sut = check([
        ['تجهیز', 'اولین موعد', OIL_CHANGE, null, null],
        [null, null, 30, null, null],
        [COMPRESSOR, ON_1405_08_30, '+', null, null],
        [null, null, null, null, null],
      ]);

      expect(sut.errors).toEqual([]);
      expect(sut.toCreate).toHaveLength(1);
    });
  });
});
