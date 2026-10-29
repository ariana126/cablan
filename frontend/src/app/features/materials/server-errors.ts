import { HttpErrorResponse } from '@angular/common/http';
import { FieldTree, ValidationError } from '@angular/forms/signals';

import { FieldProblem, PROBLEM, toProblemDetails } from '../../core/http/problem-details';

export interface MaterialFormModel {
  readonly name: string;
  readonly code: string;
}

const GENERIC_MESSAGE = 'خطایی غیرمنتظره رخ داد. دوباره تلاش کنید.';

/**
 * Turns whatever the materials gateway threw into the errors `submit()` applies to a create or
 * edit form. Branches on `type`, never `detail` — see `core/http/problem-details.ts`. Every message
 * here is written client-side in Persian; none of it echoes anything the API sent.
 */
export function mapMaterialFormError(
  error: unknown,
  form: FieldTree<MaterialFormModel>,
): readonly ValidationError.WithOptionalFieldTree[] {
  // Checked by status rather than by `type`, because the contract's 403 response carries no `type`
  // member at all. Any 403 here means the caller's permissions changed mid-session; the backend is
  // what actually enforced it.
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

  if (problem.type === PROBLEM.materialNameAlreadyExists) {
    return [
      {
        fieldTree: form.name,
        kind: 'server',
        message: 'این نام قبلاً برای مادهٔ اولیهٔ دیگری ثبت شده است.',
      },
    ];
  }

  if (problem.type === PROBLEM.materialCodeAlreadyExists) {
    return [
      {
        fieldTree: form.code,
        kind: 'server',
        message: 'این کد قبلاً برای مادهٔ اولیهٔ دیگری ثبت شده است.',
      },
    ];
  }

  if (problem.type === PROBLEM.entityNotFound) {
    return [rootError('این ماده اولیه دیگر وجود ندارد. فهرست را تازه‌سازی کنید.')];
  }

  return [rootError(GENERIC_MESSAGE)];
}

const FIELD_MESSAGES: Readonly<Record<string, string>> = {
  name: 'نام نمی‌تواند خالی باشد.',
  code: 'کد نمی‌تواند خالی باشد.',
};

function toFieldError(
  fieldError: FieldProblem,
  form: FieldTree<MaterialFormModel>,
): ValidationError.WithOptionalFieldTree {
  const message =
    (fieldError.field !== undefined ? FIELD_MESSAGES[fieldError.field] : undefined) ??
    GENERIC_MESSAGE;

  switch (fieldError.field) {
    case 'name':
      return { fieldTree: form.name, kind: 'server', message };
    case 'code':
      return { fieldTree: form.code, kind: 'server', message };
    default:
      return rootError(message);
  }
}

function rootError(message: string): ValidationError.WithOptionalFieldTree {
  return { kind: 'server', message };
}

const ACCESS_DENIED = 'شما اجازهٔ انجام این عملیات را ندارید.';

/** Turns whatever `MaterialImportGateway.preview` threw into the alert the page shows. */
export function mapImportPreviewError(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 403) {
    return ACCESS_DENIED;
  }
  if (toProblemDetails(error)?.type === PROBLEM.materialImportFileUnreadable) {
    return 'فایل اکسل خوانده نشد. فایل خروجی نرم‌افزار حسابداری را که ستون‌های «کد کالا» و «نام کالا» دارد انتخاب کنید.';
  }
  return 'بارگذاری فایل اکسل ممکن نشد. دوباره تلاش کنید.';
}

/** One refused row of a confirm: its spreadsheet row number and its error codes. */
export interface InvalidImportRow {
  readonly row: number;
  readonly errors: readonly string[];
}

/** Why a confirm was refused: the alert the dialog shows, and the rows to mark (none, mostly). */
export interface ImportConfirmRefusal {
  readonly message: string;
  readonly invalidRows: readonly InvalidImportRow[];
}

/** Turns whatever `MaterialImportGateway.confirm` threw into what the change-list dialog shows. */
export function mapImportConfirmError(error: unknown): ImportConfirmRefusal {
  if (error instanceof HttpErrorResponse && error.status === 403) {
    return { message: ACCESS_DENIED, invalidRows: [] };
  }

  const problem = toProblemDetails(error);
  if (problem?.type === PROBLEM.materialImportHasInvalidRows) {
    return {
      message:
        'تغییرات اعمال نشد، چون برخی ردیف‌ها خطا دارند. ردیف‌های خطادار را حذف کنید و دوباره تایید کنید.',
      invalidRows: (problem.rows ?? []).map((row) => ({
        row: row.row ?? 0,
        errors: row.errors ?? [],
      })),
    };
  }
  if (problem?.type === PROBLEM.materialImportEmpty) {
    return { message: 'تغییری برای اعمال وجود ندارد.', invalidRows: [] };
  }
  return { message: 'اعمال تغییرات ممکن نشد. دوباره تلاش کنید.', invalidRows: [] };
}

/** Turns whatever `MaterialsGateway.delete` threw into the message the delete-confirmation dialog shows. */
export function mapDeleteError(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 403) {
    return 'شما اجازهٔ انجام این عملیات را ندارید.';
  }

  const problem = toProblemDetails(error);
  if (problem?.type === PROBLEM.entityNotFound) {
    return 'این ماده اولیه پیش‌تر حذف شده است. فهرست را تازه‌سازی کنید.';
  }

  return 'حذف مادهٔ اولیه ممکن نشد. دوباره تلاش کنید.';
}
