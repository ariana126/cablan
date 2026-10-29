import { HttpErrorResponse } from '@angular/common/http';
import { FieldTree, ValidationError } from '@angular/forms/signals';

import { PROBLEM, toProblemDetails } from '../../core/http/problem-details';

export interface EquipmentFormModel {
  readonly name: string;
}

const ACCESS_DENIED = 'شما اجازهٔ انجام این عملیات را ندارید.';
const UNREACHABLE = 'خطایی در برقراری ارتباط با سرور رخ داد. دوباره تلاش کنید.';
const GENERIC = 'خطایی غیرمنتظره رخ داد. دوباره تلاش کنید.';

export const EQUIPMENT_NAME_REQUIRED = 'نام تجهیز را وارد کنید.';

/**
 * What the add/rename form shows for a refusal. Branches on `type`, never `detail`; every message
 * is the client's own Persian (`core/http/problem-details.ts`).
 */
export function mapEquipmentFormError(
  error: unknown,
  form: FieldTree<EquipmentFormModel>,
): readonly ValidationError.WithOptionalFieldTree[] {
  if (error instanceof HttpErrorResponse && error.status === 403) {
    return [{ kind: 'server', message: ACCESS_DENIED }];
  }

  const problem = toProblemDetails(error);
  switch (problem?.type) {
    case undefined:
      return [{ kind: 'server', message: UNREACHABLE }];
    case PROBLEM.validationError:
      return [{ fieldTree: form.name, kind: 'server', message: EQUIPMENT_NAME_REQUIRED }];
    case PROBLEM.equipmentNameTaken:
      return [
        {
          fieldTree: form.name,
          kind: 'server',
          message: 'تجهیزی با این نام قبلاً ثبت شده است.',
        },
      ];
    case PROBLEM.equipmentRetired:
      return [{ kind: 'server', message: 'این تجهیز کنار گذاشته شده و قابل ویرایش نیست.' }];
    case PROBLEM.entityNotFound:
      return [{ kind: 'server', message: 'این تجهیز دیگر وجود ندارد. فهرست را تازه‌سازی کنید.' }];
    default:
      return [{ kind: 'server', message: GENERIC }];
  }
}

/** What the retirement confirmation shows when the API refuses it. */
export function mapRetireError(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 403) {
    return ACCESS_DENIED;
  }
  switch (toProblemDetails(error)?.type) {
    case PROBLEM.equipmentRetired:
      return 'این تجهیز پیش‌تر کنار گذاشته شده است.';
    case PROBLEM.entityNotFound:
      return 'این تجهیز دیگر وجود ندارد. فهرست را تازه‌سازی کنید.';
    default:
      return 'کنار گذاشتن تجهیز ممکن نشد. دوباره تلاش کنید.';
  }
}
