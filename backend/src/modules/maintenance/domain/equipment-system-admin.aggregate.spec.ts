import { EntityNotFound, Identity } from '@framework/domain';

import { Equipment } from './equipment.aggregate';
import { EquipmentDeleted } from './events/equipment-deleted.event';
import { EquipmentReactivated } from './events/equipment-reactivated.event';
import { EquipmentRenamed } from './events/equipment-renamed.event';
import { PmPlanItemDeleted } from './events/pm-plan-item-deleted.event';
import { EquipmentIsRetired } from './exceptions/equipment-is-retired.exception';
import { EquipmentNotRetired } from './exceptions/equipment-not-retired.exception';
import { InvalidReactivationItem } from './exceptions/invalid-reactivation-item.exception';
import { PmPlanItemIsActive } from './exceptions/pm-plan-item-is-active.exception';
import { ReactivationFirstDueDateInPast } from './exceptions/reactivation-first-due-date-in-past.exception';
import { MaintenanceActivity } from './maintenance-activity.aggregate';
import { MaintenanceExecution } from './maintenance-execution.aggregate';
import { ReadonlyPmPlanItem } from './pm-plan-item.entity';
import { ActivitySpecialty } from './value/activity-specialty.vo';
import { CalendarDate } from './value/calendar-date.vo';
import { CalendarDateRange } from './value/calendar-date-range.vo';
import { EquipmentName } from './value/equipment-name.vo';
import { IntervalDays } from './value/interval-days.vo';
import { MaintenanceActivityName } from './value/maintenance-activity-name.vo';
import { PmOccurrenceStatus } from './value/pm-occurrence-status';
import { ServiceBreak } from './value/service-break.vo';

// The design's worked example (issue #110), in Gregorian dates: every 7 days
// from 2026-09-23 (Jalali 1405/07/01). 09:00 Tehran on each day.
const date = (value: string) => CalendarDate.fromString(value);
const morningOf = (isoDate: string) => new Date(`${isoDate}T05:30:00.000Z`);
const ON_07_10 = morningOf('2026-10-02');
const ON_07_20 = morningOf('2026-10-12');
const ON_08_05 = morningOf('2026-10-27');
const ON_08_18 = morningOf('2026-11-09');
const INSPECTOR = { id: Identity.new(), name: 'مسلمی' };
const NO_REPORT = { notes: null, operatingHours: null };

function activityNamed(name: string): MaintenanceActivity {
  const activity = MaintenanceActivity.register(
    MaintenanceActivityName.fromString(name),
    ActivitySpecialty.mechanical(),
  );
  activity.releaseEvents();
  return activity;
}

function extruderWithWeeklyOilChange() {
  const equipment = Equipment.register(EquipmentName.fromString('اکسترودر 1'));
  const oilChange = activityNamed('تعویض روغن');
  const item = equipment.addPlanItem(
    oilChange,
    IntervalDays.of(7),
    date('2026-09-23'),
  );
  equipment.releaseEvents();
  return { equipment, oilChange, item };
}

function retiredOn0710() {
  const world = extruderWithWeeklyOilChange();
  world.equipment.retire(ON_07_10);
  world.equipment.releaseEvents();
  return world;
}

function doneOn(
  equipment: Equipment,
  item: ReadonlyPmPlanItem,
  dueDate: string,
): MaintenanceExecution {
  return MaintenanceExecution.record({
    equipmentId: equipment.id,
    equipmentName: equipment.name().asString(),
    planItemId: item.id,
    activityId: item.activityId(),
    activityName: item.activityName(),
    dueDate: date(dueDate),
    performedAt: morningOf(dueDate),
    performedById: INSPECTOR.id,
    performedByName: INSPECTOR.name,
    notes: null,
    operatingHours: null,
  });
}

