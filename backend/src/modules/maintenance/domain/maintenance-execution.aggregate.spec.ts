import { Identity } from '@framework/domain';

import { MaintenanceExecutionDeleted } from './events/maintenance-execution-deleted.event';
import { MaintenanceExecutionRecorded } from './events/maintenance-execution-recorded.event';
import { MaintenanceExecution } from './maintenance-execution.aggregate';
import { CalendarDate } from './value/calendar-date.vo';
import { OperatingHours } from './value/operating-hours.vo';
import { PmOccurrenceStatus } from './value/pm-occurrence-status';

const equipmentId = Identity.new();
const planItemId = Identity.new();
const activityId = Identity.new();
const performedById = Identity.new();

function recordedAt(
  performedAt: string,
  dueDate = '2026-07-08',
  notes: string | null = null,
  operatingHours: OperatingHours | null = null,
) {
  return MaintenanceExecution.record({
    equipmentId,
    equipmentName: 'اکسترودر',
    planItemId,
    activityId,
    activityName: 'تعویض روغن',
    dueDate: CalendarDate.fromString(dueDate),
    performedAt: new Date(performedAt),
    performedById,
    performedByName: 'مسلمی',
    notes,
    operatingHours,
  });
}

describe('MaintenanceExecution', () => {
  // Issue #110: the System Admin's deletion of a history row.
  it('records its deletion with what it was', () => {
    const execution = recordedAt('2026-07-08T06:00:00.000Z');
    execution.releaseEvents();

    execution.delete();

    expect(execution.releaseEvents()).toEqual([
      new MaintenanceExecutionDeleted(
        execution.id.asString(),
        equipmentId.asString(),
        'اکسترودر',
        planItemId.asString(),
        'تعویض روغن',
        '2026-07-08',
        'مسلمی',
      ),
    ]);
  });

  it('records who did which occurrence when, with notes', () => {
    const execution = recordedAt(
      '2026-07-08T06:00:00.000Z',
      '2026-07-08',
      'فیلتر هم عوض شد',
    );

    expect(execution.dueDate().asString()).toBe('2026-07-08');
    expect(execution.activityName()).toBe('تعویض روغن');
    expect(execution.performedByName()).toBe('مسلمی');
    expect(execution.notes()).toBe('فیلتر هم عوض شد');
    expect(execution.releaseEvents()).toEqual([
      new MaintenanceExecutionRecorded(
        execution.id.asString(),
        equipmentId.asString(),
        'اکسترودر',
        planItemId.asString(),
        'تعویض روغن',
        '2026-07-08',
        new Date('2026-07-08T06:00:00.000Z'),
        'مسلمی',
        'فیلتر هم عوض شد',
        null,
      ),
    ]);
  });

  it('records the equipment’s operating hours when given', () => {
    const execution = recordedAt(
      '2026-07-08T06:00:00.000Z',
      '2026-07-08',
      null,
      OperatingHours.of(1250.5),
    );

    expect(execution.operatingHours()).toEqual(OperatingHours.of(1250.5));
    expect(execution.releaseEvents()).toEqual([
      expect.objectContaining({ operatingHours: 1250.5 }),
    ]);
  });

  it('keeps no operating hours when none were given', () => {
    expect(recordedAt('2026-07-08T06:00:00.000Z').operatingHours()).toBeNull();
  });

  it.each([null, '', ' '.repeat(3)])('keeps no notes for %p', (notes) => {
    expect(
      recordedAt('2026-07-08T06:00:00.000Z', '2026-07-08', notes).notes(),
    ).toBeNull();
  });

  it('trims its notes', () => {
    expect(
      recordedAt(
        '2026-07-08T06:00:00.000Z',
        '2026-07-08',
        '  انجام شد ',
      ).notes(),
    ).toBe('انجام شد');
  });

  it('was performed on the Tehran calendar date of its instant', () => {
    // 21:00 UTC on 07/07 is 00:30 on 07/08 in Tehran.
    expect(
      recordedAt('2026-07-07T21:00:00.000Z').performedOn().asString(),
    ).toBe('2026-07-08');
  });

  it('is on time when performed on its due date in Tehran', () => {
    expect(recordedAt('2026-07-08T20:00:00.000Z').status()).toBe(
      PmOccurrenceStatus.OnTime,
    );
  });

  it('is on time when performed before its due date', () => {
    expect(recordedAt('2026-07-05T06:00:00.000Z').status()).toBe(
      PmOccurrenceStatus.OnTime,
    );
  });

  it('is late when performed after its due date in Tehran, even if not yet in UTC', () => {
    // 20:30 UTC on 07/08 is already 07/09 in Tehran.
    expect(recordedAt('2026-07-08T20:30:00.000Z').status()).toBe(
      PmOccurrenceStatus.Late,
    );
  });

  it.each([
    ['2 days early', '2026-07-06T06:00:00.000Z', null],
    ['on the due date', '2026-07-08T06:00:00.000Z', null],
    ['1 day after it', '2026-07-09T06:00:00.000Z', 1],
    ['6 days after it', '2026-07-14T06:00:00.000Z', 6],
  ])(
    'performed %s (%s), it is %p days late',
    (_when, performedAt, daysLate) => {
      expect(recordedAt(performedAt).daysLate()).toBe(daysLate);
    },
  );

  it('counts days late in Tehran dates, not elapsed hours', () => {
    // 20:30 UTC on 07/08 is 00:00 on 07/09 in Tehran: one day late, though under a day has passed.
    expect(recordedAt('2026-07-08T20:30:00.000Z').daysLate()).toBe(1);
  });
});
