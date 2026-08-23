import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { signal } from '@angular/core';
import { describe, expect, it } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
import { LoginFormModel, mapLoginError } from './server-errors';

function problemResponse(status: number, body: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body, url: '/api/auth/login' });
}

function loginForm() {
  return TestBed.runInInjectionContext(() =>
    form(signal<LoginFormModel>({ username: '', password: '' })),
  );
}

describe('mapLoginError', () => {
  it('puts a wrong-credentials message on the form root, not on either field', () => {
    const loginFormTree = loginForm();

    const errors = mapLoginError(
      problemResponse(401, { type: PROBLEM.invalidCredentials }),
      loginFormTree,
    );

    expect(errors).toEqual([{ kind: 'server', message: 'نام کاربری یا رمز عبور نادرست است.' }]);
  });

  it('attaches a validation-error field entry to the matching field', () => {
    const loginFormTree = loginForm();

    const errors = mapLoginError(
      problemResponse(400, {
        type: PROBLEM.validationError,
        errors: [{ field: 'username', message: 'username should not be empty' }],
      }),
      loginFormTree,
    );

    expect(errors).toEqual([
      { fieldTree: loginFormTree.username, kind: 'server', message: 'نام کاربری را وارد کنید.' },
    ]);
  });

  it('attaches a password validation entry to the password field', () => {
    const loginFormTree = loginForm();

    const errors = mapLoginError(
      problemResponse(400, {
        type: PROBLEM.validationError,
        errors: [{ field: 'password', message: 'password should not be empty' }],
      }),
      loginFormTree,
    );

    expect(errors).toEqual([
      { fieldTree: loginFormTree.password, kind: 'server', message: 'رمز عبور را وارد کنید.' },
    ]);
  });

  it('falls back to a root message for anything else, including a network failure', () => {
    const loginFormTree = loginForm();

    const errors = mapLoginError(
      new HttpErrorResponse({
        status: 0,
        error: new ProgressEvent('error'),
        url: '/api/auth/login',
      }),
      loginFormTree,
    );

    expect(errors).toEqual([
      {
        kind: 'server',
        message: 'ورود به سامانه ممکن نشد. اتصال خود را بررسی کنید و دوباره تلاش کنید.',
      },
    ]);
  });
});
