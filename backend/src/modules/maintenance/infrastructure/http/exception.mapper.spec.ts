// Loaded first, for its side effect: the framework barrel pulls in
// `HttpExceptionFilter`, which instantiates every module's mapper. Entering
// that cycle from the mapper under test instead leaves the mapper undefined
// when the filter reaches it.
import '@framework/infrastructure';

import {
  EquipmentNameTaken,
  MaintenanceActivityNameTaken,
} from '@maintenance/application/exceptions';
import { ActivityAlreadyInPmPlan } from '@maintenance/domain/exceptions/activity-already-in-pm-plan.exception';
import { EquipmentIsRetired } from '@maintenance/domain/exceptions/equipment-is-retired.exception';
import { PmOccurrenceAlreadyRecorded } from '@maintenance/domain/exceptions/pm-occurrence-already-recorded.exception';
import { PmPlanItemIsRemoved } from '@maintenance/domain/exceptions/pm-plan-item-is-removed.exception';
import { UsageBasedIntervalNotSupported } from '@maintenance/domain/exceptions/usage-based-interval-not-supported.exception';
import { EquipmentName } from '@maintenance/domain/value/equipment-name.vo';
import { IntervalUnit } from '@maintenance/domain/value/interval-unit';
import { MaintenanceActivityName } from '@maintenance/domain/value/maintenance-activity-name.vo';

import { MaintenanceExceptionMapper } from './exception.mapper';

const TYPE_BASE = 'https://my-api-doc.dev/problems/';

function problemFor(exception: unknown): Record<string, unknown> {
  const sut = new MaintenanceExceptionMapper();
  expect(sut.canMap(exception)).toBe(true);
  return sut.toProblemDetail(exception).asResponseBody();
}

describe('MaintenanceExceptionMapper', () => {
  it.each([
    [
      'a taken equipment name',
      EquipmentNameTaken.withName(EquipmentName.fromString('اکسترودر')),
      'equipment-name-taken',
      409,
      'تجهیزی با این نام قبلا ثبت شده است',
      { name: 'اکسترودر' },
    ],
    [
      'a taken activity name',
      MaintenanceActivityNameTaken.withName(
        MaintenanceActivityName.fromString('تعویض روغن'),
      ),
      'maintenance-activity-name-taken',
      409,
      'فعالیتی با این نام قبلا ثبت شده است',
      { name: 'تعویض روغن' },
    ],
    [
      'an activity already in the plan',
      ActivityAlreadyInPmPlan.of('equipment-1', 'activity-1'),
      'activity-already-in-pm-plan',
      409,
      'این فعالیت قبلا به برنامه این تجهیز اضافه شده است',
      { equipmentId: 'equipment-1', activityId: 'activity-1' },
    ],
    [
      'an interval in operating hours',
      UsageBasedIntervalNotSupported.forUnit(IntervalUnit.OperatingHours),
      'usage-based-interval-not-supported',
      400,
      'برنامه فقط بر اساس روز قابل تعریف است',
      { intervalUnit: 'operating_hours' },
    ],
    [
      'retired equipment',
      EquipmentIsRetired.withId('equipment-1'),
      'equipment-retired',
      409,
      'این تجهیز کنار گذاشته شده است',
      { equipmentId: 'equipment-1' },
    ],
    [
      'a removed plan item',
      PmPlanItemIsRemoved.withId('item-1'),
      'pm-plan-item-removed',
      409,
      'این فعالیت از برنامه تجهیز حذف شده است',
      { planItemId: 'item-1' },
    ],
    [
      'an occurrence already recorded',
      PmOccurrenceAlreadyRecorded.of('item-1', '2026-07-01'),
      'pm-occurrence-already-recorded',
      409,
      'انجام این موعد قبلا ثبت شده است',
      { planItemId: 'item-1', dueDate: '2026-07-01' },
    ],
  ])(
    'maps %s to its problem with a Persian detail',
    (_label, exception, type, status, detail, members) => {
      expect(problemFor(exception)).toEqual(
        expect.objectContaining({
          type: `${TYPE_BASE}${type}`,
          status,
          detail,
          ...members,
        }),
      );
    },
  );

  it('claims nothing else', () => {
    expect(new MaintenanceExceptionMapper().canMap(new Error('other'))).toBe(
      false,
    );
  });
});
