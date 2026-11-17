import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
import { ConfirmUnassignQcActivityDialog } from './confirm-unassign-qc-activity-dialog';

const UNASSIGN = { method: 'DELETE', url: '/api/qc-equipment/e1/activities/q1' };

function setUp() {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MatDialogRef, useValue: { close } },
      {
        provide: MAT_DIALOG_DATA,
        useValue: {
          equipment: { id: 'e1', name: 'اکسترودر 1' },
          activity: { activityId: 'q1', activityName: 'بازرسی ابعادی', lastPerformedAt: null },
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(ConfirmUnassignQcActivityDialog);
  const root = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    close,
    root,
    httpMock: TestBed.inject(HttpTestingController),
    confirm: () =>
      Array.from(root.querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === 'حذف تخصیص')
        ?.click(),
  };
}

describe('ConfirmUnassignQcActivityDialog', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('says the records already made are kept', async () => {
    const { fixture, root } = setUp();
    await fixture.whenStable();

    expect(root.textContent).toContain(
      'تخصیص «بازرسی ابعادی» از «اکسترودر 1» برداشته می‌شود و دیگر برای آن ثبت نمی‌شود؛ سوابق انجام قبلی باقی می‌مانند.',
    );
  });

  it('removes the assignment and closes with true', async () => {
    const { fixture, close, httpMock, confirm } = setUp();
    await fixture.whenStable();

    confirm();
    httpMock.expectOne(UNASSIGN).flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(close).toHaveBeenCalledWith(true);
  });

  it('shows a refusal as its alert and stays open', async () => {
    const { fixture, root, close, httpMock, confirm } = setUp();
    await fixture.whenStable();

    confirm();
    httpMock
      .expectOne(UNASSIGN)
      .flush(
        { type: PROBLEM.qcActivityNotAssigned, status: 404 },
        { status: 404, statusText: 'Not Found' },
      );
    await fixture.whenStable();

    expect(close).not.toHaveBeenCalled();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'این فعالیت QC دیگر به این تجهیز تخصیص داده نشده است.',
    );
  });
});
