import { HttpErrorResponse } from '@angular/common/http';
import { FieldTree, ValidationError } from '@angular/forms/signals';

import { FieldProblem, PROBLEM, toProblemDetails } from '../../core/http/problem-details';
import { recordHasDependentsMessage } from '../../core/http/record-has-dependents';

/** «تعریف سفارش» and «ویرایش»: the number and the MI codes assigned to it, in assignment order. */
export interface OrderFormModel {
  readonly orderNumber: string;
  readonly miCodes: string[];
}

/** «افزودن کد MI»: the one code to add. */
export interface AddMiCodeFormModel {
  readonly miCode: string;
}

const ACCESS_DENIED = 'شما اجازهٔ انجام این عملیات را ندارید.';
const UNREACHABLE = 'خطایی در برقراری ارتباط با سرور رخ داد. دوباره تلاش کنید.';
const GENERIC_MESSAGE = 'خطایی غیرمنتظره رخ داد. دوباره تلاش کنید.';
const ORDER_GONE = 'این سفارش دیگر وجود ندارد. فهرست را تازه‌سازی کنید.';

export const ORDER_NUMBER_REQUIRED = 'شماره سفارش را وارد کنید.';
export const MI_CODES_REQUIRED = 'دست کم یک کد MI انتخاب کنید.';
export const MI_CODE_REQUIRED = 'کد MI را انتخاب کنید.';
/** «کد MI» holds text that names none of the codes it offers. */
export const MI_CODE_NOT_OFFERED = 'کد MI را از فهرست انتخاب کنید.';

/**
 * Turns whatever the orders gateway threw into the errors `submit()` applies to the define or edit
 * form. Branches on `type`, never `detail`; every message is written here, in Persian.
 */
export function mapOrderFormError(
  error: unknown,
  form: FieldTree<OrderFormModel>,
): readonly ValidationError.WithOptionalFieldTree[] {
  if (error instanceof HttpErrorResponse && error.status === 403) {
    return [rootError(ACCESS_DENIED)];
  }

  const problem = toProblemDetails(error);
  if (problem === undefined) {
    return [rootError(UNREACHABLE)];
  }

  // The order has daily BOMs (issue #94): say where, so the visitor knows why.
  const usedElsewhere = recordHasDependentsMessage(error, 'edit');
  if (usedElsewhere !== undefined) {
    return [rootError(usedElsewhere)];
  }

  switch (problem.type) {
    case PROBLEM.validationError:
      return (problem.errors ?? []).map((fieldError) => toOrderFieldError(fieldError, form));
    case PROBLEM.orderNumberTaken:
      return [
        {
          fieldTree: form.orderNumber,
          kind: 'server',
          message: 'این شماره سفارش قبلاً برای سفارش دیگری ثبت شده است.',
        },
      ];
    case PROBLEM.orderMiCodeNotFound:
      return [
        {
          fieldTree: form.miCodes,
          kind: 'server',
          message: 'یکی از کدهای MI انتخاب‌شده دیگر تعریف نشده است. فهرست را تازه‌سازی کنید.',
        },
      ];
    case PROBLEM.orderMiCodeAlreadyAssigned:
      return [
        {
          fieldTree: form.miCodes,
          kind: 'server',
          message: 'هر کد MI فقط یک بار به سفارش تخصیص داده می‌شود.',
        },
      ];
    case PROBLEM.entityNotFound:
      return [rootError(ORDER_GONE)];
    default:
      return [rootError(GENERIC_MESSAGE)];
  }
}

function toOrderFieldError(
  fieldError: FieldProblem,
  form: FieldTree<OrderFormModel>,
): ValidationError.WithOptionalFieldTree {
  switch (fieldError.field) {
    case 'orderNumber':
      return { fieldTree: form.orderNumber, kind: 'server', message: ORDER_NUMBER_REQUIRED };
    case 'miCodes':
      return { fieldTree: form.miCodes, kind: 'server', message: MI_CODES_REQUIRED };
    default:
      return rootError(GENERIC_MESSAGE);
  }
}

/** Turns whatever `OrdersGateway.addMiCode` threw into the errors of the «افزودن کد MI» form. */
export function mapAddMiCodeError(
  error: unknown,
  form: FieldTree<AddMiCodeFormModel>,
): readonly ValidationError.WithOptionalFieldTree[] {
  if (error instanceof HttpErrorResponse && error.status === 403) {
    return [rootError(ACCESS_DENIED)];
  }

  const problem = toProblemDetails(error);
  switch (problem?.type) {
    case undefined:
      return [rootError(UNREACHABLE)];
    case PROBLEM.validationError:
      return [{ fieldTree: form.miCode, kind: 'server', message: MI_CODE_REQUIRED }];
    case PROBLEM.orderMiCodeAlreadyAssigned:
      return [
        {
          fieldTree: form.miCode,
          kind: 'server',
          message: 'این کد MI قبلاً به این سفارش تخصیص داده شده است.',
        },
      ];
    case PROBLEM.orderMiCodeNotFound:
      return [
        {
          fieldTree: form.miCode,
          kind: 'server',
          message: 'این کد MI دیگر تعریف نشده است. فهرست را تازه‌سازی کنید.',
        },
      ];
    case PROBLEM.entityNotFound:
      return [rootError(ORDER_GONE)];
    default:
      return [rootError(GENERIC_MESSAGE)];
  }
}

/** Turns whatever `OrdersGateway.delete` threw into the message the confirmation shows. */
export function mapDeleteOrderError(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 403) {
    return ACCESS_DENIED;
  }

  const usedElsewhere = recordHasDependentsMessage(error, 'delete');
  if (usedElsewhere !== undefined) {
    return usedElsewhere;
  }

  if (toProblemDetails(error)?.type === PROBLEM.entityNotFound) {
    return 'این سفارش پیش‌تر حذف شده است. فهرست را تازه‌سازی کنید.';
  }

  return 'حذف سفارش ممکن نشد. دوباره تلاش کنید.';
}

function rootError(message: string): ValidationError.WithOptionalFieldTree {
  return { kind: 'server', message };
}
