import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { NAVIGATION, NavigationEntry } from '../../core/identity/navigation';
import { NavigationIcon, navigationIconFor } from './navigation-icon';

/** Every entry of the tree, categories and pages alike, depth first. */
function everyEntry(entries: readonly NavigationEntry[]): readonly NavigationEntry[] {
  return entries.flatMap((entry) =>
    entry.kind === 'page' ? [entry] : [entry, ...everyEntry(entry.children)],
  );
}

const key = (entry: NavigationEntry) => (entry.kind === 'page' ? entry.path : entry.id);

const unknownPage: NavigationEntry = {
  kind: 'page',
  path: 'not-in-the-tree',
  label: '؟',
  roles: [],
};

async function render(entry: NavigationEntry) {
  const fixture = TestBed.createComponent(NavigationIcon);
  fixture.componentRef.setInput('entry', entry);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('navigationIconFor', () => {
  it.each(everyEntry(NAVIGATION).map((entry) => [key(entry), entry] as const))(
    'gives %s an icon of its own rather than the fallback document',
    (_, entry) => {
      expect(navigationIconFor(entry)).not.toBe(navigationIconFor(unknownPage));
    },
  );

  it('never gives two entries the same icon, so the drawer and home tell them apart', () => {
    const entries = everyEntry(NAVIGATION);

    expect(new Set(entries.map(navigationIconFor)).size).toBe(entries.length);
  });

  it('draws the technical area as a wrench', () => {
    const technical = NAVIGATION.find(
      (entry) => entry.kind === 'category' && entry.id === 'technical',
    );

    expect(technical && navigationIconFor(technical)).toBe('wrench');
  });

  it('falls back to a plain document for an entry it does not know', () => {
    expect(navigationIconFor(unknownPage)).toBe('document');
  });
});

describe('NavigationIcon', () => {
  it('draws the entry’s icon as one decorative line icon', async () => {
    const root = await render(NAVIGATION[0]);

    expect(root.querySelectorAll('mat-icon > svg')).toHaveLength(1);
    expect(root.querySelector('mat-icon')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('draws different glyphs for different entries', async () => {
    const [first, second] = await Promise.all(
      NAVIGATION.slice(0, 2).map(
        async (entry) => (await render(entry)).querySelector('svg')?.innerHTML,
      ),
    );

    expect(first).not.toBe(second);
  });
});
