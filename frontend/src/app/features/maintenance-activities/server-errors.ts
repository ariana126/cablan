import { HttpErrorResponse } from '@angular/common/http';
import { FieldTree, ValidationError } from '@angular/forms/signals';

import { PROBLEM, toProblemDetails } from '../../core/http/problem-details';

export interface MaintenanceActivityFormModel {
  readonly name: string;
}

export const ACTIVITY_NAME_REQUIRED = 'نام فعالیت را وارد کنید.';

/**
 * What the add/rename form shows for a refusal. Branches on `type`, never `detail`; every message
 * is the client's own Persian (`core/http/problem-details.ts`).
 */
export function mapMaintenanceActivityFormError(
  error: unknown,
  form: FieldTree<MaintenanceActivityFormModel>,
): readonly ValidationError.WithOptionalFieldTree[] {
  if (error instanceof HttpErrorResponse && error.status === 403) {
    return [{ kind: 'server', message: 'شما اجازهٔ انجام این عملیات را ندارید.' }];
  }

  const problem = toProblemDetails(error);
  switch (problem?.type) {
    case undefined:
      return [
        { kind: 'server', message: 'خطایی در برقراری ارتباط با سرور رخ داد. دوباره تلاش کنید.' },
      ];
    case PROBLEM.validationError:
      return [{ fieldTree: form.name, kind: 'server', message: ACTIVITY_NAME_REQUIRED }];
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
