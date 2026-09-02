import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { accessTokenInterceptor } from '../../core/http/access-token-interceptor';
import { SessionStore } from '../../core/identity/session-store';
import { LoginPage } from './login-page';

// Minimal stand-ins for the pages a successful login can land on — this spec has no business
// depending on either of them.
@Component({ selector: 'app-stub-users-page', template: '<p>users</p>' })
class StubUsersPage {}

@Component({ selector: 'app-stub-home-page', template: '<p>home</p>' })
class StubHomePage {}

/** The submit handler as the test needs to see it — not the whole component's private surface. */
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
  const match = labels.find((element) => element.textContent?.trim() === label);
  const forAttr = match?.getAttribute('for');
  return forAttr ? root.querySelector(`#${forAttr}`) : null;
}

describe('LoginPage', () => {
  let httpMock: HttpTestingController;
  let session: SessionStore;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([accessTokenInterceptor])),
        provideHttpClientTesting(),
        provideRouter(
          [
            { path: '', component: StubHomePage },
            { path: 'login', component: LoginPage },
            { path: 'users', component: StubUsersPage },
          ],
          withComponentInputBinding(),
        ),
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('has a labelled username and password field, and a submit button', async () => {
    const harness = await RouterTestingHarness.create('/login');
    const root = harness.routeNativeElement as HTMLElement;

    expect(findByLabel(root, 'نام کاربری')).not.toBeNull();
    expect(findByLabel(root, 'رمز عبور')).not.toBeNull();
    expect(root.querySelector('button[type="submit"]')).not.toBeNull();
  });

  it('reveals the password on demand and hides it again', async () => {
    const harness = await RouterTestingHarness.create('/login');
    const root = harness.routeNativeElement as HTMLElement;

    const password = findByLabel(root, 'رمز عبور');
    const toggle = root.querySelector('app-password-visibility-toggle button') as HTMLButtonElement;
    expect(password?.type).toBe('password');

    toggle.click();
    await harness.fixture.whenStable();
    expect(password?.type).toBe('text');

    toggle.click();
    await harness.fixture.whenStable();
    expect(password?.type).toBe('password');
  });

  it('logs in, stores the token and navigates to the return URL', async () => {
    const harness = await RouterTestingHarness.create('/login?returnUrl=%2Fusers');
    const root = harness.routeNativeElement as HTMLElement;
    const page = harness.routeDebugElement?.componentInstance as Submittable;

    setValue(findByLabel(root, 'نام کاربری'), 'sina.q');
    setValue(findByLabel(root, 'رمز عبور'), 'Passw0rd!');
    await harness.fixture.whenStable();

    const submitted = page.onSubmit();
    httpMock.expectOne('/api/auth/login').flush({ accessToken: 'a-fresh-token' });
    await submitted;
    await harness.fixture.whenStable();

    expect(session.accessToken()).toBe('a-fresh-token');
    expect(router.url).toBe('/users');
  });

  // Home is the only landing every role may reach. Any one section would be a page some role is
  // withheld from, and landing there would show them the not-found page instead.
  it('lands on home when nothing said where the visitor was headed', async () => {
    const harness = await RouterTestingHarness.create('/login');
    const root = harness.routeNativeElement as HTMLElement;
    const page = harness.routeDebugElement?.componentInstance as Submittable;

    setValue(findByLabel(root, 'نام کاربری'), 'sina.q');
    setValue(findByLabel(root, 'رمز عبور'), 'Passw0rd!');
    await harness.fixture.whenStable();

    const submitted = page.onSubmit();
    httpMock.expectOne('/api/auth/login').flush({ accessToken: 'a-fresh-token' });
    await submitted;
    await harness.fixture.whenStable();

    expect(router.url).toBe('/');
  });

  it('shows a root-level error and does not navigate when the credentials are wrong', async () => {
    const harness = await RouterTestingHarness.create('/login');
    const root = harness.routeNativeElement as HTMLElement;
    const page = harness.routeDebugElement?.componentInstance as Submittable;

    setValue(findByLabel(root, 'نام کاربری'), 'sina.q');
    setValue(findByLabel(root, 'رمز عبور'), 'wrong-password');
    await harness.fixture.whenStable();

    const submitted = page.onSubmit();
    httpMock
      .expectOne('/api/auth/login')
      .flush(
        { type: 'https://my-api-doc.dev/problems/invalid-credentials' },
        { status: 401, statusText: 'Unauthorized' },
      );
    await submitted;
    await harness.fixture.whenStable();

    const alert = root.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('نام کاربری یا رمز عبور نادرست است');
    expect(session.isAuthenticated()).toBe(false);
    expect(router.url).toBe('/login');
  });

  it('clears the password out of the form once the request has been sent, win or lose', async () => {
    // A failed attempt, so the page stays mounted afterwards and there is a field left to inspect —
    // a successful one navigates away and tears the form down before this could be asserted.
    const harness = await RouterTestingHarness.create('/login');
    const root = harness.routeNativeElement as HTMLElement;
    const page = harness.routeDebugElement?.componentInstance as Submittable;

    setValue(findByLabel(root, 'نام کاربری'), 'sina.q');
    setValue(findByLabel(root, 'رمز عبور'), 'Passw0rd!');
    await harness.fixture.whenStable();

    const submitted = page.onSubmit();
    httpMock
      .expectOne('/api/auth/login')
      .flush(
        { type: 'https://my-api-doc.dev/problems/invalid-credentials' },
        { status: 401, statusText: 'Unauthorized' },
      );
    await submitted;
    await harness.fixture.whenStable();

    expect(findByLabel(root, 'رمز عبور')?.value).toBe('');
  });
});