describe('Equipment — the System Admin’s exceptions (issue #110)', () => {
  describe('reactivating', () => {
    it('puts retired equipment back in service, closing its service break', () => {
      const { equipment } = retiredOn0710();

      equipment.reactivate(ON_07_20, []);

      expect(equipment.isRetired()).toBe(false);
      expect(equipment.retiredAt()).toBeNull();
      expect(equipment.serviceBreaks()).toEqual([
        ServiceBreak.startingAt(ON_07_10).endingAt(ON_07_20),
      ]);
      expect(equipment.releaseEvents()).toEqual([
        new EquipmentReactivated(equipment.id.asString(), 'اکسترودر 1', []),
      ]);
    });

    it('refuses equipment in service', () => {
      const { equipment } = extruderWithWeeklyOilChange();

      expect(() => equipment.reactivate(ON_07_20, [])).toThrow(
        EquipmentNotRetired,
      );
    });

    it('continues a row’s previous calendar, skipping the due dates while retired (next 07/22, 07/15 not generated)', () => {
      const { equipment, item } = retiredOn0710();
      equipment.reactivate(ON_07_20, []);
      const occurrences = equipment.occurrencesOf(item, [
        doneOn(equipment, item, '2026-09-23'),
      ]);

      expect(
        equipment
          .occurrencesInForceOf(item, [])
          .nextDueDate(date('2026-10-12'))
          .asString(),
      ).toBe('2026-10-14');
      expect(occurrences.generatesOn(date('2026-10-07'))).toBe(false);
      expect(
        occurrences
          .occurrencesDueIn(
            CalendarDateRange.between(date('2026-09-23'), date('2026-10-14')),
            date('2026-10-12'),
          )
          .map(({ dueDate, status }) => [dueDate.asString(), status]),
      ).toEqual([
        ['2026-09-23', PmOccurrenceStatus.OnTime],
        ['2026-09-30', PmOccurrenceStatus.Missed],
        ['2026-10-14', PmOccurrenceStatus.Upcoming],
      ]);
    });

    it('restarts a rescheduled row from its new first due date, keeping its interval (07/25, 08/02)', () => {
      const { equipment, item } = retiredOn0710();

      equipment.reactivate(ON_07_20, [
        { planItemId: item.id, firstDueDate: date('2026-10-17') },
      ]);

      const occurrences = equipment.occurrencesInForceOf(item, []);
      expect(occurrences.nextDueDate(date('2026-10-12')).asString()).toBe(
        '2026-10-17',
      );
      expect(
        occurrences
          .occurrencesDueIn(
            CalendarDateRange.between(date('2026-10-12'), date('2026-10-24')),
            date('2026-10-12'),
          )
          .map(({ dueDate }) => dueDate.asString()),
      ).toEqual(['2026-10-17', '2026-10-24']);
      expect(equipment.releaseEvents()).toEqual([
        new EquipmentReactivated(equipment.id.asString(), 'اکسترودر 1', [
          {
            planItemId: item.id.asString(),
            activityName: 'تعویض روغن',
            firstDueDate: '2026-10-17',
          },
        ]),
      ]);
    });

    it('accepts today as a new first due date', () => {
      const { equipment, item } = retiredOn0710();

      equipment.reactivate(ON_07_20, [
        { planItemId: item.id, firstDueDate: date('2026-10-12') },
      ]);

      expect(
        equipment
          .occurrencesInForceOf(item, [])
          .nextDueDate(date('2026-10-12'))
          .asString(),
      ).toBe('2026-10-12');
    });

    it('refuses a new first due date before the reactivation day, changing nothing', () => {
      const { equipment, item } = retiredOn0710();
      const schedule = item.schedule();

      expect(() =>
        equipment.reactivate(ON_07_20, [
          { planItemId: item.id, firstDueDate: date('2026-10-10') },
        ]),
      ).toThrow(ReactivationFirstDueDateInPast);
      expect(equipment.isRetired()).toBe(true);
      expect(item.schedule()).toEqual(schedule);
      expect(equipment.releaseEvents()).toEqual([]);
    });

    it('refuses to reschedule a row that is not an active row of its plan', () => {
      const { equipment, item } = extruderWithWeeklyOilChange();
      equipment.deactivatePlanItem(item.id, morningOf('2026-09-30'));
      equipment.retire(ON_07_10);

      for (const planItemId of [item.id, Identity.new()]) {
        expect(() =>
          equipment.reactivate(ON_07_20, [
            { planItemId, firstDueDate: date('2026-10-17') },
          ]),
        ).toThrow(InvalidReactivationItem);
      }
      expect(equipment.isRetired()).toBe(true);
    });

    it('refuses to reschedule one row twice', () => {
      const { equipment, item } = retiredOn0710();

      expect(() =>
        equipment.reactivate(ON_07_20, [
          { planItemId: item.id, firstDueDate: date('2026-10-17') },
          { planItemId: item.id, firstDueDate: date('2026-10-18') },
        ]),
      ).toThrow(InvalidReactivationItem);
    });

    it('leaves a separately deactivated row deactivated', () => {
      const { equipment, item } = extruderWithWeeklyOilChange();
      equipment.deactivatePlanItem(item.id, morningOf('2026-09-30'));
      equipment.retire(ON_07_10);

      equipment.reactivate(ON_07_20, []);

      expect(equipment.inactivePlanItems()).toEqual([item]);
      expect(equipment.hasPmPlan()).toBe(false);
    });

    it('can be retired and reactivated again, every gap left out (80% example)', () => {
      const { equipment, item } = retiredOn0710();
      equipment.reactivate(ON_07_20, []);
      equipment.retire(ON_08_05);
      equipment.reactivate(ON_08_18, []);
      const executions = [
        '2026-09-23',
        '2026-10-14',
        '2026-10-21',
        '2026-11-11',
      ].map((dueDate) => doneOn(equipment, item, dueDate));

      expect(
        equipment
          .occurrencesOf(item, executions)
          .occurrencesDueIn(
            CalendarDateRange.between(date('2026-09-23'), date('2026-11-15')),
            date('2026-11-16'),
          )
          .map(({ dueDate, status }) => [dueDate.asString(), status]),
      ).toEqual([
        ['2026-09-23', PmOccurrenceStatus.OnTime],
        ['2026-09-30', PmOccurrenceStatus.Missed],
        ['2026-10-14', PmOccurrenceStatus.OnTime],
        ['2026-10-21', PmOccurrenceStatus.OnTime],
        ['2026-11-11', PmOccurrenceStatus.OnTime],
      ]);
    });

    // Code review: a restart overtaken by a second retirement before its first
    // due date. Every 7 days from 07/01 (Gregorian here); retired 07/10,
    // reactivated 07/20 from 08/20, retired 07/25, reactivated 08/10 from
    // 08/12. 07/22 was an in-service day of the first restart — it must not
    // come back as an occurrence.
    it('never brings back the previous calendar over a restart overtaken before its first due date', () => {
      const equipment = Equipment.register(
        EquipmentName.fromString('اکسترودر 1'),
      );
      const item = equipment.addPlanItem(
        activityNamed('تعویض روغن'),
        IntervalDays.of(7),
        date('2026-07-01'),
      );
      equipment.retire(morningOf('2026-07-10'));
      equipment.reactivate(morningOf('2026-07-20'), [
        { planItemId: item.id, firstDueDate: date('2026-08-20') },
      ]);
      equipment.retire(morningOf('2026-07-25'));
      equipment.reactivate(morningOf('2026-08-10'), [
        { planItemId: item.id, firstDueDate: date('2026-08-12') },
      ]);

      expect(
        equipment
          .occurrencesOf(item, [])
          .occurrencesDueIn(
            CalendarDateRange.between(date('2026-07-01'), date('2026-08-31')),
            date('2026-08-11'),
          )
          .map(({ dueDate }) => dueDate.asString()),
      ).toEqual([
        '2026-07-01',
        '2026-07-08',
        '2026-08-12',
        '2026-08-19',
        '2026-08-26',
      ]);
      expect(
        equipment
          .occurrencesInForceOf(item, [])
          .nextDueDate(date('2026-08-10'))
          .asString(),
      ).toBe('2026-08-12');
    });

    it('records an execution after reactivation against the first due date after the gap', () => {
      const { equipment, oilChange, item } = retiredOn0710();
      equipment.reactivate(ON_07_20, []);

      const execution = equipment.recordExecutionOf(
        item.id,
        oilChange.name(),
        [],
        ON_07_20,
        INSPECTOR,
        NO_REPORT,
      );

      expect(execution.dueDate().asString()).toBe('2026-10-14');
    });
  });

  describe('stopping while retired', () => {
    // The retirement day stays in service, as before issue #110: a gap runs
    // from the day after it.
    it('stops every item on the retirement day, inclusive', () => {
      const { equipment, item } = retiredOn0710();

      expect(equipment.stopDateOf(item)?.asString()).toBe('2026-10-02');
      expect(
        equipment.occurrencesOf(item, []).generatesOn(date('2026-10-02')),
      ).toBe(true);
      expect(
        equipment.occurrencesOf(item, []).generatesOn(date('2026-10-03')),
      ).toBe(false);
    });

    // «کنار گذاشتن تجهیز مثل حذف همه فعالیت های آن در همان روز است»: every 7
    // days from 07/03, retired 07/10, today 07/20 — 07/10 is still listed,
    // and missed.
    it('keeps a due date on the retirement day, which turns missed', () => {
      const equipment = Equipment.register(
        EquipmentName.fromString('اکسترودر 1'),
      );
      const item = equipment.addPlanItem(
        activityNamed('بررسی تابلو برق'),
        IntervalDays.of(7),
        date('2026-09-25'),
      );
      equipment.retire(ON_07_10);

      expect(
        equipment
          .occurrencesOf(item, [])
          .occurrencesDueIn(
            CalendarDateRange.between(date('2026-09-23'), date('2026-10-22')),
            date('2026-10-12'),
          )
          .map(({ dueDate, status }) => [dueDate.asString(), status]),
      ).toEqual([
        ['2026-09-25', PmOccurrenceStatus.Missed],
        ['2026-10-02', PmOccurrenceStatus.Missed],
      ]);
    });

    it('keeps a due date on the retirement day once reactivated, and turns it missed', () => {
      const equipment = Equipment.register(
        EquipmentName.fromString('اکسترودر 1'),
      );
      const item = equipment.addPlanItem(
        activityNamed('بررسی تابلو برق'),
        IntervalDays.of(7),
        date('2026-09-25'),
      );
      equipment.retire(ON_07_10);
      equipment.reactivate(ON_07_20, []);

      expect(
        equipment
          .occurrencesOf(item, [])
          .occurrencesDueIn(
            CalendarDateRange.between(date('2026-09-23'), date('2026-10-22')),
            date('2026-10-12'),
          )
          .map(({ dueDate, status }) => [dueDate.asString(), status]),
      ).toEqual([
        ['2026-09-25', PmOccurrenceStatus.Missed],
        ['2026-10-02', PmOccurrenceStatus.Missed],
        ['2026-10-16', PmOccurrenceStatus.Upcoming],
      ]);
    });

    it('keeps a job due and done on the retirement day, before it retired (reviewer L2)', () => {
      const { equipment, item } = extruderWithWeeklyOilChange();
      const done = doneOn(equipment, item, '2026-10-07');
      equipment.retire(new Date('2026-10-07T15:00:00.000Z'));

      expect(
        equipment
          .occurrencesOf(item, [done])
          .occurrencesDueIn(
            CalendarDateRange.between(date('2026-10-07'), date('2026-10-14')),
            date('2026-10-20'),
          )
          .map(({ dueDate, status }) => [dueDate.asString(), status]),
      ).toEqual([['2026-10-07', PmOccurrenceStatus.OnTime]]);
    });

    it('judges a retired equipment’s items as in force, for its next due dates', () => {
      const { equipment, item } = retiredOn0710();

      expect(
        equipment
          .occurrencesInForceOf(item, [doneOn(equipment, item, '2026-09-23')])
          .nextDueDate(date('2026-10-12'))
          .asString(),
      ).toBe('2026-10-07');
    });
  });

  describe('correcting its name', () => {
    it('changes only correctable fields when renamed, its only field', () => {
      expect(
        extruderWithWeeklyOilChange().equipment.changesOnlyCorrectableFields(),
      ).toBe(true);
    });

    it('renames retired equipment, leaving it retired', () => {
      const { equipment } = retiredOn0710();

      equipment.correctName(EquipmentName.fromString('اکسترودر قدیمی'));

      expect(equipment.name().asString()).toBe('اکسترودر قدیمی');
      expect(equipment.isRetired()).toBe(true);
      expect(equipment.releaseEvents()).toEqual([
        new EquipmentRenamed(
          equipment.id.asString(),
          'اکسترودر 1',
          'اکسترودر قدیمی',
        ),
      ]);
    });

    it('records nothing when the name is unchanged', () => {
      const { equipment } = retiredOn0710();

      equipment.correctName(EquipmentName.fromString('اکسترودر 1'));

      expect(equipment.releaseEvents()).toEqual([]);
    });

    it('is still not an ordinary rename once retired', () => {
      const { equipment } = retiredOn0710();

      expect(() =>
        equipment.rename(EquipmentName.fromString('اکسترودر قدیمی')),
      ).toThrow(EquipmentIsRetired);
    });
  });

  describe('a plan item, whatever its state', () => {
    it('is found active, inactive, or of retired equipment', () => {
      const { equipment, item } = extruderWithWeeklyOilChange();
      equipment.deactivatePlanItem(item.id, ON_07_10);
      equipment.retire(ON_07_20);

      expect(equipment.planItem(item.id)).toBe(item);
    });

    it('is not one outside its plan', () => {
      const { equipment } = extruderWithWeeklyOilChange();

      expect(() => equipment.planItem(Identity.new())).toThrow(EntityNotFound);
    });
  });

  describe('deleting an inactive row', () => {
    it('removes it from the plan, other rows of the same activity left alone', () => {
      const { equipment, oilChange, item } = extruderWithWeeklyOilChange();
      equipment.deactivatePlanItem(item.id, ON_07_10);
      const active = equipment.addPlanItem(
        oilChange,
        IntervalDays.of(7),
        date('2026-10-14'),
      );
      equipment.releaseEvents();

      equipment.deletePlanItem(item.id);

      expect(equipment.planItems()).toEqual([active]);
      expect(equipment.releaseEvents()).toEqual([
        new PmPlanItemDeleted(
          equipment.id.asString(),
          'اکسترودر 1',
          item.id.asString(),
          'تعویض روغن',
        ),
      ]);
    });

    it('removes it from retired equipment too', () => {
      const { equipment, item } = extruderWithWeeklyOilChange();
      equipment.deactivatePlanItem(item.id, ON_07_10);
      equipment.retire(ON_07_20);

      equipment.deletePlanItem(item.id);

      expect(equipment.planItems()).toEqual([]);
    });

    it('refuses an active row', () => {
      const { equipment, item } = extruderWithWeeklyOilChange();

      expect(() => equipment.deletePlanItem(item.id)).toThrow(
        PmPlanItemIsActive,
      );
      expect(equipment.planItems()).toEqual([item]);
    });

    it('refuses a row outside its plan', () => {
      const { equipment } = extruderWithWeeklyOilChange();

      expect(() => equipment.deletePlanItem(Identity.new())).toThrow(
        EntityNotFound,
      );
    });
  });

  describe('deleting it', () => {
    it('is recorded for retired equipment', () => {
      const { equipment } = retiredOn0710();

      equipment.delete();

      expect(equipment.releaseEvents()).toEqual([
        new EquipmentDeleted(equipment.id.asString(), 'اکسترودر 1'),
      ]);
    });

    it('refuses equipment in service', () => {
      const { equipment } = extruderWithWeeklyOilChange();

      expect(() => equipment.delete()).toThrow(EquipmentNotRetired);
      expect(equipment.releaseEvents()).toEqual([]);
    });
  });

  it('is rebuilt from its stored service breaks', () => {
    const breaks = [
      ServiceBreak.restore(ON_07_10, ON_07_20),
      ServiceBreak.restore(ON_08_05, null),
    ];

    const equipment = Equipment.fromPersistence(
      Identity.new(),
      EquipmentName.fromString('اکسترودر 1'),
      breaks,
      [],
    );

    expect(equipment.isRetired()).toBe(true);
    expect(equipment.retiredAt()).toEqual(ON_08_05);
    expect(equipment.serviceBreaks()).toEqual(breaks);
  });

  it('cannot be rebuilt from an open service break followed by another', () => {
    expect(() =>
      Equipment.fromPersistence(
        Identity.new(),
        EquipmentName.fromString('اکسترودر 1'),
        [
          ServiceBreak.restore(ON_07_10, null),
          ServiceBreak.restore(ON_08_05, null),
        ],
        [],
      ),
    ).toThrow();
  });
});
