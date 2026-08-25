import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { describe, expect, it } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
import { mapComponentFormError, ComponentFormModel, mapDeleteError } from './server-errors';

function problemResponse(status: number, body: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body, url: '/api/components' });
}

function componentForm() {
  return TestBed.runInInjectionContext(() => form(signal<ComponentFormModel>({ name: '' })));
}

describe('mapComponentFormError', () => {
  it('attaches each validation-error entry to its matching field', () => {
    const formTree = componentForm();

    const errors = mapComponentFormError(
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

  it('puts a component-name-already-exists error on the name field', () => {
    const formTree = componentForm();

    const errors = mapComponentFormError(
      problemResponse(409, { type: PROBLEM.componentNameAlreadyExists }),
      formTree,
    );

    expect(errors).toEqual([
      {
        fieldTree: formTree.name,
        kind: 'server',
        message: 'این نام قبلاً برای جز دیگری ثبت شده است.',
      },
    ]);
  });

  it('reports a since-deleted component on the form root', () => {
    const formTree = componentForm();

    const errors = mapComponentFormError(
      problemResponse(404, { type: PROBLEM.entityNotFound }),
      formTree,
    );

    expect(errors).toEqual([
      { kind: 'server', message: 'این جز دیگر وجود ندارد. فهرست را تازه‌سازی کنید.' },
    ]);
  });

  it('reports a 403 as an access-denied message on the form root, whatever the body carries', () => {
    const formTree = componentForm();

    const errors = mapComponentFormError(problemResponse(403, { title: 'Forbidden' }), formTree);

    expect(errors).toEqual([{ kind: 'server', message: 'شما اجازهٔ انجام این عملیات را ندارید.' }]);
  });

  it('falls back to a root message for a network failure or anything unrecognised', () => {
    const formTree = componentForm();

    const errors = mapComponentFormError(
      new HttpErrorResponse({
        status: 0,
        error: new ProgressEvent('error'),
        url: '/api/components',
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
      'این جز پیش‌تر حذف شده است. فهرست را تازه‌سازی کنید.',
    );
  });

  it('falls back to a generic message for anything else', () => {
    expect(
      mapDeleteError(
        new HttpErrorResponse({
          status: 0,
          error: new ProgressEvent('error'),
          url: '/api/components/1',
        }),
      ),
    ).toBe('حذف جز ممکن نشد. دوباره تلاش کنید.');
  });
});
