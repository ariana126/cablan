import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { CategoryIcon } from './category-icon';

async function render(id: string) {
  const fixture = TestBed.createComponent(CategoryIcon);
  fixture.componentRef.setInput('id', id);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('CategoryIcon', () => {
  it.each(['quality-control', 'master-data', 'system-administration', 'reports'])(
    'draws its own line icon for %s',
    async (id) => {
      const root = await render(id);

      expect(root.querySelectorAll('svg')).toHaveLength(1);
      expect(root.querySelector('svg')?.innerHTML.length).toBeGreaterThan(0);
    },
  );

  it('draws different icons for different categories', async () => {
    const icons = await Promise.all(
      ['quality-control', 'master-data', 'system-administration'].map(async (id) => {
        const root = await render(id);
        return root.querySelector('svg')?.innerHTML;
      }),
    );

    expect(new Set(icons).size).toBe(3);
  });

  it('falls back to a plain document icon for anything it does not know, such as a page', async () => {
    const root = await render('boms');

    expect(root.querySelectorAll('svg')).toHaveLength(1);
  });

  it('is decoration: the label next to it carries the meaning', async () => {
    const root = await render('master-data');

    expect(root.querySelector('mat-icon')?.getAttribute('aria-hidden')).toBe('true');
  });
});
