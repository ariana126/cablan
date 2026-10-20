import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { StatTile } from './stat-tile';

@Component({
  imports: [StatTile],
  template: `
    <app-stat-tile label="آنالیز های روزانه" [value]="value" [note]="note">
      <svg tileIcon data-testid="icon"></svg>
    </app-stat-tile>
  `,
})
class Host {
  value = '۲۴';
  note: string | undefined = 'در بازهٔ انتخاب‌شده';
}

async function render(setUp: (host: Host) => void = () => undefined) {
  const fixture = TestBed.createComponent(Host);
  setUp(fixture.componentInstance);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('StatTile', () => {
  it('reads label first and then its value, so the figure is announced with what it counts', async () => {
    const root = await render();

    const text = root.textContent ?? '';
    expect(text.indexOf('آنالیز های روزانه')).toBeGreaterThanOrEqual(0);
    expect(text.indexOf('آنالیز های روزانه')).toBeLessThan(text.indexOf('۲۴'));
  });

  it('is a plain block, not a live region', async () => {
    const root = await render();

    expect(root.querySelector('[aria-live]')).toBeNull();
    expect(root.querySelector('[role="status"]')).toBeNull();
  });

  it('shows the scope note only when given one', async () => {
    const withNote = await render();
    const without = await render((host) => (host.note = undefined));

    expect(withNote.textContent).toContain('در بازهٔ انتخاب‌شده');
    expect(without.textContent).not.toContain('در بازهٔ');
  });

  it('projects an icon next to the label', async () => {
    const root = await render();

    expect(root.querySelector('[data-testid="icon"]')).not.toBeNull();
  });
});
