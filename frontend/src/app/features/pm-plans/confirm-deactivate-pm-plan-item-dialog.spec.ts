import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConfirmRemovePmPlanItemDialog } from './confirm-remove-pm-plan-item-dialog';

const URL = '/api/equipment/e1/pm-plan-items/p1';

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
          item: {
            id: 'p1',
            activityId: 'a1',
            activityName: 'تعویض روغن',
            intervalDays: 30,
            firstDueDate: '2026-09-23',
            nextDueDate: '2026-10-23',
          },
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(ConfirmRemovePmPlanItemDialog);
  return {
    fixture,
    close,
    httpMock: TestBed.inject(HttpTestingController),
    root: fixture.nativeElement as HTMLElement,
  };
}

const button = (root: HTMLElement, text: string) =>
  Array.from(root.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.trim() === text,
  );

describe('ConfirmRemovePmPlanItemDialog', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('names the activity, the equipment and that the history stays', async () => {
    const { fixture, root } = setUp();
    await fixture.whenStable();

    expect(root.textContent).toContain('«تعویض روغن»');
    expect(root.textContent).toContain('«اکسترودر 1»');
    expect(root.textContent).toContain('سابقهٔ انجام آن حفظ می‌شود');
  });

  it('removes the item on «حذف از برنامه» and closes', async () => {
    const { fixture, root, close, httpMock } = setUp();
    await fixture.whenStable();

    button(root, 'حذف از برنامه')?.click();
    httpMock
      .expectOne({ method: 'DELETE', url: URL })
      .flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(close).toHaveBeenCalledWith(true);
  });

  it('stays open with an alert when removal fails', async () => {
    const { fixture, root, close, httpMock } = setUp();
    await fixture.whenStable();

    button(root, 'حذف از برنامه')?.click();
    httpMock
      .expectOne({ method: 'DELETE', url: URL })
      .flush({ title: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'شما اجازهٔ انجام این عملیات را ندارید.',
    );
    expect(close).not.toHaveBeenCalled();
  });
});
