import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { EmptyState } from './empty-state';

async function render(inputs: Record<string, unknown>) {
  const fixture = TestBed.createComponent(EmptyState);
  for (const [name, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(name, value);
  }
  await fixture.whenStable();
  return { fixture, root: fixture.nativeElement as HTMLElement };
}

describe('EmptyState', () => {
  it('is a status, not an alert: an empty result is not a failure', async () => {
    const { root } = await render({ message: 'هیچ آنالیز روزانه‌ای یافت نشد.' });

    expect(root.querySelector('[role="status"]')?.textContent).toContain(
      'هیچ آنالیز روزانه‌ای یافت نشد.',
    );
    expect(root.querySelector('[role="alert"]')).toBeNull();
  });

  it('adds a muted sentence about what to do only when given one', async () => {
    const { root } = await render({
      message: 'موردی یافت نشد',
      description: 'فیلترها را پاک کنید.',
    });

    expect(root.textContent).toContain('فیلترها را پاک کنید.');
  });

  it('offers an action only when given a label, and emits action', async () => {
    const without = await render({ message: 'موردی یافت نشد' });
    const { fixture, root } = await render({
      message: 'موردی یافت نشد',
      actionLabel: 'پاک کردن فیلترها',
    });
    let actions = 0;
    fixture.componentInstance.action.subscribe(() => actions++);

    root.querySelector('button')!.click();

    expect(without.root.querySelector('button')).toBeNull();
    expect(actions).toBe(1);
  });
});
