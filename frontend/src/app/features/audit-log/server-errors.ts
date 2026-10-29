import { HttpErrorResponse } from '@angular/common/http';

import { PROBLEM, toProblemDetails } from '../../core/http/problem-details';

/** Each refusal of a reversion, in the words `viewing-audit-log.feature`'s rules use. */
const REVERT_REFUSALS: Readonly<Record<string, string>> = {
  [PROBLEM.materialImportNotLatest]: 'فقط آخرین بارگذاری گروهی قابل برگرداندن است',
  [PROBLEM.materialImportNotRevertible]:
    'این بارگذاری گروهی قابل برگرداندن نیست، چون مواد اولیه آن پس از بارگذاری تغییر کرده یا استفاده شده اند',
  [PROBLEM.materialImportAlreadyReverted]: 'این بارگذاری گروهی قبلا برگردانده شده است',
  [PROBLEM.materialImportNotFound]: 'این بارگذاری گروهی یافت نشد.',
};

/**
 * Turns whatever `MaterialImportGateway.revert` threw into the alert the details dialog shows.
 * Branches on `type`, never `detail`; a 403 by status, since the contract's 403 has no `type` — the
 * dialog only offers «برگرداندن» to the System Admin, so it means the role changed mid-session.
 */
export function mapRevertError(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 403) {
    return 'شما اجازهٔ انجام این عملیات را ندارید.';
  }
  const type = toProblemDetails(error)?.type;
  return (
    (type !== undefined ? REVERT_REFUSALS[type] : undefined) ??
    'برگرداندن بارگذاری گروهی ممکن نشد. دوباره تلاش کنید.'
  );
}
