import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { WeightDifference } from './weight-difference';

type Direction = 'above' | 'below';

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
  ] as const)('says %s standard in words for a screen reader', async (direction, words) => {
    const root = await render(direction, 1);

    expect(root.querySelector('.visually-hidden')?.textContent?.trim()).toBe(words);
  });

  it.each(['above', 'below'] as const)(
    'draws a direction icon for %s so colour is never the only cue',
    async (direction) => {
      const root = await render(direction, 1);

      expect(root.querySelectorAll('svg')).toHaveLength(1);
      expect(root.querySelector(`.weight-difference--${direction}`)).not.toBeNull();
    },
  );

  describe('neutral (issue #113: a deviation is not a pass or a fail)', () => {
    async function renderNeutral(direction: Direction, value: number) {
      const fixture = TestBed.createComponent(WeightDifference);
      fixture.componentRef.setInput('direction', direction);
      fixture.componentRef.setInput('value', value);
      fixture.componentRef.setInput('neutral', true);
      await fixture.whenStable();
      return fixture.nativeElement as HTMLElement;
    }

    it.each([
      ['above', '۲٫۵ بیشتر از استاندارد'],
      ['below', '۲٫۵ کمتر از استاندارد'],
    ] as const)(
      'writes the direction %s in visible words beside the value',
      async (direction, text) => {
        const root = await renderNeutral(direction, 2.5);

        expect(root.textContent?.replace(/\s+/g, ' ').trim()).toBe(text);
        expect(root.querySelector('.visually-hidden')).toBeNull();
      },
    );

    it('wears neither the error nor the positive colour pair', async () => {
      const root = await renderNeutral('above', 1);

      expect(root.querySelector('.weight-difference--neutral')).not.toBeNull();
      expect(root.querySelector('.weight-difference--above')).toBeNull();
      expect(root.querySelector('.weight-difference--below')).toBeNull();
    });
  });
});
