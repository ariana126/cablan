import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { PmOccurrenceStatus } from '../../core/i18n/pm-status-labels';
import { PmStatusBadge } from './pm-status-badge';

async function render(status: PmOccurrenceStatus): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(PmStatusBadge);
  fixture.componentRef.setInput('status', status);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('PmStatusBadge', () => {
  it.each([
    ['on_time', 'بموقع'],
    ['late', 'با تاخیر'],
    ['missed', 'انجام نشده'],
    ['overdue', 'عقب افتاده'],
    ['due', 'سررسیده'],
    ['upcoming', 'آینده'],
  ] as const)('reads %s as «%s»', async (status, label) => {
    const root = await render(status);

    expect(root.textContent?.trim()).toBe(label);
  });

  // State is never colour alone: each pill carries an icon, hidden from assistive technology since
  // the word already says it.
  it('pairs the word with a decorative icon', async () => {
    const root = await render('missed');

    expect(root.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('tones the pill by its status', async () => {
    expect((await render('overdue')).querySelector('.pm-status-badge--overdue')).not.toBeNull();
    expect((await render('on_time')).querySelector('.pm-status-badge--on-time')).not.toBeNull();
  });
});
