import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
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

  it('asks for the name alone and submits with «ثبت فعالیت»', async () => {
    const { fixture, root } = setUp({ mode: 'create' });
    await fixture.whenStable();

    expect(root.querySelector('h2')?.textContent?.trim()).toBe('افزودن فعالیت');
    expect(nameInput(root)?.value).toBe('');
    expect(
      Array.from(root.querySelectorAll('button')).map((button) => button.textContent?.trim()),
    ).toContain('ثبت فعالیت');
  });

  it('registers the activity and closes on success', async () => {
    const { fixture, root, close, httpMock, submit } = setUp({ mode: 'create' });
    await fixture.whenStable();

    setValue(nameInput(root), 'تعویض روغن');
    await fixture.whenStable();
    const submitted = submit();
    const request = httpMock.expectOne({ method: 'POST', url: '/api/maintenance-activities' });
    expect(request.request.body).toEqual({ name: 'تعویض روغن' });
    request.flush({ id: '1' }, { status: 201, statusText: 'Created' });
    await submitted;

    expect(close).toHaveBeenCalledWith(true);
  });

  it('refuses an empty name on the field, without asking the API', async () => {
    const { fixture, root, close, submit } = setUp({ mode: 'create' });
    await fixture.whenStable();

    await submit();
    await fixture.whenStable();

    expect(root.querySelector('mat-error')?.textContent?.trim()).toBe('نام فعالیت را وارد کنید.');
    expect(close).not.toHaveBeenCalled();
  });

  it('shows a taken name on the name field and stays open', async () => {
    const { fixture, root, close, httpMock, submit } = setUp({
      mode: 'edit',
      activity: { id: '4', name: 'بررسی تابلو برق' },
    });
    await fixture.whenStable();

    setValue(nameInput(root), 'تعویض روغن');
    await fixture.whenStable();
    const submitted = submit();
    const request = httpMock.expectOne({ method: 'PATCH', url: '/api/maintenance-activities/4' });
    expect(request.request.body).toEqual({ name: 'تعویض روغن' });
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

  it('opens on the activity it renames', async () => {
    const { fixture, root } = setUp({ mode: 'edit', activity: { id: '4', name: 'تعویض روغن' } });
    await fixture.whenStable();

    expect(root.querySelector('h2')?.textContent?.trim()).toBe('ویرایش فعالیت');
    expect(nameInput(root)?.value).toBe('تعویض روغن');
  });
});
