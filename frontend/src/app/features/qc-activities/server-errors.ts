import { HttpErrorResponse } from '@angular/common/http';
import { FieldTree, ValidationError } from '@angular/forms/signals';

import { PROBLEM, toProblemDetails } from '../../core/http/problem-details';
import { recordHasDependentsMessage } from '../../core/http/record-has-dependents';

export interface QcActivityFormModel {
  readonly name: string;
}

/** The Gherkin's word for it is «عنوان فعالیت»; so is the field's label. */
export const QC_ACTIVITY_NAME_REQUIRED = 'عنوان فعالیت را وارد کنید.';

/** The API's limit on a title (`QcActivityDto.name`); the field stops typing there. */
export const QC_ACTIVITY_NAME_MAX_LENGTH = 200;
export const QC_ACTIVITY_NAME_TOO_LONG = 'عنوان فعالیت حداکثر ۲۰۰ نویسه است.';

const FORBIDDEN = 'شما اجازهٔ انجام این عملیات را ندارید.';
const UNREACHABLE = 'خطایی در برقراری ارتباط با سرور رخ داد. دوباره تلاش کنید.';
const UNEXPECTED = 'خطایی غیرمنتظره رخ داد. دوباره تلاش کنید.';
const GONE = 'این فعالیت QC دیگر وجود ندارد. فهرست را تازه‌سازی کنید.';

/**
 * What the define/edit dialog shows for a refusal. Branches on `type`, never `detail`. A use
 * elsewhere (issue #94) is the dialog's alert, the dialog staying open; a taken or blank name sits
 * on the field.
 */
export function mapQcActivityFormError(
  error: unknown,
  form: FieldTree<QcActivityFormModel>,
): readonly ValidationError.WithOptionalFieldTree[] {
  if (error instanceof HttpErrorResponse && error.status === 403) {
    return [{ kind: 'server', message: FORBIDDEN }];
  }
  const usedElsewhere = recordHasDependentsMessage(error, 'edit');
  if (usedElsewhere !== undefined) {
    return [{ kind: 'server', message: usedElsewhere }];
  }
  const problem = toProblemDetails(error);
  switch (problem?.type) {
    case undefined:
      return [{ kind: 'server', message: UNREACHABLE }];
    case PROBLEM.validationError:
      // The API names the field, not the rule; the title sent tells a missing one from a long one.
      return [
        {
          fieldTree: form.name,
          kind: 'server',
          message:
            form.name().value().trim().length > QC_ACTIVITY_NAME_MAX_LENGTH
              ? QC_ACTIVITY_NAME_TOO_LONG
              : QC_ACTIVITY_NAME_REQUIRED,
        },
      ];
    case PROBLEM.qcActivityNameTaken:
      return [
        {
          fieldTree: form.name,
          kind: 'server',
          message: 'فعالیت QC با این عنوان قبلاً تعریف شده است.',
        },
      ];
    case PROBLEM.qcActivityNotFound:
      return [{ kind: 'server', message: GONE }];
    default:
      return [{ kind: 'server', message: UNEXPECTED }];
  }
}

/** The delete confirmation's alert for a refusal — the dependents sentence first (issue #94). */
export function mapQcActivityDeleteError(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 403) {
    return FORBIDDEN;
  }
  const usedElsewhere = recordHasDependentsMessage(error, 'delete');
  if (usedElsewhere !== undefined) {
    return usedElsewhere;
  }
  switch (toProblemDetails(error)?.type) {
    case undefined:
      return UNREACHABLE;
    case PROBLEM.qcActivityNotFound:
      return GONE;
    default:
      return UNEXPECTED;
  }
}
