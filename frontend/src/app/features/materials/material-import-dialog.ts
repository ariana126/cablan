import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import {
  MatCell,
  MatCellDef,
  MatColumnDef,
  MatHeaderCell,
  MatHeaderCellDef,
  MatHeaderRow,
  MatHeaderRowDef,
  MatRow,
  MatRowDef,
  MatTable,
} from '@angular/material/table';
import { firstValueFrom } from 'rxjs';

import {
  AppMaterialImportChange,
  MaterialImportGateway,
} from '../../core/materials/material-import-gateway';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { StackedTable } from '../../ui/stacked-table/stacked-table';
import { describeImportChange, importRowErrorLabel } from './material-import-change';
import { InvalidImportRow, mapImportConfirmError } from './server-errors';

export interface MaterialImportDialogData {
  /** The preview's change list, in file order. */
  readonly changes: readonly AppMaterialImportChange[];
}

/** One line of the table: the change as the server classified it, put into words. */
interface ChangeRow {
  readonly change: AppMaterialImportChange;
  readonly description: string;
  readonly errors: readonly string[];
}

const COLUMNS = ['row', 'change', 'errors', 'actions'];

function toRow(change: AppMaterialImportChange, errors: readonly string[]): ChangeRow {
  return {
    change,
    description: describeImportChange(change),
    errors: errors.map(importRowErrorLabel),
  };
}

/**
 * The accounting Excel's change list («لیست تغییرات بارگذاری از اکسل»): one row per change in the
 * order the file has them — its spreadsheet row, the change in words, its errors — each removable
 * before «تایید» applies the rest, all or nothing. A refusal for invalid rows keeps the dialog open,
 * marks the rows the server named and says why in a `role="alert"` banner — the only alert in the
 * dialog, so the row errors the preview already showed are not announced as one.
 *
 * The table is always drawn, empty included, so it keeps its headers; the empty state follows it.
 * On a phone (`appStackedTable`) each change becomes a card with its remove button as the footer.
 */
