import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';

import { BomEditDetailsDialog, BomEditDetailsDialogData } from './bom-edit-details-dialog';

const HEADING = 'کاربر نیکروش در 1403/06/15 ساعت 10:00 به علت خطای ترازو تغییرات زیر را انجام داد';
const CHANGE = 'وزن جز مغزی مواد اولیه مسی از 3 به 2 تغییر کرد';

const data: BomEditDetailsDialogData = {
  orderNumber: 'ORD-5002',
  editHistory: [
    {
      editedBy: 'نیکروش',
      editedAt: '2024-09-05T06:30:00.000Z',
      reason: 'خطای ترازو',
      heading: HEADING,
      changes: [CHANGE],
    },
  ],
};

async function setUp() {
  TestBed.configureTestingModule({
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close: vi.fn() } },
    ],
  });
  const fixture = TestBed.createComponent(BomEditDetailsDialog);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('BomEditDetailsDialog', () => {
  it('is titled «جزئیات ویرایش» and names the daily BOM by its order number', async () => {
    const root = await setUp();

    expect(root.querySelector('h2')?.textContent?.trim()).toBe('جزئیات ویرایش');
    expect(root.textContent).toContain('ORD-5002');
  });

  it('lists every line of the edit details as its own list item', async () => {
    const root = await setUp();

    const items = Array.from(root.querySelectorAll('li')).map((li) => li.textContent?.trim());
    expect(items).toEqual([HEADING, CHANGE]);
  });

  it('names the list «جزئیات ویرایش», as the dialog is titled', async () => {
    const root = await setUp();

    expect(root.querySelector('ul')?.getAttribute('aria-label')).toBe('جزئیات ویرایش');
  });

  it('offers a close button', async () => {
    const root = await setUp();

    const close = root.querySelector('button[aria-label="بستن"]');
    expect(close?.hasAttribute('mat-dialog-close')).toBe(true);
  });
});
