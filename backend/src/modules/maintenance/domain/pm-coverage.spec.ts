import { Equipment } from './equipment.aggregate';
import { MaintenanceActivity } from './maintenance-activity.aggregate';
import { PmCoverage } from './pm-coverage';
import { CalendarDate } from './value/calendar-date.vo';
import { EquipmentName } from './value/equipment-name.vo';
import { IntervalDays } from './value/interval-days.vo';
import { MaintenanceActivityName } from './value/maintenance-activity-name.vo';

const NOW = new Date('2026-10-12T05:30:00.000Z');
const oilChange = MaintenanceActivity.register(
  MaintenanceActivityName.fromString('تعویض روغن'),
);

function equipmentNamed(name: string): Equipment {
  return Equipment.register(EquipmentName.fromString(name));
}

function withPlan(name: string, firstDueDate = '2026-09-23'): Equipment {
  const equipment = equipmentNamed(name);
  equipment.addPlanItem(
    oilChange,
    IntervalDays.of(7),
    CalendarDate.fromString(firstDueDate),
  );
  return equipment;
}

const names = (equipment: readonly Equipment[]) =>
  equipment.map((candidate) => candidate.name().asString());

describe('PmCoverage', () => {
  it('covers half of four pieces in service: two with a plan, one first due ahead', () => {
    const deactivatedOnly = withPlan('میکسر');
    deactivatedOnly.deactivatePlanItem(deactivatedOnly.planItems()[0].id, NOW);
    const retired = withPlan('کوره');
    retired.retire(NOW);

    const sut = PmCoverage.of([
      withPlan('اکسترودر'),
      withPlan('پرس', '2026-11-30'),
      deactivatedOnly,
      equipmentNamed('برش'),
      retired,
    ]);

    expect({
      inService: sut.inService(),
      withPlan: sut.withPlan(),
      withoutPlan: names(sut.withoutPlan()),
      percent: sut.coveragePercent(),
    }).toEqual({
      inService: 4,
      withPlan: 2,
      withoutPlan: ['میکسر', 'برش'],
      percent: 50,
    });
  });

  it('rounds to a whole percent (two of three: 67)', () => {
    const sut = PmCoverage.of([
      withPlan('اکسترودر'),
      withPlan('پرس'),
      equipmentNamed('برش'),
    ]);

    expect(sut.coveragePercent()).toBe(67);
  });

  it('has no percentage without equipment in service', () => {
    const retired = withPlan('کوره');
    retired.retire(NOW);

    const sut = PmCoverage.of([retired]);

    expect([sut.inService(), sut.coveragePercent()]).toEqual([0, null]);
  });
});
