import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Role } from '../../api/model';
import { signInAs } from '../../core/identity/testing/sign-in-as';
import { provideJalaliDateAdapter } from '../../core/material/jalali-date-adapter';
import { QcExecutionDetailsDialog } from './qc-execution-details-dialog';
import { QcExecutionsPage } from './qc-executions-page';
import { EXECUTION } from './testing/qc-execution';

async function loaded(role: Role) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      provideJalaliDateAdapter(),
    ],
  });
  const httpMock = TestBed.inject(HttpTestingController);
  await signInAs(role, httpMock);
  const fixture = TestBed.createComponent(QcExecutionsPage);
  TestBed.inject(ApplicationRef).tick();
  httpMock
    .expectOne({ method: 'GET', url: '/api/qc-executions/filter-options' })
    .flush({ equipment: [], activities: [], performers: [] });
  const history = httpMock.expectOne((request) => request.url === '/api/qc-executions');
  expect(history.request.params.keys()).toEqual([]);
  history.flush({ executions: [EXECUTION], counts: [] });
  await fixture.whenStable();
  return { fixture, root: fixture.nativeElement as HTMLElement };
}

describe('QcExecutionsPage', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('is headed «سوابق فعالیت‌های QC» and lists every equipment’s records', async () => {
    const { root } = await loaded(Role.management);

    expect(root.querySelector('h1')?.textContent?.trim()).toBe('سوابق فعالیت‌های QC');
    expect(root.querySelector('td.mat-column-equipment')?.textContent?.trim()).toBe('اکسترودر 1');
  });

  it.each([
    [Role.system_admin, true],
    [Role.management, false],
  ])('offers %s the deletion in a record’s details: %s', async (role, canDelete) => {
    const { fixture, root } = await loaded(role);
    const open = vi
      .spyOn(TestBed.inject(MatDialog), 'open')
      .mockReturnValue({ afterClosed: () => of(undefined) } as MatDialogRef<unknown, unknown>);

    Array.from(root.querySelectorAll('button'))
      .find((button) => button.getAttribute('aria-label')?.startsWith('جزئیات '))
      ?.click();
    await fixture.whenStable();

    expect(open).toHaveBeenCalledWith(QcExecutionDetailsDialog, {
      data: { execution: EXECUTION, canDelete },
    });
  });
});
