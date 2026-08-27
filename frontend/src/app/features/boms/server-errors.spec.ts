import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { describe, expect, it } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
import { BomFormModel, mapBomFormError, mapDeleteError } from './server-errors';

function problemResponse(status: number, body: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body, url: '/api/boms' });
}

const baseModel: BomFormModel = {
  standardBomMiCode: '0001',
  orderNumber: 'SO-1234',
  trackingNumber: 'TN-5678',
  description: '',
  components: [
    {
      componentId: 'component-1',
      name: 'پیچ شش‌گوش',
      materials: [{ materialId: 'material-1', name: 'میلگرد فولادی', weight: 150 }],
    },
  ],
};

function bomForm(model: BomFormModel = baseModel) {
  return TestBed.runInInjectionContext(() => form(signal<BomFormModel>(model)));
}

describe('mapBomFormError', () => {
  it('attaches a validation error for the orderNumber field onto that field', () => {
    const formTree = bomForm();

    const errors = mapBomFormError(
      problemResponse(400, {
        type: PROBLEM.validationError,
        errors: [{ field: 'orderNumber', message: 'orderNumber should not be empty' }],
      }),
      formTree,
    );

    expect(errors).toEqual([
      { fieldTree: formTree.orderNumber, kind: 'server', message: 'شماره سفارش را وارد کنید.' },
    ]);
  });

  it('attaches a validation error for the trackingNumber field onto that field', () => {
    const formTree = bomForm();

    const errors = mapBomFormError(
      problemResponse(400, {
        type: PROBLEM.validationError,
        errors: [{ field: 'trackingNumber', message: 'trackingNumber should not be empty' }],
      }),
      formTree,
    );

    expect(errors).toEqual([
      { fieldTree: formTree.trackingNumber, kind: 'server', message: 'شماره ردیابی را وارد کنید.' },
    ]);
  });

  it('attaches a validation error for the standardBomMiCode field onto that field', () => {
    const formTree = bomForm();

    const errors = mapBomFormError(
      problemResponse(400, {
        type: PROBLEM.validationError,
        errors: [{ field: 'standardBomMiCode', message: 'standardBomMiCode should not be empty' }],
      }),
      formTree,
    );

    expect(errors).toEqual([
      {
        fieldTree: formTree.standardBomMiCode,
        kind: 'server',
        message: 'کد MI آنالیز استاندارد را انتخاب کنید.',
      },
    ]);
  });

  it('reports an unresolved standard BOM MI code on the standardBomMiCode field', () => {
    const formTree = bomForm();

    const errors = mapBomFormError(
      problemResponse(400, { type: PROBLEM.bomStandardBomNotFound, standardBomMiCode: '0001' }),
      formTree,
    );

    expect(errors).toEqual([
      {
        fieldTree: formTree.standardBomMiCode,
        kind: 'server',
        message: 'آنالیز استانداردی با این کد MI یافت نشد. فهرست را تازه‌سازی کنید.',
      },
    ]);
  });

  it('reports the at-least-one-component invariant on the form root', () => {
    const formTree = bomForm();

    const errors = mapBomFormError(
      problemResponse(400, { type: PROBLEM.bomMustHaveAtLeastOneComponent }),
      formTree,
    );

    expect(errors).toEqual([
      { kind: 'server', message: 'این آنالیز روزانه باید حداقل یک جز داشته باشد.' },
    ]);
  });

  it('reports the at-least-one-material invariant on the form root', () => {
    const formTree = bomForm();

    const errors = mapBomFormError(
      problemResponse(400, {
        type: PROBLEM.bomComponentMustHaveAtLeastOneMaterial,
        componentId: 'component-1',
      }),
      formTree,
    );

    expect(errors).toEqual([
      { kind: 'server', message: 'هر جز باید حداقل یک مواد اولیه داشته باشد.' },
    ]);
  });

  it('reports a stale composition entry on the form root', () => {
    const formTree = bomForm();

    const errors = mapBomFormError(
      problemResponse(400, {
        type: PROBLEM.bomCompositionEntryNotFound,
        entryId: 'component-1',
      }),
      formTree,
    );

    expect(errors).toEqual([
      {
        kind: 'server',
        message: 'ترکیب انتخاب‌شده دیگر با آنالیز استاندارد همخوانی ندارد. فرم را دوباره باز کنید.',
      },
    ]);
  });

  it('reports a since-deleted daily BOM on the form root', () => {
    const formTree = bomForm();

    const errors = mapBomFormError(
      problemResponse(404, { type: PROBLEM.entityNotFound }),
      formTree,
    );

    expect(errors).toEqual([
      { kind: 'server', message: 'این آنالیز روزانه دیگر وجود ندارد. فهرست را تازه‌سازی کنید.' },
    ]);
  });

  it('reports a 403 as an access-denied message on the form root, whatever the body carries', () => {
    const formTree = bomForm();

    const errors = mapBomFormError(problemResponse(403, { title: 'Forbidden' }), formTree);

    expect(errors).toEqual([{ kind: 'server', message: 'شما اجازهٔ انجام این عملیات را ندارید.' }]);
  });

  it('reports an invalid material weight on the form root', () => {
    const formTree = bomForm();

    const errors = mapBomFormError(
      problemResponse(400, {
        type: PROBLEM.validationError,
        errors: [{ field: 'weight', message: 'weight must be a positive number' }],
      }),
      formTree,
    );

    expect(errors).toEqual([
      { kind: 'server', message: 'وزن مواد اولیه را به صورت عدد مثبت وارد کنید.' },
    ]);
  });

  it('falls back to a root message for a network failure or anything unrecognised', () => {
    const formTree = bomForm();

    const errors = mapBomFormError(
      new HttpErrorResponse({ status: 0, error: new ProgressEvent('error'), url: '/api/boms' }),
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
      'این آنالیز روزانه پیش‌تر حذف شده است. فهرست را تازه‌سازی کنید.',
    );
  });

  it('falls back to a generic message for anything else', () => {
    expect(
      mapDeleteError(
        new HttpErrorResponse({ status: 0, error: new ProgressEvent('error'), url: '/api/boms/1' }),
      ),
    ).toBe('حذف آنالیز روزانه ممکن نشد. دوباره تلاش کنید.');
  });
});
