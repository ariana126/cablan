import { HttpErrorResponse } from '@angular/common/http';
import { FieldTree, ValidationError } from '@angular/forms/signals';

import { EDIT_REASON_REQUIRED } from '../../core/boms/bom-edit-history';
import { PROBLEM, toProblemDetails } from '../../core/http/problem-details';

export interface RejectionFormModel {
  readonly reason: string;
}

/** The reason field's one message, whether the form or the API found it blank. */
export const REASON_REQUIRED = 'دلیل عدم تایید را وارد کنید.';

/** What a refused review says when someone else got there first — approve and reject alike. */
export const ALREADY_REVIEWED =
  'این آنالیز روزانه پیش‌تر بررسی شده است؛ برای بررسی دوباره ابتدا آن را ویرایش کنید.';

function isForbidden(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 403;
}

/** Whether a review was refused because the daily BOM is no longer pending — someone else got
 * there first, so the card is stale and worth re-reading. */
export function isAlreadyReviewed(error: unknown): boolean {
  return toProblemDetails(error)?.type === PROBLEM.bomAlreadyReviewed;
}

/** Why an approval was refused, in words the visitor can act on. */
export function approvalFailure(error: unknown): string {
  if (isForbidden(error)) {
    return 'شما اجازهٔ تایید آنالیز روزانه را ندارید.';
  }
  if (isAlreadyReviewed(error)) {
    return ALREADY_REVIEWED;
  }
  return 'تایید آنالیز روزانه انجام نشد.';
}

/**
 * Turns whatever `BomsGateway.reject` threw into the errors `submit()` applies to the rejection
 * form: a blank reason on the field itself, everything else at the form root. Branches on `type`,
 * never `detail`; 403 by status, since the contract's 403 carries no `type`. `bom-already-reviewed`
 * never reaches here — the dialog closes on it (`isAlreadyReviewed`) so the card can re-read.
 */
export function mapRejectionError(
  error: unknown,
  form: FieldTree<RejectionFormModel>,
): readonly ValidationError.WithOptionalFieldTree[] {
  if (isForbidden(error)) {
    return [rootError('شما اجازهٔ عدم تایید آنالیز روزانه را ندارید.')];
  }
  const problem = toProblemDetails(error);
  if (problem?.type === PROBLEM.rejectionReasonRequired) {
    return [{ fieldTree: form.reason, kind: 'server', message: REASON_REQUIRED }];
  }
  return [rootError('عدم تایید آنالیز روزانه انجام نشد.')];
}

/** A dashboard edit's own form: just the reason, «دلیل ویرایش». */
export interface EditReasonFormModel {
  readonly editReason: string;
}

/**
 * Turns whatever a dashboard edit (`PATCH /boms/:id`, `editSource: 'dashboard'`) threw into the
 * errors `submit()` applies to its reason field: `edit-reason-required` on that field, everything
 * else at the form root. The reason is never required client-side — a save that changes nothing
 * needs none, and only the API can tell.
 */
export function mapDashboardEditError(
  error: unknown,
  form: FieldTree<EditReasonFormModel>,
): readonly ValidationError.WithOptionalFieldTree[] {
  if (isForbidden(error)) {
    return [rootError('شما اجازهٔ ویرایش آنالیز روزانه را ندارید.')];
  }
  const type = toProblemDetails(error)?.type;
  if (type === PROBLEM.editReasonRequired) {
    return [{ fieldTree: form.editReason, kind: 'server', message: EDIT_REASON_REQUIRED }];
  }
  // A weight edit re-sends the whole composition, checked against the standard BOM's *current*
  // one; a line the standard BOM has since dropped can no longer be saved from here.
  if (type === PROBLEM.bomCompositionEntryNotFound) {
    return [
      rootError(
        'این آنالیز روزانه اجزا یا مواد اولیه‌ای دارد که دیگر در آنالیز استاندارد نیست؛ ویرایش ممکن نیست.',
      ),
    ];
  }
  return [rootError('ویرایش آنالیز روزانه ذخیره نشد.')];
}

function rootError(message: string): ValidationError.WithOptionalFieldTree {
  return { kind: 'server', message };
}
