import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
import { ConfirmDeactivatePmPlanItemDialog } from './confirm-deactivate-pm-plan-item-dialog';
import { squeeze } from './testing/pm-plans-queries';

const URL = '/api/equipment/e1/pm-plan-items/p1/deactivation';
const DEACTIVATE = 'غیرفعال‌سازی';

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
  const fixture = TestBed.createComponent(ConfirmDeactivatePmPlanItemDialog);
  return {
    fixture,
    close,
    httpMock: TestBed.inject(HttpTestingController),
    root: fixture.nativeElement as HTMLElement,
  };
}

const button = (root: HTMLElement, text: string) =>
  Array.from(root.querySelectorAll('button')).find(
    (candidate) => squeeze(candidate.textContent) === text,
  );

describe('ConfirmDeactivatePmPlanItemDialog', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('is titled «غیرفعال‌سازی فعالیت در برنامه»', async () => {
    const { fixture, root } = setUp();
    await fixture.whenStable();

    expect(squeeze(root.querySelector('h2')?.textContent)).toBe(`${DEACTIVATE} فعالیت در برنامه`);
  });

  it('names the activity and the equipment, and says the history stays and it cannot be undone', async () => {
    const { fixture, root } = setUp();
    await fixture.whenStable();

    const body = squeeze(root.textContent);
    expect(body).toContain('فعالیت «تعویض روغن» در برنامهٔ تجهیز «اکسترودر 1» غیرفعال می‌شود.');
    expect(body).toContain('برنامه و سوابق انجام آن حفظ می‌شود');
    expect(body).toContain('دیگر نمی‌توان آن را دوباره فعال کرد.');
  });

  it('offers no way to delete the item', async () => {
    const { fixture, root } = setUp();
    await fixture.whenStable();

    expect(squeeze(root.textContent)).not.toContain('حذف');
  });

  it('deactivates the item on «غیرفعال‌سازی» and closes', async () => {
    const { fixture, root, close, httpMock } = setUp();
    await fixture.whenStable();

    button(root, DEACTIVATE)?.click();
    httpMock
      .expectOne({ method: 'POST', url: URL })
      .flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(close).toHaveBeenCalledWith(true);
  });

  it.each([
    [403, undefined, 'شما اجازهٔ انجام این عملیات را ندارید.'],
    [409, PROBLEM.pmPlanItemDeactivated, 'این فعالیت پیش‌تر در برنامه غیرفعال شده است.'],
    [409, PROBLEM.equipmentRetired, 'این تجهیز کنار گذاشته شده و برنامهٔ آن متوقف است.'],
    [404, PROBLEM.entityNotFound, 'این فعالیت دیگر در برنامه نیست. صفحه را تازه‌سازی کنید.'],
    [500, undefined, 'غیرفعال‌سازی فعالیت ممکن نشد. دوباره تلاش کنید.'],
  ] as const)(
    'stays open with an alert when the API answers %i %s',
    async (status, type, message) => {
      const { fixture, root, close, httpMock } = setUp();
      await fixture.whenStable();

      button(root, DEACTIVATE)?.click();
      httpMock
        .expectOne({ method: 'POST', url: URL })
        .flush(type ? { type, title: 'Refused', status } : { title: 'Refused' }, {
          status,
          statusText: 'Refused',
        });
      await fixture.whenStable();

      expect(squeeze(root.querySelector('[role="alert"]')?.textContent)).toContain(message);
      expect(close).not.toHaveBeenCalled();
    },
  );
});
