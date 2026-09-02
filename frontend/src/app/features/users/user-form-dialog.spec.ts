import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Role } from '../../api/model';
import { UserFormDialog, UserFormDialogData } from './user-form-dialog';

/** The subset of the submit pipeline a spec needs to await directly. */
interface Submittable {
  onSubmit(): Promise<unknown>;
}

function setValue(element: Element | null, value: string): void {
  const input = element as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function findByLabel(root: HTMLElement, label: string): HTMLInputElement | null {
  const labels = Array.from(root.querySelectorAll('label'));
  const match = labels.find((element) => element.textContent?.trim().startsWith(label));
  const forAttr = match?.getAttribute('for');
  return forAttr ? root.querySelector(`#${forAttr}`) : null;
}

function setUp(data: UserFormDialogData) {
  const close = vi.fn();

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: data },
    ],
  });

  const fixture = TestBed.createComponent(UserFormDialog);
  const httpMock = TestBed.inject(HttpTestingController);

  return { fixture, close, httpMock, root: fixture.nativeElement as HTMLElement };
}

describe('UserFormDialog', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  describe('create mode', () => {
    it('starts every field empty, with the least-privileged role preselected', async () => {
      const { fixture, root } = setUp({ mode: 'create' });
      await fixture.whenStable();

      expect(findByLabel(root, 'نام')?.value).toBe('');
      expect(findByLabel(root, 'نام کاربری')?.value).toBe('');
      expect(findByLabel(root, 'رمز عبور')?.value).toBe('');
    });

    it('reveals the password on demand and hides it again', async () => {
      const { fixture, root } = setUp({ mode: 'create' });
      await fixture.whenStable();

      const password = findByLabel(root, 'رمز عبور');
      const toggle = root.querySelector(
        'app-password-visibility-toggle button',
      ) as HTMLButtonElement;
      expect(password?.type).toBe('password');

      toggle.click();
      await fixture.whenStable();
      expect(password?.type).toBe('text');

      toggle.click();
      await fixture.whenStable();
      expect(password?.type).toBe('password');
    });

    it('registers the user and closes the dialog on success', async () => {
      const { fixture, root, close, httpMock } = setUp({ mode: 'create' });
      await fixture.whenStable();

      setValue(findByLabel(root, 'نام'), 'Sina Ghadrdan');
      setValue(findByLabel(root, 'نام کاربری'), 'sina.q');
      setValue(findByLabel(root, 'رمز عبور'), 'Passw0rd!');
      await fixture.whenStable();

      const page = fixture.componentInstance as unknown as Submittable;
      const submitted = page.onSubmit();
      const request = httpMock.expectOne({ method: 'POST', url: '/api/users' });
      expect(request.request.body).toEqual({
        name: 'Sina Ghadrdan',
        username: 'sina.q',
        password: 'Passw0rd!',
        role: Role.reporter,
      });
      request.flush(null, { status: 201, statusText: 'Created' });
      await submitted;

      expect(close).toHaveBeenCalledWith(true);
    });

    it('refuses a password shorter than six characters, without asking the API', async () => {
      const { fixture, root, close } = setUp({ mode: 'create' });
      await fixture.whenStable();

      setValue(findByLabel(root, 'نام'), 'Sina Ghadrdan');
      setValue(findByLabel(root, 'نام کاربری'), 'sina.q');
      setValue(findByLabel(root, 'رمز عبور'), 'Pass1');
      await fixture.whenStable();

      // No `httpMock.expectOne` here on purpose: the afterEach `verify()` is what proves the
      // request was never made. A floor the client can check is a round trip it need not spend.
      await (fixture.componentInstance as unknown as Submittable).onSubmit();
      await fixture.whenStable();

      expect(close).not.toHaveBeenCalled();
      const passwordField = findByLabel(root, 'رمز عبور')?.closest('mat-form-field');
      expect(passwordField?.textContent).toContain('رمز عبور باید دست‌کم ۶ نویسه باشد.');
    });

    it('accepts a password of exactly six characters', async () => {
      const { fixture, root, close, httpMock } = setUp({ mode: 'create' });
      await fixture.whenStable();

      setValue(findByLabel(root, 'نام'), 'Sina Ghadrdan');
      setValue(findByLabel(root, 'نام کاربری'), 'sina.q');
      setValue(findByLabel(root, 'رمز عبور'), 'Pass12');
      await fixture.whenStable();

      const submitted = (fixture.componentInstance as unknown as Submittable).onSubmit();
      httpMock
        .expectOne({ method: 'POST', url: '/api/users' })
        .flush(null, { status: 201, statusText: 'Created' });
      await submitted;

      expect(close).toHaveBeenCalledWith(true);
    });

    it('does not close and reports the field when the username is already taken', async () => {
      const { fixture, root, close, httpMock } = setUp({ mode: 'create' });
      await fixture.whenStable();

      setValue(findByLabel(root, 'نام'), 'Sina Ghadrdan');
      setValue(findByLabel(root, 'نام کاربری'), 'sina.q');
      setValue(findByLabel(root, 'رمز عبور'), 'Passw0rd!');
      await fixture.whenStable();

      const page = fixture.componentInstance as unknown as Submittable;
      const submitted = page.onSubmit();
      httpMock
        .expectOne({ method: 'POST', url: '/api/users' })
        .flush(
          { type: 'https://my-api-doc.dev/problems/username-already-exists' },
          { status: 409, statusText: 'Conflict' },
        );
      await submitted;
      await fixture.whenStable();

      expect(close).not.toHaveBeenCalled();
      const usernameField = findByLabel(root, 'نام کاربری')?.closest('mat-form-field');
      expect(usernameField?.textContent).toContain('این نام کاربری قبلاً ثبت شده است');
    });
  });

  describe('edit mode', () => {
    const user = {
      id: 'user-1',
      name: 'Sina Ghadrdan',
      username: 'sina.q',
      role: Role.qc_inspector,
    };

    it('pre-fills the form from the given user, with an empty password', async () => {
      const { fixture, root } = setUp({ mode: 'edit', user });
      await fixture.whenStable();

      expect(findByLabel(root, 'نام')?.value).toBe('Sina Ghadrdan');
      expect(findByLabel(root, 'نام کاربری')?.value).toBe('sina.q');
      expect(findByLabel(root, 'رمز عبور')?.value).toBe('');
    });

    it('omits the password from the request when it was left blank', async () => {
      const { fixture, root, httpMock } = setUp({ mode: 'edit', user });
      await fixture.whenStable();

      setValue(findByLabel(root, 'نام'), 'Sina G.');
      await fixture.whenStable();

      const page = fixture.componentInstance as unknown as Submittable;
      const submitted = page.onSubmit();
      const request = httpMock.expectOne({ method: 'PATCH', url: '/api/users/user-1' });
      expect(request.request.body).toEqual({ name: 'Sina G.', username: 'sina.q' });
      request.flush(null, { status: 204, statusText: 'No Content' });
      await submitted;
    });

    // The floor belongs to registration only. An edit's password field means "replace it with
    // this", and the rule the admin is working around here is one the API does not enforce either.
    it('lets a short new password through, because the floor is a registration rule', async () => {
      const { fixture, root, httpMock } = setUp({ mode: 'edit', user });
      await fixture.whenStable();

      setValue(findByLabel(root, 'رمز عبور'), 'Pass1');
      await fixture.whenStable();

      const submitted = (fixture.componentInstance as unknown as Submittable).onSubmit();
      const request = httpMock.expectOne({ method: 'PATCH', url: '/api/users/user-1' });
      expect(request.request.body.password).toBe('Pass1');
      request.flush(null, { status: 204, statusText: 'No Content' });
      await submitted;
    });

    it('does not send a role at all when the role was left untouched', async () => {
      const { fixture, root, httpMock } = setUp({ mode: 'edit', user });
      await fixture.whenStable();

      setValue(findByLabel(root, 'نام'), 'Sina G.');
      await fixture.whenStable();

      const page = fixture.componentInstance as unknown as Submittable;
      const submitted = page.onSubmit();
      const request = httpMock.expectOne({ method: 'PATCH', url: '/api/users/user-1' });
      expect(request.request.body.role).toBeUndefined();
      request.flush(null, { status: 204, statusText: 'No Content' });
      await submitted;
    });
  });
});
