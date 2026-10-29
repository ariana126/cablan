import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
import { ConfirmRetireEquipmentDialog } from './confirm-retire-equipment-dialog';

function setUp() {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MatDialogRef, useValue: { close } },
      {
        provide: MAT_DIALOG_DATA,
        useValue: { equipment: { id: '7', name: 'اکسترودر 1', retired: false } },
      },
    ],
  });
  const fixture = TestBed.createComponent(ConfirmRetireEquipmentDialog);
  return {
    fixture,
    close,
    httpMock: TestBed.inject(HttpTestingController),
    root: fixture.nativeElement as HTMLElement,
  };
}

function button(root: HTMLElement, text: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.trim() === text,
  );
}

describe('ConfirmRetireEquipmentDialog', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('names the equipment and what retiring it stops', async () => {
    const { fixture, root } = setUp();
    await fixture.whenStable();

    expect(root.textContent).toContain('«اکسترودر 1»');
    expect(root.textContent).toContain('سابقهٔ تعمیرات آن حفظ می‌شود');
  });

  it('retires the equipment on «کنار گذاشتن تجهیز» and closes', async () => {
    const { fixture, root, close, httpMock } = setUp();
    await fixture.whenStable();

    button(root, 'کنار گذاشتن تجهیز')?.click();
    httpMock
      .expectOne({ method: 'POST', url: '/api/equipment/7/retirement' })
      .flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(close).toHaveBeenCalledWith(true);
  });

  it('stays open and says so when the equipment was already retired', async () => {
    const { fixture, root, close, httpMock } = setUp();
    await fixture.whenStable();

    button(root, 'کنار گذاشتن تجهیز')?.click();
    httpMock
      .expectOne({ method: 'POST', url: '/api/equipment/7/retirement' })
      .flush(
        { type: PROBLEM.equipmentRetired, title: 'Equipment Retired', status: 409 },
        { status: 409, statusText: 'Conflict' },
      );
    await fixture.whenStable();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'این تجهیز پیش‌تر کنار گذاشته شده است.',
    );
    expect(close).not.toHaveBeenCalled();
  });

  it('closes with nothing done on «انصراف»', async () => {
    const { fixture, root, close } = setUp();
    await fixture.whenStable();

    button(root, 'انصراف')?.click();

    expect(close).toHaveBeenCalledWith(false);
  });
});