@Component({
  selector: 'app-material-import-dialog',
  imports: [
    DialogHead,
    EmptyState,
    ErrorBanner,
    MatButton,
    MatCell,
    MatCellDef,
    MatColumnDef,
    MatDialogActions,
    MatDialogContent,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatIcon,
    MatIconButton,
    MatProgressBar,
    MatRow,
    MatRowDef,
    MatTable,
    StackedTable,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-head
      heading="لیست تغییرات بارگذاری از اکسل"
      subtitle="ردیف‌هایی را که نمی‌خواهید حذف کنید؛ با «تایید» بقیه با هم اعمال می‌شوند."
    />

    <mat-dialog-content class="stack stack--tight">
      @if (submitting()) {
        <mat-progress-bar mode="indeterminate" aria-label="در حال اعمال تغییرات" />
      }
      @if (error(); as message) {
        <app-error-banner [message]="message" />
      }

      <div class="changes" appStackedTable>
        <table mat-table [dataSource]="rows()">
          <ng-container matColumnDef="row">
            <th mat-header-cell *matHeaderCellDef>ردیف</th>
            <td mat-cell *matCellDef="let line" class="changes__row">{{ line.change.row }}</td>
          </ng-container>

          <ng-container matColumnDef="change">
            <th mat-header-cell *matHeaderCellDef>تغییر</th>
            <td mat-cell *matCellDef="let line">{{ line.description }}</td>
          </ng-container>

          <ng-container matColumnDef="errors">
            <th mat-header-cell *matHeaderCellDef>خطا</th>
            <td mat-cell *matCellDef="let line">
              @if (line.errors.length > 0) {
                <ul class="changes__errors">
                  @for (error of line.errors; track $index) {
                    <li class="changes__error">
                      <mat-icon class="changes__error-icon">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <circle cx="12" cy="12" r="9" />
                          <path d="M12 8v5M12 16.5v.01" />
                        </svg>
                      </mat-icon>
                      <span>{{ error }}</span>
                    </li>
                  }
                </ul>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>
              <span class="visually-hidden">عملیات</span>
            </th>
            <td mat-cell *matCellDef="let line">
              <div class="cell-actions">
                <button
                  #removeButton
                  matIconButton
                  class="icon-button--small"
                  type="button"
                  [attr.aria-label]="'حذف ردیف ' + line.change.row"
                  [disabled]="submitting()"
                  (click)="remove(line)"
                >
                  <mat-icon>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M4 7h16M10 11v6M14 11v6" />
                      <path d="M6 7l1 13h10l1-13M9 7V4h6v3" />
                    </svg>
                  </mat-icon>
                </button>
              </div>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let line; columns: columns"></tr>
        </table>
      </div>

      @if (rows().length === 0) {
        <app-empty-state message="تغییری وجود ندارد" />
      }
    </mat-dialog-content>

    <mat-dialog-actions class="dialog-footer">
      <button #cancelButton matButton type="button" (click)="cancel()">انصراف</button>
      <button
        matButton="filled"
        type="button"
        [disabled]="rows().length === 0 || submitting()"
        (click)="confirm()"
      >
        تایید
      </button>
    </mat-dialog-actions>
  `,
  styleUrl: './material-import-dialog.scss',
})
export class MaterialImportDialog {
  private readonly dialogRef = inject(MatDialogRef<MaterialImportDialog, boolean>);
  private readonly data = inject<MaterialImportDialogData>(MAT_DIALOG_DATA);
  private readonly gateway = inject(MaterialImportGateway);
  private readonly injector = inject(Injector);

  protected readonly columns = COLUMNS;

  protected readonly rows = signal<readonly ChangeRow[]>(
    this.data.changes.map((change) => toRow(change, change.errors)),
  );
  protected readonly submitting = signal(false);
  protected readonly error = signal('');

  // `read: ElementRef` — on a `matButton` the template reference names the component, not the element.
  private readonly removeButtons = viewChildren('removeButton', {
    read: ElementRef<HTMLButtonElement>,
  });
  private readonly cancelButton = viewChild.required('cancelButton', {
    read: ElementRef<HTMLButtonElement>,
  });

  /** Drops a row, and gives focus to the row that took its place (else the one before, else
   * «انصراف») — the button that had it is gone. */
  protected remove(line: ChangeRow): void {
    const index = this.rows().indexOf(line);
    this.rows.update((rows) => rows.filter((candidate) => candidate !== line));

    afterNextRender(
      () => {
        const buttons = this.removeButtons();
        const next = buttons[Math.min(index, buttons.length - 1)] ?? this.cancelButton();
        next.nativeElement.focus();
      },
      { injector: this.injector },
    );
  }

  protected async confirm(): Promise<void> {
    this.submitting.set(true);
    this.error.set('');

    try {
      await firstValueFrom(
        this.gateway.confirm(
          this.rows().map(({ change }) => ({
            row: change.row,
            name: change.name,
            code: change.code,
          })),
        ),
      );
      this.dialogRef.close(true);
    } catch (confirmError) {
      const refusal = mapImportConfirmError(confirmError);
      if (refusal.invalidRows.length > 0) {
        this.markInvalid(refusal.invalidRows);
      }
      this.error.set(refusal.message);
    } finally {
      this.submitting.set(false);
    }
  }

  protected cancel(): void {
    this.dialogRef.close(false);
  }

  /** The server judged the kept rows afresh: its errors replace the preview's, row by row. */
  private markInvalid(invalidRows: readonly InvalidImportRow[]): void {
    const errorsByRow = new Map(invalidRows.map((invalid) => [invalid.row, invalid.errors]));
    this.rows.update((rows) =>
      rows.map(({ change }) => toRow(change, errorsByRow.get(change.row) ?? [])),
    );
  }
}
