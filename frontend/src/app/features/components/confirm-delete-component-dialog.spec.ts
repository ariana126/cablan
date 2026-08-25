import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfirmDeleteComponentDialog } from './confirm-delete-component-dialog';

const component = { id: 'component-1', name: 'پیچ شش‌گوش' };

describe('ConfirmDeleteComponentDialog', () => {
  let close: ReturnType<typeof vi.fn>;
  let httpMock: HttpTestingController;
  let fixture: ReturnType<typeof TestBed.createComponent<ConfirmDeleteComponentDialog>>;
  let root: HTMLElement;

  beforeEach(async () => {
    close = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: { component } },
      ],
    });

    fixture = TestBed.createComponent(ConfirmDeleteComponentDialog);
    httpMock = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
    root = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('names the component being deleted', () => {
    expect(root.textContent).toContain('پیچ شش‌گوش');
  });

  it('has a confirm button named "حذف"', () => {
    const button = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'حذف',
    );
    expect(button).toBeDefined();
  });

  it('closes with true once the deletion succeeds', async () => {
    const button = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'حذف',
    );
    button?.dispatchEvent(new Event('click'));

    httpMock
      .expectOne({ method: 'DELETE', url: '/api/components/component-1' })
      .flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(close).toHaveBeenCalledWith(true);
  });

  it('shows an error and stays open when the deletion fails', async () => {
    const button = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'حذف',
    );
    button?.dispatchEvent(new Event('click'));

    httpMock
      .expectOne({ method: 'DELETE', url: '/api/components/component-1' })
      .flush({ title: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();

    expect(close).not.toHaveBeenCalled();
    const alert = root.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('شما اجازهٔ انجام این عملیات را ندارید.');
  });

  it('closes with false when cancelled', () => {
    const button = Array.from(root.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('انصراف'),
    );
    button?.dispatchEvent(new Event('click'));

    expect(close).toHaveBeenCalledWith(false);
  });
});
