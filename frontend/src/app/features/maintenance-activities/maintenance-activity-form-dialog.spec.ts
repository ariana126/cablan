import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
import {
  CONFLICT,
  recordHasDependentsBody,
} from '../../core/http/testing/record-has-dependents-problem';
import {
  MaintenanceActivityFormDialog,
  MaintenanceActivityFormDialogData,
} from './maintenance-activity-form-dialog';

interface Submittable {
  onSubmit(): Promise<unknown>;
}

function setValue(element: Element | null, value: string): void {
  const input = element as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function nameInput(root: HTMLElement): HTMLInputElement | null {
  const label = Array.from(root.querySelectorAll('label')).find((element) =>
    element.textContent?.trim().startsWith('نام فعالیت'),
  );
  const id = label?.getAttribute('for');
  return id ? root.querySelector(`#${id}`) : null;
}

function specialtyGroup(root: HTMLElement): HTMLElement | null {
  return root.querySelector('[role="radiogroup"]');
}

/** The radiogroup's accessible name: the text of the element(s) `aria-labelledby` points at. */
function groupName(root: HTMLElement): string {
  const ids = specialtyGroup(root)?.getAttribute('aria-labelledby')?.split(' ') ?? [];
  return ids
    .map((id) => root.querySelector(`#${id}`)?.textContent?.trim() ?? '')
    .join(' ')
    .trim();
}

function radio(root: HTMLElement, label: string): HTMLInputElement | null {
  const labelElement = Array.from(root.querySelectorAll('mat-radio-button label')).find(
    (element) => element.textContent?.trim() === label,
  );
  const id = labelElement?.getAttribute('for');
  return id ? root.querySelector(`#${id}`) : null;
}

function setUp(data: MaintenanceActivityFormDialogData) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: data },
    ],
  });
  const fixture = TestBed.createComponent(MaintenanceActivityFormDialog);
  return {
    fixture,
    close,
    httpMock: TestBed.inject(HttpTestingController),
    root: fixture.nativeElement as HTMLElement,
    submit: () => (fixture.componentInstance as unknown as Submittable).onSubmit(),
  };
}

