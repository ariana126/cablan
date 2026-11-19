import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
import { mapPmPlanImportError, mapPmPlanImportPreviewError } from './pm-plan-import-errors';

const refusal = (status: number, body: unknown = null) =>
  new HttpErrorResponse({ status, statusText: 'Refused', error: body });

const ERROR = {
  sheet: 'pm',
  cell: 'D1',
  row: 1,
  column: 'D',
  value: 'روغن کاری',
  reason: 'activity-not-found',
  message: 'فعالیت تعریف نشده است',
};

const UNREADABLE = 'فایل اکسل خوانده نشد. فایل برنامه PM را با پسوند xlsx انتخاب کنید.';
const ACCESS_DENIED = 'شما اجازهٔ انجام این عملیات را ندارید.';

describe('mapPmPlanImportPreviewError', () => {
  it('says a role without the right is refused', () => {
    expect(mapPmPlanImportPreviewError(refusal(403))).toBe(ACCESS_DENIED);
  });

  it('says the file could not be read as a workbook', () => {
    expect(
      mapPmPlanImportPreviewError(
        refusal(400, { type: PROBLEM.pmPlanImportFileUnreadable, status: 400 }),
      ),
    ).toBe(UNREADABLE);
  });

  it('says a file over 5 MB is too large', () => {
    expect(mapPmPlanImportPreviewError(refusal(413))).toBe('حجم فایل اکسل بیشتر از ۵ مگابایت است.');
  });

  it('asks to try again otherwise', () => {
    expect(mapPmPlanImportPreviewError(refusal(0))).toBe(
      'بارگذاری فایل اکسل ممکن نشد. دوباره تلاش کنید.',
    );
  });
});

describe('mapPmPlanImportError', () => {
  it('hands back the errors the server found in the file, and says nothing was added', () => {
    expect(
      mapPmPlanImportError(
        refusal(400, { type: PROBLEM.pmPlanImportHasErrors, status: 400, errors: [ERROR] }),
      ),
    ).toEqual({
      message: 'فایل برنامه PM خطا دارد و هیچ برنامه‌ای ثبت نشد.',
      errors: [ERROR],
    });
  });

  it('says a role without the right is refused', () => {
    expect(mapPmPlanImportError(refusal(403))).toEqual({ message: ACCESS_DENIED });
  });

  it('says the file could not be read', () => {
    expect(
      mapPmPlanImportError(refusal(400, { type: PROBLEM.pmPlanImportFileUnreadable, status: 400 })),
    ).toEqual({ message: UNREADABLE });
  });

  it('asks to try again otherwise', () => {
    expect(mapPmPlanImportError(refusal(500, { type: 'about:blank', status: 500 }))).toEqual({
      message: 'ثبت برنامه‌ها ممکن نشد. دوباره تلاش کنید.',
    });
  });
});
