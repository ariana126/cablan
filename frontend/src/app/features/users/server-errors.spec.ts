import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { describe, expect, it } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
import { Role } from '../../api/model';
import { mapDeleteError, mapUserFormError, UserFormModel } from './server-errors';

function problemResponse(status: number, body: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body, url: '/api/users' });
}

function userForm() {
  return TestBed.runInInjectionContext(() =>
    form(signal<UserFormModel>({ name: '', username: '', password: '', role: Role.reporter })),
  );
}

describe('mapUserFormError', () => {
  it('attaches each validation-error entry to its matching field', () => {
    const formTree = userForm();

    const errors = mapUserFormError(
      problemResponse(400, {
        type: PROBLEM.validationError,
        errors: [
          { field: 'name', message: 'name should not be empty' },
          { field: 'role', message: 'role must be a valid enum value' },
        ],
      }),
      formTree,
    );

    expect(errors).toEqual([
      { fieldTree: formTree.name, kind: 'server', message: 'نام نمی‌تواند خالی باشد.' },
      { fieldTree: formTree.role, kind: 'server', message: 'نقش انتخاب‌شده معتبر نیست.' },
    ]);
  });

  it('puts a username-already-exists error on the username field', () => {
    const formTree = userForm();

    const errors = mapUserFormError(
      problemResponse(409, { type: PROBLEM.usernameAlreadyExists }),
      formTree,
    );

    expect(errors).toEqual([
      {
        fieldTree: formTree.username,
        kind: 'server',
        message: 'این نام کاربری قبلاً ثبت شده است.',
      },
    ]);
  });

  it('puts a cannot-change-own-role error on the role field', () => {
    const formTree = userForm();

    const errors = mapUserFormError(
      problemResponse(409, { type: PROBLEM.cannotChangeOwnRole }),
      formTree,
    );

    expect(errors).toEqual([
      {
        fieldTree: formTree.role,
        kind: 'server',
        message: 'امکان تغییر نقش خودتان وجود ندارد.',
      },
    ]);
  });

  it('reports a since-deleted user on the form root', () => {
    const formTree = userForm();

    const errors = mapUserFormError(
      problemResponse(404, { type: PROBLEM.entityNotFound }),
      formTree,
    );

    expect(errors).toEqual([
      { kind: 'server', message: 'این کاربر دیگر وجود ندارد. فهرست را تازه‌سازی کنید.' },
    ]);
  });

  it('reports a 403 as an access-denied message on the form root, whatever the body carries', () => {
    const formTree = userForm();

    const errors = mapUserFormError(problemResponse(403, { title: 'Forbidden' }), formTree);

    expect(errors).toEqual([{ kind: 'server', message: 'شما اجازهٔ انجام این عملیات را ندارید.' }]);
  });

  it('falls back to a root message for a network failure or anything unrecognised', () => {
    const formTree = userForm();

    const errors = mapUserFormError(
      new HttpErrorResponse({ status: 0, error: new ProgressEvent('error'), url: '/api/users' }),
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
      'این کاربر پیش‌تر حذف شده است. فهرست را تازه‌سازی کنید.',
    );
  });

  it('falls back to a generic message for anything else', () => {
    expect(
      mapDeleteError(
        new HttpErrorResponse({
          status: 0,
          error: new ProgressEvent('error'),
          url: '/api/users/1',
        }),
      ),
    ).toBe('حذف کاربر ممکن نشد. دوباره تلاش کنید.');
  });
});
