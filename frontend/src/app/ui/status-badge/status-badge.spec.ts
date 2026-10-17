import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { StatusBadge } from './status-badge';

type Kind = 'create' | 'update' | 'delete' | 'neutral';

async function render(kind: Kind, label: string) {
  const fixture = TestBed.createComponent(StatusBadge);
  fixture.componentRef.setInput('kind', kind);
  fixture.componentRef.setInput('label', label);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('StatusBadge', () => {
  it.each([
    ['create', 'ثبت'],
    ['update', 'ویرایش'],
    ['delete', 'حذف'],
    ['neutral', 'ورود'],
  ] as const)('says %s in words, not by colour alone', async (kind, label) => {
    const root = await render(kind, label);

    expect(root.textContent?.trim()).toBe(label);
  });

  it.each(['create', 'update', 'delete', 'neutral'] as const)(
    'draws an icon for %s next to the word',
    async (kind) => {
      const root = await render(kind, 'x');

      expect(root.querySelectorAll('svg')).toHaveLength(1);
    },
  );

  it.each(['create', 'update', 'delete', 'neutral'] as const)(
    'carries the %s kind as a class the stylesheet can colour',
    async (kind) => {
      const root = await render(kind, 'x');

      expect(root.querySelector(`.status-badge--${kind}`)).not.toBeNull();
    },
  );

  it('is not interactive: it is neither a button nor a link', async () => {
    const root = await render('create', 'ثبت');

    expect(root.querySelector('button, a')).toBeNull();
  });
});
