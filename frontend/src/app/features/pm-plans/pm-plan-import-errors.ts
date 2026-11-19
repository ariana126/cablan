import { HttpErrorResponse } from '@angular/common/http';

import { PROBLEM, toProblemDetails } from '../../core/http/problem-details';
import { AppPmPlanImportError } from '../../core/maintenance/pm-plan-import-gateway';

const ACCESS_DENIED = 'شما اجازهٔ انجام این عملیات را ندارید.';
const UNREADABLE = 'فایل اکسل خوانده نشد. فایل برنامه PM را با پسوند xlsx انتخاب کنید.';
const TOO_LARGE = 'حجم فایل اکسل بیشتر از ۵ مگابایت است.';
const HAS_ERRORS = 'فایل برنامه PM خطا دارد و هیچ برنامه‌ای ثبت نشد.';

/** Why the import was refused: the dialog's alert, and — for a file with errors — the errors the
 * server found this time, which replace the check's. */
export interface PmPlanImportRefusal {
  readonly message: string;
  readonly errors?: readonly AppPmPlanImportError[];
}

/** The refusals both requests share — by status (403, 413; the contract's 403 has no `type`), then
 * by `type`, never by `detail`. Every message is written here, in Persian. */
function commonRefusal(error: unknown): string | undefined {
  if (error instanceof HttpErrorResponse && error.status === 403) {
    return ACCESS_DENIED;
  }
  if (error instanceof HttpErrorResponse && error.status === 413) {
    return TOO_LARGE;
  }
  if (toProblemDetails(error)?.type === PROBLEM.pmPlanImportFileUnreadable) {
    return UNREADABLE;
  }
  return undefined;
}

/** Turns whatever `PmPlanImportGateway.preview` threw into the alert `/pm-plans` shows. */
export function mapPmPlanImportPreviewError(error: unknown): string {
  return commonRefusal(error) ?? 'بارگذاری فایل اکسل ممکن نشد. دوباره تلاش کنید.';
}

/** Turns whatever `PmPlanImportGateway.import` threw into what the import dialog shows. */
export function mapPmPlanImportError(error: unknown): PmPlanImportRefusal {
  const problem = toProblemDetails(error);
  if (problem?.type === PROBLEM.pmPlanImportHasErrors) {
    // The `errors` extension here is the preview's error shape, not a validation error's.
    const errors = (problem as { readonly errors?: unknown }).errors;
    return { message: HAS_ERRORS, errors: Array.isArray(errors) ? errors : [] };
  }
  return { message: commonRefusal(error) ?? 'ثبت برنامه‌ها ممکن نشد. دوباره تلاش کنید.' };
}
