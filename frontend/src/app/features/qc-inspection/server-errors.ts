import { HttpErrorResponse } from '@angular/common/http';
import { FieldTree, ValidationError } from '@angular/forms/signals';

import { PROBLEM, toProblemDetails } from '../../core/http/problem-details';

export interface QcRecordFormModel {
  readonly trackingNumber: string;
  readonly notes: string;
}

export const TRACKING_NUMBER_REQUIRED = 'شماره ردیابی را وارد کنید.';

/** The API's limits (`RecordQcExecutionDto`); the fields stop typing there. */
export const TRACKING_NUMBER_MAX_LENGTH = 100;
export const NOTES_MAX_LENGTH = 2000;
export const TRACKING_NUMBER_TOO_LONG = 'شماره ردیابی حداکثر ۱۰۰ نویسه است.';
export const NOTES_TOO_LONG = 'توضیحات حداکثر ۲۰۰۰ نویسه است.';

/**
 * What «ثبت انجام» shows for a refusal (issue #119). Branches on `type`. A retired equipment and an
 * activity no longer assigned are said in the API's own Persian `detail`, which names both
 * («"بازرسی ابعادی" به "اکسترودر 1" تخصیص داده نشده است.»), the client's words as the fallback.
 */
export function mapQcRecordError(
  error: unknown,
  form: FieldTree<QcRecordFormModel>,
): readonly ValidationError.WithOptionalFieldTree[] {
  if (error instanceof HttpErrorResponse && error.status === 403) {
    return [{ kind: 'server', message: 'شما اجازهٔ ثبت انجام فعالیت QC را ندارید.' }];
  }
  const problem = toProblemDetails(error);
  switch (problem?.type) {
    case undefined:
      return [
        { kind: 'server', message: 'خطایی در برقراری ارتباط با سرور رخ داد. دوباره تلاش کنید.' },
      ];
    case PROBLEM.validationError:
      if (problem.errors?.some((each) => each.field === 'notes')) {
        return [{ fieldTree: form.notes, kind: 'server', message: NOTES_TOO_LONG }];
      }
      // The API names the field, not the rule; the number sent tells a missing one from a long one.
      return [
        {
          fieldTree: form.trackingNumber,
          kind: 'server',
          message:
            form.trackingNumber().value().trim().length > TRACKING_NUMBER_MAX_LENGTH
              ? TRACKING_NUMBER_TOO_LONG
              : TRACKING_NUMBER_REQUIRED,
        },
      ];
    case PROBLEM.equipmentRetired:
      return [
        {
          kind: 'server',
          message: problem.detail ?? 'این تجهیز کنار گذاشته شده است؛ ثبت انجام ممکن نیست.',
        },
      ];
    case PROBLEM.qcActivityNotAssigned:
      return [
        {
          kind: 'server',
          message: problem.detail ?? 'این فعالیت QC دیگر به این تجهیز تخصیص داده نشده است.',
        },
      ];
    case PROBLEM.equipmentNotFound:
      return [{ kind: 'server', message: 'این تجهیز دیگر وجود ندارد.' }];
    case PROBLEM.qcActivityNotFound:
      return [{ kind: 'server', message: 'این فعالیت QC دیگر وجود ندارد.' }];
    default:
      return [{ kind: 'server', message: 'خطایی غیرمنتظره رخ داد. دوباره تلاش کنید.' }];
  }
}
