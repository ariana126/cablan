import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatIcon } from '@angular/material/icon';
import { describe, expect, it } from 'vitest';

import { Icon, ICON_NAMES, IconName } from './icon';

@Component({
  imports: [Icon, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<mat-icon [appIcon]="name()" />`,
})
class Host {
  readonly name = signal<IconName>('add');
}

async function render(name: IconName = 'add') {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.name.set(name);
  await fixture.whenStable();
  return { fixture, root: fixture.nativeElement as HTMLElement };
}

describe('Icon', () => {
  it('draws a line icon inside the mat-icon, in the design system’s stroke style', async () => {
    const { root } = await render('add');

    const svg = root.querySelector('mat-icon > svg');
    expect(svg?.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg?.getAttribute('fill')).toBe('none');
    expect(svg?.getAttribute('stroke')).toBe('currentColor');
    expect(svg?.getAttribute('stroke-width')).toBe('2');
    expect(svg?.getAttribute('stroke-linecap')).toBe('round');
    expect(svg?.getAttribute('stroke-linejoin')).toBe('round');
    expect(svg?.querySelectorAll('path').length).toBeGreaterThan(0);
  });

  it('redraws in place when the name changes, never stacking a second glyph', async () => {
    const { fixture, root } = await render('add');
    const before = root.querySelector('svg')?.innerHTML;

    fixture.componentInstance.name.set('delete');
    await fixture.whenStable();

    expect(root.querySelectorAll('svg')).toHaveLength(1);
    expect(root.querySelector('svg')?.innerHTML).not.toBe(before);
  });

  it('is decoration: the button’s own text carries the meaning', async () => {
    const { root } = await render('check');

    expect(root.querySelector('mat-icon')?.getAttribute('aria-hidden')).toBe('true');
    expect(root.textContent?.trim()).toBe('');
  });

  it.each(ICON_NAMES)('draws %s', async (name) => {
    const { root } = await render(name);

    const paths = Array.from(root.querySelectorAll('path'));
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.every((path) => (path.getAttribute('d') ?? '').length > 0)).toBe(true);
  });

  it('gives every name a glyph of its own', async () => {
    const glyphs = await Promise.all(
      ICON_NAMES.map(async (name) => (await render(name)).root.querySelector('svg')?.innerHTML),
    );

    expect(new Set(glyphs).size).toBe(ICON_NAMES.length);
  });
});
