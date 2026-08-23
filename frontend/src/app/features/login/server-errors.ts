import { FieldTree, ValidationError } from '@angular/forms/signals';

import { FieldProblem, PROBLEM, toProblemDetails } from '../../core/http/problem-details';

export interface LoginFormModel {
  readonly username: string;
  readonly password: string;
}

/**
 * Turns whatever `AuthGateway.login` threw into the errors `submit()` applies to the login form.
 *
 * Branches on `type`, never `detail` — see `core/http/problem-details.ts`. Every message here is
 * written client-side in Persian; none of it echoes anything the API sent, including the `errors[]`
 * entries' own `message`, which is untranslated validator text meant for logs, not a visitor.
 */
export function mapLoginError(
  error: unknown,
  form: FieldTree<LoginFormModel>,
): readonly ValidationError.WithOptionalFieldTree[] {
  const problem = toProblemDetails(error);

  if (problem === undefined) {
    return [rootError('ورود به سامانه ممکن نشد. اتصال خود را بررسی کنید و دوباره تلاش کنید.')];
  }

  if (problem.type === PROBLEM.invalidCredentials) {
    return [rootError('نام کاربری یا رمز عبور نادرست است.')];
  }

  if (problem.type === PROBLEM.validationError) {
    return (problem.errors ?? []).map((fieldError) => toFieldError(fieldError, form));
  }

  return [rootError('ورود به سامانه ممکن نشد. دوباره تلاش کنید.')];
}

function toFieldError(
  fieldError: FieldProblem,
  form: FieldTree<LoginFormModel>,
): ValidationError.WithOptionalFieldTree {
  switch (fieldError.field) {
    case 'username':
      return { fieldTree: form.username, kind: 'server', message: 'نام کاربری را وارد کنید.' };
    case 'password':
      return { fieldTree: form.password, kind: 'server', message: 'رمز عبور را وارد کنید.' };
    default:
      return rootError('ورود به سامانه ممکن نشد. دوباره تلاش کنید.');
  }
}

function rootError(message: string): ValidationError.WithOptionalFieldTree {
  return { kind: 'server', message };
}
