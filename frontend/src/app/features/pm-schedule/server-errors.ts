import { HttpErrorResponse } from '@angular/common/http';
import { FieldTree, ValidationError } from '@angular/forms/signals';

import { PROBLEM, toProblemDetails } from '../../core/http/problem-details';
import { OPERATING_HOURS_MALFORMED } from './operating-hours';

export interface RecordExecutionFormModel {
  readonly notes: string;
  /** As typed; `''` when none is given. */
  readonly operatingHours: string;
}

/**
 * What the record dialog shows when the API refuses a recording: a refused `operatingHours`
 * (`validation-error` naming it) on that field, anything else — which belongs to the task — as the
 * dialog's alert. Branches on `type`, never `detail`.
 */
export function mapRecordExecutionFormError(
  error: unknown,
  form: FieldTree<RecordExecutionFormModel>,
): readonly ValidationError.WithOptionalFieldTree[] {
  const problem = toProblemDetails(error);
  if (
    problem?.type === PROBLEM.validationError &&
    problem.errors?.some((each) => each.field === 'operatingHours')
  ) {
    return [{ fieldTree: form.operatingHours, kind: 'server', message: OPERATING_HOURS_MALFORMED }];
  }
  return [{ kind: 'server', message: mapRecordExecutionError(error) }];
}

/**
 * What the record dialog's alert says when the API refuses the recording itself — each refusal is
 * one sentence for the dialog. Branches on `type`, never `detail`.
 */
export function mapRecordExecutionError(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 403) {
    return 'شما اجازهٔ ثبت انجام این کار را ندارید.';
  }

  switch (toProblemDetails(error)?.type) {
    case undefined:
      return 'خطایی در برقراری ارتباط با سرور رخ داد. دوباره تلاش کنید.';
    case PROBLEM.pmPlanItemDeactivated:
      return 'این فعالیت در برنامهٔ تجهیز غیرفعال شده است.';
    case PROBLEM.equipmentRetired:
      return 'این تجهیز کنار گذاشته شده است.';
    case PROBLEM.pmOccurrenceAlreadyRecorded:
      return 'انجام این موعد پیش‌تر ثبت شده است. فهرست را تازه‌سازی کنید.';
    case PROBLEM.entityNotFound:
      return 'این کار دیگر در برنامه نیست. فهرست را تازه‌سازی کنید.';
    default:
      return 'ثبت انجام ممکن نشد. دوباره تلاش کنید.';
  }
}
