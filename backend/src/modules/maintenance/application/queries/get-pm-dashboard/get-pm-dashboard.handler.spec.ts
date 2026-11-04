import { EntityNotFound, Identity } from '@framework/domain';
import { PmPlanReader } from '@maintenance/application/service/pm-plan-reader';
import { tehranMorningOf } from '@maintenance/application/support/fixed-clock';
import { MaintenanceWorld } from '@maintenance/application/support/maintenance-world';
import { Equipment } from '@maintenance/domain/equipment.aggregate';
import { MaintenanceActivity } from '@maintenance/domain/maintenance-activity.aggregate';

import { GetPmDashboardHandler } from './get-pm-dashboard.handler';
import { GetPmDashboardQuery } from './get-pm-dashboard.query';
import { PmDashboardReadModel } from './pm-dashboard.read-model';

// The issue's dates are Jalali; these are their Gregorian days (1405/07/01 is
// 2026-09-23). `J(dd)` is 1405/07/dd, `J(dd, 8)` 1405/08/dd.
function J(day: number, month = 7): string {
  const first = month === 7 ? '2026-09-23' : '2026-10-23';
  const date = new Date(`${first}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + day - 1);
  return date.toISOString().slice(0, 10);
}

function makeSut(today: string) {
  const world = new MaintenanceWorld(today);
  const sut = new GetPmDashboardHandler(
    world.equipmentRepository,
    world.executionRepository,
    new PmPlanReader(
      world.activityRepository,
      world.executionRepository,
      world.clock,
    ),
    world.clock,
  );
  return { world, sut };
}

/** Every 7 days from 07/01 on «اکسترودر»'s oil change. */
function withWeeklyOilChange(today: string) {
  const { world, sut } = makeSut(today);
  const extruder = world.equipment('اکسترودر');
  const oilChange = world.activity('تعویض روغن');
  const item = world.planItem(extruder, oilChange, 7, J(1));
  const done = (dueDate: string, performedOn: string) =>
    world.executed(extruder, item, dueDate, tehranMorningOf(performedOn));
  return { world, sut, extruder, oilChange, item, done };
}

/**
 * Today 07/20: «اکسترودر» oil change every 7 days from 07/20 (due today)
 * and greasing every 10 days from 07/17 (overdue 3 days); «پرس» oil change
 * every 30 days from 07/30, done early today.
 */
function arrangeToday() {
  const { world, sut } = makeSut(J(20));
  const extruder = world.equipment('اکسترودر');
  const press = world.equipment('پرس');
  const oilChange = world.activity('تعویض روغن');
  const greasing = world.activity('گریس کاری');
  world.planItem(extruder, oilChange, 7, J(20));
  world.planItem(extruder, greasing, 10, J(17));
  const pressOil = world.planItem(press, oilChange, 30, J(30));
  world.executed(press, pressOil, J(30), tehranMorningOf(J(20)));
  return { sut };
}

/** A plan item every 10 days, overdue by `days` on 07/20. */
function overdueBy(
  world: MaintenanceWorld,
  equipment: Equipment,
  activity: MaintenanceActivity,
  days: number,
) {
  world.planItem(equipment, activity, 10, J(20 - days));
}

const dashboard = (
  sut: GetPmDashboardHandler,
  periodDays = 30,
  equipmentId?: string,
): Promise<PmDashboardReadModel> =>
  sut.execute(new GetPmDashboardQuery(periodDays, equipmentId));

describe('GetPmDashboardHandler', () => {
  it('states its day, when it was made and the period it covers', async () => {
    const { sut, world } = makeSut(J(20));

    const result = await dashboard(sut, 7);

    expect({
      today: result.today,
      generatedAt: result.generatedAt,
      periodDays: result.periodDays,
      periodFrom: result.periodFrom,
      periodTo: result.periodTo,
    }).toEqual({
      today: J(20),
      generatedAt: world.clock.now().toISOString(),
      periodDays: 7,
      periodFrom: J(14),
      periodTo: J(20),
    });
  });

  describe('the current state', () => {
    it.each([7, 30, 90])(
      'counts today’s due, overdue and done work whatever the period (%p days)',
      async (periodDays) => {
        const { sut } = arrangeToday();

        const { current } = await dashboard(sut, periodDays);

        expect(current).toEqual({ dueToday: 1, overdue: 1, doneToday: 1 });
      },
    );

    it('counts an occurrence that turned missed as missed, no longer overdue', async () => {
      const { sut } = withWeeklyOilChange(J(8));

      const result = await dashboard(sut, 7);

      expect([result.current.overdue, result.missedCount]).toEqual([0, 1]);
    });

    it('leaves deactivated items and retired equipment out of today’s work', async () => {
      const { world, sut } = makeSut(J(20));
      const extruder = world.equipment('اکسترودر');
      const press = world.equipment('پرس');
      const oilChange = world.activity('تعویض روغن');
      const item = world.planItem(extruder, oilChange, 10, J(17));
      world.planItem(press, oilChange, 7, J(20));
      extruder.deactivatePlanItem(item.id, tehranMorningOf(J(20)));
      press.retire(tehranMorningOf(J(20)));

      const { current } = await dashboard(sut);

      expect(current).toEqual({ dueToday: 0, overdue: 0, doneToday: 0 });
    });
  });

  describe('missed occurrences, counted by the day they turned missed', () => {
    it.each([
      [J(8), 7, 1],
      [J(10), 7, 1],
      [J(20), 7, 0],
      [J(20), 30, 1],
    ])(
      'only 07/01 undone of a weekly plan from 07/01, missed on 07/08: today %s, %p days → %p',
      async (today, periodDays, missed) => {
        const { sut, done } = withWeeklyOilChange(today);
        if (today >= J(10)) done(J(8), J(8));
        if (today >= J(20)) done(J(15), J(15));

        const result = await dashboard(sut, periodDays);

        expect(result.missedCount).toBe(missed);
      },
    );
  });

  describe('performance', () => {
    it('judges the period’s past occurrences — a weekly oil change on 07/30', async () => {
      const { sut, done } = withWeeklyOilChange(J(30));
      done(J(1), J(1));
      done(J(8), J(10));
      done(J(15), J(19));
      done(J(22), J(22));

      const { performance } = await dashboard(sut);

      expect(performance).toEqual({
        considered: 5,
        onTime: 2,
        late: 2,
        notDone: 1,
        adherencePercent: 40,
        completionPercent: 80,
        averageDaysLate: 3,
      });
    });

    it('trends daily and weekly over the past days, oldest first', async () => {
      const { sut, done } = withWeeklyOilChange(J(16));
      done(J(8), J(10));

      const { trend } = await dashboard(sut, 7);

      expect(trend.daily.map((point) => point.from)).toEqual([
        J(10),
        J(11),
        J(12),
        J(13),
        J(14),
        J(15),
      ]);
      expect(trend.daily.at(-1)).toEqual({
        from: J(15),
        to: J(15),
        considered: 1,
        onTime: 0,
        late: 0,
        adherencePercent: 0,
        completionPercent: 0,
      });
      expect(trend.weekly).toEqual([
        {
          from: J(10),
          to: J(15),
          considered: 1,
          onTime: 0,
          late: 0,
          adherencePercent: 0,
          completionPercent: 0,
        },
      ]);
    });

    it.each([
      [
        'an item deactivated on 07/03',
        (equipment: Equipment, itemId: Identity) =>
          equipment.deactivatePlanItem(itemId, tehranMorningOf(J(3))),
      ],
      [
        'equipment retired on 07/03',
        (equipment: Equipment) => equipment.retire(tehranMorningOf(J(3))),
      ],
    ])(
      'keeps the history of %s: its on-time 07/01 still counts on 07/20',
      async (_label, stop) => {
        const { sut, extruder, item, done } = withWeeklyOilChange(J(20));
        done(J(1), J(1));
        stop(extruder, item.id);

        const { performance } = await dashboard(sut);

        expect([
          performance.adherencePercent,
          performance.completionPercent,
          performance.onTime,
        ]).toEqual([100, 100, 1]);
      },
    );
  });

  // Issue #110, the approved example: retired 07/10–07/20 and 08/05–08/18,
  // done 07/01, 07/22, 07/29, 08/20; 07/15, 08/06 and 08/13 are not
  // counted, 07/08 is missed.
  it('leaves every retirement’s due dates out of adherence and completion (80%)', async () => {
    const { sut, extruder, done } = withWeeklyOilChange(J(25, 8));
    extruder.retire(tehranMorningOf(J(10)));
    extruder.reactivate(tehranMorningOf(J(20)), []);
    extruder.retire(tehranMorningOf(J(5, 8)));
    extruder.reactivate(tehranMorningOf(J(18, 8)), []);
    for (const day of [J(1), J(22), J(29), J(20, 8)]) {
      done(day, day);
    }

    const { performance } = await dashboard(sut, 90);

    expect([
      performance.considered,
      performance.adherencePercent,
      performance.completionPercent,
    ]).toEqual([5, 80, 80]);
  });

  it('cannot record, after reactivation, an occurrence from before the retirement', async () => {
    const { sut, extruder } = withWeeklyOilChange(J(12));
    extruder.retire(tehranMorningOf(J(10)));
    extruder.reactivate(tehranMorningOf(J(12)), []);

    const { occurrences } = await dashboard(sut, 7);

    expect(
      occurrences.map((row) => [row.dueDate, row.status, row.recordable]),
    ).toEqual([
      [J(1), 'missed', false],
      [J(8), 'overdue', false],
      [J(15), 'upcoming', false],
    ]);
  });

  describe('for one piece of equipment', () => {
    it('judges only its work, while coverage stays plant-wide', async () => {
      const { world, sut, oilChange } = withWeeklyOilChange(J(10));
      const press = world.equipment('پرس');
      const pressOil = world.planItem(press, oilChange, 7, J(1));
      world.executed(press, pressOil, J(1), tehranMorningOf(J(1)));
      world.executed(press, pressOil, J(8), tehranMorningOf(J(8)));

      const result = await dashboard(sut, 30, press.id.asString());

      expect({
        adherence: result.performance.adherencePercent,
        overdue: result.current.overdue,
        missed: result.missedCount,
        activeEquipment: result.coverage.activeEquipment,
        equipmentShown: [
          ...new Set(result.occurrences.map((row) => row.equipmentName)),
        ],
      }).toEqual({
        adherence: 100,
        overdue: 0,
        missed: 0,
        activeEquipment: 2,
        equipmentShown: ['پرس'],
      });
    });

    it('refuses equipment that does not exist', async () => {
      const { sut } = withWeeklyOilChange(J(10));

      await expect(
        dashboard(sut, 30, Identity.new().asString()),
      ).rejects.toThrow(EntityNotFound);
    });
  });

  describe('coverage', () => {
    it('counts in-service equipment with at least one active item, even one first due ahead', async () => {
      const { world, sut } = makeSut(J(20));
      const oilChange = world.activity('تعویض روغن');
      world.planItem(world.equipment('اکسترودر'), oilChange, 7, J(1));
      world.planItem(world.equipment('پرس'), oilChange, 7, J(10, 8));
      const mixer = world.equipment('میکسر');
      const mixerOil = world.planItem(mixer, oilChange, 7, J(1));
      mixer.deactivatePlanItem(mixerOil.id, tehranMorningOf(J(5)));
      const cutter = world.equipment('برش');
      const retired = world.equipment('کوره');
      world.planItem(retired, oilChange, 7, J(1));
      retired.retire(tehranMorningOf(J(5)));

      const { coverage } = await dashboard(sut);

      expect({
        ...coverage,
        equipmentWithoutPlan: coverage.equipmentWithoutPlan.map(
          (equipment) => equipment.name,
        ),
      }).toEqual({
        activeEquipment: 4,
        withPlan: 2,
        withoutPlan: 2,
        coveragePercent: 50,
        equipmentWithoutPlan: ['برش', 'میکسر'],
      });
      expect(coverage.equipmentWithoutPlan[0].id).toBe(cutter.id.asString());
    });

    it('has no percentage without in-service equipment', async () => {
      const { sut } = makeSut(J(20));

      const { coverage } = await dashboard(sut);

      expect(coverage).toEqual({
        activeEquipment: 0,
        withPlan: 0,
        withoutPlan: 0,
        coveragePercent: null,
        equipmentWithoutPlan: [],
      });
    });
  });

  describe('the equipment with the most overdue work', () => {
    it('ranks by overdue count, then total days overdue, then name', async () => {
      const { world, sut } = makeSut(J(20));
      const oilChange = world.activity('تعویض روغن');
      const greasing = world.activity('گریس کاری');
      const a = world.equipment('الف');
      const b = world.equipment('ب');
      const c = world.equipment('پ');
      const d = world.equipment('ت');
      world.equipment('ث');
      overdueBy(world, a, oilChange, 5);
      overdueBy(world, a, greasing, 1);
      overdueBy(world, b, oilChange, 4);
      overdueBy(world, b, greasing, 4);
      overdueBy(world, d, oilChange, 2);
      overdueBy(world, c, oilChange, 2);

      const { mostOverdueEquipment } = await dashboard(sut);

      expect(
        mostOverdueEquipment.map((row) => [
          row.equipmentName,
          row.overdueCount,
          row.totalDaysOverdue,
        ]),
      ).toEqual([
        ['ب', 2, 8],
        ['الف', 2, 6],
        ['پ', 1, 2],
        ['ت', 1, 2],
      ]);
      expect(mostOverdueEquipment[0].equipmentId).toBe(b.id.asString());
    });

    it('leaves missed occurrences out (weekly from 07/01, on 07/10: one overdue by 2 days)', async () => {
      const { sut } = withWeeklyOilChange(J(10));

      const { mostOverdueEquipment } = await dashboard(sut);

      expect(
        mostOverdueEquipment.map((row) => [
          row.equipmentName,
          row.overdueCount,
          row.totalDaysOverdue,
        ]),
      ).toEqual([['اکسترودر', 1, 2]]);
    });
  });

  describe('the next seven days', () => {
    it('lists what is upcoming from tomorrow through a week ahead, by due date then equipment name', async () => {
      const { world, sut } = makeSut(J(20));
      const oilChange = world.activity('تعویض روغن');
      const greasing = world.activity('گریس کاری');
      const press = world.equipment('پرس');
      const extruder = world.equipment('اکسترودر');
      world.planItem(press, oilChange, 30, J(21));
      world.planItem(press, greasing, 30, J(27));
      world.planItem(extruder, oilChange, 30, J(27));
      world.planItem(extruder, greasing, 30, J(28));
      const mixer = world.equipment('میکسر');
      const doneEarly = world.planItem(mixer, oilChange, 30, J(22));
      world.executed(mixer, doneEarly, J(22), tehranMorningOf(J(20)));

      const { upcoming } = await dashboard(sut);

      expect(
        upcoming.map((row) => [
          row.dueDate,
          row.equipmentName,
          row.activityName,
        ]),
      ).toEqual([
        [J(21), 'پرس', 'تعویض روغن'],
        [J(27), 'اکسترودر', 'تعویض روغن'],
        [J(27), 'پرس', 'گریس کاری'],
      ]);
    });
  });

  describe('the follow-up occurrences', () => {
    it('holds the period through a week ahead, the overdue one just before it and what was done today', async () => {
      const { world, sut } = makeSut(J(20));
      const oilChange = world.activity('تعویض روغن');
      const extruder = world.equipment('اکسترودر');
      // Every 30 days from 07/05: overdue 15 days, due before the 7-day
      // period (07/14 – 07/20). «پرس» greasing every 30 days from 07/20, done
      // today, and its next one (08/19) done early today too.
      const monthly = world.planItem(extruder, oilChange, 30, J(5));
      const press = world.equipment('پرس');
      const greasing = world.activity('گریس کاری');
      const pressItem = world.planItem(press, greasing, 30, J(20));
      world.executed(press, pressItem, J(20), tehranMorningOf(J(20)));
      world.executed(press, pressItem, J(19, 8), tehranMorningOf(J(20)));

      const { occurrences } = await dashboard(sut, 7);

      expect(
        occurrences.map((row) => [
          row.equipmentName,
          row.dueDate,
          row.status,
          row.doneToday,
          row.recordable,
        ]),
      ).toEqual([
        ['اکسترودر', J(5), 'overdue', false, true],
        ['پرس', J(20), 'on_time', true, false],
        ['پرس', J(19, 8), 'on_time', true, false],
      ]);
      expect(occurrences[0].planItemId).toBe(monthly.id.asString());
    });

    it('holds a missed one just before the period when it turned missed inside it', async () => {
      const { sut, done } = withWeeklyOilChange(J(10));
      done(J(8), J(8));

      const { occurrences } = await dashboard(sut, 7);

      expect(
        occurrences.map((row) => [row.dueDate, row.status, row.missedOn]),
      ).toEqual([
        [J(1), 'missed', J(8)],
        [J(8), 'on_time', null],
        [J(15), 'upcoming', null],
      ]);
    });

    it('leaves out the one just before the period once it was done on an earlier day', async () => {
      const { sut, done } = withWeeklyOilChange(J(10));
      done(J(1), J(3));

      const { occurrences } = await dashboard(sut, 7);

      expect(occurrences.map((row) => [row.dueDate, row.status])).toEqual([
        [J(8), 'overdue'],
        [J(15), 'upcoming'],
      ]);
    });

    it('describes each one: who did it when, how late, and whether it can be recorded', async () => {
      const { world, sut, extruder, oilChange, item } = withWeeklyOilChange(
        J(10),
      );
      const performedAt = tehranMorningOf(J(3));
      world.executed(
        extruder,
        item,
        J(1),
        performedAt,
        'مسلمی',
        'فیلتر هم عوض شد',
      );

      const { occurrences } = await dashboard(sut, 30);

      expect(occurrences.slice(0, 2)).toEqual([
        {
          equipmentId: extruder.id.asString(),
          equipmentName: 'اکسترودر',
          equipmentRetired: false,
          planItemId: item.id.asString(),
          activityId: oilChange.id.asString(),
          activityName: 'تعویض روغن',
          dueDate: J(1),
          status: 'late',
          daysOverdue: 0,
          daysLate: 2,
          missedOn: null,
          performedAt: performedAt.toISOString(),
          performedByName: 'مسلمی',
          notes: 'فیلتر هم عوض شد',
          doneToday: false,
          recordable: false,
        },
        {
          equipmentId: extruder.id.asString(),
          equipmentName: 'اکسترودر',
          equipmentRetired: false,
          planItemId: item.id.asString(),
          activityId: oilChange.id.asString(),
          activityName: 'تعویض روغن',
          dueDate: J(8),
          status: 'overdue',
          daysOverdue: 2,
          daysLate: null,
          missedOn: null,
          performedAt: null,
          performedByName: null,
          notes: null,
          doneToday: false,
          recordable: true,
        },
      ]);
    });

    it.each([
      [
        'its item was deactivated',
        (equipment: Equipment, itemId: Identity) =>
          equipment.deactivatePlanItem(itemId, tehranMorningOf(J(10))),
      ],
      [
        'its equipment was retired',
        (equipment: Equipment) => equipment.retire(tehranMorningOf(J(10))),
      ],
    ])('cannot record an overdue one when %s', async (_label, stop) => {
      const { sut, extruder, item } = withWeeklyOilChange(J(10));
      stop(extruder, item.id);

      const { occurrences } = await dashboard(sut, 7);

      expect(
        occurrences.map((row) => [row.dueDate, row.status, row.recordable]),
      ).toEqual([
        [J(1), 'missed', false],
        [J(8), 'overdue', false],
      ]);
    });
  });
});
