import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatAutocompleteHarness } from '@angular/material/autocomplete/testing';
import { MatDatepickerToggleHarness } from '@angular/material/datepicker/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { toIsoCalendarDate } from '../../core/date/calendar-date';
import { PROBLEM } from '../../core/http/problem-details';
import { provideJalaliDateAdapter } from '../../core/material/jalali-date-adapter';
import { AddPmPlanItemDialog } from './add-pm-plan-item-dialog';

interface Submittable {
  onSubmit(): Promise<unknown>;
}

const ACTIVITIES = [
  { id: 'a1', name: 'بررسی تابلو برق' },
  { id: 'a2', name: 'تعویض روغن' },
];

const ITEMS_URL = '/api/equipment/e1/pm-plan-items';

function fieldNamed(root: HTMLElement, label: string): HTMLInputElement | null {
  const match = Array.from(root.querySelectorAll('label')).find(
    (element) => element.textContent?.replace('*', '').trim() === label,
  );
  const id = match?.getAttribute('for');
  return id ? root.querySelector(`#${id}`) : null;
}

/** The error under the field labelled `label`. */
function errorOf(root: HTMLElement, label: string): string | undefined {
  const field = Array.from(root.querySelectorAll('mat-form-field')).find(
    (candidate) => candidate.querySelector('mat-label')?.textContent?.trim() === label,
  );
  return field?.querySelector('mat-error')?.textContent?.trim();
}

describe('AddPmPlanItemDialog', () => {
  let fixture: ComponentFixture<AddPmPlanItemDialog>;
  let loader: HarnessLoader;
  let httpMock: HttpTestingController;
  let close: ReturnType<typeof vi.fn>;
  let root: HTMLElement;
  const originalScrollIntoView = Element.prototype.scrollIntoView;

  const submit = () => (fixture.componentInstance as unknown as Submittable).onSubmit();

  beforeEach(async () => {
    Element.prototype.scrollIntoView = vi.fn();
    close = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideJalaliDateAdapter(),
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: { equipment: { id: 'e1', name: 'اکسترودر 1' } } },
      ],
    });
    fixture = TestBed.createComponent(AddPmPlanItemDialog);
    loader = TestbedHarnessEnvironment.documentRootLoader(fixture);
    httpMock = TestBed.inject(HttpTestingController);
    root = fixture.nativeElement as HTMLElement;
    // A tick, not `whenStable()`: the activities request is pending until flushed just below.
    TestBed.inject(ApplicationRef).tick();
    httpMock.expectOne({ method: 'GET', url: '/api/maintenance-activities' }).flush(ACTIVITIES);
    await fixture.whenStable();
  });

  afterEach(() => {
    Element.prototype.scrollIntoView = originalScrollIntoView;
    httpMock.verify();
  });

  const chooseActivity = async (name: string): Promise<void> => {
    const picker = await loader.getHarness(MatAutocompleteHarness);
    await picker.enterText(name);
    await picker.selectOption({ text: name });
    await fixture.whenStable();
  };

  const enterInterval = async (days: string): Promise<void> => {
    const input = fieldNamed(root, 'دوره (روز)')!;
    input.value = days;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };

  const pickTodayAsFirstDueDate = async (): Promise<void> => {
    const toggle = await loader.getHarness(MatDatepickerToggleHarness);
    await toggle.openCalendar();
    await (await toggle.getCalendar())!.selectCell({ today: true });
    await fixture.whenStable();
  };

  it('names the equipment the activity is added to', () => {
    expect(root.querySelector('h2')?.textContent?.trim()).toBe('افزودن فعالیت به برنامه');
    expect(root.textContent).toContain('اکسترودر 1');
  });

  // The duplicate rule is the API's: an activity already in the plan stays pickable, and the 409
  // says why it cannot be added again.
  it('offers every registered activity', async () => {
    const picker = await loader.getHarness(MatAutocompleteHarness);
    await picker.focus();

    const options = await picker.getOptions();
    expect(await Promise.all(options.map((option) => option.getText()))).toEqual([
      'بررسی تابلو برق',
      'تعویض روغن',
    ]);
  });

  it('asks for the interval in days in a number field', () => {
    expect(fieldNamed(root, 'دوره (روز)')?.type).toBe('number');
  });

  it('adds the activity with its interval in days and its first due date, then closes', async () => {
    await chooseActivity('تعویض روغن');
    await enterInterval('30');
    await pickTodayAsFirstDueDate();

    const submitted = submit();
    const request = httpMock.expectOne({ method: 'POST', url: ITEMS_URL });
    expect(request.request.body).toEqual({
      activityId: 'a2',
      intervalValue: 30,
      intervalUnit: 'days',
      firstDueDate: toIsoCalendarDate(new Date()),
    });
    request.flush({ id: 'p1' }, { status: 201, statusText: 'Created' });
    await submitted;

    // The equipment's id, so a page that let the visitor choose it knows which one now has a plan.
    expect(close).toHaveBeenCalledWith('e1');
  });

  it('asks for no equipment when it was opened for one', () => {
    expect(fieldNamed(root, 'تجهیز')).toBeNull();
  });

  it('says which field is missing, without asking the API', async () => {
    await submit();
    await fixture.whenStable();

    expect(errorOf(root, 'فعالیت')).toBe('فعالیت را انتخاب کنید.');
    expect(errorOf(root, 'دوره (روز)')).toBe('دوره را وارد کنید.');
    expect(errorOf(root, 'اولین موعد')).toBe('اولین موعد را انتخاب کنید.');
    expect(close).not.toHaveBeenCalled();
  });

  it.each(['0', '-3', '1.5'])('refuses %s as an interval', async (days) => {
    await chooseActivity('تعویض روغن');
    await enterInterval(days);
    await pickTodayAsFirstDueDate();

    await submit();
    await fixture.whenStable();

    expect(errorOf(root, 'دوره (روز)')).toBe('دوره باید تعداد روزی بزرگ‌تر از صفر باشد.');
  });

  it('shows an activity already in the plan as an alert, and stays open', async () => {
    await chooseActivity('تعویض روغن');
    await enterInterval('30');
    await pickTodayAsFirstDueDate();

    const submitted = submit();
    httpMock.expectOne({ method: 'POST', url: ITEMS_URL }).flush(
      {
        type: PROBLEM.activityAlreadyInPmPlan,
        title: 'Activity Already In PM Plan',
        status: 409,
      },
      { status: 409, statusText: 'Conflict' },
    );
    await submitted;
    await fixture.whenStable();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'این فعالیت قبلاً به برنامهٔ این تجهیز اضافه شده است.',
    );
    expect(close).not.toHaveBeenCalled();
  });
});

