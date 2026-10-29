import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
import { mapRevertError } from './server-errors';

function problemResponse(status: number, body: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body, url: '/api/materials/imports/1/reversion' });
}

describe('mapRevertError', () => {
  it.each([
    [PROBLEM.materialImportNotLatest, 'فقط آخرین بارگذاری گروهی قابل برگرداندن است'],
    [
      PROBLEM.materialImportNotRevertible,
      'این بارگذاری گروهی قابل برگرداندن نیست، چون مواد اولیه آن پس از بارگذاری تغییر کرده یا استفاده شده اند',
    ],
    [PROBLEM.materialImportAlreadyReverted, 'این بارگذاری گروهی قبلا برگردانده شده است'],
  ])('words the refusal %s in Persian', (type, message) => {
    expect(mapRevertError(problemResponse(409, { type, status: 409 }))).toBe(message);
  });

  it('reports a 403 as access denied', () => {
    expect(mapRevertError(problemResponse(403, null))).toBe(
      'شما اجازهٔ انجام این عملیات را ندارید.',
    );
  });

  it('says the import no longer exists on a 404', () => {
    expect(
      mapRevertError(problemResponse(404, { type: PROBLEM.materialImportNotFound, status: 404 })),
    ).toBe('این بارگذاری گروهی یافت نشد.');
  });

  it('falls back to a generic message for anything else', () => {
    expect(mapRevertError(new Error('boom'))).toBe(
      'برگرداندن بارگذاری گروهی ممکن نشد. دوباره تلاش کنید.',
    );
  });
});
