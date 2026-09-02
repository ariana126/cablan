import { Clipboard } from '@angular/cdk/clipboard';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CopyIdButton } from './copy-id-button';

const ID = '3f9a1c7e-5b2d-4a18-9c3f-0e6d8b4a2715';

/**
 * `Clipboard.copy` reaches for `document.execCommand`, which jsdom does not implement, and
 * `MatSnackBar.open` would attach a real overlay to the document. Both are stubbed so the tests
 * assert what this component *asks* for rather than what a browser would then do with it.
 */
function setUp(name = 'میلگرد فولادی') {
  TestBed.configureTestingModule({});

  const fixture: ComponentFixture<CopyIdButton> = TestBed.createComponent(CopyIdButton);
  fixture.componentRef.setInput('entityId', ID);
  fixture.componentRef.setInput('entityName', name);
  fixture.detectChanges();

  const copy = vi.spyOn(TestBed.inject(Clipboard), 'copy').mockReturnValue(true);
  const open = vi
    .spyOn(TestBed.inject(MatSnackBar), 'open')
    .mockReturnValue({} as MatSnackBarRef<TextOnlySnackBar>);

  return { fixture, copy, open, root: fixture.nativeElement as HTMLElement };
}

describe('CopyIdButton', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('never renders the id it carries', () => {
    const { root } = setUp();

    expect(root.textContent).not.toContain(ID);
  });

  it('names the record it belongs to, so identical buttons are told apart', () => {
    const { root } = setUp('ورق آلومینیوم');

    expect(root.querySelector('button')?.getAttribute('aria-label')).toBe(
      'کپی شناسه ورق آلومینیوم',
    );
  });

  it('copies the id when pressed', () => {
    const { copy, root } = setUp();

    root.querySelector('button')?.click();

    expect(copy).toHaveBeenCalledWith(ID);
  });

  it('confirms the copy, since nothing on the page changes to show it happened', () => {
    const { open, root } = setUp();

    root.querySelector('button')?.click();

    expect(open).toHaveBeenCalledWith('شناسه کپی شد.', undefined, expect.anything());
  });

  it('says so when the clipboard refuses the copy', () => {
    const { copy, open, root } = setUp();
    copy.mockReturnValue(false);

    root.querySelector('button')?.click();

    expect(open).toHaveBeenCalledWith('شناسه کپی نشد.', 'باشه', expect.anything());
  });
});
