import { Clipboard } from '@angular/cdk/clipboard';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { describe, expect, it, vi } from 'vitest';

import { CopiedSnackBar } from './copy-id-button';
import { CopyId } from './copy-id';

const ID = '3f9a1c7e-5b2d-4a18-9c3f-0e6d8b4a2715';

function setUp(copied: boolean) {
  const copy = vi.spyOn(TestBed.inject(Clipboard), 'copy').mockReturnValue(copied);
  const snackBar = TestBed.inject(MatSnackBar);
  const open = vi.spyOn(snackBar, 'open').mockReturnValue({} as MatSnackBarRef<TextOnlySnackBar>);
  const openFromComponent = vi
    .spyOn(snackBar, 'openFromComponent')
    .mockReturnValue({} as MatSnackBarRef<CopiedSnackBar>);
  return { copy, open, openFromComponent, service: TestBed.inject(CopyId) };
}

describe('CopyId', () => {
  it('puts the whole id on the clipboard', () => {
    const { copy, service } = setUp(true);

    service.copy(ID);

    expect(copy).toHaveBeenCalledWith(ID);
  });

  it('confirms a successful copy with the check-marked snackbar', () => {
    const { openFromComponent, open, service } = setUp(true);

    service.copy(ID);

    expect(openFromComponent).toHaveBeenCalledWith(
      CopiedSnackBar,
      expect.objectContaining({ duration: 3000 }),
    );
    expect(open).not.toHaveBeenCalled();
  });

  it('says so, with an acknowledgement, when the clipboard refuses', () => {
    const { open, openFromComponent, service } = setUp(false);

    service.copy(ID);

    expect(open).toHaveBeenCalledWith('شناسه کپی نشد.', 'باشه', expect.anything());
    expect(openFromComponent).not.toHaveBeenCalled();
  });
});
