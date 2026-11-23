import { HttpErrorResponse } from '@angular/common/http';

import { PROBLEM, toProblemDetails } from '../../core/http/problem-details';
import { QcActivityRefusal } from '../../core/qc/qc-inspections-gateway';

export const TRACKING_NUMBER_REQUIRED = 'شماره ردیابی را وارد کنید.';

/** The API's limits (`RecordQcExecutionsDto`); the fields stop typing there. */
export const TRACKING_NUMBER_MAX_LENGTH = 100;
export const NOTES_MAX_LENGTH = 2000;
export const TRACKING_NUMBER_TOO_LONG = 'شماره ردیابی حداکثر ۱۰۰ نویسه است.';

/**
 * Why a submission got no per-activity answer (issue #132):
 * - `unanswered` — no answer, or the server failed: something may have been recorded, so the same
 *   submission is offered again («ارسال دوباره»), which never records an activity twice;
 * - `invalid` — the API refused the tracking number: nothing recorded, the field says why;
 * - `refused` — the API refused the whole submission: nothing recorded, the alert says why.
 */
export type QcSubmissionFailure =
  | { readonly kind: 'unanswered'; readonly message: string; readonly detail: string }
  | { readonly kind: 'invalid'; readonly message: string }
  | { readonly kind: 'refused'; readonly message: string };

/** What was sent, for the words: the equipment named, the tracking number measured. */
export interface QcSubmissionContext {
  readonly equipmentName: string;
  readonly trackingNumber: string;
}

/** Branches on `type`, never on `detail`; 403 by status (the contract's 403 has no `type`). */
export function qcSubmissionFailureOf(
  error: unknown,
  { equipmentName, trackingNumber }: QcSubmissionContext,
): QcSubmissionFailure {
  if (!(error instanceof HttpErrorResponse) || error.status === 0 || error.status >= 500) {
    return {
      kind: 'unanswered',
      message: 'پاسخ ثبت از سرور نرسید.',
      detail: 'با «ارسال دوباره» همین ثبت دوباره فرستاده می‌شود و هیچ فعالیتی دو بار ثبت نمی‌شود.',
    };
  }
  if (error.status === 403) {
    return { kind: 'refused', message: 'شما اجازهٔ ثبت انجام فعالیت QC را ندارید.' };
  }
  const problem = toProblemDetails(error);
  switch (problem?.type) {
    case PROBLEM.validationError:
      if (problem.errors?.some((each) => each.field === 'trackingNumber')) {
        // The API names the field, not the rule; the number sent tells a missing one from a long one.
        return {
          kind: 'invalid',
          message:
            trackingNumber.trim().length > TRACKING_NUMBER_MAX_LENGTH
              ? TRACKING_NUMBER_TOO_LONG
              : TRACKING_NUMBER_REQUIRED,
        };
      }
      return {
        kind: 'refused',
        message: 'ثبت پذیرفته نشد؛ فعالیت‌های انتخاب‌شده یا توضیحات آن‌ها را بررسی کنید.',
      };
    case PROBLEM.equipmentRetired:
      return {
        kind: 'refused',
        message: `«${equipmentName}» کنار گذاشته شده است؛ ثبت انجام ممکن نیست.`,
      };
    case PROBLEM.qcSubmissionMismatch:
      return {
        kind: 'refused',
        message: 'این ثبت پیش از این برای تجهیز، بازرس یا شماره ردیابی دیگری فرستاده شده است.',
      };
    case PROBLEM.equipmentNotFound:
      return { kind: 'refused', message: 'این تجهیز دیگر وجود ندارد.' };
    default:
      return { kind: 'refused', message: 'خطایی غیرمنتظره رخ داد. دوباره تلاش کنید.' };
  }
}

/** Why one activity of a submission was refused, in the inspector's words. */
export function qcRefusalReason(
  refusal: QcActivityRefusal,
  activityName: string,
  equipmentName: string,
): string {
  switch (refusal) {
    case 'qc-activity-not-assigned':
      return `"${activityName}" به "${equipmentName}" تخصیص داده نشده است.`;
    case 'qc-activity-not-found':
      return 'این فعالیت QC دیگر وجود ندارد.';
    default:
      return 'ثبت این فعالیت پذیرفته نشد.';
  }
}
