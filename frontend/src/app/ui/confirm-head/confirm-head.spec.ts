import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmHead } from './confirm-head';

@Component({
  imports: [ConfirmHead],
  template: `<app-confirm-head heading="حذف محصول">محصول «ویجت» حذف می‌شود.</app-confirm-head>`,
})
class Host {}

async function render(): Promise<HTMLElement> {
  TestBed.configureTestingModule({
    providers: [{ provide: MatDialogRef, useValue: { close: vi.fn() } }],
  });
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('ConfirmHead', () => {
  it('titles the dialog with a level-two heading', async () => {
    const root = await render();

    expect(root.querySelector('h2')?.textContent?.trim()).toBe('حذف محصول');
  });

  it('says what is lost, in the projected sentence, under the title', async () => {
    const root = await render();

    expect(root.querySelector('p')?.textContent?.trim()).toBe('محصول «ویجت» حذف می‌شود.');
  });

  it('marks the destructive choice with the error-coloured trash tile', async () => {
    const root = await render();

    expect(root.querySelector('.dialog-icon-tile svg')).not.toBeNull();
  });

  it('has no close button: the choice is cancel or delete', async () => {
    const root = await render();

    expect(root.querySelector('button')).toBeNull();
  });
});
