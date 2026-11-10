import { tehranMorningOf } from '@maintenance/application/support/fixed-clock';
import { MaintenanceWorld } from '@maintenance/application/support/maintenance-world';
import { CalendarDate } from '@maintenance/domain/value/calendar-date.vo';
import { OperatingHours } from '@maintenance/domain/value/operating-hours.vo';

import { MaintenanceHistoryEntryReadModel } from './maintenance-history-entry.read-model';

/** «اکسترودر 1»'s oil change, every 7 days from 07/01, read on 07/16. */
function weeklyOilChange() {
  const world = new MaintenanceWorld('2026-07-16');
  const extruder = world.equipment('اکسترودر 1');
  const item = world.planItem(
    extruder,
    world.activity('تعویض روغن'),
    7,
    '2026-07-01',
  );
  const occurrenceDue = (dueDate: string) =>
    extruder
      .occurrencesOf(item, [])
      .occurrenceOn(
        CalendarDate.fromString(dueDate),
        CalendarDate.fromString('2026-07-16'),
      );
  return { world, extruder, item, occurrenceDue };
}

describe('MaintenanceHistoryEntryReadModel', () => {
  it('reads a job done from its execution', () => {
    const { world, extruder, item } = weeklyOilChange();
    const execution = world.executed(
      extruder,
      item,
      '2026-07-01',
      tehranMorningOf('2026-07-03'),
      'مسلمی',
      'فیلتر هم عوض شد',
      undefined,
      OperatingHours.of(1250.5),
    );

    expect(
      MaintenanceHistoryEntryReadModel.executed(execution, 'mechanical'),
    ).toEqual({
      kind: 'executed',
      id: execution.id.asString(),
      planItemId: item.id.asString(),
      activityName: 'تعویض روغن',
      activitySpecialty: 'mechanical',
      dueDate: '2026-07-01',
      performedAt: tehranMorningOf('2026-07-03').toISOString(),
      performedBy: 'مسلمی',
      status: 'late',
      notes: 'فیلتر هم عوض شد',
      daysLate: 2,
      operatingHours: 1250.5,
    });
  });

  it('reads a missed occurrence with its plan row’s current activity and nothing of a job', () => {
    const { item, occurrenceDue } = weeklyOilChange();

    expect(
      MaintenanceHistoryEntryReadModel.missed(
        {
          item,
          activityName: 'تعویض روغن موتور',
          activitySpecialty: 'electrical',
        },
        occurrenceDue('2026-07-01'),
      ),
    ).toEqual({
      kind: 'missed',
      id: null,
      planItemId: item.id.asString(),
      activityName: 'تعویض روغن موتور',
      activitySpecialty: 'electrical',
      dueDate: '2026-07-01',
      performedAt: null,
      performedBy: null,
      status: 'missed',
      notes: null,
      daysLate: null,
      operatingHours: null,
    });
  });

  it('refuses an occurrence that is not missed', () => {
    const { item, occurrenceDue } = weeklyOilChange();

    expect(() =>
      MaintenanceHistoryEntryReadModel.missed(
        { item, activityName: 'تعویض روغن', activitySpecialty: null },
        occurrenceDue('2026-07-15'),
      ),
    ).toThrow();
  });
});
