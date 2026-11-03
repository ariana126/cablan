import { HttpErrorResponse } from '@angular/common/http';
import { FieldTree, ValidationError } from '@angular/forms/signals';

import { PROBLEM, toProblemDetails } from '../../core/http/problem-details';
import { recordHasDependentsMessage } from '../../core/http/record-has-dependents';
import { ActivitySpecialty } from '../../core/i18n/specialty-labels';

export interface MaintenanceActivityFormModel {
  readonly name: string;
  /** `''` until one is chosen — never `null` (signal forms). */
  readonly specialty: ActivitySpecialty | '';
}

export const ACTIVITY_NAME_REQUIRED = 'نام فعالیت را وارد کنید.';

/** The acceptance suite finds this error by the word «تخصص» in it. */
export const ACTIVITY_SPECIALTY_REQUIRED = 'تخصص فعالیت را انتخاب کنید.';

/**
 * What the add/edit form shows for a refusal. Branches on `type`, never `detail`; every message
 * is the client's own Persian (`core/http/problem-details.ts`).
 */
export function mapMaintenanceActivityFormError(
  error: unknown,
  form: FieldTree<MaintenanceActivityFormModel>,
): readonly ValidationError.WithOptionalFieldTree[] {
  if (error instanceof HttpErrorResponse && error.status === 403) {
    return [{ kind: 'server', message: 'شما اجازهٔ انجام این عملیات را ندارید.' }];
  }

  // Another record references this one (issue #94): say where, so the visitor knows why.
  const usedElsewhere = recordHasDependentsMessage(error, 'edit');
  if (usedElsewhere !== undefined) {
    return [{ kind: 'server', message: usedElsewhere }];
  }

  const problem = toProblemDetails(error);
  switch (problem?.type) {
    case undefined:
      return [
        { kind: 'server', message: 'خطایی در برقراری ارتباط با سرور رخ داد. دوباره تلاش کنید.' },
      ];
    case PROBLEM.validationError:
      return problem.errors?.some((each) => each.field === 'specialty')
        ? [{ fieldTree: form.specialty, kind: 'server', message: ACTIVITY_SPECIALTY_REQUIRED }]
        : [{ fieldTree: form.name, kind: 'server', message: ACTIVITY_NAME_REQUIRED }];
    case PROBLEM.maintenanceActivityNameTaken:
      return [
        {
          fieldTree: form.name,
          kind: 'server',
          message: 'فعالیتی با این نام قبلاً ثبت شده است.',
        },
      ];
    case PROBLEM.entityNotFound:
      return [{ kind: 'server', message: 'این فعالیت دیگر وجود ندارد. فهرست را تازه‌سازی کنید.' }];
    default:
      return [{ kind: 'server', message: 'خطایی غیرمنتظره رخ داد. دوباره تلاش کنید.' }];
  }
}
