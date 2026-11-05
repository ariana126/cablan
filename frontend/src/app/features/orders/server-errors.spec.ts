import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { describe, expect, it } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
import { recordHasDependentsBody } from '../../core/http/testing/record-has-dependents-problem';
import {
  AddMiCodeFormModel,
  mapAddMiCodeError,
  mapDeleteOrderError,
  mapOrderFormError,
  OrderFormModel,
} from './server-errors';

function problemResponse(status: number, body: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body, url: '/api/orders' });
}

const forbidden = () => new HttpErrorResponse({ status: 403, url: '/api/orders' });

const inUse = () =>
  problemResponse(
    409,
    recordHasDependentsBody([{ kind: 'daily-bom', count: 1, names: ['ORD-5001'] }], 'order'),
  );

function orderForm() {
  return TestBed.runInInjectionContext(() =>
    form(signal<OrderFormModel>({ orderNumber: '', miCodes: [] })),
  );
}

function addMiCodeForm() {
  return TestBed.runInInjectionContext(() => form(signal<AddMiCodeFormModel>({ miCode: '' })));
}

describe('mapOrderFormError', () => {
  it('puts a taken order number on the order number field', () => {
    const tree = orderForm();

    const errors = mapOrderFormError(
      problemResponse(409, { type: PROBLEM.orderNumberTaken }),
      tree,
    );

    expect(errors).toEqual([
      {
        fieldTree: tree.orderNumber,
        kind: 'server',
        message: 'این شماره سفارش قبلاً برای سفارش دیگری ثبت شده است.',
      },
    ]);
  });

  it('puts an MI code no standard BOM has on the MI codes field', () => {
    const tree = orderForm();

    const errors = mapOrderFormError(
      problemResponse(400, { type: PROBLEM.orderMiCodeNotFound }),
      tree,
    );

    expect(errors).toEqual([
      {
        fieldTree: tree.miCodes,
        kind: 'server',
        message: 'یکی از کدهای MI انتخاب‌شده دیگر تعریف نشده است. فهرست را تازه‌سازی کنید.',
      },
    ]);
  });

  it('puts an MI code chosen twice on the MI codes field', () => {
    const tree = orderForm();

    const errors = mapOrderFormError(
      problemResponse(409, { type: PROBLEM.orderMiCodeAlreadyAssigned }),
      tree,
    );

    expect(errors).toEqual([
      {
        fieldTree: tree.miCodes,
        kind: 'server',
        message: 'هر کد MI فقط یک بار به سفارش تخصیص داده می‌شود.',
      },
    ]);
  });

  it('binds the validation errors to the order number and the MI codes', () => {
    const tree = orderForm();

    const errors = mapOrderFormError(
      problemResponse(400, {
        type: PROBLEM.validationError,
        errors: [{ field: 'orderNumber' }, { field: 'miCodes' }],
      }),
      tree,
    );

    expect(errors).toEqual([
      { fieldTree: tree.orderNumber, kind: 'server', message: 'شماره سفارش را وارد کنید.' },
      { fieldTree: tree.miCodes, kind: 'server', message: 'دست کم یک کد MI انتخاب کنید.' },
    ]);
  });

  it('says where an order in use is used, at the form root', () => {
    const errors = mapOrderFormError(inUse(), orderForm());

    expect(errors).toEqual([
      {
        kind: 'server',
        message:
          'امکان ویرایش این اطلاعات وجود ندارد، زیرا در ۱ آنالیز روزانه («ORD-5001») استفاده شده است.',
      },
    ]);
  });

  it('says access is denied on a 403', () => {
    expect(mapOrderFormError(forbidden(), orderForm())).toEqual([
      { kind: 'server', message: 'شما اجازهٔ انجام این عملیات را ندارید.' },
    ]);
  });

  it('says the order is gone when it was deleted meanwhile', () => {
    expect(
      mapOrderFormError(problemResponse(404, { type: PROBLEM.entityNotFound }), orderForm()),
    ).toEqual([{ kind: 'server', message: 'این سفارش دیگر وجود ندارد. فهرست را تازه‌سازی کنید.' }]);
  });
});

describe('mapAddMiCodeError', () => {
  it('puts an MI code already on the order on the MI code field', () => {
    const tree = addMiCodeForm();

    const errors = mapAddMiCodeError(
      problemResponse(409, { type: PROBLEM.orderMiCodeAlreadyAssigned }),
      tree,
    );

    expect(errors).toEqual([
      {
        fieldTree: tree.miCode,
        kind: 'server',
        message: 'این کد MI قبلاً به این سفارش تخصیص داده شده است.',
      },
    ]);
  });

  it('puts an MI code no standard BOM has on the MI code field', () => {
    const tree = addMiCodeForm();

    const errors = mapAddMiCodeError(
      problemResponse(400, { type: PROBLEM.orderMiCodeNotFound }),
      tree,
    );

    expect(errors).toEqual([
      {
        fieldTree: tree.miCode,
        kind: 'server',
        message: 'این کد MI دیگر تعریف نشده است. فهرست را تازه‌سازی کنید.',
      },
    ]);
  });

  it('says access is denied on a 403', () => {
    expect(mapAddMiCodeError(forbidden(), addMiCodeForm())).toEqual([
      { kind: 'server', message: 'شما اجازهٔ انجام این عملیات را ندارید.' },
    ]);
  });
});

describe('mapDeleteOrderError', () => {
  it('says where an order in use is used', () => {
    expect(mapDeleteOrderError(inUse())).toBe(
      'امکان حذف این اطلاعات وجود ندارد، زیرا در ۱ آنالیز روزانه («ORD-5001») استفاده شده است.',
    );
  });

  it('says access is denied on a 403', () => {
    expect(mapDeleteOrderError(forbidden())).toBe('شما اجازهٔ انجام این عملیات را ندارید.');
  });

  it('says the order was deleted already', () => {
    expect(mapDeleteOrderError(problemResponse(404, { type: PROBLEM.entityNotFound }))).toBe(
      'این سفارش پیش‌تر حذف شده است. فهرست را تازه‌سازی کنید.',
    );
  });

  it('falls back to a generic sentence', () => {
    expect(mapDeleteOrderError(problemResponse(500, { type: 'about:blank' }))).toBe(
      'حذف سفارش ممکن نشد. دوباره تلاش کنید.',
    );
  });
});
