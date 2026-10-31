import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
import { EquipmentFormDialog, EquipmentFormDialogData } from './equipment-form-dialog';

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
    element.textContent?.trim().startsWith('نام تجهیز'),
  );
  const id = label?.getAttribute('for');
  return id ? root.querySelector(`#${id}`) : null;
}

function setUp(data: EquipmentFormDialogData) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: data },
    ],
  });
  const fixture = TestBed.createComponent(EquipmentFormDialog);
  return {
    fixture,
    close,
    httpMock: TestBed.inject(HttpTestingController),
    root: fixture.nativeElement as HTMLElement,
    submit: () => (fixture.componentInstance as unknown as Submittable).onSubmit(),
  };
}

const buttonTexts = (root: HTMLElement): string[] =>
  Array.from(root.querySelectorAll('button')).map((button) => button.textContent?.trim() ?? '');

describe('EquipmentFormDialog', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('asks for the name alone and submits with «ثبت تجهیز»', async () => {
    const { fixture, root } = setUp({ mode: 'create' });
    await fixture.whenStable();

    expect(root.querySelector('h2')?.textContent?.trim()).toBe('افزودن تجهیز');
    expect(nameInput(root)?.value).toBe('');
    expect(buttonTexts(root)).toContain('ثبت تجهیز');
  });

  it('registers the equipment and closes on success', async () => {
    const { fixture, root, close, httpMock, submit } = setUp({ mode: 'create' });
    await fixture.whenStable();

    setValue(nameInput(root), 'اکسترودر 1');
    await fixture.whenStable();
    const submitted = submit();
    const request = httpMock.expectOne({ method: 'POST', url: '/api/equipment' });
    expect(request.request.body).toEqual({ name: 'اکسترودر 1' });
    request.flush({ id: '1' }, { status: 201, statusText: 'Created' });
    await submitted;

    expect(close).toHaveBeenCalledWith(true);
  });

  it('refuses a blank name on the field, without asking the API', async () => {
    const { fixture, root, close, submit } = setUp({ mode: 'create' });
    await fixture.whenStable();

    setValue(nameInput(root), '   ');
    await submit();
    await fixture.whenStable();

    expect(root.querySelector('mat-error')?.textContent?.trim()).toBe('نام تجهیز را وارد کنید.');
    expect(close).not.toHaveBeenCalled();
  });

  it('shows a taken name on the name field and stays open', async () => {
    const { fixture, root, close, httpMock, submit } = setUp({ mode: 'create' });
    await fixture.whenStable();

    setValue(nameInput(root), 'اکسترودر 1');
    await fixture.whenStable();
    const submitted = submit();
    httpMock.expectOne({ method: 'POST', url: '/api/equipment' }).flush(
      {
        type: PROBLEM.equipmentNameTaken,
        title: 'Equipment Name Taken',
        status: 409,
        detail: 'تجهیزی با این نام قبلا ثبت شده است',
      },
      { status: 409, statusText: 'Conflict' },
    );
    await submitted;
    await fixture.whenStable();

    expect(root.querySelector('mat-error')?.textContent?.trim()).toBe(
      'تجهیزی با این نام قبلاً ثبت شده است.',
    );
    expect(close).not.toHaveBeenCalled();
  });

  it('renames the equipment it was opened for', async () => {
    const { fixture, root, close, httpMock, submit } = setUp({
      mode: 'edit',
      equipment: { id: '7', name: 'اکسترودر 1', retired: false, activePlanItemCount: 0 },
    });
    await fixture.whenStable();

    expect(root.querySelector('h2')?.textContent?.trim()).toBe('ویرایش تجهیز');
    expect(nameInput(root)?.value).toBe('اکسترودر 1');

    setValue(nameInput(root), 'اکسترودر اصلی');
    await fixture.whenStable();
    const submitted = submit();
    const request = httpMock.expectOne({ method: 'PATCH', url: '/api/equipment/7' });
    expect(request.request.body).toEqual({ name: 'اکسترودر اصلی' });
    request.flush(null, { status: 204, statusText: 'No Content' });
    await submitted;

    expect(close).toHaveBeenCalledWith(true);
  });
});
