import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { ConductorColours, CoreColour, ConductorMaterial } from './conductor-colours';

async function render(inputs: {
  cores?: readonly CoreColour[];
  material?: ConductorMaterial;
  compact?: boolean;
}) {
  const fixture = TestBed.createComponent(ConductorColours);
  for (const [name, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(name, value);
  }
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('ConductorColours', () => {
  it('names every core after its swatch, in core order', async () => {
    const root = await render({ cores: ['brown', 'black', 'grey', 'blue', 'pe'] });

    const text = (root.textContent ?? '').replace(/\s+/g, ' ');
    const positions = ['قهوه‌ای', 'مشکی', 'خاکستری', 'آبی', 'سبز-زرد'].map((name) =>
      text.indexOf(name),
    );
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('draws one swatch per core, and protective earth as its own split swatch', async () => {
    const root = await render({ cores: ['brown', 'pe'] });

    expect(root.querySelectorAll('.swatch')).toHaveLength(2);
    expect(root.querySelector('.swatch--pe')).not.toBeNull();
  });

  it('shows the conductor material beside its name', async () => {
    const copper = await render({ material: 'copper' });
    const aluminium = await render({ material: 'aluminium' });

    expect(copper.textContent).toContain('مس');
    expect(aluminium.textContent).toContain('آلومینیوم');
  });

  it('hides the swatches from assistive technology in the full form: the names carry the meaning', async () => {
    const root = await render({ cores: ['brown'] });

    expect(root.querySelector('.swatch')?.getAttribute('aria-hidden')).toBe('true');
  });

  it.each([
    [['brown'], 'یک رشته: قهوه‌ای'],
    [['brown', 'black'], 'دو رشته: قهوه‌ای، مشکی'],
    [['brown', 'blue', 'pe'], 'سه رشته: قهوه‌ای، آبی، سبز-زرد'],
    [['brown', 'black', 'grey', 'blue'], 'چهار رشته: قهوه‌ای، مشکی، خاکستری، آبی'],
  ] as const)(
    'in compact form is one image whose name lists the cores in order (%j)',
    async (cores, expected) => {
      const root = await render({ cores, compact: true });

      const image = root.querySelector('[role="img"]');
      expect(image?.getAttribute('aria-label')).toBe(expected);
      expect(root.textContent?.trim()).toBe('');
    },
  );

  it('falls back to a number when there are more cores than it has words for', async () => {
    const root = await render({
      cores: ['brown', 'black', 'grey', 'blue', 'pe', 'brown'],
      compact: true,
    });

    expect(root.querySelector('[role="img"]')?.getAttribute('aria-label')).toContain('۶ رشته');
  });

  it('adds the material to the compact name', async () => {
    const root = await render({ cores: ['brown'], material: 'copper', compact: true });

    expect(root.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe(
      'یک رشته: قهوه‌ای؛ هادی: مس',
    );
  });
});
