import { EntityNotFound, Identity } from '@framework/domain';

import { Equipment } from './equipment.aggregate';
import { EquipmentRegistered } from './events/equipment-registered.event';
import { EquipmentRenamed } from './events/equipment-renamed.event';
import { EquipmentRetired } from './events/equipment-retired.event';
import { PmPlanItemAdded } from './events/pm-plan-item-added.event';
import { PmPlanItemIntervalChanged } from './events/pm-plan-item-interval-changed.event';
import { PmPlanItemRemoved } from './events/pm-plan-item-removed.event';
import { ActivityAlreadyInPmPlan } from './exceptions/activity-already-in-pm-plan.exception';
import { EquipmentIsRetired } from './exceptions/equipment-is-retired.exception';
import { PmPlanItemIsRemoved } from './exceptions/pm-plan-item-is-removed.exception';
import { MaintenanceActivity } from './maintenance-activity.aggregate';
import { CalendarDate } from './value/calendar-date.vo';
import { EquipmentName } from './value/equipment-name.vo';
import { IntervalDays } from './value/interval-days.vo';
import { MaintenanceActivityName } from './value/maintenance-activity-name.vo';

const date = (value: string) => CalendarDate.fromString(value);
const NOW = new Date('2026-07-10T06:00:00.000Z');

function activityNamed(name: string): MaintenanceActivity {
  const activity = MaintenanceActivity.register(
    MaintenanceActivityName.fromString(name),
  );
  activity.releaseEvents();
  return activity;
}

function registeredEquipment(name = 'اکسترودر'): Equipment {
  const equipment = Equipment.register(EquipmentName.fromString(name));
  equipment.releaseEvents();
  return equipment;
}

function withOilChangeEvery30Days() {
  const equipment = registeredEquipment();
  const oilChange = activityNamed('تعویض روغن');
  const item = equipment.addPlanItem(
    oilChange,
    IntervalDays.of(30),
    date('2026-07-01'),
  );
  equipment.releaseEvents();
  return { equipment, oilChange, item };
}

