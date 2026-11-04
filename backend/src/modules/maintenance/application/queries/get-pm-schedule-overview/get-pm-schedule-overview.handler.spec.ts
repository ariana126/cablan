import { Identity } from '@framework/domain';
import { InvalidPmScheduleRange } from '@maintenance/application/exceptions';
import { PmOccurrenceReadModel } from '@maintenance/application/service/pm-occurrence.read-model';
import {
  PmOccurrenceFinder,
  PmScheduleFilters,
} from '@maintenance/application/service/pm-occurrence-finder';
import { PmPlanReader } from '@maintenance/application/service/pm-plan-reader';
import { tehranMorningOf } from '@maintenance/application/support/fixed-clock';
import { MaintenanceWorld } from '@maintenance/application/support/maintenance-world';
import { ActivitySpecialty } from '@maintenance/domain/value/activity-specialty.vo';
import { PmOccurrenceStatus } from '@maintenance/domain/value/pm-occurrence-status';

import { GetPmScheduleOverviewHandler } from './get-pm-schedule-overview.handler';
import { GetPmScheduleOverviewQuery } from './get-pm-schedule-overview.query';

function makeSut(today: string) {
  const world = new MaintenanceWorld(today);
  const sut = new GetPmScheduleOverviewHandler(
    new PmOccurrenceFinder(
      world.equipmentRepository,
      world.executionRepository,
      new PmPlanReader(
        world.activityRepository,
        world.executionRepository,
        world.clock,
      ),
    ),
  );
  return { world, sut };
}

/** Every 7 days from 07/01 on «اکسترودر»'s oil change. */
function withWeeklyOilChange(today: string) {
  const { world, sut } = makeSut(today);
  const extruder = world.equipment('اکسترودر');
  const oilChange = world.activity('تعویض روغن');
  const item = world.planItem(extruder, oilChange, 7, '2026-07-01');
  return { world, sut, extruder, oilChange, item };
}

const dueRows = (rows: PmOccurrenceReadModel[]) =>
  rows.map((row) => [row.dueDate, row.status]);

/**
 * For the filters. Today 07/23. «اکسترودر»: oil change (mechanical) from 07/01
 * (done 07/01 by مسلمی, 07/08 late on 07/10 by رضازاده) and greasing
 * (electrical) from 07/02. «پرس»: oil change from 07/01.
 */
function arrangeFilterable() {
  const { world, sut, extruder, oilChange, item } =
    withWeeklyOilChange('2026-07-23');
  const greasing = world.activity('گریس کاری', ActivitySpecialty.electrical());
  world.planItem(extruder, greasing, 7, '2026-07-02');
  const press = world.equipment('پرس');
  world.planItem(press, oilChange, 7, '2026-07-01');
  const moslemi = Identity.new();
  const rezazadeh = Identity.new();
  world.executed(
    extruder,
    item,
    '2026-07-01',
    tehranMorningOf('2026-07-01'),
    'مسلمی',
    null,
    moslemi,
  );
  world.executed(
    extruder,
    item,
    '2026-07-08',
    tehranMorningOf('2026-07-10'),
    'رضازاده',
    null,
    rezazadeh,
  );
  return {
    world,
    sut,
    extruder,
    press,
    oilChange,
    greasing,
    moslemi,
    rezazadeh,
  };
}

const july = (filters: PmScheduleFilters) =>
  new GetPmScheduleOverviewQuery('2026-07-01', '2026-07-15', filters);

/** The «بازدید» rows, by due date and specialty. */
const inspected = (rows: PmOccurrenceReadModel[]) =>
  rows
    .filter((row) => row.activityName === 'بازدید')
    .map((row) => [row.dueDate, row.activitySpecialty]);

const described = (rows: PmOccurrenceReadModel[]) =>
  rows.map((row) => [
    row.equipmentName,
    row.activityName,
    row.dueDate,
    row.status,
  ]);