/**
 * «تعریف برنامه برای تجهیز» (issue #81): the same dialog, opened for no equipment, asks which one
 * first — among the candidates the page passes (active equipment with no plan item yet).
 */
describe('AddPmPlanItemDialog, choosing the equipment', () => {
  const CANDIDATES = [
    { id: 'e2', name: 'اکسترودر 2' },
    { id: 'e4', name: 'دستگاه قلع اندود' },
  ];

  let fixture: ComponentFixture<AddPmPlanItemDialog>;
  let loader: HarnessLoader;
  let httpMock: HttpTestingController;
  let close: ReturnType<typeof vi.fn>;
  let root: HTMLElement;
  const originalScrollIntoView = Element.prototype.scrollIntoView;

  const submit = () => (fixture.componentInstance as unknown as Submittable).onSubmit();

  beforeEach(async () => {
    Element.prototype.scrollIntoView = vi.fn();
    close = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideJalaliDateAdapter(),
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: { candidates: CANDIDATES } },
      ],
    });
    fixture = TestBed.createComponent(AddPmPlanItemDialog);
    loader = TestbedHarnessEnvironment.documentRootLoader(fixture);
    httpMock = TestBed.inject(HttpTestingController);
    root = fixture.nativeElement as HTMLElement;
    TestBed.inject(ApplicationRef).tick();
    httpMock.expectOne({ method: 'GET', url: '/api/maintenance-activities' }).flush(ACTIVITIES);
    await fixture.whenStable();
  });

  afterEach(() => {
    Element.prototype.scrollIntoView = originalScrollIntoView;
    httpMock.verify();
  });

  /** The equipment picker comes first, the activity picker second. */
  const pickers = () => loader.getAllHarnesses(MatAutocompleteHarness);

  const choose = async (picker: MatAutocompleteHarness, name: string): Promise<void> => {
    await picker.enterText(name);
    await picker.selectOption({ text: name });
    await fixture.whenStable();
  };

  it('is headed «تعریف برنامه برای تجهیز»', () => {
    expect(root.querySelector('h2')?.textContent?.trim()).toBe('تعریف برنامه برای تجهیز');
  });

  it('asks for the equipment first, in a picker labelled «تجهیز»', () => {
    const labels = Array.from(root.querySelectorAll('mat-label')).map((label) =>
      label.textContent?.replace('*', '').trim(),
    );
    expect(labels.slice(0, 2)).toEqual(['تجهیز', 'فعالیت']);
  });

  it('offers exactly the candidates, each named by the equipment alone', async () => {
    const [equipment] = await pickers();
    await equipment.focus();

    const options = await equipment.getOptions();
    expect(await Promise.all(options.map((option) => option.getText()))).toEqual([
      'اکسترودر 2',
      'دستگاه قلع اندود',
    ]);
  });

  it('says the equipment is missing, without asking the API', async () => {
    await submit();
    await fixture.whenStable();

    expect(errorOf(root, 'تجهیز')).toBe('تجهیز را انتخاب کنید.');
    expect(close).not.toHaveBeenCalled();
  });

  it('adds the activity to the chosen equipment’s plan, then closes with its id', async () => {
    const [equipment, activity] = await pickers();
    await choose(equipment, 'دستگاه قلع اندود');
    await choose(activity, 'تعویض روغن');
    const interval = fieldNamed(root, 'دوره (روز)')!;
    interval.value = '30';
    interval.dispatchEvent(new Event('input'));
    const toggle = await loader.getHarness(MatDatepickerToggleHarness);
    await toggle.openCalendar();
    await (await toggle.getCalendar())!.selectCell({ today: true });
    await fixture.whenStable();

    const submitted = submit();
    const request = httpMock.expectOne({ method: 'POST', url: '/api/equipment/e4/pm-plan-items' });
    expect(request.request.body).toEqual({
      activityId: 'a2',
      intervalValue: 30,
      intervalUnit: 'days',
      firstDueDate: toIsoCalendarDate(new Date()),
    });
    request.flush({ id: 'p1' }, { status: 201, statusText: 'Created' });
    await submitted;

    expect(close).toHaveBeenCalledWith('e4');
  });
});