describe('Equipment', () => {
  describe('registering and renaming', () => {
    it('is registered by name, in service and with an empty plan', () => {
      const equipment = Equipment.register(EquipmentName.fromString('پرس'));

      expect(equipment.name().asString()).toBe('پرس');
      expect(equipment.isRetired()).toBe(false);
      expect(equipment.planItems()).toEqual([]);
      expect(equipment.releaseEvents()).toEqual([
        new EquipmentRegistered(equipment.id.asString(), 'پرس'),
      ]);
    });

    it('is renamed', () => {
      const equipment = registeredEquipment('پرس');

      equipment.rename(EquipmentName.fromString('پرس هیدرولیک'));

      expect(equipment.name().asString()).toBe('پرس هیدرولیک');
      expect(equipment.releaseEvents()).toEqual([
        new EquipmentRenamed(equipment.id.asString(), 'پرس', 'پرس هیدرولیک'),
      ]);
    });

    it('records nothing when renamed to the name it already has', () => {
      const equipment = registeredEquipment('پرس');

      equipment.rename(EquipmentName.fromString('پرس'));

      expect(equipment.releaseEvents()).toEqual([]);
    });
  });

  describe('retiring', () => {
    it('is retired, stamped with when', () => {
      const equipment = registeredEquipment('پرس');

      equipment.retire(NOW);

      expect(equipment.isRetired()).toBe(true);
      expect(equipment.retiredAt()).toEqual(NOW);
      expect(equipment.releaseEvents()).toEqual([
        new EquipmentRetired(equipment.id.asString(), 'پرس'),
      ]);
    });

    it('cannot be retired twice', () => {
      const equipment = registeredEquipment();
      equipment.retire(NOW);

      expect(() => equipment.retire(NOW)).toThrow(EquipmentIsRetired);
    });

    it('cannot be renamed once retired', () => {
      const equipment = registeredEquipment();
      equipment.retire(NOW);

      expect(() => equipment.rename(EquipmentName.fromString('دیگر'))).toThrow(
        EquipmentIsRetired,
      );
    });
  });

  describe('its PM plan', () => {
    it('gains an item for an activity, its interval and first due date', () => {
      const equipment = registeredEquipment('اکسترودر');
      const oilChange = activityNamed('تعویض روغن');

      const item = equipment.addPlanItem(
        oilChange,
        IntervalDays.of(30),
        date('2026-07-01'),
      );

      expect(equipment.activePlanItems()).toEqual([item]);
      expect(item.activityId().equals(oilChange.id)).toBe(true);
      expect(item.schedule().firstDueDate().asString()).toBe('2026-07-01');
      expect(item.schedule().intervalDays().asNumber()).toBe(30);
      expect(equipment.releaseEvents()).toEqual([
        new PmPlanItemAdded(
          equipment.id.asString(),
          'اکسترودر',
          item.id.asString(),
          oilChange.id.asString(),
          'تعویض روغن',
          30,
          '2026-07-01',
        ),
      ]);
    });

    it('holds its items in the order they were added', () => {
      const equipment = registeredEquipment();
      const first = equipment.addPlanItem(
        activityNamed('تعویض روغن'),
        IntervalDays.of(30),
        date('2026-07-01'),
      );
      const second = equipment.addPlanItem(
        activityNamed('گریس کاری'),
        IntervalDays.of(7),
        date('2026-07-02'),
      );

      expect(equipment.activePlanItems()).toEqual([first, second]);
    });

    it('refuses an activity already in its plan', () => {
      const { equipment, oilChange } = withOilChangeEvery30Days();

      expect(() =>
        equipment.addPlanItem(
          oilChange,
          IntervalDays.of(7),
          date('2026-08-01'),
        ),
      ).toThrow(ActivityAlreadyInPmPlan);
    });

    it('takes an activity again once its earlier item was removed', () => {
      const { equipment, oilChange, item } = withOilChangeEvery30Days();
      equipment.removePlanItem(item.id, NOW);

      const again = equipment.addPlanItem(
        oilChange,
        IntervalDays.of(7),
        date('2026-08-01'),
      );

      expect(equipment.activePlanItems()).toEqual([again]);
    });

    it('takes no item once retired', () => {
      const equipment = registeredEquipment();
      equipment.retire(NOW);

      expect(() =>
        equipment.addPlanItem(
          activityNamed('تعویض روغن'),
          IntervalDays.of(7),
          date('2026-08-01'),
        ),
      ).toThrow(EquipmentIsRetired);
    });

    describe('changing an item’s interval', () => {
      it('restarts the item’s schedule from the given due date, which the event names', () => {
        const { equipment, item } = withOilChangeEvery30Days();

        equipment.changePlanItemInterval(
          item.id,
          IntervalDays.of(15),
          date('2026-07-01'),
        );

        expect(
          item
            .schedule()
            .dueDatesThrough(date('2026-07-16'))
            .map((due) => due.asString()),
        ).toEqual(['2026-07-01', '2026-07-16']);
        expect(equipment.releaseEvents()).toEqual([
          new PmPlanItemIntervalChanged(
            equipment.id.asString(),
            'اکسترودر',
            item.id.asString(),
            'تعویض روغن',
            30,
            15,
            '2026-07-01',
          ),
        ]);
      });

      it('refuses to restart from a date that is not one of the item’s due dates', () => {
        const { equipment, item } = withOilChangeEvery30Days();

        expect(() =>
          equipment.changePlanItemInterval(
            item.id,
            IntervalDays.of(15),
            date('2026-07-10'),
          ),
        ).toThrow();
      });

      it('records nothing when the interval is unchanged', () => {
        const { equipment, item } = withOilChangeEvery30Days();

        equipment.changePlanItemInterval(
          item.id,
          IntervalDays.of(30),
          date('2026-07-01'),
        );

        expect(equipment.releaseEvents()).toEqual([]);
        expect(item.schedule().segments()).toHaveLength(1);
      });

      it('refuses an item not in its plan', () => {
        const { equipment } = withOilChangeEvery30Days();

        expect(() =>
          equipment.changePlanItemInterval(
            Identity.new(),
            IntervalDays.of(15),
            date('2026-07-01'),
          ),
        ).toThrow(EntityNotFound);
      });

      it('refuses a removed item', () => {
        const { equipment, item } = withOilChangeEvery30Days();
        equipment.removePlanItem(item.id, NOW);

        expect(() =>
          equipment.changePlanItemInterval(
            item.id,
            IntervalDays.of(15),
            date('2026-07-01'),
          ),
        ).toThrow(PmPlanItemIsRemoved);
      });

      it('refuses once the equipment is retired', () => {
        const { equipment, item } = withOilChangeEvery30Days();
        equipment.retire(NOW);

        expect(() =>
          equipment.changePlanItemInterval(
            item.id,
            IntervalDays.of(15),
            date('2026-07-01'),
          ),
        ).toThrow(EquipmentIsRetired);
      });
    });

    describe('removing an item', () => {
      it('takes it out of the active plan but keeps it, stamped with when', () => {
        const { equipment, item } = withOilChangeEvery30Days();

        equipment.removePlanItem(item.id, NOW);

        expect(equipment.activePlanItems()).toEqual([]);
        expect(equipment.planItems()).toEqual([item]);
        expect(item.removedAt()).toEqual(NOW);
        expect(equipment.releaseEvents()).toEqual([
          new PmPlanItemRemoved(
            equipment.id.asString(),
            'اکسترودر',
            item.id.asString(),
            'تعویض روغن',
          ),
        ]);
      });

      it('cannot remove it twice', () => {
        const { equipment, item } = withOilChangeEvery30Days();
        equipment.removePlanItem(item.id, NOW);

        expect(() => equipment.removePlanItem(item.id, NOW)).toThrow(
          PmPlanItemIsRemoved,
        );
      });

      it('refuses an item not in its plan', () => {
        const { equipment } = withOilChangeEvery30Days();

        expect(() => equipment.removePlanItem(Identity.new(), NOW)).toThrow(
          EntityNotFound,
        );
      });
    });

    describe('recording an execution of an item', () => {
      const INSPECTOR = { id: Identity.new(), name: 'مسلمی' };
      const ON_07_05 = new Date('2026-07-05T05:30:00.000Z');

      it('records the item’s next occurrence as done now, by the performer, with notes', () => {
        const { equipment, oilChange, item } = withOilChangeEvery30Days();

        const execution = equipment.recordExecutionOf(
          item.id,
          oilChange.name(),
          [],
          ON_07_05,
          INSPECTOR,
          'فیلتر هم عوض شد',
        );

        expect(execution.dueDate().asString()).toBe('2026-07-01');
        expect(execution.planItemId().equals(item.id)).toBe(true);
        expect(execution.equipmentName()).toBe('اکسترودر');
        expect(execution.activityName()).toBe('تعویض روغن');
        expect(execution.performedAt()).toEqual(ON_07_05);
        expect(execution.performedById().equals(INSPECTOR.id)).toBe(true);
        expect(execution.performedByName()).toBe('مسلمی');
        expect(execution.notes()).toBe('فیلتر هم عوض شد');
        expect(equipment.releaseEvents()).toEqual([]);
      });

      it('moves on past the occurrences already done', () => {
        const { equipment, oilChange, item } = withOilChangeEvery30Days();
        const first = equipment.recordExecutionOf(
          item.id,
          oilChange.name(),
          [],
          ON_07_05,
          INSPECTOR,
          null,
        );

        const second = equipment.recordExecutionOf(
          item.id,
          oilChange.name(),
          [first],
          ON_07_05,
          INSPECTOR,
          null,
        );

        expect(second.dueDate().asString()).toBe('2026-07-31');
      });

      it('names the activity as it is called now', () => {
        const { equipment, oilChange, item } = withOilChangeEvery30Days();
        oilChange.rename(
          MaintenanceActivityName.fromString('تعویض روغن موتور'),
        );

        expect(
          equipment
            .recordExecutionOf(
              item.id,
              oilChange.name(),
              [],
              ON_07_05,
              INSPECTOR,
              null,
            )
            .activityName(),
        ).toBe('تعویض روغن موتور');
      });

      it('is of the activity the item schedules', () => {
        const { equipment, oilChange, item } = withOilChangeEvery30Days();

        expect(
          equipment
            .recordExecutionOf(
              item.id,
              oilChange.name(),
              [],
              ON_07_05,
              INSPECTOR,
              null,
            )
            .activityId()
            .equals(oilChange.id),
        ).toBe(true);
      });

      it('refuses a removed item', () => {
        const { equipment, oilChange, item } = withOilChangeEvery30Days();
        equipment.removePlanItem(item.id, NOW);

        expect(() =>
          equipment.recordExecutionOf(
            item.id,
            oilChange.name(),
            [],
            ON_07_05,
            INSPECTOR,
            null,
          ),
        ).toThrow(PmPlanItemIsRemoved);
      });
    });

    describe('the item an execution is recorded against', () => {
      it('is an active item of equipment in service', () => {
        const { equipment, item } = withOilChangeEvery30Days();

        expect(equipment.activePlanItem(item.id)).toBe(item);
      });

      it('is not a removed item', () => {
        const { equipment, item } = withOilChangeEvery30Days();
        equipment.removePlanItem(item.id, NOW);

        expect(() => equipment.activePlanItem(item.id)).toThrow(
          PmPlanItemIsRemoved,
        );
      });

      it('is not an item of retired equipment', () => {
        const { equipment, item } = withOilChangeEvery30Days();
        equipment.retire(NOW);

        expect(() => equipment.activePlanItem(item.id)).toThrow(
          EquipmentIsRetired,
        );
      });

      it('is not an item outside its plan', () => {
        const { equipment } = withOilChangeEvery30Days();

        expect(() => equipment.activePlanItem(Identity.new())).toThrow(
          EntityNotFound,
        );
      });
    });
  });
});