describe('GetPmScheduleOverviewHandler', () => {
  it('lists every occurrence due in the range, the future ones included, with its status today', async () => {
    const { sut } = withWeeklyOilChange('2026-07-10');

    const rows = await sut.execute(
      new GetPmScheduleOverviewQuery('2026-07-01', '2026-07-30'),
    );

    expect(dueRows(rows)).toEqual([
      ['2026-07-01', 'missed'],
      ['2026-07-08', 'overdue'],
      ['2026-07-15', 'upcoming'],
      ['2026-07-22', 'upcoming'],
      ['2026-07-29', 'upcoming'],
    ]);
  });

  it('includes a due date on either bound of the range', async () => {
    const { sut } = withWeeklyOilChange('2026-07-10');

    const rows = await sut.execute(
      new GetPmScheduleOverviewQuery('2026-07-08', '2026-07-22'),
    );

    expect(rows.map((row) => row.dueDate)).toEqual([
      '2026-07-08',
      '2026-07-15',
      '2026-07-22',
    ]);
  });

  it('describes each occurrence: the equipment, the activity, when and by whom it was done, and how late', async () => {
    const { world, sut, extruder, oilChange, item } =
      withWeeklyOilChange('2026-07-12');
    const performer = Identity.new();
    const performedAt = tehranMorningOf('2026-07-10');
    world.executed(
      extruder,
      item,
      '2026-07-08',
      performedAt,
      'مسلمی',
      'فیلتر هم عوض شد',
      performer,
    );

    const rows = await sut.execute(
      new GetPmScheduleOverviewQuery('2026-07-08', '2026-07-15'),
    );

    const common = {
      equipmentId: extruder.id.asString(),
      equipmentName: 'اکسترودر',
      equipmentRetired: false,
      planItemId: item.id.asString(),
      activityId: oilChange.id.asString(),
      activityName: 'تعویض روغن',
      activitySpecialty: 'mechanical' as const,
    };
    expect(rows).toEqual([
      new PmOccurrenceReadModel({
        ...common,
        dueDate: '2026-07-08',
        calendarDate: '2026-07-10',
        status: 'late',
        performedAt: performedAt.toISOString(),
        performedById: performer.asString(),
        performedBy: 'مسلمی',
        daysLate: 2,
        notes: 'فیلتر هم عوض شد',
      }),
      new PmOccurrenceReadModel({
        ...common,
        dueDate: '2026-07-15',
        calendarDate: '2026-07-15',
        status: 'upcoming',
        performedAt: null,
        performedById: null,
        performedBy: null,
        daysLate: null,
        notes: null,
      }),
    ]);
  });

  it.each([
    [
      '2026-07-01',
      '2026-07-08',
      [
        ['2026-07-01', 'missed'],
        ['2026-07-08', 'late'],
      ],
    ],
    ['2026-07-09', '2026-07-14', []],
  ])(
    'ranges on the due date, not the day done (an occurrence due 07/08 done 07/10, %s – %s)',
    async (from, to, expected) => {
      const { world, sut, extruder, item } = withWeeklyOilChange('2026-07-12');
      world.executed(
        extruder,
        item,
        '2026-07-08',
        tehranMorningOf('2026-07-10'),
      );

      const rows = await sut.execute(new GetPmScheduleOverviewQuery(from, to));

      expect(dueRows(rows)).toEqual(expected);
    },
  );

  it.each([
    [
      '2026-07-10',
      [
        ['2026-07-01', 'on_time'],
        ['2026-07-08', 'missed'],
      ],
    ],
    [
      '2026-07-08',
      [
        ['2026-07-01', 'on_time'],
        ['2026-07-08', 'missed'],
      ],
    ],
    ['2026-07-07', [['2026-07-01', 'on_time']]],
  ])(
    'keeps a deactivated item up to the day it was deactivated (%s)',
    async (deactivatedOn, expected) => {
      const { world, sut, extruder, item } = withWeeklyOilChange('2026-07-20');
      world.executed(
        extruder,
        item,
        '2026-07-01',
        tehranMorningOf('2026-07-01'),
      );
      extruder.deactivatePlanItem(item.id, tehranMorningOf(deactivatedOn));

      const rows = await sut.execute(
        new GetPmScheduleOverviewQuery('2026-07-01', '2026-07-30'),
      );

      expect(dueRows(rows)).toEqual(expected);
    },
  );

  it('keeps retired equipment up to the day it was retired, every item flagged', async () => {
    const { world, sut, extruder, item } = withWeeklyOilChange('2026-07-20');
    world.planItem(
      extruder,
      world.activity('بررسی تابلو برق'),
      7,
      '2026-07-03',
    );
    world.executed(extruder, item, '2026-07-01', tehranMorningOf('2026-07-01'));
    extruder.retire(tehranMorningOf('2026-07-10'));

    const rows = await sut.execute(
      new GetPmScheduleOverviewQuery('2026-07-01', '2026-07-30'),
    );

    expect(
      rows.map((row) => [
        row.activityName,
        row.dueDate,
        row.status,
        row.equipmentRetired,
      ]),
    ).toEqual([
      ['تعویض روغن', '2026-07-01', 'on_time', true],
      ['تعویض روغن', '2026-07-08', 'missed', true],
      ['بررسی تابلو برق', '2026-07-03', 'missed', true],
      ['بررسی تابلو برق', '2026-07-10', 'missed', true],
    ]);
  });

  it('leaves out the due dates while its equipment was retired, once reactivated (07/15 out, 07/08 missed)', async () => {
    const { sut, extruder, item, world } = withWeeklyOilChange('2026-07-20');
    world.executed(extruder, item, '2026-07-01', tehranMorningOf('2026-07-01'));
    extruder.retire(tehranMorningOf('2026-07-10'));
    extruder.reactivate(tehranMorningOf('2026-07-20'), []);

    const rows = await sut.execute(
      new GetPmScheduleOverviewQuery('2026-07-01', '2026-07-30'),
    );

    expect(
      rows.map((row) => [row.dueDate, row.status, row.equipmentRetired]),
    ).toEqual([
      ['2026-07-01', 'on_time', false],
      ['2026-07-08', 'missed', false],
      ['2026-07-22', 'upcoming', false],
      ['2026-07-29', 'upcoming', false],
    ]);
  });

  it('orders by equipment name, plan order (deactivated items in their place), then due date', async () => {
    const { world, sut } = makeSut('2026-07-02');
    const press = world.equipment('پرس');
    const extruder = world.equipment('اکسترودر');
    const oilChange = world.activity('تعویض روغن');
    const greasing = world.activity('گریس کاری');
    world.planItem(press, oilChange, 7, '2026-07-01');
    const deactivated = world.planItem(extruder, greasing, 7, '2026-07-02');
    world.planItem(extruder, oilChange, 7, '2026-07-01');
    extruder.deactivatePlanItem(deactivated.id, world.clock.now());

    const rows = await sut.execute(
      new GetPmScheduleOverviewQuery('2026-07-01', '2026-07-09'),
    );

    expect(
      rows.map((row) => [row.equipmentName, row.activityName, row.dueDate]),
    ).toEqual([
      ['اکسترودر', 'گریس کاری', '2026-07-02'],
      ['اکسترودر', 'تعویض روغن', '2026-07-01'],
      ['اکسترودر', 'تعویض روغن', '2026-07-08'],
      ['پرس', 'تعویض روغن', '2026-07-01'],
      ['پرس', 'تعویض روغن', '2026-07-08'],
    ]);
  });

  describe('filtered', () => {
    it('by equipment', async () => {
      const { sut, press } = arrangeFilterable();

      const rows = await sut.execute(
        july({ equipmentId: press.id.asString() }),
      );

      expect(described(rows)).toEqual([
        ['پرس', 'تعویض روغن', '2026-07-01', 'missed'],
        ['پرس', 'تعویض روغن', '2026-07-08', 'missed'],
        ['پرس', 'تعویض روغن', '2026-07-15', 'missed'],
      ]);
    });

    it('by activity', async () => {
      const { sut, greasing } = arrangeFilterable();

      const rows = await sut.execute(
        july({ activityId: greasing.id.asString() }),
      );

      expect(described(rows)).toEqual([
        ['اکسترودر', 'گریس کاری', '2026-07-02', 'missed'],
        ['اکسترودر', 'گریس کاری', '2026-07-09', 'missed'],
      ]);
    });

    it('by status', async () => {
      const { sut } = arrangeFilterable();

      const rows = await sut.execute(july({ status: PmOccurrenceStatus.Late }));

      expect(described(rows)).toEqual([
        ['اکسترودر', 'تعویض روغن', '2026-07-08', 'late'],
      ]);
    });

    it('by performer, leaving out what nobody has done', async () => {
      const { sut, moslemi, rezazadeh } = arrangeFilterable();

      expect(
        described(
          await sut.execute(july({ performedById: moslemi.asString() })),
        ),
      ).toEqual([['اکسترودر', 'تعویض روغن', '2026-07-01', 'on_time']]);
      expect(
        described(
          await sut.execute(july({ performedById: rezazadeh.asString() })),
        ),
      ).toEqual([['اکسترودر', 'تعویض روغن', '2026-07-08', 'late']]);
    });

    it('by specialty', async () => {
      const { sut } = arrangeFilterable();

      const rows = await sut.execute(july({ specialty: 'electrical' }));

      expect(described(rows)).toEqual([
        ['اکسترودر', 'گریس کاری', '2026-07-02', 'missed'],
        ['اکسترودر', 'گریس کاری', '2026-07-09', 'missed'],
      ]);
      expect(rows.map((row) => row.activitySpecialty)).toEqual([
        'electrical',
        'electrical',
      ]);
    });

    it('by specialty and performer at once', async () => {
      const { sut, moslemi, rezazadeh } = arrangeFilterable();

      expect(
        described(
          await sut.execute(
            july({
              specialty: 'mechanical',
              performedById: rezazadeh.asString(),
            }),
          ),
        ),
      ).toEqual([['اکسترودر', 'تعویض روغن', '2026-07-08', 'late']]);
      expect(
        await sut.execute(
          july({ specialty: 'electrical', performedById: moslemi.asString() }),
        ),
      ).toEqual([]);
    });

    it('leaves an activity without a specialty out of either specialty, keeping it unfiltered', async () => {
      const { world, sut, press } = arrangeFilterable();
      world.planItem(
        press,
        world.activityWithoutSpecialty('بازدید'),
        30,
        '2026-07-03',
      );

      expect(inspected(await sut.execute(july({})))).toEqual([
        ['2026-07-03', null],
      ]);
      expect(
        inspected(await sut.execute(july({ specialty: 'mechanical' }))),
      ).toEqual([]);
      expect(
        inspected(await sut.execute(july({ specialty: 'electrical' }))),
      ).toEqual([]);
    });

    it('by several filters at once', async () => {
      const { sut, extruder, oilChange } = arrangeFilterable();

      const rows = await sut.execute(
        july({
          equipmentId: extruder.id.asString(),
          activityId: oilChange.id.asString(),
          status: PmOccurrenceStatus.Missed,
        }),
      );

      expect(described(rows)).toEqual([
        ['اکسترودر', 'تعویض روغن', '2026-07-15', 'missed'],
      ]);
    });

    it('to nothing for equipment that does not exist', async () => {
      const { sut } = arrangeFilterable();

      expect(
        await sut.execute(july({ equipmentId: Identity.new().asString() })),
      ).toEqual([]);
    });
  });

  it.each([
    ['no start', undefined, '2026-07-30'],
    ['no end', '2026-07-01', undefined],
    ['a start after its end', '2026-07-10', '2026-07-01'],
  ])('refuses a range with %s', async (_label, from, to) => {
    const { sut } = withWeeklyOilChange('2026-07-10');

    await expect(
      sut.execute(new GetPmScheduleOverviewQuery(from, to)),
    ).rejects.toThrow(InvalidPmScheduleRange);
  });

  it('takes a range of up to 3660 days, both ends counted', async () => {
    const { sut } = withWeeklyOilChange('2026-07-10');

    const rows = await sut.execute(
      new GetPmScheduleOverviewQuery('2026-01-01', '2036-01-08'),
    );

    expect(rows.length).toBeGreaterThan(0);
  });

  it('refuses a range of more than 3660 days, as too long', async () => {
    const { sut } = withWeeklyOilChange('2026-07-10');

    await expect(
      sut.execute(new GetPmScheduleOverviewQuery('2026-01-01', '2036-01-09')),
    ).rejects.toMatchObject({ reason: 'too-long' });
  });
});
