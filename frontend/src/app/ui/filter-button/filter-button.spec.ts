import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { FilterButton } from './filter-button';

async function render(inputs: Record<string, unknown>) {
  const fixture = TestBed.createComponent(FilterButton);
  for (const [name, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(name, value);
  }
  await fixture.whenStable();
  const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
  return { fixture, button };
}

describe('FilterButton', () => {
  it('is named by its label while nothing is selected', async () => {
    const { button } = await render({ label: 'برند' });

    expect(button.getAttribute('aria-label')).toBeNull();
    expect(button.textContent?.trim()).toBe('برند');
  });

  it('says how many values are chosen once any are', async () => {
    const { button } = await render({ label: 'برند', selectedCount: 2 });

    expect(button.getAttribute('aria-label')).toBe('فیلتر برند، ۲ مقدار انتخاب شده');
  });

  it('lets a caller keep a name the rest of the system already relies on', async () => {
    const { button } = await render({
      label: 'برند',
      selectedCount: 2,
      accessibleName: 'فیلتر ستون برند',
    });

    expect(button.getAttribute('aria-label')).toBe('فیلتر ستون برند');
  });

  it('marks an active filter so it can be told apart from an idle one', async () => {
    const idle = await render({ label: 'برند' });
    const active = await render({ label: 'برند', selectedCount: 1 });

    expect(idle.button.classList.contains('filter-button--active')).toBe(false);
    expect(active.button.classList.contains('filter-button--active')).toBe(true);
  });

  it('emits pressed when clicked', async () => {
    const { fixture, button } = await render({ label: 'برند' });
    let pressed = 0;
    fixture.componentInstance.pressed.subscribe(() => pressed++);

    button.click();

    expect(pressed).toBe(1);
  });
});
