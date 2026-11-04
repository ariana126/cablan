import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';

import {
  CorrectionConfirmationDialog,
  CorrectionConfirmationDialogData,
} from './correction-confirmation-dialog';

const squeeze = (text: string | null | undefined) => text?.replace(/\s+/g, ' ').trim() ?? '';

async function setUp() {
  const close = vi.fn();
  const data: CorrectionConfirmationDialogData = {
    message: 'این اطلاعات در ۱ محصول («کابل NYY») استفاده شده است.',
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: data },
    ],
  });
  const fixture = TestBed.createComponent(CorrectionConfirmationDialog);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const button = (text: string) =>
    Array.from(root.querySelectorAll('button')).find(
      (candidate) => squeeze(candidate.textContent) === text,
    );
  return { root, close, button };
}

describe('CorrectionConfirmationDialog', () => {
  it('is titled «اعمال در اطلاعات و سوابق مرتبط», the dialog’s accessible name', async () => {
    const { root } = await setUp();

    expect(squeeze(root.querySelector('h2[mat-dialog-title]')?.textContent)).toBe(
      'اعمال در اطلاعات و سوابق مرتبط',
    );
  });

  it('says where the record is used', async () => {
    const { root } = await setUp();

    expect(root.textContent).toContain('این اطلاعات در ۱ محصول («کابل NYY») استفاده شده است.');
  });

  it('closes with true on «تایید»', async () => {
    const { button, close } = await setUp();

    button('تایید')?.click();

    expect(close).toHaveBeenCalledWith(true);
  });

  it('closes with false on «انصراف»', async () => {
    const { button, close } = await setUp();

    button('انصراف')?.click();

    expect(close).toHaveBeenCalledWith(false);
  });
});
