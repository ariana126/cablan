import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { describe, expect, it } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
import { mapDeleteError, mapStandardBomFormError, StandardBomFormModel } from './server-errors';

function problemResponse(status: number, body: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body, url: '/api/standard-boms' });
}

const baseModel: StandardBomFormModel = {
  productId: 'product-1',
  miCode: '1234',
  brand: 'Legrand',
  standardLength: 305,
  active: 'true',
  description: '',
  components: [
    {
      componentId: 'component-1',
      name: 'پیچ شش‌گوش',
      materials: [{ materialId: 'material-1', name: 'میلگرد فولادی', weight: 150 }],
    },
  ],
};

function standardBomForm(model: StandardBomFormModel = baseModel) {
  return TestBed.runInInjectionContext(() => form(signal<StandardBomFormModel>(model)));
}

describe('mapStandardBomFormError', () => {
  it('attaches a validation error for a known field onto that field', () => {
    const formTree = standardBomForm();

    const errors = mapStandardBomFormError(
      problemResponse(400, {
        type: PROBLEM.validationError,
        errors: [{ field: 'miCode', message: 'miCode should not be empty' }],
      }),
      formTree,
    );

    expect(errors).toEqual([
      { fieldTree: formTree.miCode, kind: 'server', message: 'کد MI را وارد کنید.' },
    ]);
  });

  it('attaches a validation error for the brand field onto that field', () => {
    const formTree = standardBomForm();

    const errors = mapStandardBomFormError(
      problemResponse(400, {
        type: PROBLEM.validationError,
        errors: [{ field: 'brand', message: 'brand should not be empty' }],
      }),
      formTree,
    );

    expect(errors).toEqual([
      { fieldTree: formTree.brand, kind: 'server', message: 'برند را وارد کنید.' },
    ]);
  });

  it('attaches a validation error for the standardLength field onto that field', () => {
    const formTree = standardBomForm();

    const errors = mapStandardBomFormError(
      problemResponse(400, {
        type: PROBLEM.validationError,
        errors: [{ field: 'standardLength', message: 'standardLength must be a positive number' }],
      }),
      formTree,
    );

    expect(errors).toEqual([
      {
        fieldTree: formTree.standardLength,
        kind: 'server',
        message: 'متراژ استاندارد را به صورت عدد مثبت وارد کنید.',
      },
    ]);
  });

  it('attaches a validation error for the active field onto that field', () => {
    const formTree = standardBomForm();

    const errors = mapStandardBomFormError(
      problemResponse(400, {
        type: PROBLEM.validationError,
        errors: [{ field: 'active', message: 'active must be a boolean value' }],
      }),
      formTree,
    );

    expect(errors).toEqual([
      {
        fieldTree: formTree.active,
        kind: 'server',
        message: 'وضعیت فعال بودن را مشخص کنید.',
      },
    ]);
  });

  it('reports a duplicate MI code conflict on the miCode field', () => {
    const formTree = standardBomForm();

    const errors = mapStandardBomFormError(
      problemResponse(409, { type: PROBLEM.standardBomMiCodeAlreadyExists, miCode: '1234' }),
      formTree,
    );

    expect(errors).toEqual([
      {
        fieldTree: formTree.miCode,
        kind: 'server',
        message: 'این کد MI قبلاً برای آنالیز استاندارد دیگری ثبت شده است.',
      },
    ]);
  });

  it('reports the at-least-one-component invariant on the form root', () => {
    const formTree = standardBomForm();

    const errors = mapStandardBomFormError(
      problemResponse(400, { type: PROBLEM.standardBomMustHaveAtLeastOneComponent }),
      formTree,
    );

    expect(errors).toEqual([
      { kind: 'server', message: 'این آنالیز استاندارد باید حداقل یک جز داشته باشد.' },
    ]);
  });

  it('reports the at-least-one-material invariant on the form root', () => {
    const formTree = standardBomForm();

    const errors = mapStandardBomFormError(
      problemResponse(400, {
        type: PROBLEM.standardBomComponentMustHaveAtLeastOneMaterial,
        componentId: 'component-1',
      }),
      formTree,
    );

    expect(errors).toEqual([
      { kind: 'server', message: 'هر جز باید حداقل یک مواد اولیه داشته باشد.' },
    ]);
  });

  it('reports a since-deleted product on the productId field', () => {
    const formTree = standardBomForm();

    const errors = mapStandardBomFormError(
      problemResponse(400, { type: PROBLEM.standardBomProductNotFound, productId: 'product-1' }),
      formTree,
    );

    expect(errors).toEqual([
      {
        fieldTree: formTree.productId,
        kind: 'server',
        message: 'این محصول دیگر وجود ندارد. فهرست را تازه‌سازی کنید.',
      },
    ]);
  });

  it('reports a stale composition entry on the form root', () => {
    const formTree = standardBomForm();

    const errors = mapStandardBomFormError(
      problemResponse(400, {
        type: PROBLEM.standardBomCompositionEntryNotFound,
        entryId: 'component-1',
      }),
      formTree,
    );

    expect(errors).toEqual([
      {
        kind: 'server',
        message: 'ترکیب انتخاب‌شده دیگر با محصول همخوانی ندارد. فرم را دوباره باز کنید.',
      },
    ]);
  });

  it('reports a since-deleted standard BOM on the form root', () => {
    const formTree = standardBomForm();

    const errors = mapStandardBomFormError(
      problemResponse(404, { type: PROBLEM.entityNotFound }),
      formTree,
    );

    expect(errors).toEqual([
      { kind: 'server', message: 'این آنالیز استاندارد دیگر وجود ندارد. فهرست را تازه‌سازی کنید.' },
    ]);
  });

  it('reports a 403 as an access-denied message on the form root, whatever the body carries', () => {
    const formTree = standardBomForm();

    const errors = mapStandardBomFormError(problemResponse(403, { title: 'Forbidden' }), formTree);

    expect(errors).toEqual([{ kind: 'server', message: 'شما اجازهٔ انجام این عملیات را ندارید.' }]);
  });

  it('falls back to a root message for a network failure or anything unrecognised', () => {
    const formTree = standardBomForm();

    const errors = mapStandardBomFormError(
      new HttpErrorResponse({
        status: 0,
        error: new ProgressEvent('error'),
        url: '/api/standard-boms',
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
      'این آنالیز استاندارد پیش‌تر حذف شده است. فهرست را تازه‌سازی کنید.',
    );
  });

  it('falls back to a generic message for anything else', () => {
    expect(
      mapDeleteError(
        new HttpErrorResponse({
          status: 0,
          error: new ProgressEvent('error'),
          url: '/api/standard-boms/1',
        }),
      ),
    ).toBe('حذف آنالیز استاندارد ممکن نشد. دوباره تلاش کنید.');
  });
});
