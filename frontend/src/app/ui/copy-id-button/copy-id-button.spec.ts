import { Clipboard } from '@angular/cdk/clipboard';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CopiedSnackBar, CopyIdButton } from './copy-id-button';

const ID = '3f9a1c7e-5b2d-4a18-9c3f-0e6d8b4a2715';

/**
 * `Clipboard.copy` reaches for `document.execCommand`, which jsdom does not implement, and
 * `MatSnackBar.open` would attach a real overlay to the document. Both are stubbed so the tests
 * assert what this component *asks* for rather than what a browser would then do with it.
 */
function setUp(name = 'میلگرد فولادی', short = false) {
  TestBed.configureTestingModule({});

  const fixture: ComponentFixture<CopyIdButton> = TestBed.createComponent(CopyIdButton);
  fixture.componentRef.setInput('entityId', ID);
  fixture.componentRef.setInput('entityName', name);
  fixture.componentRef.setInput('short', short);
  fixture.detectChanges();

  const copy = vi.spyOn(TestBed.inject(Clipboard), 'copy').mockReturnValue(true);
  const snackBar = TestBed.inject(MatSnackBar);
  const open = vi.spyOn(snackBar, 'open').mockReturnValue({} as MatSnackBarRef<TextOnlySnackBar>);
  const openFromComponent = vi
    .spyOn(snackBar, 'openFromComponent')
    .mockReturnValue({} as MatSnackBarRef<CopiedSnackBar>);

  return { fixture, copy, open, openFromComponent, root: fixture.nativeElement as HTMLElement };
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

  it('confirms the copy with a check-marked snackbar, since nothing else on the page changes', () => {
    const { openFromComponent, root } = setUp();

    root.querySelector('button')?.click();

    expect(openFromComponent).toHaveBeenCalledWith(
      CopiedSnackBar,
      expect.objectContaining({ duration: 3000 }),
    );
  });

  it('shows the first eight characters of the id as a left-to-right tag when asked to', () => {
    const { root } = setUp('میلگرد', true);

    const tag = root.querySelector('bdi');
    expect(tag?.getAttribute('dir')).toBe('ltr');
    expect(tag?.textContent?.trim()).toBe('3f9a1c7e…');
    expect(root.textContent).not.toContain(ID);
  });

  it('still copies the whole id when it shows the short one', () => {
    const { copy, root } = setUp('میلگرد', true);

    root.querySelector('button')?.click();

    expect(copy).toHaveBeenCalledWith(ID);
  });

  it('says so when the clipboard refuses the copy', () => {
    const { copy, open, root } = setUp();
    copy.mockReturnValue(false);

    root.querySelector('button')?.click();

    expect(open).toHaveBeenCalledWith('شناسه کپی نشد.', 'باشه', expect.anything());
  });
});
