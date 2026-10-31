import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';

import { AppMaintenanceExecution } from '../../core/maintenance/equipment-gateway';
import {
  PmExecutionDetailsDialog,
  PmExecutionDetailsDialogData,
} from './pm-execution-details-dialog';

const EXECUTION: AppMaintenanceExecution = {
  id: 'x1',
  activityName: 'تعویض روغن',
  dueDate: '2026-09-23',
  performedAt: '2026-09-23T07:00:00.000Z',
  performedBy: 'مسلمی',
  status: 'late',
  notes: 'فیلتر روغن هم تعویض شد\nنشتی پمپ گزارش شد',
};

async function setUp(execution: AppMaintenanceExecution = EXECUTION) {
  const data: PmExecutionDetailsDialogData = { equipmentName: 'اکسترودر 1', execution };
  TestBed.configureTestingModule({
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close: vi.fn() } },
    ],
  });
  const fixture = TestBed.createComponent(PmExecutionDetailsDialog);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

/** Each `<dt>` with the text of the `<dd>` after it. */
const facts = (root: HTMLElement): Record<string, string> =>
  Object.fromEntries(
    Array.from(root.querySelectorAll('dt')).map((dt) => [
      dt.textContent?.trim() ?? '',
      dt.nextElementSibling?.textContent?.replace(/[ \t]+/g, ' ').trim() ?? '',
    ]),
  );

describe('PmExecutionDetailsDialog', () => {
  it('is titled «جزئیات انجام PM» and names the equipment under it', async () => {
    const root = await setUp();

    expect(root.querySelector('h2')?.textContent?.trim()).toBe('جزئیات انجام PM');
    expect(root.querySelector('.dialog-head__subtitle')?.textContent?.trim()).toBe('اکسترودر 1');
  });

  it('shows the whole history row: activity, due date, performer, time, status and notes', async () => {
    const root = await setUp();

    const shown = facts(root);
    expect(Object.keys(shown)).toEqual([
      'فعالیت',
      'موعد',
      'انجام دهنده',
      'زمان انجام',
      'وضعیت',
      'توضیحات',
    ]);
    expect(shown['فعالیت']).toBe('تعویض روغن');
    expect(shown['موعد']).toBe('۱۴۰۵/۰۷/۰۱');
    expect(shown['انجام دهنده']).toBe('مسلمی');
    expect(shown['زمان انجام']).toMatch(/^۱۴۰۵\/۰۷\/۰۱ [۰-۹]{2}:[۰-۹]{2}$/);
    expect(shown['وضعیت']).toBe('با تاخیر');
  });

  it('keeps the notes’ line breaks as written', async () => {
    const root = await setUp();

    expect(facts(root)['توضیحات']).toBe('فیلتر روغن هم تعویض شد\nنشتی پمپ گزارش شد');
  });

  it('shows a dash when no notes were written', async () => {
    const root = await setUp({ ...EXECUTION, notes: '' });

    expect(facts(root)['توضیحات']).toBe('—');
  });

  it('offers a close button', async () => {
    const root = await setUp();

    const close = root.querySelector('button[aria-label="بستن"]');
    expect(close?.hasAttribute('mat-dialog-close')).toBe(true);
  });
});
