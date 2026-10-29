import { HttpErrorResponse } from '@angular/common/http';
import { FieldTree, SchemaPath, validate, ValidationError } from '@angular/forms/signals';

import { FieldProblem, PROBLEM, toProblemDetails } from '../../core/http/problem-details';

export const INTERVAL_REQUIRED = 'دوره را وارد کنید.';
export const INTERVAL_NOT_WHOLE_DAYS = 'دوره باید تعداد روزی بزرگ‌تر از صفر باشد.';

/**
 * The interval rule both plan dialogs share: a whole number of days, at least one. An emptied
 * number input reads back as `NaN`, which is "missing" rather than "wrong".
 */
export function wholeDays(path: SchemaPath<number>): void {
  validate(path, ({ value }) => {
    const days = value();
    if (Number.isNaN(days)) {
      return { kind: 'required', message: INTERVAL_REQUIRED };
    }
    return Number.isInteger(days) && days > 0
      ? undefined
      : { kind: 'wholeDays', message: INTERVAL_NOT_WHOLE_DAYS };
  });
}

/** The fields a plan-item refusal can point at — the add dialog has all three, the change one the
 * interval alone. */
export interface PlanItemFields {
  readonly activityId?: FieldTree<string>;
  readonly intervalDays: FieldTree<number>;
  readonly firstDueDate?: FieldTree<Date | null>;
}

const ACCESS_DENIED = 'شما اجازهٔ انجام این عملیات را ندارید.';

/**
 * What the add and change-interval dialogs show for a refusal. A refusal that belongs to no one
 * field — the activity already in the plan, the item or the equipment gone — is the dialog's alert.
 * Branches on `type`, never `detail`; every message is the client's own Persian.
 */
export function mapPlanItemFormError(
  error: unknown,
  fields: PlanItemFields,
): readonly ValidationError.WithOptionalFieldTree[] {
  if (error instanceof HttpErrorResponse && error.status === 403) {
    return [root(ACCESS_DENIED)];
  }

  const problem = toProblemDetails(error);
  switch (problem?.type) {
    case undefined:
      return [root('خطایی در برقراری ارتباط با سرور رخ داد. دوباره تلاش کنید.')];
    case PROBLEM.validationError:
      return (problem.errors ?? [{}]).map((fieldError) => toFieldError(fieldError, fields));
    case PROBLEM.activityAlreadyInPmPlan:
      return [root('این فعالیت قبلاً به برنامهٔ این تجهیز اضافه شده است.')];
    case PROBLEM.usageBasedIntervalNotSupported:
      return [root('برنامه فقط بر اساس روز قابل تعریف است.')];
    case PROBLEM.equipmentRetired:
      return [root('این تجهیز کنار گذاشته شده و برنامهٔ آن متوقف است.')];
    case PROBLEM.pmPlanItemRemoved:
      return [root('این فعالیت از برنامهٔ تجهیز حذف شده است.')];
    case PROBLEM.entityNotFound:
      return [root('تجهیز یا فعالیت دیگر وجود ندارد. صفحه را تازه‌سازی کنید.')];
    default:
      return [root('خطایی غیرمنتظره رخ داد. دوباره تلاش کنید.')];
  }
}

function toFieldError(
  fieldError: FieldProblem,
  fields: PlanItemFields,
): ValidationError.WithOptionalFieldTree {
  switch (fieldError.field) {
    case 'activityId':
      return fields.activityId
        ? { fieldTree: fields.activityId, kind: 'server', message: 'فعالیت را انتخاب کنید.' }
        : root('فعالیت را انتخاب کنید.');
    case 'intervalValue':
    case 'intervalDays':
      return { fieldTree: fields.intervalDays, kind: 'server', message: INTERVAL_NOT_WHOLE_DAYS };
    case 'firstDueDate':
      return fields.firstDueDate
        ? { fieldTree: fields.firstDueDate, kind: 'server', message: 'اولین موعد را انتخاب کنید.' }
        : root('اولین موعد را انتخاب کنید.');
    default:
      return root('خطایی غیرمنتظره رخ داد. دوباره تلاش کنید.');
  }
}

/** What the removal confirmation shows when the API refuses it. */
export function mapRemovePlanItemError(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 403) {
    return ACCESS_DENIED;
  }
  switch (toProblemDetails(error)?.type) {
    case PROBLEM.pmPlanItemRemoved:
      return 'این فعالیت پیش‌تر از برنامه حذف شده است.';
    case PROBLEM.equipmentRetired:
      return 'این تجهیز کنار گذاشته شده و برنامهٔ آن متوقف است.';
    case PROBLEM.entityNotFound:
      return 'این فعالیت دیگر در برنامه نیست. صفحه را تازه‌سازی کنید.';
    default:
      return 'حذف فعالیت از برنامه ممکن نشد. دوباره تلاش کنید.';
  }
}

function root(message: string): ValidationError.WithOptionalFieldTree {
  return { kind: 'server', message };
}
