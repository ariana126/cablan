import { EntityNotFound, Identity } from '@framework/domain';
import { PmPlanReader } from '@maintenance/application/service/pm-plan-reader';
import { tehranMorningOf } from '@maintenance/application/support/fixed-clock';
import { MaintenanceWorld } from '@maintenance/application/support/maintenance-world';
import { ActivitySpecialty } from '@maintenance/domain/value/activity-specialty.vo';
import { CalendarDate } from '@maintenance/domain/value/calendar-date.vo';
import { CalendarDateRange } from '@maintenance/domain/value/calendar-date-range.vo';
import { IntervalDays } from '@maintenance/domain/value/interval-days.vo';
import { MaintenanceActivityName } from '@maintenance/domain/value/maintenance-activity-name.vo';
import { OperatingHours } from '@maintenance/domain/value/operating-hours.vo';

import { GetEquipmentMaintenanceHistoryHandler } from './get-equipment-maintenance-history.handler';
import { GetEquipmentMaintenanceHistoryQuery } from './get-equipment-maintenance-history.query';
import { MaintenanceHistoryEntryReadModel } from './maintenance-history-entry.read-model';

function makeSut(today: string) {
  const world = new MaintenanceWorld(today);
  const sut = new GetEquipmentMaintenanceHistoryHandler(
    world.equipmentRepository,
    world.executionRepository,
    new PmPlanReader(
      world.activityRepository,
      world.executionRepository,
      world.clock,
    ),
  );
  return { world, sut };
}

/** «اکسترودر 1»'s oil change, every 7 days from 07/01. */
function withWeeklyOilChange(today: string) {
  const { world, sut } = makeSut(today);
  const extruder = world.equipment('اکسترودر 1');
  const oilChange = world.activity('تعویض روغن');
  const item = world.planItem(extruder, oilChange, 7, '2026-07-01');
  return { world, sut, extruder, oilChange, item };
}

function historyOf(
  sut: GetEquipmentMaintenanceHistoryHandler,
  equipmentId: Identity,
  range: [string, string] | null = null,
): Promise<MaintenanceHistoryEntryReadModel[]> {
  return sut.execute(
    new GetEquipmentMaintenanceHistoryQuery(
      equipmentId,
      range
        ? CalendarDateRange.between(
            CalendarDate.fromString(range[0]),
            CalendarDate.fromString(range[1]),
          )
        : null,
    ),
  );
}

/** The history within `range`: the 07/01 oil change done late on 07/06, nothing since, today 07/16. */
function lateFirstThenNothing(range: [string, string]) {
  const { world, sut, extruder, item } = withWeeklyOilChange('2026-07-16');
  world.executed(extruder, item, '2026-07-01', tehranMorningOf('2026-07-06'));
  return historyOf(sut, extruder.id, range);
}

/** Each entry as [due date, status]. */
function rows(entries: MaintenanceHistoryEntryReadModel[]) {
  return entries.map((entry) => [entry.dueDate, entry.status]);
}

