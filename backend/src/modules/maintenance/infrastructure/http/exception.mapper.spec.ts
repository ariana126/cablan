// Loaded first, for its side effect: the framework barrel pulls in
// `HttpExceptionFilter`, which instantiates every module's mapper. Entering
// that cycle from the mapper under test instead leaves the mapper undefined
// when the filter reaches it.
import '@framework/infrastructure';

import { Identity } from '@framework/domain';
import {
  EquipmentChangedConcurrently,
  EquipmentNameTaken,
  EquipmentNotFound,
  InvalidPmScheduleRange,
  InvalidQcExecutionRange,
  MaintenanceActivityNameTaken,
  PmPlanImportFileUnreadable,
  PmPlanImportHasErrors,
  QcActivityNameTaken,
  QcActivityNotFound,
  QcExecutionNotFound,
  QcSubmissionMismatch,
} from '@maintenance/application/exceptions';
import { ActivityAlreadyHasSpecialty } from '@maintenance/domain/exceptions/activity-already-has-specialty.exception';
import { ActivityAlreadyInPmPlan } from '@maintenance/domain/exceptions/activity-already-in-pm-plan.exception';
import { DateRangeStartsAfterEnd } from '@maintenance/domain/exceptions/date-range-starts-after-end.exception';
import { EquipmentIsRetired } from '@maintenance/domain/exceptions/equipment-is-retired.exception';
import { EquipmentNotRetired } from '@maintenance/domain/exceptions/equipment-not-retired.exception';
import { InvalidReactivationItem } from '@maintenance/domain/exceptions/invalid-reactivation-item.exception';
import { PmOccurrenceAlreadyRecorded } from '@maintenance/domain/exceptions/pm-occurrence-already-recorded.exception';
import { PmPlanItemIsActive } from '@maintenance/domain/exceptions/pm-plan-item-is-active.exception';
import { PmPlanItemIsDeactivated } from '@maintenance/domain/exceptions/pm-plan-item-is-deactivated.exception';
import { QcActivityAlreadyAssigned } from '@maintenance/domain/exceptions/qc-activity-already-assigned.exception';
import { QcActivityNotAssigned } from '@maintenance/domain/exceptions/qc-activity-not-assigned.exception';
import { ReactivationFirstDueDateInPast } from '@maintenance/domain/exceptions/reactivation-first-due-date-in-past.exception';
import { SpecialtyAssignmentMismatch } from '@maintenance/domain/exceptions/specialty-assignment-mismatch.exception';
import { UsageBasedIntervalNotSupported } from '@maintenance/domain/exceptions/usage-based-interval-not-supported.exception';
import { EquipmentName } from '@maintenance/domain/value/equipment-name.vo';
import { IntervalUnit } from '@maintenance/domain/value/interval-unit';
import { MaintenanceActivityName } from '@maintenance/domain/value/maintenance-activity-name.vo';
import { QcActivityName } from '@maintenance/domain/value/qc-activity-name.vo';

import { MaintenanceExceptionMapper } from './exception.mapper';

const TYPE_BASE = 'https://my-api-doc.dev/problems/';

