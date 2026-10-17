import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppStandardBom } from '../../core/standard-boms/standard-boms-gateway';
import { ConfirmDeleteStandardBomDialog } from './confirm-delete-standard-bom-dialog';

const standardBom: AppStandardBom = {
  id: 'bom-1',
  miCode: '1234',
  brand: 'Legrand',
  standardLength: 305,
  active: true,
  description: '',
  productId: 'product-1',
  components: [],
};

describe('ConfirmDeleteStandardBomDialog', () => {
  let close: ReturnType<typeof vi.fn>;
  let httpMock: HttpTestingController;
  let fixture: ReturnType<typeof TestBed.createComponent<ConfirmDeleteStandardBomDialog>>;
  let root: HTMLElement;

  beforeEach(async () => {
    close = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: { standardBom } },
      ],
    });

    fixture = TestBed.createComponent(ConfirmDeleteStandardBomDialog);
    httpMock = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
    root = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('offers no close button: the choice is cancel or delete', () => {
    const labels = Array.from(root.querySelectorAll('button')).map((b) =>
      b.getAttribute('aria-label'),
    );

    expect(labels).not.toContain('بستن');
  });

  it('says that it cannot be undone', () => {
    expect(root.textContent).toContain('این کار قابل بازگشت نیست');
  });

  it('names the standard BOM being deleted by its MI code', () => {
    expect(root.textContent).toContain('1234');
  });

  it('has a confirm button named «حذف آنالیز»', () => {
    const button = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'حذف آنالیز',
    );
    expect(button).toBeDefined();
  });

  it('closes with true once the deletion succeeds', async () => {
    const button = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'حذف آنالیز',
    );
    button?.dispatchEvent(new Event('click'));

    httpMock
      .expectOne({ method: 'DELETE', url: '/api/standard-boms/bom-1' })
      .flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(close).toHaveBeenCalledWith(true);
  });

  it('shows an error and stays open when the deletion fails', async () => {
    const button = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'حذف آنالیز',
    );
    button?.dispatchEvent(new Event('click'));

    httpMock
      .expectOne({ method: 'DELETE', url: '/api/standard-boms/bom-1' })
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