describe('GetEquipmentMaintenanceHistoryHandler', () => {
  describe('the executions', () => {
    // Issue #110: each row names its execution and its plan row, so the
    // System Admin can delete it.
    it('lists the equipment’s executions newest first, each on time or late by its days, with its plan row', async () => {
      const { world, sut, extruder, item } = withWeeklyOilChange('2026-07-20');
      const first = world.executed(
        extruder,
        item,
        '2026-07-01',
        tehranMorningOf('2026-07-01'),
        'مسلمی',
        'فیلتر هم عوض شد',
      );
      const second = world.executed(
        extruder,
        item,
        '2026-07-08',
        tehranMorningOf('2026-07-10'),
        'رضازاده',
      );

      expect(await historyOf(sut, extruder.id)).toEqual([
        {
          kind: 'executed',
          id: second.id.asString(),
          planItemId: item.id.asString(),
          activityName: 'تعویض روغن',
          activitySpecialty: 'mechanical',
          dueDate: '2026-07-08',
          performedAt: tehranMorningOf('2026-07-10').toISOString(),
          performedBy: 'رضازاده',
          status: 'late',
          notes: null,
          daysLate: 2,
          operatingHours: null,
        },
        {
          kind: 'executed',
          id: first.id.asString(),
          planItemId: item.id.asString(),
          activityName: 'تعویض روغن',
          activitySpecialty: 'mechanical',
          dueDate: '2026-07-01',
          performedAt: tehranMorningOf('2026-07-01').toISOString(),
          performedBy: 'مسلمی',
          status: 'on_time',
          notes: 'فیلتر هم عوض شد',
          daysLate: null,
          operatingHours: null,
        },
      ]);
    });

    it('reports how many whole Tehran days late each execution was, null when on time', async () => {
      const { world, sut, extruder, item } = withWeeklyOilChange('2026-07-20');
      world.executed(
        extruder,
        item,
        '2026-07-01',
        tehranMorningOf('2026-06-29'),
      );
      world.executed(
        extruder,
        item,
        '2026-07-08',
        tehranMorningOf('2026-07-14'),
      );

      const entries = await historyOf(sut, extruder.id);

      expect(entries.map((entry) => [entry.dueDate, entry.daysLate])).toEqual([
        ['2026-07-08', 6],
        ['2026-07-01', null],
      ]);
    });

    it('keeps each execution’s status after the interval is changed', async () => {
      const { world, sut } = makeSut('2026-07-20');
      const extruder = world.equipment('اکسترودر 1');
      const item = world.planItem(
        extruder,
        world.activity('تعویض روغن'),
        30,
        '2026-07-01',
      );
      world.executed(
        extruder,
        item,
        '2026-07-01',
        tehranMorningOf('2026-07-03'),
      );
      extruder.changePlanItemInterval(
        item.id,
        IntervalDays.of(15),
        CalendarDate.fromString('2026-07-01'),
      );

      expect(rows(await historyOf(sut, extruder.id))).toEqual([
        ['2026-07-01', 'late'],
      ]);
    });

    it('keeps the executions of a deactivated item and of retired equipment', async () => {
      const { world, sut, extruder, item } = withWeeklyOilChange('2026-07-20');
      world.executed(
        extruder,
        item,
        '2026-07-01',
        tehranMorningOf('2026-07-01'),
      );
      extruder.deactivatePlanItem(item.id, world.clock.now());
      extruder.retire(world.clock.now());

      const entries = await historyOf(sut, extruder.id);

      expect(
        entries
          .filter((entry) => entry.kind === 'executed')
          .map((entry) => entry.dueDate),
      ).toEqual(['2026-07-01']);
    });

    it('lists only this equipment’s executions', async () => {
      const { world, sut } = makeSut('2026-07-20');
      const extruder = world.equipment('اکسترودر 1');
      const press = world.equipment('پرس');
      const pressItem = world.planItem(
        press,
        world.activity('تعویض روغن'),
        7,
        '2026-07-01',
      );
      world.executed(
        press,
        pressItem,
        '2026-07-01',
        tehranMorningOf('2026-07-01'),
      );

      expect(await historyOf(sut, extruder.id)).toEqual([]);
    });

    it('shows the equipment’s operating hours where they were recorded', async () => {
      const { world, sut, extruder, item } = withWeeklyOilChange('2026-07-20');
      const record = (dueDate: string, hours: OperatingHours | null) =>
        world.executed(
          extruder,
          item,
          dueDate,
          tehranMorningOf(dueDate),
          'مسلمی',
          null,
          Identity.new(),
          hours,
        );
      record('2026-07-01', OperatingHours.of(1250.5));
      record('2026-07-08', null);

      const entries = await historyOf(sut, extruder.id);

      expect(
        entries.map((entry) => [entry.dueDate, entry.operatingHours]),
      ).toEqual([
        ['2026-07-08', null],
        ['2026-07-01', 1250.5],
      ]);
    });

    it('shows the activity’s current specialty, even one assigned after the job was done', async () => {
      const { world, sut } = makeSut('2026-07-20');
      const extruder = world.equipment('اکسترودر 1');
      const oilChange = world.activityWithoutSpecialty('تعویض روغن');
      const item = world.planItem(extruder, oilChange, 7, '2026-07-01');
      world.executed(
        extruder,
        item,
        '2026-07-01',
        tehranMorningOf('2026-07-01'),
      );

      const [before] = await historyOf(sut, extruder.id);
      oilChange.completeMissingSpecialty(ActivitySpecialty.electrical());
      const [after] = await historyOf(sut, extruder.id);

      expect(before.activitySpecialty).toBeNull();
      expect(after.activitySpecialty).toBe('electrical');
    });
  });

  // Issue #114: an occurrence not done by the time the next one fell due.
  describe('the missed occurrences', () => {
    it('lists each one separately, without performer, time or execution, leaving out the one still overdue (today 07/16)', async () => {
      const { sut, extruder, item } = withWeeklyOilChange('2026-07-16');

      const missed = (dueDate: string) => ({
        kind: 'missed',
        id: null,
        planItemId: item.id.asString(),
        activityName: 'تعویض روغن',
        activitySpecialty: 'mechanical',
        dueDate,
        performedAt: null,
        performedBy: null,
        status: 'missed',
        notes: null,
        daysLate: null,
        operatingHours: null,
      });
      expect(await historyOf(sut, extruder.id)).toEqual([
        missed('2026-07-08'),
        missed('2026-07-01'),
      ]);
    });

    it.each(['2026-07-01', '2026-07-05', '2026-07-07'])(
      'lists none before the next due date comes (today %s)',
      async (today) => {
        const { sut, extruder } = withWeeklyOilChange(today);

        expect(await historyOf(sut, extruder.id)).toEqual([]);
      },
    );

    it('lists an occurrence from the day the next one falls due (today 07/08)', async () => {
      const { sut, extruder } = withWeeklyOilChange('2026-07-08');

      expect(rows(await historyOf(sut, extruder.id))).toEqual([
        ['2026-07-01', 'missed'],
      ]);
    });

    it('lists on-time, late and missed occurrences side by side', async () => {
      const { world, sut, extruder, item } = withWeeklyOilChange('2026-07-23');
      world.executed(
        extruder,
        item,
        '2026-07-01',
        tehranMorningOf('2026-07-01'),
      );
      world.executed(
        extruder,
        item,
        '2026-07-15',
        tehranMorningOf('2026-07-17'),
      );

      expect(rows(await historyOf(sut, extruder.id))).toEqual([
        ['2026-07-15', 'late'],
        ['2026-07-08', 'missed'],
        ['2026-07-01', 'on_time'],
      ]);
    });

    it('lists a deactivated activity’s due dates only up to its deactivation (deactivated 07/20, today 07/30)', async () => {
      const { world, sut, extruder, item } = withWeeklyOilChange('2026-07-20');
      extruder.deactivatePlanItem(item.id, world.clock.now());
      world.clock.set(tehranMorningOf('2026-07-30'));

      expect(rows(await historyOf(sut, extruder.id))).toEqual([
        ['2026-07-15', 'missed'],
        ['2026-07-08', 'missed'],
        ['2026-07-01', 'missed'],
      ]);
    });

    it('leaves out the due dates while the equipment was retired (done 07/01, retired 07/10, reactivated 07/20)', async () => {
      const { world, sut, extruder, item } = withWeeklyOilChange('2026-07-10');
      world.executed(
        extruder,
        item,
        '2026-07-01',
        tehranMorningOf('2026-07-01'),
      );
      extruder.retire(world.clock.now());
      world.clock.set(tehranMorningOf('2026-07-20'));
      extruder.reactivate(world.clock.now(), []);

      expect(rows(await historyOf(sut, extruder.id))).toEqual([
        ['2026-07-08', 'missed'],
        ['2026-07-01', 'on_time'],
      ]);
    });

    it('lists the occurrence of an execution the System Admin deleted as missed', async () => {
      const { world, sut, extruder, item } = withWeeklyOilChange('2026-07-10');
      const execution = world.executed(
        extruder,
        item,
        '2026-07-01',
        tehranMorningOf('2026-07-01'),
      );
      execution.delete();
      await world.executionRepository.delete(execution);

      expect(rows(await historyOf(sut, extruder.id))).toEqual([
        ['2026-07-01', 'missed'],
      ]);
    });

    it('names a missed occurrence by its activity’s current name and specialty', async () => {
      const { sut, extruder, oilChange } = withWeeklyOilChange('2026-07-08');
      oilChange.edit(
        MaintenanceActivityName.fromString('تعویض روغن موتور'),
        ActivitySpecialty.electrical(),
      );

      const [entry] = await historyOf(sut, extruder.id);

      expect([entry.activityName, entry.activitySpecialty]).toEqual([
        'تعویض روغن موتور',
        'electrical',
      ]);
    });
  });

  describe('the order', () => {
    it('is by activity name among entries of one day', async () => {
      const { world, sut } = makeSut('2026-07-08');
      const extruder = world.equipment('اکسترودر 1');
      world.planItem(extruder, world.activity('روغن کاری'), 7, '2026-07-01');
      world.planItem(extruder, world.activity('بازدید'), 7, '2026-07-01');
      world.planItem(extruder, world.activity('پاکسازی'), 7, '2026-07-01');

      const entries = await historyOf(sut, extruder.id);

      expect(entries.map((entry) => entry.activityName)).toEqual([
        'بازدید',
        'پاکسازی',
        'روغن کاری',
      ]);
    });

    it('puts a job done on a day before an occurrence that fell due that day and was missed', async () => {
      const { world, sut } = makeSut('2026-07-20');
      const extruder = world.equipment('اکسترودر 1');
      const greasing = world.planItem(
        extruder,
        world.activity('روغن کاری'),
        7,
        '2026-07-08',
      );
      world.planItem(extruder, world.activity('بازدید'), 7, '2026-07-01');
      world.executed(
        extruder,
        greasing,
        '2026-07-08',
        tehranMorningOf('2026-07-08'),
      );

      const entries = await historyOf(sut, extruder.id);

      expect(
        entries.map((entry) => [entry.dueDate, entry.kind, entry.activityName]),
      ).toEqual([
        ['2026-07-08', 'executed', 'روغن کاری'],
        ['2026-07-08', 'missed', 'بازدید'],
        ['2026-07-01', 'missed', 'بازدید'],
      ]);
    });

    it('is by the time performed among jobs done on one day', async () => {
      const { world, sut } = makeSut('2026-07-20');
      const extruder = world.equipment('اکسترودر 1');
      const inspection = world.planItem(
        extruder,
        world.activity('بازدید'),
        7,
        '2026-07-15',
      );
      const greasing = world.planItem(
        extruder,
        world.activity('روغن کاری'),
        7,
        '2026-07-15',
      );
      world.executed(
        extruder,
        inspection,
        '2026-07-15',
        new Date('2026-07-15T05:30:00.000Z'),
      );
      world.executed(
        extruder,
        greasing,
        '2026-07-15',
        new Date('2026-07-15T08:30:00.000Z'),
      );

      const entries = await historyOf(sut, extruder.id);

      expect(entries.map((entry) => entry.activityName)).toEqual([
        'روغن کاری',
        'بازدید',
      ]);
    });
  });

  describe('a date range', () => {
    it('holds a job by the day it was done and a missed occurrence by its due date (07/05–07/10)', async () => {
      const entries = await lateFirstThenNothing(['2026-07-05', '2026-07-10']);

      expect(
        entries.map((entry) => [
          entry.dueDate,
          entry.status,
          entry.performedAt,
        ]),
      ).toEqual([
        ['2026-07-08', 'missed', null],
        ['2026-07-01', 'late', tehranMorningOf('2026-07-06').toISOString()],
      ]);
    });

    it('leaves out a job due inside it but done after it (07/01–07/04)', async () => {
      expect(await lateFirstThenNothing(['2026-07-01', '2026-07-04'])).toEqual(
        [],
      );
    });

    it('includes both of its bounds', async () => {
      const entries = await lateFirstThenNothing(['2026-07-06', '2026-07-08']);

      expect(rows(entries)).toEqual([
        ['2026-07-08', 'missed'],
        ['2026-07-01', 'late'],
      ]);
    });
  });

  it('refuses unknown equipment', async () => {
    const { sut } = makeSut('2026-07-20');

    await expect(historyOf(sut, Identity.new())).rejects.toBeInstanceOf(
      EntityNotFound,
    );
  });
});
