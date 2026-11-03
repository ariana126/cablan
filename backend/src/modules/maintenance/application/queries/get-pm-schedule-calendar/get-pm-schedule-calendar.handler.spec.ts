import { InvalidPmScheduleRange } from '@maintenance/application/exceptions';
import { PmOccurrenceFinder } from '@maintenance/application/service/pm-occurrence-finder';
import { PmPlanReader } from '@maintenance/application/service/pm-plan-reader';
import { tehranMorningOf } from '@maintenance/application/support/fixed-clock';
import { MaintenanceWorld } from '@maintenance/application/support/maintenance-world';
import { ActivitySpecialty } from '@maintenance/domain/value/activity-specialty.vo';
import { CalendarDate } from '@maintenance/domain/value/calendar-date.vo';
import { IntervalDays } from '@maintenance/domain/value/interval-days.vo';
import { PmOccurrenceStatus } from '@maintenance/domain/value/pm-occurrence-status';

import { GetPmScheduleCalendarHandler } from './get-pm-schedule-calendar.handler';
import { GetPmScheduleCalendarQuery } from './get-pm-schedule-calendar.query';

/** «اکسترودر»'s oil change every 7 days from `firstDueDate`, read on `today`. */
function arrange(today: string, firstDueDate: string) {
  const world = new MaintenanceWorld(today);
  const sut = new GetPmScheduleCalendarHandler(
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
  const extruder = world.equipment('اکسترودر');
  const item = world.planItem(
    extruder,
    world.activity('تعویض روغن'),
    7,
    firstDueDate,
  );
  return { world, sut, extruder, item };
}

describe('GetPmScheduleCalendarHandler', () => {
  it('places a late occurrence once, on the day it was done', async () => {
    const { world, sut, extruder, item } = arrange('2026-07-12', '2026-07-08');
    world.executed(extruder, item, '2026-07-08', tehranMorningOf('2026-07-10'));

    const rows = await sut.execute(
      new GetPmScheduleCalendarQuery('2026-07-01', '2026-07-31'),
    );

    expect(
      rows.map((row) => [
        row.calendarDate,
        row.dueDate,
        row.status,
        row.daysLate,
      ]),
    ).toEqual([
      ['2026-07-10', '2026-07-08', 'late', 2],
      ['2026-07-15', '2026-07-15', 'upcoming', null],
      ['2026-07-22', '2026-07-22', 'upcoming', null],
      ['2026-07-29', '2026-07-29', 'upcoming', null],
    ]);
  });

  it('ranges on the calendar day: a late occurrence due before the month and done in it is shown', async () => {
    const { world, sut, extruder, item } = arrange('2026-08-05', '2026-07-29');
    world.executed(extruder, item, '2026-07-29', tehranMorningOf('2026-08-02'));

    const rows = await sut.execute(
      new GetPmScheduleCalendarQuery('2026-08-01', '2026-08-04'),
    );

    expect(rows.map((row) => [row.calendarDate, row.dueDate])).toEqual([
      ['2026-08-02', '2026-07-29'],
    ]);
  });

  it('places a late job on the day it was done even after an interval change put due dates before it', async () => {
    // Due 07/01 every 30 days, done late on 07/11; the interval changed to 3
    // that day, from 07/01 — so 07/04, 07/07 and 07/10 now come between.
    const { world, sut, extruder } = arrange('2026-07-11', '2026-07-01');
    const item = world.planItem(
      extruder,
      world.activity('گریس کاری'),
      30,
      '2026-07-01',
    );
    world.executed(extruder, item, '2026-07-01', tehranMorningOf('2026-07-11'));
    extruder.changePlanItemInterval(
      item.id,
      IntervalDays.of(3),
      CalendarDate.fromString('2026-07-01'),
    );

    const rows = await sut.execute(
      new GetPmScheduleCalendarQuery('2026-07-11', '2026-07-14', {
        activityId: item.activityId().asString(),
      }),
    );

    expect(
      rows.map((row) => [row.dueDate, row.calendarDate, row.status]),
    ).toEqual([
      ['2026-07-01', '2026-07-11', 'late'],
      ['2026-07-13', '2026-07-13', 'upcoming'],
    ]);
  });

  it('keeps an occurrence not done on its due date', async () => {
    const { sut } = arrange('2026-07-20', '2026-07-08');

    const rows = await sut.execute(
      new GetPmScheduleCalendarQuery('2026-07-01', '2026-07-14'),
    );

    expect(rows.map((row) => [row.calendarDate, row.status])).toEqual([
      ['2026-07-08', 'missed'],
    ]);
  });

  it('shows months ahead', async () => {
    const { sut } = arrange('2026-07-10', '2026-07-01');

    const rows = await sut.execute(
      new GetPmScheduleCalendarQuery('2026-12-01', '2026-12-20'),
    );

    expect(rows.map((row) => [row.calendarDate, row.status])).toEqual([
      ['2026-12-02', 'upcoming'],
      ['2026-12-09', 'upcoming'],
      ['2026-12-16', 'upcoming'],
    ]);
  });

  it('applies the filters', async () => {
    const { world, sut, extruder, item } = arrange('2026-07-12', '2026-07-08');
    world.executed(extruder, item, '2026-07-08', tehranMorningOf('2026-07-10'));

    const rows = await sut.execute(
      new GetPmScheduleCalendarQuery('2026-07-01', '2026-07-31', {
        status: PmOccurrenceStatus.Late,
      }),
    );

    expect(rows.map((row) => row.calendarDate)).toEqual(['2026-07-10']);
  });

  it('applies the specialty filter', async () => {
    const { world, sut, extruder } = arrange('2026-07-12', '2026-07-08');
    world.planItem(
      extruder,
      world.activity('بازرسی تابلو', ActivitySpecialty.electrical()),
      30,
      '2026-07-09',
    );

    const rows = await sut.execute(
      new GetPmScheduleCalendarQuery('2026-07-01', '2026-07-31', {
        specialty: 'electrical',
      }),
    );

    expect(
      rows.map((row) => [
        row.activityName,
        row.calendarDate,
        row.activitySpecialty,
      ]),
    ).toEqual([['بازرسی تابلو', '2026-07-09', 'electrical']]);
  });

  it.each([
    ['no start', undefined, '2026-07-31'],
    ['no end', '2026-07-01', undefined],
    ['a start after its end', '2026-07-31', '2026-07-01'],
    ['more than 3660 days', '2026-01-01', '2036-01-09'],
  ])('refuses a range with %s', async (_label, from, to) => {
    const { sut } = arrange('2026-07-12', '2026-07-08');

    await expect(
      sut.execute(new GetPmScheduleCalendarQuery(from, to)),
    ).rejects.toThrow(InvalidPmScheduleRange);
  });
});
