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
  daysLate: 2,
  activitySpecialty: 'mechanical',
  operatingHours: 1250.5,
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

  it('shows the whole history row: activity, specialty, due date, performer, time, status, delay, operating hours and notes', async () => {
    const root = await setUp();

    const shown = facts(root);
    expect(Object.keys(shown)).toEqual([
      'فعالیت',
      'تخصص',
      'موعد',
      'انجام دهنده',
      'زمان انجام',
      'وضعیت',
      'مقدار تاخیر',
      'ساعت کارکرد دستگاه',
      'توضیحات',
    ]);
    expect(shown['فعالیت']).toBe('تعویض روغن');
    expect(shown['تخصص']).toBe('مکانیک');
    expect(shown['ساعت کارکرد دستگاه']).toBe('۱٬۲۵۰٫۵ ساعت');
    expect(shown['موعد']).toBe('۱۴۰۵/۰۷/۰۱');
    expect(shown['انجام دهنده']).toBe('مسلمی');
    expect(shown['زمان انجام']).toMatch(/^۱۴۰۵\/۰۷\/۰۱ [۰-۹]{2}:[۰-۹]{2}$/);
    expect(shown['وضعیت']).toBe('با تاخیر');
    expect(shown['مقدار تاخیر']).toBe('۲ روز');
  });

  it('shows a hyphen for the delay when the work was not late', async () => {
    const root = await setUp({ ...EXECUTION, status: 'on_time', daysLate: null });

    expect(facts(root)['مقدار تاخیر']).toBe('-');
  });

  // Zero is a reading; an absent value is not, so it must never read as «۰ ساعت».
  it('says «ثبت نشده» when no operating hours were given, and shows a zero reading as one', async () => {
    expect(facts(await setUp({ ...EXECUTION, operatingHours: null }))['ساعت کارکرد دستگاه']).toBe(
      'ثبت نشده',
    );
    TestBed.resetTestingModule();
    expect(facts(await setUp({ ...EXECUTION, operatingHours: 0 }))['ساعت کارکرد دستگاه']).toBe(
      '۰ ساعت',
    );
  });

  it('says «تخصص تعیین نشده» while the activity has no specialty', async () => {
    const root = await setUp({ ...EXECUTION, activitySpecialty: null });

    expect(facts(root)['تخصص']).toBe('تخصص تعیین نشده');
  });

  it('keeps the notes’ line breaks as written', async () => {
    const root = await setUp();

    expect(facts(root)['توضیحات']).toBe('فیلتر روغن هم تعویض شد\nنشتی پمپ گزارش شد');
  });

  it('shows a dash when no notes were written', async () => {
    const root = await setUp({ ...EXECUTION, notes: '' });

    expect(facts(root)['توضیحات']).toBe('—');
  });

  // Nine facts can outgrow the dialog, and axe fails a scrolling region nothing in it can focus
  // (the close button sits outside the content).
  it('lets the keyboard reach its content, should it scroll', async () => {
    const root = await setUp();

    expect(root.querySelector('mat-dialog-content')?.getAttribute('tabindex')).toBe('0');
  });

  it('offers a close button', async () => {
    const root = await setUp();

    const close = root.querySelector('button[aria-label="بستن"]');
    expect(close?.hasAttribute('mat-dialog-close')).toBe(true);
  });
});
