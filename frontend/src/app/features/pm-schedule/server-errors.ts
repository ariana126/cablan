import { HttpErrorResponse } from '@angular/common/http';

import { PROBLEM, toProblemDetails } from '../../core/http/problem-details';

/**
 * What the record dialog's alert says when the API refuses a recording. Every refusal belongs to the
 * task, not to the notes, so each is one sentence for the dialog. Branches on `type`, never `detail`.
 */
export function mapRecordExecutionError(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 403) {
    return 'شما اجازهٔ ثبت انجام این کار را ندارید.';
  }

  switch (toProblemDetails(error)?.type) {
    case undefined:
      return 'خطایی در برقراری ارتباط با سرور رخ داد. دوباره تلاش کنید.';
    case PROBLEM.pmPlanItemRemoved:
      return 'این فعالیت از برنامهٔ تجهیز حذف شده است.';
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
