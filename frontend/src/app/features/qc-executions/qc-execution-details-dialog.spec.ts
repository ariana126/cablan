import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { AppQcExecution } from '../../core/qc/qc-executions-gateway';
import { EXECUTION } from './testing/qc-execution';
import { ConfirmDeleteQcExecutionDialog } from './confirm-delete-qc-execution-dialog';
import { QcExecutionDetailsDialog } from './qc-execution-details-dialog';

function setUp(canDelete: boolean, execution: AppQcExecution = EXECUTION) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: { execution, canDelete } },
    ],
  });
  const fixture = TestBed.createComponent(QcExecutionDetailsDialog);
  return { fixture, close, root: fixture.nativeElement as HTMLElement };
}

/** Each `dt` with the text of the `dd` after it. */
const facts = (root: HTMLElement): Record<string, string> =>
  Object.fromEntries(
    Array.from(root.querySelectorAll('dt')).map((term) => [
      term.textContent?.trim() ?? '',
      term.nextElementSibling?.textContent?.trim() ?? '',
    ]),
  );

const deleteButton = (root: HTMLElement) =>
  Array.from(root.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === 'حذف سابقه',
  );

describe('QcExecutionDetailsDialog', () => {
  it('shows the record in full: the row’s facts, its tracking number and its notes', async () => {
    const { fixture, root } = setUp(false);
    await fixture.whenStable();

    expect(root.querySelector('h2')?.textContent?.trim()).toBe('جزئیات سابقه QC');
    expect(facts(root)).toEqual({
      تجهیز: 'اکسترودر 1',
      فعالیت: 'بازرسی ابعادی',
      'ثبت کننده': 'نیکروش',
      'زمان انجام': '۱۴۰۵/۰۷/۰۲ ۱۲:۲۰',
      'فاصله از انجام قبلی': '۱ روز و ۳ ساعت و ۲۰ دقیقه',
      'انجام قبلی': '۱۴۰۵/۰۷/۰۱ ۰۹:۰۰',
      'شماره ردیابی': 'TR-101',
      توضیحات: 'خراش جزئی\nروی سطح',
    });
  });

  it('says a first record has no earlier one, and empty notes as a dash', async () => {
    const { fixture, root } = setUp(false, {
      ...EXECUTION,
      notes: null,
      previousPerformedAt: null,
      intervalMinutes: null,
    });
    await fixture.whenStable();

    expect(facts(root)['فاصله از انجام قبلی']).toBe('بدون سابقه قبلی');
    expect(facts(root)['انجام قبلی']).toBe('—');
    expect(facts(root)['توضیحات']).toBe('—');
  });

  it('offers «حذف سابقه» to whoever may delete records only', async () => {
    const { fixture, root } = setUp(false);
    await fixture.whenStable();

    expect(deleteButton(root)).toBeUndefined();
  });

  it('confirms the deletion over itself and closes with deleted once it is done', async () => {
    const { fixture, root, close } = setUp(true);
    await fixture.whenStable();
    const open = vi
      .spyOn(TestBed.inject(MatDialog), 'open')
      .mockReturnValue({ afterClosed: () => of(true) } as MatDialogRef<unknown, boolean>);

    deleteButton(root)?.click();
    await fixture.whenStable();

    expect(open).toHaveBeenCalledWith(
      ConfirmDeleteQcExecutionDialog,
      expect.objectContaining({ data: { execution: EXECUTION } }),
    );
    expect(close).toHaveBeenCalledWith('deleted');
  });

  it('stays open when the deletion is not confirmed', async () => {
    const { fixture, root, close } = setUp(true);
    await fixture.whenStable();
    vi.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({
      afterClosed: () => of(false),
    } as MatDialogRef<unknown, boolean>);

    deleteButton(root)?.click();
    await fixture.whenStable();

    expect(close).not.toHaveBeenCalled();
  });
});
