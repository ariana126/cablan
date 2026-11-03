import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { NAVIGATION, NavigationEntry } from '../../core/identity/navigation';
import { categoryIconFor, NavigationIcon, navigationIconFor, pageIconFor } from './navigation-icon';

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

  /** Every «گزارشات» folder — one per area — is the same kind of place, so it looks the same. */
  const reportFolders = (entries: readonly NavigationEntry[]) =>
    entries.filter((entry) => entry.kind === 'category' && entry.label === 'گزارشات');

  it('never gives two entries the same icon, so the drawer and home tell them apart', () => {
    const entries = everyEntry(NAVIGATION);
    const distinct = entries.filter((entry) => !reportFolders(entries).slice(1).includes(entry));

    expect(new Set(distinct.map(navigationIconFor)).size).toBe(distinct.length);
  });

  // Issue #108: «فنی» has a «گزارشات» folder of its own, drawn like quality control's.
  it('draws every «گزارشات» folder alike — quality control’s and the technical area’s', () => {
    const folders = reportFolders(everyEntry(NAVIGATION));

    expect(folders).toHaveLength(2);
    expect(new Set(folders.map(navigationIconFor))).toEqual(new Set(['bar-chart']));
  });

  it('draws the technical area as a wrench', () => {
    const technical = NAVIGATION.find(
      (entry) => entry.kind === 'category' && entry.id === 'technical',
    );

    expect(technical && navigationIconFor(technical)).toBe('wrench');
  });

  // Home's shortcuts and group headings know a page by path and a category by id, nothing more.
  it('looks a page up by path and a category by id, as the drawer does', () => {
    expect(pageIconFor('boms/dashboard')).toBe('dashboard');
    expect(categoryIconFor('technical')).toBe('wrench');
    expect(pageIconFor('not-in-the-tree')).toBe('document');
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
