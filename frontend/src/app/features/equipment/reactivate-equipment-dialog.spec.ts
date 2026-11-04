import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatDatepickerToggleHarness } from '@angular/material/datepicker/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
import { provideJalaliDateAdapter } from '../../core/material/jalali-date-adapter';
import { ReactivateEquipmentDialog } from './reactivate-equipment-dialog';

const RETIRED = { id: '2', name: 'اکسترودر 2', retired: true, activePlanItemCount: 2 };

const planItem = (id: string, activityName: string) => ({
  id,
  activityId: `a-${id}`,
  activityName,
  intervalDays: 7,
  firstDueDate: '2026-09-23',
  nextDueDate: '2026-10-23',
});

const DETAIL = {
  id: '2',
  name: 'اکسترودر 2',
  retired: true,
  planItems: [planItem('p1', 'تعویض روغن'), planItem('p2', 'بررسی تابلو برق')],
  inactivePlanItems: [],
};

const POST = { method: 'POST', url: '/api/equipment/2/reactivation' };

const squeeze = (text: string | null | undefined) => text?.replace(/\s+/g, ' ').trim() ?? '';

describe('ReactivateEquipmentDialog', () => {
  let fixture: ComponentFixture<ReactivateEquipmentDialog>;
  let loader: HarnessLoader;
  let httpMock: HttpTestingController;
  let close: ReturnType<typeof vi.fn>;
  let root: HTMLElement;
  const originalScrollIntoView = Element.prototype.scrollIntoView;

  beforeEach(async () => {
    // Midday in Tehran and UTC alike, so "today" is one day whatever the runner's zone.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-04T09:00:00.000Z'));
    // jsdom lacks it; the calendar scrolls the active cell into view.
    Element.prototype.scrollIntoView = () => undefined;
    close = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideJalaliDateAdapter(),
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: { equipment: RETIRED } },
      ],
    });
    fixture = TestBed.createComponent(ReactivateEquipmentDialog);
    loader = TestbedHarnessEnvironment.documentRootLoader(fixture);
    httpMock = TestBed.inject(HttpTestingController);
    root = fixture.nativeElement as HTMLElement;
    // A tick, not `whenStable()`: the plan is being read until a spec flushes it.
    TestBed.inject(ApplicationRef).tick();
  });

  afterEach(() => {
    httpMock.verify();
    Element.prototype.scrollIntoView = originalScrollIntoView;
    vi.useRealTimers();
  });

  const planArrives = async (detail: object = DETAIL) => {
    httpMock.expectOne({ method: 'GET', url: '/api/equipment/2' }).flush(detail);
    await fixture.whenStable();
  };

  /** A radiogroup by its accessible name — the text of what `aria-labelledby` points at. */
  const radiogroup = (name: string) =>
    Array.from(root.querySelectorAll<HTMLElement>('[role="radiogroup"]')).find(
      (group) =>
        squeeze(root.querySelector(`#${group.getAttribute('aria-labelledby')}`)?.textContent) ===
        name,
    );

  const radio = (group: HTMLElement | undefined, label: string) => {
    const labelElement = Array.from(group?.querySelectorAll('label') ?? []).find(
      (element) => squeeze(element.textContent) === label,
    );
    const id = labelElement?.getAttribute('for');
    return id ? root.querySelector<HTMLInputElement>(`#${id}`) : null;
  };

  const fieldLabelled = (label: string) =>
    Array.from(root.querySelectorAll('mat-form-field')).find(
      (field) => squeeze(field.querySelector('mat-label')?.textContent) === label,
    );

  const submitButton = () =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => squeeze(button.textContent) === 'فعال سازی دوباره',
    );

  const submit = async () => {
    submitButton()?.click();
    await fixture.whenStable();
  };

  const pickTodayForTheFirstRow = async () => {
    const toggle = await loader.getHarness(MatDatepickerToggleHarness);
    await toggle.openCalendar();
    await (await toggle.getCalendar())!.selectCell({ today: true });
    await fixture.whenStable();
  };

  it('is titled «فعال سازی دوباره تجهیز» and names the equipment', async () => {
    await planArrives();

    expect(squeeze(root.querySelector('h2')?.textContent)).toBe('فعال سازی دوباره تجهیز');
    expect(root.textContent).toContain('اکسترودر 2');
  });

  it('offers each active plan row its own choice, named by the activity, continuing by default', async () => {
    await planArrives();

    for (const activity of ['تعویض روغن', 'بررسی تابلو برق']) {
      const group = radiogroup(activity);
      expect(group).toBeDefined();
      expect(radio(group, 'ادامه برنامه قبلی')?.checked).toBe(true);
      expect(radio(group, 'تعیین اولین موعد تازه')?.checked).toBe(false);
    }
    expect(fieldLabelled('اولین موعد تازه تعویض روغن')).toBeUndefined();
  });

  it('reactivates with every row continuing its previous calendar', async () => {
    await planArrives();

    await submit();
    const request = httpMock.expectOne(POST);
    expect(request.request.body).toEqual({});
    request.flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(close).toHaveBeenCalledWith(true);
  });

  it('restarts a row from the new first due date picked for it, the others continuing', async () => {
    await planArrives();

    radio(radiogroup('تعویض روغن'), 'تعیین اولین موعد تازه')?.click();
    await fixture.whenStable();
    expect(fieldLabelled('اولین موعد تازه تعویض روغن')).toBeDefined();
    await pickTodayForTheFirstRow();

    await submit();
    const request = httpMock.expectOne(POST);
    expect(request.request.body).toEqual({
      rescheduledItems: [{ planItemId: 'p1', firstDueDate: '2026-11-04' }],
    });
    request.flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(close).toHaveBeenCalledWith(true);
  });

  it('offers no day before today as a new first due date', async () => {
    await planArrives();

    radio(radiogroup('تعویض روغن'), 'تعیین اولین موعد تازه')?.click();
    await fixture.whenStable();
    const toggle = await loader.getHarness(MatDatepickerToggleHarness);
    await toggle.openCalendar();
    const calendar = (await toggle.getCalendar())!;

    // 2026-11-04 is ۱۴۰۵/۰۸/۱۳: the twelve days before it in the month are closed, today is not.
    const disabled = await calendar.getCells({ disabled: true });
    expect(disabled.length).toBeGreaterThanOrEqual(12);
    expect(await (await calendar.getCells({ today: true }))[0].isDisabled()).toBe(false);
  });

  it('asks for the new first due date of a row set to restart, sending nothing', async () => {
    await planArrives();

    radio(radiogroup('تعویض روغن'), 'تعیین اولین موعد تازه')?.click();
    await fixture.whenStable();
    await submit();

    expect(
      fieldLabelled('اولین موعد تازه تعویض روغن')?.querySelector('mat-error')?.textContent,
    ).toContain('اولین موعد تازه را انتخاب کنید.');
    expect(close).not.toHaveBeenCalled();
  });

  it('shows a first due date before the reactivation day in the dialog’s alert', async () => {
    await planArrives();

    radio(radiogroup('تعویض روغن'), 'تعیین اولین موعد تازه')?.click();
    await fixture.whenStable();
    await pickTodayForTheFirstRow();
    await submit();
    httpMock
      .expectOne(POST)
      .flush(
        { type: PROBLEM.reactivationFirstDueDateInPast },
        { status: 400, statusText: 'Bad Request' },
      );
    // The click's submit settles after the flush; wait for the dialog to say it.
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(squeeze(root.querySelector('[role="alert"]')?.textContent)).toBe(
        'اولین موعد تازه نمی تواند پیش از روز فعال سازی باشد.',
      );
    });
    expect(close).not.toHaveBeenCalled();
  });

  it('says so when the plan has no active row, and still reactivates', async () => {
    await planArrives({ ...DETAIL, planItems: [] });

    expect(root.textContent).toContain('این تجهیز فعالیت فعالی در برنامه ندارد.');
    await submit();
    httpMock.expectOne(POST).flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(close).toHaveBeenCalledWith(true);
  });
});
