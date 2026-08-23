import { HttpErrorResponse } from '@angular/common/http';
import { FieldTree, ValidationError } from '@angular/forms/signals';

import { Role } from '../../api/model';
import { FieldProblem, PROBLEM, toProblemDetails } from '../../core/http/problem-details';

export interface UserFormModel {
  readonly name: string;
  readonly username: string;
  readonly password: string;
  readonly role: Role;
}

const GENERIC_MESSAGE = 'خطایی غیرمنتظره رخ داد. دوباره تلاش کنید.';

/**
 * Turns whatever the users gateway threw into the errors `submit()` applies to a create or edit
 * form. Branches on `type`, never `detail` — see `core/http/problem-details.ts`. Every message here
 * is written client-side in Persian; none of it echoes anything the API sent.
 */
export function mapUserFormError(
  error: unknown,
  form: FieldTree<UserFormModel>,
): readonly ValidationError.WithOptionalFieldTree[] {
  // Checked by status rather than by `type`, because the contract's 403 response carries no `type`
  // member at all — see the `/api/users` paths in api/openapi.json. Any 403 here means the caller's
  // permissions changed mid-session; the backend is what actually enforced it.
  if (error instanceof HttpErrorResponse && error.status === 403) {
    return [rootError('شما اجازهٔ انجام این عملیات را ندارید.')];
  }

  const problem = toProblemDetails(error);
  if (problem === undefined) {
    return [rootError('خطایی در برقراری ارتباط با سرور رخ داد. دوباره تلاش کنید.')];
  }

  if (problem.type === PROBLEM.validationError) {
    return (problem.errors ?? []).map((fieldError) => toFieldError(fieldError, form));
  }

  if (problem.type === PROBLEM.usernameAlreadyExists) {
    return [
      { fieldTree: form.username, kind: 'server', message: 'این نام کاربری قبلاً ثبت شده است.' },
    ];
  }

  if (problem.type === PROBLEM.cannotChangeOwnRole) {
    return [
      { fieldTree: form.role, kind: 'server', message: 'امکان تغییر نقش خودتان وجود ندارد.' },
    ];
  }

  if (problem.type === PROBLEM.entityNotFound) {
    return [rootError('این کاربر دیگر وجود ندارد. فهرست را تازه‌سازی کنید.')];
  }

  return [rootError(GENERIC_MESSAGE)];
}

const FIELD_MESSAGES: Readonly<Record<string, string>> = {
  name: 'نام نمی‌تواند خالی باشد.',
  username: 'نام کاربری نمی‌تواند خالی باشد.',
  password: 'رمز عبور نمی‌تواند خالی باشد.',
  role: 'نقش انتخاب‌شده معتبر نیست.',
};

function toFieldError(
  fieldError: FieldProblem,
  form: FieldTree<UserFormModel>,
): ValidationError.WithOptionalFieldTree {
  const message =
    (fieldError.field !== undefined ? FIELD_MESSAGES[fieldError.field] : undefined) ??
    GENERIC_MESSAGE;

  switch (fieldError.field) {
    case 'name':
      return { fieldTree: form.name, kind: 'server', message };
    case 'username':
      return { fieldTree: form.username, kind: 'server', message };
    case 'password':
      return { fieldTree: form.password, kind: 'server', message };
    case 'role':
      return { fieldTree: form.role, kind: 'server', message };
    default:
      return rootError(message);
  }
}

function rootError(message: string): ValidationError.WithOptionalFieldTree {
  return { kind: 'server', message };
}

/** Turns whatever `UsersGateway.delete` threw into the message the delete-confirmation dialog shows. */
export function mapDeleteError(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 403) {
    return 'شما اجازهٔ انجام این عملیات را ندارید.';
  }

  const problem = toProblemDetails(error);
  if (problem?.type === PROBLEM.entityNotFound) {
    return 'این کاربر پیش‌تر حذف شده است. فهرست را تازه‌سازی کنید.';
  }

  return 'حذف کاربر ممکن نشد. دوباره تلاش کنید.';
}
