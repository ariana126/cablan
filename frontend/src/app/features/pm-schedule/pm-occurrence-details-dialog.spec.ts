import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it } from 'vitest';

import { AppPmOccurrence } from '../../core/maintenance/pm-schedule-gateway';
import {
  PmOccurrenceDetailsDialog,
  PmOccurrenceDetailsDialogData,
} from './pm-occurrence-details-dialog';

const LATE: AppPmOccurrence = {
  equipmentId: 'e1',
  equipmentName: 'اکسترودر 1',
  equipmentRetired: false,
  planItemId: 'p1',
  activityId: 'a1',
  activityName: 'تعویض روغن',
  activitySpecialty: 'mechanical',
  dueDate: '2026-10-23',
  calendarDate: '2026-10-25',
  status: 'late',
  performedAt: '2026-10-25T07:00:00.000Z',
  performedById: 'u1',
  performedBy: 'مسلمی',
  daysLate: 2,
  notes: 'فیلتر هم\nتعویض شد',
};

async function render(occurrence: AppPmOccurrence) {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: MAT_DIALOG_DATA,
        useValue: { occurrence } satisfies PmOccurrenceDetailsDialogData,
      },
      { provide: MatDialogRef, useValue: { close: () => undefined } },
    ],
  });
  const fixture = TestBed.createComponent(PmOccurrenceDetailsDialog);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const read = (selector: string) =>
    Array.from(root.querySelectorAll(selector)).map(
      (element) => element.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    );
  return { root, labels: read('dl dt'), values: read('dl dd') };
}

describe('PmOccurrenceDetailsDialog', () => {
  it('lists the occurrence’s eight facts as label and value pairs, in order', async () => {
    const { labels, values } = await render(LATE);

    expect(labels).toEqual([
      'تجهیز',
      'فعالیت',
      'موعد',
      'زمان انجام',
      'وضعیت',
      'مقدار تاخیر',
      'انجام دهنده',
      'توضیحات',
    ]);
    // The original due date, not the day it shows on in the calendar.
    expect(values.slice(0, 3)).toEqual(['اکسترودر 1', 'تعویض روغن', '۱۴۰۵/۰۸/۰۱']);
    expect(values[3]).toMatch(/^۱۴۰۵\/۰۸\/۰۳ [۰-۹]{2}:[۰-۹]{2}$/);
    expect(values.slice(4)).toEqual(['با تاخیر', '۲ روز', 'مسلمی', 'فیلتر هم تعویض شد']);
  });

  it('shows a dash for every fact an unperformed occurrence does not have', async () => {
    const { values } = await render({
      ...LATE,
      status: 'upcoming',
      performedAt: null,
      performedById: null,
      performedBy: null,
      daysLate: null,
      notes: null,
    });

    expect(values.slice(3)).toEqual(['—', 'آینده', '—', '—', '—']);
  });

  it('closes through a «بستن» button', async () => {
    const { root } = await render(LATE);

    const names = Array.from(root.querySelectorAll('button')).map((button) =>
      button.getAttribute('aria-label'),
    );
    expect(names).toEqual(['بستن']);
  });
});
