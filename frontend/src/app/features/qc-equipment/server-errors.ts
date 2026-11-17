import { HttpErrorResponse } from '@angular/common/http';
import { FieldTree, ValidationError } from '@angular/forms/signals';

import { PROBLEM, toProblemDetails } from '../../core/http/problem-details';

const FORBIDDEN = 'شما اجازهٔ انجام این عملیات را ندارید.';
const UNREACHABLE = 'خطایی در برقراری ارتباط با سرور رخ داد. دوباره تلاش کنید.';
const UNEXPECTED = 'خطایی غیرمنتظره رخ داد. دوباره تلاش کنید.';

/**
 * The sentence a QC folder's refusal reads as. Branches on `type`; for `equipment-retired` the API's
 * own Persian `detail` names the equipment («"اکسترودر 1" کنار گذاشته شده است.»), so it is shown as
 * sent, with the client's words as the fallback.
 */
export function qcFolderErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 403) {
    return FORBIDDEN;
  }
  const problem = toProblemDetails(error);
  switch (problem?.type) {
    case undefined:
      return UNREACHABLE;
    case PROBLEM.equipmentRetired:
      return problem.detail ?? 'این تجهیز کنار گذاشته شده است.';
    case PROBLEM.equipmentNotFound:
      return 'این تجهیز دیگر وجود ندارد.';
    case PROBLEM.qcActivityNotFound:
      return 'این فعالیت QC دیگر وجود ندارد.';
    case PROBLEM.qcActivityAlreadyAssigned:
      return 'این فعالیت QC قبلاً به این تجهیز تخصیص داده شده است.';
    case PROBLEM.qcActivityNotAssigned:
      return 'این فعالیت QC دیگر به این تجهیز تخصیص داده نشده است.';
    default:
      return UNEXPECTED;
  }
}

/** The add dialog's refusal: an activity assigned meanwhile sits on the picker, the rest are the
 * dialog's alert. */
export function mapAssignError(
  error: unknown,
  activityId: FieldTree<string>,
): readonly ValidationError.WithOptionalFieldTree[] {
  const message = qcFolderErrorMessage(error);
  return toProblemDetails(error)?.type === PROBLEM.qcActivityAlreadyAssigned
    ? [{ fieldTree: activityId, kind: 'server', message }]
    : [{ kind: 'server', message }];
}
