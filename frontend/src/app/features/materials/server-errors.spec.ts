import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { describe, expect, it } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
import {
  mapDeleteError,
  mapImportConfirmError,
  mapImportPreviewError,
  mapMaterialFormError,
  MaterialFormModel,
} from './server-errors';

function problemResponse(status: number, body: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body, url: '/api/materials' });
}

function materialForm() {
  return TestBed.runInInjectionContext(() =>
    form(signal<MaterialFormModel>({ name: '', code: '' })),
  );
}

describe('mapMaterialFormError', () => {
  it('attaches each validation-error entry to its matching field', () => {
    const formTree = materialForm();

    const errors = mapMaterialFormError(
      problemResponse(400, {
        type: PROBLEM.validationError,
        errors: [{ field: 'name', message: 'name should not be empty' }],
      }),
      formTree,
    );

    expect(errors).toEqual([
      { fieldTree: formTree.name, kind: 'server', message: 'نام نمی‌تواند خالی باشد.' },
    ]);
  });

  it('attaches a validation error on the code to the code field', () => {
    const formTree = materialForm();

    const errors = mapMaterialFormError(
      problemResponse(400, {
        type: PROBLEM.validationError,
        errors: [{ field: 'code', message: 'code should not be empty' }],
      }),
      formTree,
    );

    expect(errors).toEqual([
      { fieldTree: formTree.code, kind: 'server', message: 'کد نمی‌تواند خالی باشد.' },
    ]);
  });

  it('puts a material-code-already-exists error on the code field', () => {
    const formTree = materialForm();

    const errors = mapMaterialFormError(
      problemResponse(409, {
        type: 'https://my-api-doc.dev/problems/material-code-already-exists',
        code: 'RM-001',
      }),
      formTree,
    );

    expect(errors).toEqual([
      {
        fieldTree: formTree.code,
        kind: 'server',
        message: 'این کد قبلاً برای مادهٔ اولیهٔ دیگری ثبت شده است.',
      },
    ]);
  });

  it('puts a material-name-already-exists error on the name field', () => {
    const formTree = materialForm();

    const errors = mapMaterialFormError(
      problemResponse(409, { type: PROBLEM.materialNameAlreadyExists }),
      formTree,
    );

    expect(errors).toEqual([
      {
        fieldTree: formTree.name,
        kind: 'server',
        message: 'این نام قبلاً برای مادهٔ اولیهٔ دیگری ثبت شده است.',
      },
    ]);
  });

  it('reports a since-deleted material on the form root', () => {
    const formTree = materialForm();

    const errors = mapMaterialFormError(
      problemResponse(404, { type: PROBLEM.entityNotFound }),
      formTree,
    );

    expect(errors).toEqual([
      { kind: 'server', message: 'این ماده اولیه دیگر وجود ندارد. فهرست را تازه‌سازی کنید.' },
    ]);
  });

  it('reports a 403 as an access-denied message on the form root, whatever the body carries', () => {
    const formTree = materialForm();

    const errors = mapMaterialFormError(problemResponse(403, { title: 'Forbidden' }), formTree);

    expect(errors).toEqual([{ kind: 'server', message: 'شما اجازهٔ انجام این عملیات را ندارید.' }]);
  });

  it('falls back to a root message for a network failure or anything unrecognised', () => {
    const formTree = materialForm();

    const errors = mapMaterialFormError(
      new HttpErrorResponse({
        status: 0,
        error: new ProgressEvent('error'),
        url: '/api/materials',
      }),
      formTree,
    );

    expect(errors).toEqual([
      { kind: 'server', message: 'خطایی در برقراری ارتباط با سرور رخ داد. دوباره تلاش کنید.' },
    ]);
  });
});

describe('mapDeleteError', () => {
  it('reports an access-denied message for a 403, regardless of body', () => {
    expect(mapDeleteError(problemResponse(403, { title: 'Forbidden' }))).toBe(
      'شما اجازهٔ انجام این عملیات را ندارید.',
    );
  });

  it('reports an already-deleted message for a 404', () => {
    expect(mapDeleteError(problemResponse(404, { type: PROBLEM.entityNotFound }))).toBe(
      'این ماده اولیه پیش‌تر حذف شده است. فهرست را تازه‌سازی کنید.',
    );
  });

  it('falls back to a generic message for anything else', () => {
    expect(
      mapDeleteError(
        new HttpErrorResponse({
          status: 0,
          error: new ProgressEvent('error'),
          url: '/api/materials/1',
        }),
      ),
    ).toBe('حذف مادهٔ اولیه ممکن نشد. دوباره تلاش کنید.');
  });
});

describe('mapImportPreviewError', () => {
  it('reports a 403 as access denied', () => {
    expect(mapImportPreviewError(problemResponse(403, null))).toBe(
      'شما اجازهٔ انجام این عملیات را ندارید.',
    );
  });

  it('says the file could not be read when it is not the accounting export', () => {
    expect(
      mapImportPreviewError(
        problemResponse(400, { type: PROBLEM.materialImportFileUnreadable, status: 400 }),
      ),
    ).toBe(
      'فایل اکسل خوانده نشد. فایل خروجی نرم‌افزار حسابداری را که ستون‌های «کد کالا» و «نام کالا» دارد انتخاب کنید.',
    );
  });

  it('falls back to a generic message for anything else', () => {
    expect(mapImportPreviewError(new Error('boom'))).toBe(
      'بارگذاری فایل اکسل ممکن نشد. دوباره تلاش کنید.',
    );
  });
});

describe('mapImportConfirmError', () => {
  it('lists the refused rows with their errors when some kept rows are invalid', () => {
    const refusal = mapImportConfirmError(
      problemResponse(400, {
        type: PROBLEM.materialImportHasInvalidRows,
        status: 400,
        rows: [{ row: 4, name: 'مسی', code: 'B-1', errors: ['code-taken'] }],
      }),
    );

    expect(refusal).toEqual({
      message:
        'تغییرات اعمال نشد، چون برخی ردیف‌ها خطا دارند. ردیف‌های خطادار را حذف کنید و دوباره تایید کنید.',
      invalidRows: [{ row: 4, errors: ['code-taken'] }],
    });
  });

  it('says there is nothing to apply when no kept row changes anything', () => {
    expect(
      mapImportConfirmError(problemResponse(400, { type: PROBLEM.materialImportEmpty })),
    ).toEqual({ message: 'تغییری برای اعمال وجود ندارد.', invalidRows: [] });
  });

  it('reports a 403 as access denied', () => {
    expect(mapImportConfirmError(problemResponse(403, null))).toEqual({
      message: 'شما اجازهٔ انجام این عملیات را ندارید.',
      invalidRows: [],
    });
  });

  it('falls back to a generic message for anything else', () => {
    expect(mapImportConfirmError(new Error('boom'))).toEqual({
      message: 'اعمال تغییرات ممکن نشد. دوباره تلاش کنید.',
      invalidRows: [],
    });
  });
});
