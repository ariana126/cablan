import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';

import { OfferStandardBomDialog } from './offer-standard-bom-dialog';

const OFFER = 'محصول با موفقیت ثبت شد. آیا می‌خواهید برای این محصول آنالیز استاندارد تعریف کنید؟';

function setUp() {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [{ provide: MatDialogRef, useValue: { close } }],
  });
  const fixture = TestBed.createComponent(OfferStandardBomDialog);
  return { fixture, close, root: fixture.nativeElement as HTMLElement };
}

function button(root: HTMLElement, name: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.trim() === name,
  );
}

describe('OfferStandardBomDialog', () => {
  it('asks, as the dialog’s title, whether to define the new product’s standard BOM', async () => {
    const { fixture, root } = setUp();
    await fixture.whenStable();

    const title = root.querySelector('[mat-dialog-title]');
    expect(title?.textContent?.trim()).toBe(OFFER);
  });

  it('offers exactly two plain buttons, accepting and declining', async () => {
    const { fixture, root } = setUp();
    await fixture.whenStable();

    const buttons = Array.from(root.querySelectorAll('button'));
    expect(buttons.map((candidate) => candidate.textContent?.trim())).toEqual([
      'خیر',
      'بله، تعریف آنالیز استاندارد',
    ]);
    expect(buttons.every((candidate) => candidate.type === 'button')).toBe(true);
  });

  it('closes with true when accepted', async () => {
    const { fixture, root, close } = setUp();
    await fixture.whenStable();

    button(root, 'بله، تعریف آنالیز استاندارد')?.click();

    expect(close).toHaveBeenCalledWith(true);
  });

  it('closes with false when declined', async () => {
    const { fixture, root, close } = setUp();
    await fixture.whenStable();

    button(root, 'خیر')?.click();

    expect(close).toHaveBeenCalledWith(false);
  });
});
