import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { AppBomEditRecord } from '../../core/boms/bom-edit-history';
import { EditHistory } from './edit-history';

const HEADING_1 =
  'کاربر نیکروش در 1403/06/15 ساعت 10:00 به علت خطای ترازو تغییرات زیر را انجام داد';
const HEADING_2 =
  'کاربر مصطفی در 1403/06/15 ساعت 14:00 به علت اندازه گیری مجدد تغییرات زیر را انجام داد';

const history: AppBomEditRecord[] = [
  {
    editedBy: 'نیکروش',
    editedAt: '2024-09-05T06:30:00.000Z',
    reason: 'خطای ترازو',
    heading: HEADING_1,
    changes: [
      'وزن جز مغزی مواد اولیه مسی از 3 به 2 تغییر کرد',
      'شماره ردیابی از TRK-3005 به TRK-3006 تغییر کرد',
    ],
  },
  {
    editedBy: 'مصطفی',
    editedAt: '2024-09-05T10:30:00.000Z',
    reason: 'اندازه گیری مجدد',
    heading: HEADING_2,
    changes: ['وزن جز مغزی مواد اولیه مسی از 2 به 2.5 تغییر کرد'],
  },
];

async function render(naming: { labelledBy?: string; label?: string } = {}) {
  const fixture = TestBed.createComponent(EditHistory);
  fixture.componentRef.setInput('history', history);
  if (naming.labelledBy !== undefined) {
    fixture.componentRef.setInput('labelledBy', naming.labelledBy);
  }
  if (naming.label !== undefined) {
    fixture.componentRef.setInput('label', naming.label);
  }
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('EditHistory', () => {
  it('lists every line as its own list item: a heading, then its changes, record after record', async () => {
    const root = await render();

    const items = Array.from(root.querySelectorAll('ul > li')).map((li) => li.textContent?.trim());
    expect(items).toEqual([
      HEADING_1,
      'وزن جز مغزی مواد اولیه مسی از 3 به 2 تغییر کرد',
      'شماره ردیابی از TRK-3005 به TRK-3006 تغییر کرد',
      HEADING_2,
      'وزن جز مغزی مواد اولیه مسی از 2 به 2.5 تغییر کرد',
    ]);
  });

  it('sets a heading line apart from the change lines under it', async () => {
    const root = await render();

    const headings = Array.from(root.querySelectorAll('li.edit-history__heading')).map((li) =>
      li.textContent?.trim(),
    );
    expect(headings).toEqual([HEADING_1, HEADING_2]);
    expect(root.querySelectorAll('li.edit-history__change')).toHaveLength(3);
  });

  it('takes its accessible name from the element it is told labels it', async () => {
    const root = await render({ labelledBy: 'card-edit-details-heading' });

    expect(root.querySelector('ul')?.getAttribute('aria-labelledby')).toBe(
      'card-edit-details-heading',
    );
  });

  it('can be named directly instead', async () => {
    const root = await render({ label: 'جزئیات ویرایش' });

    expect(root.querySelector('ul')?.getAttribute('aria-label')).toBe('جزئیات ویرایش');
  });

  it('carries no naming attribute when it is given no name', async () => {
    const root = await render();

    expect(root.querySelector('ul')?.hasAttribute('aria-labelledby')).toBe(false);
    expect(root.querySelector('ul')?.hasAttribute('aria-label')).toBe(false);
  });
});
