import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';

import { DialogHead } from './dialog-head';

async function render(inputs: Record<string, unknown>) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [{ provide: MatDialogRef, useValue: { close } }],
  });
  const fixture = TestBed.createComponent(DialogHead);
  for (const [name, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(name, value);
  }
  await fixture.whenStable();
  return { close, root: fixture.nativeElement as HTMLElement };
}

describe('DialogHead', () => {
  it('shows the dialog title as a level-two heading', async () => {
    const { root } = await render({ heading: 'ثبت آنالیز روزانه جدید' });

    expect(root.querySelector('h2')?.textContent?.trim()).toBe('ثبت آنالیز روزانه جدید');
  });

  it('shows a subtitle only when given one', async () => {
    const without = await render({ heading: 'عنوان' });
    TestBed.resetTestingModule();
    const withSubtitle = await render({
      heading: 'عنوان',
      subtitle: 'فیلدهای ستاره‌دار الزامی است.',
    });

    expect(without.root.querySelector('p')).toBeNull();
    expect(withSubtitle.root.querySelector('p')?.textContent?.trim()).toBe(
      'فیلدهای ستاره‌دار الزامی است.',
    );
  });

  it('has a close button named «بستن» that closes the dialog', async () => {
    const { close, root } = await render({ heading: 'عنوان' });

    const button = root.querySelector('button');
    expect(button?.getAttribute('aria-label')).toBe('بستن');
    button!.click();

    expect(close).toHaveBeenCalled();
  });

  it('names the close button as asked', async () => {
    const { root } = await render({ heading: 'عنوان', closeLabel: 'بستن جزئیات' });

    expect(root.querySelector('button')?.getAttribute('aria-label')).toBe('بستن جزئیات');
  });

  it('has no close button when the choice is cancel or confirm, as in a delete confirmation', async () => {
    const { root } = await render({ heading: 'حذف', showClose: false });

    expect(root.querySelector('button')).toBeNull();
  });
});
