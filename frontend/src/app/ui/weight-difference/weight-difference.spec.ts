import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { WeightDifference } from './weight-difference';

type Direction = 'above' | 'below' | 'equal';

async function render(direction: Direction, value: number) {
  const fixture = TestBed.createComponent(WeightDifference);
  fixture.componentRef.setInput('direction', direction);
  fixture.componentRef.setInput('value', value);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('WeightDifference', () => {
  it('writes the deviation as a Persian quantity', async () => {
    const root = await render('above', 1234.5);

    expect(root.textContent).toContain('۱٬۲۳۴٫۵');
  });

  it.each([
    ['above', 'بیشتر از استاندارد'],
    ['below', 'کمتر از استاندارد'],
    ['equal', 'برابر با استاندارد'],
  ] as const)('says %s standard in words for a screen reader', async (direction, words) => {
    const root = await render(direction, 1);

    expect(root.querySelector('.visually-hidden')?.textContent?.trim()).toBe(words);
  });

  it.each(['above', 'below', 'equal'] as const)(
    'draws a direction icon for %s so colour is never the only cue',
    async (direction) => {
      const root = await render(direction, 1);

      expect(root.querySelectorAll('svg')).toHaveLength(1);
      expect(root.querySelector(`.weight-difference--${direction}`)).not.toBeNull();
    },
  );
});
