import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { Role } from '../../api/model';
import { NotFoundPage } from '../../features/not-found/not-found-page';
import { guardedRoute, NOT_FOUND_TITLE } from './guarded-route';
import { SessionStore } from './session-store';

@Component({
  selector: 'app-fake-users-page',
  template: '<h1>fake users page</h1>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class FakeUsersPage {}

describe('guardedRoute', () => {
  let httpMock: HttpTestingController;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          guardedRoute({
            path: 'users',
            title: 'مدیریت کاربران · کابلان',
            load: () => Promise.resolve(FakeUsersPage),
          }),
          { path: '**', title: NOT_FOUND_TITLE, component: NotFoundPage },
        ]),
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    TestBed.inject(SessionStore).store('a-valid-token');
    harness = await RouterTestingHarness.create();
  });

  /**
   * Answers the one `GET /api/users/me` the store makes, then lets the navigation settle.
   *
   * The `setTimeout` is load-bearing: the route's loader only reaches its HTTP call after the
   * router has resolved the guard, so the request does not exist yet at the moment `navigateByUrl`
   * returns. Yielding a macrotask drains the microtask queue it is waiting behind.
   */
  async function signedInAs(role: Role, navigation: Promise<unknown>): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    httpMock
      .expectOne({ method: 'GET', url: '/api/users/me' })
      .flush({ id: '1', name: 'Sina Ghadrdan', username: 'sina.q', role });
    await navigation;
  }

  it('renders the page for a role the destination allows', async () => {
    const navigation = harness.navigateByUrl('/users');
    await signedInAs(Role.system_admin, navigation);

    expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(FakeUsersPage);
  });

  it('renders the not-found page for a role the destination withholds', async () => {
    const navigation = harness.navigateByUrl('/users');
    await signedInAs(Role.reporter, navigation);

    expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(NotFoundPage);
  });

  // The property that makes a withheld page indistinguishable from one that never existed. A
  // redirect to /not-found would fail this, and in failing it would prove /users is a real route.
  it('leaves the URL on the requested path when it withholds the page', async () => {
    const navigation = harness.navigateByUrl('/users');
    await signedInAs(Role.reporter, navigation);

    expect(TestBed.inject(Router).url).toBe('/users');
  });

  it('gives a withheld page the not-found title, never the real one', async () => {
    const navigation = harness.navigateByUrl('/users');
    await signedInAs(Role.reporter, navigation);

    expect(TestBed.inject(Title).getTitle()).toBe(NOT_FOUND_TITLE);
  });

  it('gives an allowed page its own title', async () => {
    const navigation = harness.navigateByUrl('/users');
    await signedInAs(Role.system_admin, navigation);

    expect(TestBed.inject(Title).getTitle()).toBe('مدیریت کاربران · کابلان');
  });

  it('sends an anonymous visitor to log in rather than rendering anything', async () => {
    TestBed.inject(SessionStore).clear();

    await harness.navigateByUrl('/users');

    expect(TestBed.inject(Router).url).toBe('/login?returnUrl=%2Fusers');
  });
});
