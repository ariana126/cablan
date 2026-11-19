import {
  PmPlanImportCheck,
  PmPlanImportConflict,
  PmPlanImportDifference,
  PmPlanImportError,
  PmPlanImportErrorReason,
  PmPlanImportItem,
} from '@maintenance/domain/service/pm-plan-import-check';

/** The sentence a user reads for each reason, exactly as the contract pins it. */
const MESSAGES: Record<PmPlanImportErrorReason, string> = {
  'equipment-not-found': 'تجهیز تعریف نشده است',
  'activity-not-found': 'فعالیت تعریف نشده است',
  'equipment-retired': 'تجهیز کنار گذاشته شده است',
  'duplicate-equipment-in-file': 'تجهیز در فایل تکرار شده است',
  'duplicate-activity-in-file': 'فعالیت در فایل تکرار شده است',
  'first-due-date-required': 'اولین موعد خالی است',
  'invalid-jalali-date': 'تاریخ شمسی نامعتبر است',
  'interval-required': 'دوره خالی است',
  'interval-not-positive-integer': 'دوره باید عدد صحیح مثبت باشد',
  'invalid-mark': 'علامت نامعتبر است',
  'equipment-name-required': 'نام تجهیز خالی است',
  'activity-name-required': 'نام فعالیت خالی است',
};

export interface PmPlanImportErrorReadModel {
  readonly sheet: string;
  readonly cell: string;
  readonly row: number;
  readonly column: string;
  readonly value: string;
  readonly reason: PmPlanImportErrorReason;
  readonly message: string;
}

export interface PmPlanImportItemReadModel {
  readonly cell: string;
  readonly equipmentId: string;
  readonly equipmentName: string;
  readonly activityId: string;
  readonly activityName: string;
  readonly intervalDays: number;
  /** ISO `YYYY-MM-DD`, like every PM date. */
  readonly firstDueDate: string;
}

export interface PmPlanImportConflictReadModel extends PmPlanImportItemReadModel {
  readonly existingIntervalDays: number;
  readonly existingFirstDueDate: string;
  readonly differences: readonly PmPlanImportDifference[];
}

/**
 * What a PM plan file holds against the current state (issue #127): its
 * errors in file order, the items it adds, those already in force and those
 * differing from an active item. The preview and the confirmed import (what
 * was just added) share it.
 */
export class PmPlanImportPreview {
  private constructor(
    readonly sheetName: string,
    readonly counts: {
      readonly toCreate: number;
      readonly alreadyExisting: number;
      readonly conflicts: number;
      readonly errors: number;
    },
    readonly errors: readonly PmPlanImportErrorReadModel[],
    readonly toCreate: readonly PmPlanImportItemReadModel[],
    readonly alreadyExisting: readonly PmPlanImportItemReadModel[],
    readonly conflicts: readonly PmPlanImportConflictReadModel[],
  ) {}

  static of(sheetName: string, check: PmPlanImportCheck): PmPlanImportPreview {
    return new PmPlanImportPreview(
      sheetName,
      {
        toCreate: check.toCreate.length,
        alreadyExisting: check.alreadyExisting.length,
        conflicts: check.conflicts.length,
        errors: check.errors.length,
      },
      check.errors.map((error) => errorReadModel(sheetName, error)),
      check.toCreate.map((item) => itemReadModel(item)),
      check.alreadyExisting.map((item) => itemReadModel(item)),
      check.conflicts.map((conflict) => conflictReadModel(conflict)),
    );
  }
}

function errorReadModel(
  sheet: string,
  error: PmPlanImportError,
): PmPlanImportErrorReadModel {
  return {
    sheet,
    cell: error.cell,
    row: error.row,
    column: error.column,
    value: error.value,
    reason: error.reason,
    message: MESSAGES[error.reason],
  };
}

function itemReadModel(item: PmPlanImportItem): PmPlanImportItemReadModel {
  return {
    cell: item.cell,
    equipmentId: item.equipment.id.asString(),
    equipmentName: item.equipment.name().asString(),
    activityId: item.activity.id.asString(),
    activityName: item.activity.name().asString(),
    intervalDays: item.intervalDays.asNumber(),
    firstDueDate: item.firstDueDate.asString(),
  };
}

function conflictReadModel(
  conflict: PmPlanImportConflict,
): PmPlanImportConflictReadModel {
  return {
    ...itemReadModel(conflict),
    existingIntervalDays: conflict.existingIntervalDays.asNumber(),
    existingFirstDueDate: conflict.existingFirstDueDate.asString(),
    differences: [...conflict.differences],
  };
}
