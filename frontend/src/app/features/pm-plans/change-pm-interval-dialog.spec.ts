import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
import { ChangePmIntervalDialog } from './change-pm-interval-dialog';

interface Submittable {
  onSubmit(): Promise<unknown>;
}

const ITEM = {
  id: 'p1',
  activityId: 'a1',
  activityName: 'تعویض روغن',
  intervalDays: 30,
  firstDueDate: '2026-09-23',
  nextDueDate: '2026-10-23',
};

function setUp() {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: { equipmentId: 'e1', item: ITEM } },
    ],
  });
  const fixture = TestBed.createComponent(ChangePmIntervalDialog);
  const root = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    close,
    root,
    httpMock: TestBed.inject(HttpTestingController),
    submit: () => (fixture.componentInstance as unknown as Submittable).onSubmit(),
    interval: () => root.querySelector<HTMLInputElement>('input[type="number"]')!,
  };
}

describe('ChangePmIntervalDialog', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('opens on the item’s current interval', async () => {
    const { fixture, root, interval } = setUp();
    await fixture.whenStable();

    expect(root.querySelector('h2')?.textContent?.trim()).toBe('تغییر دوره');
    expect(root.textContent).toContain('تعویض روغن');
    expect(root.querySelector('mat-label')?.textContent?.trim()).toBe('دوره (روز)');
    expect(interval().value).toBe('30');
  });

  it('sends the new interval and closes', async () => {
    const { fixture, close, httpMock, submit, interval } = setUp();
    await fixture.whenStable();

    interval().value = '15';
    interval().dispatchEvent(new Event('input'));
    await fixture.whenStable();
    const submitted = submit();
    const request = httpMock.expectOne({
      method: 'PATCH',
      url: '/api/equipment/e1/pm-plan-items/p1',
    });
    expect(request.request.body).toEqual({ intervalDays: 15 });
    request.flush(null, { status: 204, statusText: 'No Content' });
    await submitted;

    expect(close).toHaveBeenCalledWith(true);
  });

  it('refuses an interval that is not a positive number of days', async () => {
    const { fixture, root, close, submit, interval } = setUp();
    await fixture.whenStable();

    interval().value = '0';
    interval().dispatchEvent(new Event('input'));
    await submit();
    await fixture.whenStable();

    expect(root.querySelector('mat-error')?.textContent?.trim()).toBe(
      'دوره باید تعداد روزی بزرگ‌تر از صفر باشد.',
    );
    expect(close).not.toHaveBeenCalled();
  });

  it('stays open with an alert when the item left the plan meanwhile', async () => {
    const { fixture, root, close, httpMock, submit } = setUp();
    await fixture.whenStable();

    const submitted = submit();
    httpMock
      .expectOne({ method: 'PATCH', url: '/api/equipment/e1/pm-plan-items/p1' })
      .flush(
        { type: PROBLEM.pmPlanItemRemoved, title: 'PM Plan Item Removed', status: 409 },
        { status: 409, statusText: 'Conflict' },
      );
    await submitted;
    await fixture.whenStable();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'این فعالیت از برنامهٔ تجهیز حذف شده است.',
    );
    expect(close).not.toHaveBeenCalled();
  });
});