const EQUIPMENT_ID = '11111111-1111-4111-8111-111111111111';
const ACTIVITY_ID = '22222222-2222-4222-8222-222222222222';
const EXTRUDER = { id: EQUIPMENT_ID, name: 'اکسترودر 1' };
const DIMENSIONAL = { id: ACTIVITY_ID, name: 'بازرسی ابعادی' };
const PM_PLAN_IMPORT_ERROR = {
  sheet: 'pm',
  cell: 'D1',
  row: 1,
  column: 'D',
  value: 'روغن کاری',
  reason: 'activity-not-found' as const,
  message: 'فعالیت تعریف نشده است',
};

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
      'a deactivated plan item',
      PmPlanItemIsDeactivated.withId('item-1'),
      'pm-plan-item-deactivated',
      409,
      'این فعالیت در برنامهٔ تجهیز غیرفعال شده است.',
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
    [
      'equipment changed by another request meanwhile',
      EquipmentChangedConcurrently.withId('equipment-1'),
      'equipment-changed-concurrently',
      409,
      'این تجهیز همزمان تغییر کرده است، دوباره تلاش کنید',
      { equipmentId: 'equipment-1' },
    ],
    [
      'a PM schedule range without an end, or starting after it ends',
      InvalidPmScheduleRange.of('2026-07-10'),
      'invalid-pm-schedule-range',
      400,
      'بازه تاریخ باید تاریخ شروع و پایان داشته باشد و تاریخ شروع بعد از تاریخ پایان نباشد.',
      {},
    ],
    [
      'a PM schedule range longer than ten years',
      InvalidPmScheduleRange.tooLong('2026-01-01', '2036-01-09', 3660),
      'invalid-pm-schedule-range',
      400,
      'بازه تاریخ نمی تواند بیشتر از ده سال باشد.',
      {},
    ],
    [
      'a specialty assignment not naming exactly the activities without one',
      SpecialtyAssignmentMismatch.of(['activity-1'], ['activity-2']),
      'specialty-assignment-incomplete',
      400,
      'تخصص همه فعالیت ها باید تعیین شود.',
      {
        missingActivityIds: ['activity-1'],
        unexpectedActivityIds: ['activity-2'],
      },
    ],
    [
      'completing the specialty of an activity that already has one',
      ActivityAlreadyHasSpecialty.forActivity('activity-1'),
      'activity-already-has-specialty',
      409,
      'تخصص این فعالیت قبلا تعیین شده است.',
      { activityId: 'activity-1' },
    ],
    // Issue #110: the plan's pinned details.
    [
      'deleting an active plan row',
      PmPlanItemIsActive.withId('item-1'),
      'pm-plan-item-active',
      409,
      'برای حذف ردیف فعال، ابتدا آن را غیرفعال کنید.',
      { planItemId: 'item-1' },
    ],
    [
      'deleting or reactivating equipment in service',
      EquipmentNotRetired.withId('equipment-1'),
      'equipment-not-retired',
      409,
      'فقط تجهیز کنار گذاشته شده قابل حذف یا فعال سازی دوباره است.',
      { equipmentId: 'equipment-1' },
    ],
    [
      'rescheduling a row not active in the plan',
      InvalidReactivationItem.withId('item-1'),
      'invalid-reactivation-item',
      400,
      'ردیف انتخاب شده در برنامه فعال این تجهیز نیست.',
      { planItemId: 'item-1' },
    ],
    [
      'a new first due date before the reactivation day',
      ReactivationFirstDueDateInPast.of('item-1', '2026-10-10', '2026-10-12'),
      'reactivation-first-due-date-in-past',
      400,
      'اولین موعد تازه نمی تواند پیش از روز فعال سازی باشد.',
      { planItemId: 'item-1', firstDueDate: '2026-10-10' },
    ],
    // Production QC (issue #119).
    [
      'retired equipment named by its refusal',
      EquipmentIsRetired.named('equipment-1', 'اکسترودر 1'),
      'equipment-retired',
      409,
      '"اکسترودر 1" کنار گذاشته شده است.',
      { equipmentId: 'equipment-1' },
    ],
    [
      'a QC activity name already in the catalog',
      QcActivityNameTaken.withName(QcActivityName.fromString('بازرسی ابعادی')),
      'qc-activity-name-taken',
      409,
      'فعالیت QC با این عنوان قبلا تعریف شده است.',
      { name: 'بازرسی ابعادی' },
    ],
    [
      'an unknown QC activity',
      QcActivityNotFound.withId(Identity.fromString(ACTIVITY_ID)),
      'qc-activity-not-found',
      404,
      'فعالیت QC پیدا نشد.',
      { activityId: ACTIVITY_ID },
    ],
    [
      'an unknown QC record',
      QcExecutionNotFound.withId(Identity.fromString(ACTIVITY_ID)),
      'qc-execution-not-found',
      404,
      'سابقه انجام QC پیدا نشد.',
      { executionId: ACTIVITY_ID },
    ],
    [
      'a QC submission sent again unlike its earlier records (issue #132)',
      QcSubmissionMismatch.of(Identity.fromString(ACTIVITY_ID)),
      'qc-submission-mismatch',
      409,
      'این ثبت پیش از این برای تجهیز، بازرس یا شماره ردیابی دیگری فرستاده شده است.',
      { submissionId: ACTIVITY_ID },
    ],
    [
      'unknown equipment asked through a QC route',
      EquipmentNotFound.withId(Identity.fromString(EQUIPMENT_ID)),
      'equipment-not-found',
      404,
      'تجهیز پیدا نشد.',
      { equipmentId: EQUIPMENT_ID },
    ],
    [
      'a QC activity already assigned',
      QcActivityAlreadyAssigned.of(EXTRUDER, DIMENSIONAL),
      'qc-activity-already-assigned',
      409,
      '"بازرسی ابعادی" قبلا به "اکسترودر 1" تخصیص داده شده است.',
      { equipmentId: EQUIPMENT_ID, activityId: ACTIVITY_ID },
    ],
    [
      'unassigning a QC activity not assigned',
      QcActivityNotAssigned.toUnassign(EXTRUDER, DIMENSIONAL),
      'qc-activity-not-assigned',
      404,
      '"بازرسی ابعادی" به "اکسترودر 1" تخصیص داده نشده است.',
      { equipmentId: EQUIPMENT_ID, activityId: ACTIVITY_ID },
    ],
    [
      'recording a QC activity not assigned',
      QcActivityNotAssigned.toRecord(EXTRUDER, DIMENSIONAL),
      'qc-activity-not-assigned',
      409,
      '"بازرسی ابعادی" به "اکسترودر 1" تخصیص داده نشده است.',
      { equipmentId: EQUIPMENT_ID, activityId: ACTIVITY_ID },
    ],
    // Issue #127: the bulk import of PM plans from Excel.
    [
      'a PM plan upload that is not a readable spreadsheet',
      PmPlanImportFileUnreadable.notASpreadsheet(),
      'pm-plan-import-file-unreadable',
      400,
      'فایل بارگذاری شده یک فایل اکسل (xlsx) قابل خواندن نیست.',
      {},
    ],
    [
      'a PM plan import without a file',
      PmPlanImportFileUnreadable.missing(),
      'pm-plan-import-file-unreadable',
      400,
      'فایلی بارگذاری نشده است.',
      {},
    ],
    [
      'a PM plan import whose file still has errors',
      PmPlanImportHasErrors.withErrors([PM_PLAN_IMPORT_ERROR]),
      'pm-plan-import-has-errors',
      400,
      'فایل برنامه PM خطا دارد و هیچ برنامه ای ثبت نشد.',
      { errors: [PM_PLAN_IMPORT_ERROR] },
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

  // Issue #114: only the equipment history lets it through — the PM
  // schedule's finder turns it into `invalid-pm-schedule-range` first.
  it('maps a date range starting after it ends to a validation error on its start', () => {
    expect(
      problemFor(DateRangeStartsAfterEnd.between('2026-07-11', '2026-07-10')),
    ).toEqual(
      expect.objectContaining({
        type: `${TYPE_BASE}validation-error`,
        title: 'Validation Error',
        status: 400,
        detail: 'One or more fields failed validation.',
        errors: [
          {
            field: 'from',
            message: 'from must not be after to (2026-07-11 – 2026-07-10)',
          },
        ],
      }),
    );
  });

  it('maps QC records asked for from after their end to a validation error on `from`', () => {
    expect(
      problemFor(
        InvalidQcExecutionRange.startingAfterEnd(
          new Date('2026-09-24T00:00:00.000Z'),
          new Date('2026-09-23T00:00:00.000Z'),
        ),
      ),
    ).toEqual(
      expect.objectContaining({
        type: `${TYPE_BASE}validation-error`,
        status: 400,
        errors: [
          {
            field: 'from',
            message:
              'from must not be after to (2026-09-24T00:00:00.000Z – 2026-09-23T00:00:00.000Z)',
          },
        ],
      }),
    );
  });

  it('claims nothing else', () => {
    expect(new MaintenanceExceptionMapper().canMap(new Error('other'))).toBe(
      false,
    );
  });
});