describe('MaintenanceActivityFormDialog', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('asks for the name and the specialty and submits with «ثبت فعالیت»', async () => {
    const { fixture, root } = setUp({ mode: 'create' });
    await fixture.whenStable();

    expect(root.querySelector('h2')?.textContent?.trim()).toBe('افزودن فعالیت');
    expect(nameInput(root)?.value).toBe('');
    expect(groupName(root)).toBe('تخصص');
    expect(radio(root, 'برق')?.checked).toBe(false);
    expect(radio(root, 'مکانیک')?.checked).toBe(false);
    expect(
      Array.from(root.querySelectorAll('button')).map((button) => button.textContent?.trim()),
    ).toContain('ثبت فعالیت');
  });

  it('registers the activity and closes on success', async () => {
    const { fixture, root, close, httpMock, submit } = setUp({ mode: 'create' });
    await fixture.whenStable();

    setValue(nameInput(root), 'تعویض روغن');
    radio(root, 'مکانیک')?.click();
    await fixture.whenStable();
    const submitted = submit();
    const request = httpMock.expectOne({ method: 'POST', url: '/api/maintenance-activities' });
    expect(request.request.body).toEqual({ name: 'تعویض روغن', specialty: 'mechanical' });
    request.flush({ id: '1' }, { status: 201, statusText: 'Created' });
    await submitted;

    expect(close).toHaveBeenCalledWith(true);
  });

  it('refuses an empty name on the field, without asking the API', async () => {
    const { fixture, root, close, submit } = setUp({ mode: 'create' });
    await fixture.whenStable();

    radio(root, 'برق')?.click();
    await submit();
    await fixture.whenStable();

    expect(root.querySelector('mat-error')?.textContent?.trim()).toBe('نام فعالیت را وارد کنید.');
    expect(close).not.toHaveBeenCalled();
  });

  it('refuses a missing specialty under the choice, keeping «ثبت فعالیت» enabled and asking nothing', async () => {
    const { fixture, root, close, submit } = setUp({ mode: 'create' });
    await fixture.whenStable();

    setValue(nameInput(root), 'تعویض روغن');
    await fixture.whenStable();
    const submitButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'ثبت فعالیت',
    );
    expect(submitButton?.disabled).toBe(false);
    await submit();
    await fixture.whenStable();

    const errors = Array.from(root.querySelectorAll('mat-error')).map((error) =>
      error.textContent?.trim(),
    );
    expect(errors).toEqual(['تخصص فعالیت را انتخاب کنید.']);
    expect(specialtyGroup(root)?.getAttribute('aria-invalid')).toBe('true');
    expect(close).not.toHaveBeenCalled();
  });

  it('shows a taken name on the name field and stays open', async () => {
    const { fixture, root, close, httpMock, submit } = setUp({
      mode: 'edit',
      activity: { id: '4', name: 'بررسی تابلو برق', specialty: 'electrical' },
    });
    await fixture.whenStable();

    setValue(nameInput(root), 'تعویض روغن');
    await fixture.whenStable();
    const submitted = submit();
    const request = httpMock.expectOne({ method: 'PATCH', url: '/api/maintenance-activities/4' });
    expect(request.request.body).toEqual({ name: 'تعویض روغن', specialty: 'electrical' });
    request.flush(
      { type: PROBLEM.maintenanceActivityNameTaken, title: 'Name Taken', status: 409 },
      { status: 409, statusText: 'Conflict' },
    );
    await submitted;
    await fixture.whenStable();

    expect(root.querySelector('mat-error')?.textContent?.trim()).toBe(
      'فعالیتی با این نام قبلاً ثبت شده است.',
    );
    expect(close).not.toHaveBeenCalled();
  });

  it('says which equipment plans use the activity and stays open when the edit is refused', async () => {
    const { fixture, root, close, httpMock, submit } = setUp({
      mode: 'edit',
      activity: { id: '4', name: 'بررسی تابلو برق', specialty: 'electrical' },
    });
    await fixture.whenStable();

    radio(root, 'مکانیک')?.click();
    await fixture.whenStable();
    const submitted = submit();
    httpMock
      .expectOne({ method: 'PATCH', url: '/api/maintenance-activities/4' })
      .flush(
        recordHasDependentsBody(
          [{ kind: 'equipment-pm-plan', count: 2, names: ['اکسترودر 1', 'اکسترودر 2'] }],
          'MaintenanceActivity',
        ),
        CONFLICT,
      );
    await submitted;
    await fixture.whenStable();

    expect(close).not.toHaveBeenCalled();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'امکان ویرایش این اطلاعات وجود ندارد، زیرا در برنامه PM ۲ تجهیز («اکسترودر 1، اکسترودر 2») استفاده شده است.',
    );
  });

  it('shows the API’s refusal of the specialty under the choice', async () => {
    const { fixture, root, httpMock, submit } = setUp({ mode: 'create' });
    await fixture.whenStable();

    setValue(nameInput(root), 'تعویض روغن');
    radio(root, 'برق')?.click();
    await fixture.whenStable();
    const submitted = submit();
    httpMock.expectOne({ method: 'POST', url: '/api/maintenance-activities' }).flush(
      {
        type: PROBLEM.validationError,
        title: 'Validation Error',
        status: 400,
        errors: [{ field: 'specialty', message: 'specialty must be one of …' }],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await submitted;
    await fixture.whenStable();

    expect(root.querySelector('mat-error')?.textContent?.trim()).toBe(
      'تخصص فعالیت را انتخاب کنید.',
    );
  });

  it('opens on the activity it edits, its specialty chosen', async () => {
    const { fixture, root } = setUp({
      mode: 'edit',
      activity: { id: '4', name: 'تعویض روغن', specialty: 'mechanical' },
    });
    await fixture.whenStable();

    expect(root.querySelector('h2')?.textContent?.trim()).toBe('ویرایش فعالیت');
    expect(nameInput(root)?.value).toBe('تعویض روغن');
    expect(radio(root, 'مکانیک')?.checked).toBe(true);
    expect(radio(root, 'برق')?.checked).toBe(false);
  });

  it('opens an activity without a specialty with neither chosen', async () => {
    const { fixture, root } = setUp({
      mode: 'edit',
      activity: { id: '4', name: 'روانکاری', specialty: null },
    });
    await fixture.whenStable();

    expect(radio(root, 'برق')?.checked).toBe(false);
    expect(radio(root, 'مکانیک')?.checked).toBe(false);
  });
});
