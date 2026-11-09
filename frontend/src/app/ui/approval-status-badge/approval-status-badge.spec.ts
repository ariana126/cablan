import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { AppApprovalStatus } from '../../core/i18n/approval-labels';
import { ApprovalStatusBadge } from './approval-status-badge';

async function render(status: AppApprovalStatus) {
  const fixture = TestBed.createComponent(ApprovalStatusBadge);
  fixture.componentRef.setInput('status', status);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('ApprovalStatusBadge', () => {
  it.each([
    ['pending', 'در انتظار تایید'],
    ['approved', 'تایید'],
    ['rejected', 'عدم تایید'],
  ] as const)('reads %s as exactly its word', async (status, word) => {
    const root = await render(status);

    expect(root.textContent?.trim()).toBe(word);
  });

  it.each(['pending', 'approved', 'rejected'] as const)(
    'draws a hidden icon beside the word for %s, so colour is never the only cue',
    async (status) => {
      const root = await render(status);

      const icon = root.querySelector('svg');
      expect(icon?.getAttribute('aria-hidden')).toBe('true');
      expect(root.querySelector(`.approval-status--${status}`)).not.toBeNull();
    },
  );
});
