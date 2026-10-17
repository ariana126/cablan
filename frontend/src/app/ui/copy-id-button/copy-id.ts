import { Clipboard } from '@angular/cdk/clipboard';
import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { CopiedSnackBar } from './copied-snack-bar';

/**
 * Puts one record's id on the clipboard and says whether it worked. Shared by the copy button and by
 * the «کپی شناسه» item in a row's overflow menu, so both confirm the same way.
 *
 * The copy goes through the CDK's `Clipboard` rather than `navigator.clipboard`: the async API is
 * unavailable outside a secure context, and the CDK's hidden-textarea fallback still works there. A
 * snackbar confirms, because nothing else on the page changes to say the copy happened.
 */
@Injectable({ providedIn: 'root' })
export class CopyId {
  private readonly clipboard = inject(Clipboard);
  private readonly snackBar = inject(MatSnackBar);

  copy(id: string): void {
    if (this.clipboard.copy(id)) {
      this.snackBar.openFromComponent(CopiedSnackBar, { duration: 3000 });
      return;
    }

    this.snackBar.open('شناسه کپی نشد.', 'باشه', { duration: 5000 });
  }
}
