import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideRouter, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Role } from '../../api/model';
import { CurrentUserStore } from '../../core/identity/current-user-store';
import { SessionStore } from '../../core/identity/session-store';
import { fakeAccessToken } from '../../core/identity/testing/fake-access-token';
import { SpecialtyAssignmentDialog } from './specialty-assignment-dialog';
import { SpecialtyAssignmentPrompt } from './specialty-assignment-prompt';

const UNASSIGNED = '/api/maintenance-activities/unassigned-specialties';

/** A routed page that counts how often it is created — each creation reads its data afresh. */
let pageCreations = 0;
@Component({ template: '<p>daily</p>' })
class CountingPage {
  constructor() {
    pageCreations++;
  }
}

@Component({ template: '<p>home</p>' })
class HomeStub {}

describe('SpecialtyAssignmentPrompt', () => {
  let httpMock: HttpTestingController;
  let open: ReturnType<typeof vi.fn>;
  let closed: Subject<boolean | undefined>;

  beforeEach(() => {
    localStorage.clear();
    pageCreations = 0;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: '', component: HomeStub },
          { path: 'pm-schedule/daily', component: CountingPage },
        ]),
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    closed = new Subject();
    open = vi
      .spyOn(TestBed.inject(MatDialog), 'open')
      .mockReturnValue({ afterClosed: () => closed } as unknown as MatDialogRef<unknown, unknown>);
    TestBed.inject(SpecialtyAssignmentPrompt);
  });

  afterEach(() => {
    httpMock.verify();
  });

  /** The dialog's code is loaded on demand; give it the time to arrive before asserting it never opened. */
  function dialogCodeCouldHaveLoaded(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 20));
  }

  /** Signs in as `role` the way the guard does: a token, then `GET /api/users/me`. */
  async function signIn(role: Role, token = fakeAccessToken()): Promise<void> {
    TestBed.inject(SessionStore).store(token);
    const pending = TestBed.inject(CurrentUserStore).load();
    httpMock
      .expectOne({ method: 'GET', url: '/api/users/me' })
      .flush({ id: '1', name: 'سینا', username: 'sina', role });
    await pending;
    TestBed.tick();
  }

  it('asks a System Admin, once signed in, which activities still have no specialty', async () => {
    await signIn(Role.system_admin);

    httpMock.expectOne({ method: 'GET', url: UNASSIGNED }).flush([]);
  });

  it('opens the assignment, not to be dismissed by accident, when some are left', async () => {
    await signIn(Role.system_admin);

    httpMock.expectOne({ method: 'GET', url: UNASSIGNED }).flush([
      { id: 'a1', name: 'روانکاری' },
      { id: 'a2', name: 'بازدید تابلو' },
    ]);

    // The dialog's code is fetched only now, so it opens a moment after the list arrives.
    await vi.waitFor(() => expect(open).toHaveBeenCalled());
    expect(open).toHaveBeenCalledWith(SpecialtyAssignmentDialog, {
      data: {
        activities: [
          { id: 'a1', name: 'روانکاری' },
          { id: 'a2', name: 'بازدید تابلو' },
        ],
      },
      disableClose: true,
    });
  });

  /** Lands on a page that lists activities, then has the dialog opened over it. */
  async function assignmentOpenOverAPage(): Promise<Router> {
    await RouterTestingHarness.create('/pm-schedule/daily');
    const router = TestBed.inject(Router);
    await signIn(Role.system_admin);
    httpMock.expectOne({ method: 'GET', url: UNASSIGNED }).flush([{ id: 'a1', name: 'روانکاری' }]);
    await vi.waitFor(() => expect(open).toHaveBeenCalled());
    expect(pageCreations).toBe(1);
    return router;
  }

  // The page behind still shows «تخصص تعیین نشده» until it reads its data again.
  it('re-opens the page on screen once the specialties are assigned, so it reads them afresh', async () => {
    const router = await assignmentOpenOverAPage();

    closed.next(true);
    closed.complete();
    await vi.waitFor(() => expect(pageCreations).toBe(2));

    expect(router.url).toBe('/pm-schedule/daily');
  });

  it('leaves the page as it is when the assignment is put off', async () => {
    const router = await assignmentOpenOverAPage();

    closed.next(false);
    closed.complete();
    // Give a navigation, were one started, the time to finish.
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(pageCreations).toBe(1);
    expect(router.url).toBe('/pm-schedule/daily');
  });

  it('shows nothing once every activity has a specialty', async () => {
    await signIn(Role.system_admin);

    httpMock.expectOne({ method: 'GET', url: UNASSIGNED }).flush([]);
    await dialogCodeCouldHaveLoaded();

    expect(open).not.toHaveBeenCalled();
  });

  it('asks once per sign-in, not on every change of who is known', async () => {
    await signIn(Role.system_admin);
    httpMock.expectOne({ method: 'GET', url: UNASSIGNED }).flush([]);

    await TestBed.inject(CurrentUserStore).load();
    TestBed.tick();

    httpMock.expectNone(UNASSIGNED);
  });

  it('asks again after signing in afresh', async () => {
    await signIn(Role.system_admin);
    httpMock.expectOne({ method: 'GET', url: UNASSIGNED }).flush([]);

    await signIn(Role.system_admin, fakeAccessToken({ subject: 'another-admin' }));

    httpMock.expectOne({ method: 'GET', url: UNASSIGNED }).flush([]);
  });

  it.each([Role.technical_manager, Role.management, Role.pm_inspector])(
    'never asks for a %s — the assignment is the System Admin’s alone',
    async (role) => {
      await signIn(role);

      httpMock.expectNone(UNASSIGNED);
      expect(open).not.toHaveBeenCalled();
    },
  );

  it('stays quiet when the list cannot be read', async () => {
    await signIn(Role.system_admin);

    httpMock
      .expectOne({ method: 'GET', url: UNASSIGNED })
      .flush(null, { status: 500, statusText: 'Server Error' });
    await dialogCodeCouldHaveLoaded();

    expect(open).not.toHaveBeenCalled();
  });
});
