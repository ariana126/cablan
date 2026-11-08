import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatDivider } from '@angular/material/divider';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuContent, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
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

import { formatJalaliCalendarDate } from '../../core/date/calendar-date';
import { AppEquipmentDetail, AppPmPlanItem } from '../../core/maintenance/equipment-gateway';
import { groupBySpecialty } from '../../core/maintenance/specialty-groups';
import { DataSheet } from '../../ui/data-sheet/data-sheet';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { Icon } from '../../ui/icon/icon';
import { PersianNumberPipe } from '../../ui/persian-number/persian-number-pipe';
import { SpecialtyGroup } from '../../ui/specialty-group/specialty-group';
import { AddPmPlanItemDialog, AddPmPlanItemDialogData } from './add-pm-plan-item-dialog';
import { ChangePmIntervalDialog } from './change-pm-interval-dialog';
import { ConfirmDeactivatePmPlanItemDialog } from './confirm-deactivate-pm-plan-item-dialog';
import { ConfirmDeletePmExecutionsDialog } from './confirm-delete-pm-executions-dialog';

const COLUMNS = ['activity', 'intervalDays', 'firstDueDate', 'nextDueDate', 'actions'];

/**
 * «برنامه PM» — the plan section of an equipment's folder (issue #92): the activities due on it, each
 * with its interval and due dates, grouped by specialty (issue #108) into one table per group.
 * «افزودن فعالیت» sits in the sheet's own title bar, and each row's
 * «عملیات بیشتر برای {activity}» menu offers «ویرایش» (the interval) and «غیرفعال‌سازی» (behind a
 * confirmation; issue #91 — a deactivated row moves to the
 * folder's «فعالیت‌های غیرفعال»); for the System Admin also «حذف همه سوابق» (issue #110), on a retired
 * equipment's plan too. An empty plan still shows the section and its «افزودن فعالیت» — the first activity
 * is defined here.
 *
 * Retired equipment's plan stopped for good: it is shown to be read, with no add button, no actions
 * column, and a note saying so.
 *
 * It reads nothing itself — the folder owns the equipment and passes it in — and emits `changed`
 * after any dialog changed the plan, so the folder re-reads it.
 */
@Component({
  selector: 'app-pm-plan-section',
  imports: [
    DataSheet,
    EmptyState,
    Icon,
    MatButton,
    MatCell,
    MatCellDef,
    MatColumnDef,
    MatDivider,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatIcon,
    MatIconButton,
    MatMenu,
    MatMenuContent,
    MatMenuItem,
    MatMenuTrigger,
    MatRow,
    MatRowDef,
    MatTable,
    PersianNumberPipe,
    SpecialtyGroup,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-data-sheet
      heading="برنامه PM"
      [count]="items().length"
      [loading]="loading()"
      loadingLabel="در حال بارگذاری برنامهٔ تجهیز"
    >
      <ng-container ngProjectAs="[sheetActions]">
        @if (editable()) {
          <!-- Outlined, not filled (issue #112): the plan is the folder's subject; managing it is
               secondary. -->
          <button #addButton matButton="outlined" type="button" (click)="openAddDialog()">
            <mat-icon appIcon="add" />
            افزودن فعالیت
          </button>
        }
      </ng-container>

      <ng-container ngProjectAs="[sheetChips]">
        @if (!editable()) {
          <p class="plan-section__note">
            <mat-icon appIcon="block" />
            این تجهیز کنار گذاشته شده و برنامهٔ آن متوقف است؛ فقط برای مشاهده است.
          </p>
        }
      </ng-container>

      @if (items().length === 0) {
        <app-empty-state
          message="هنوز فعالیتی در برنامهٔ این تجهیز نیست."
          [description]="editable() ? 'با «افزودن فعالیت» اولین فعالیت را اضافه کنید.' : ''"
        />
      } @else {
        @for (group of groups(); track group.specialty) {
          <app-specialty-group [specialty]="group.specialty">
            <table mat-table [dataSource]="group.items">
              <ng-container matColumnDef="activity">
                <th mat-header-cell *matHeaderCellDef>فعالیت</th>
                <td mat-cell *matCellDef="let item" class="plan-activity">
                  {{ item.activityName }}
                </td>
              </ng-container>

              <ng-container matColumnDef="intervalDays">
                <th mat-header-cell *matHeaderCellDef>
                  <span class="cell-end">دوره (روز)</span>
                </th>
                <td mat-cell *matCellDef="let item">
                  <span class="cell-end">{{ item.intervalDays | persianNumber }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="firstDueDate">
                <th mat-header-cell *matHeaderCellDef>
                  <span class="cell-end">اولین موعد</span>
                </th>
                <td mat-cell *matCellDef="let item">
                  <span class="cell-end">{{ jalaliDate(item.firstDueDate) }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="nextDueDate">
                <th mat-header-cell *matHeaderCellDef>
                  <span class="cell-end">موعد بعدی</span>
                </th>
                <td mat-cell *matCellDef="let item">
                  <span class="cell-end">{{ jalaliDate(item.nextDueDate) }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>
                  <span class="visually-hidden">عملیات</span>
                </th>
                <td mat-cell *matCellDef="let item">
                  <div class="cell-actions">
                    <button
                      matIconButton
                      class="icon-button--small"
                      type="button"
                      [attr.aria-label]="'عملیات بیشتر برای ' + item.activityName"
                      [matMenuTriggerFor]="rowMenu"
                      [matMenuTriggerData]="{ item }"
                      (click)="rememberMenuTrigger($event)"
                    >
                      <mat-icon appIcon="more" />
                    </button>
                  </div>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columns()"></tr>
              <tr mat-row *matRowDef="let row; columns: columns()"></tr>
            </table>
          </app-specialty-group>
        }
      }
    </app-data-sheet>

    <mat-menu #rowMenu="matMenu">
      <ng-template matMenuContent let-item="item">
        @if (editable()) {
          <button mat-menu-item type="button" (click)="openChangeIntervalDialog(item)">
            <mat-icon appIcon="edit" />
            <span>ویرایش</span>
          </button>
          <!-- Issue #112: the dangerous items sit apart, under a divider, in the error colour. -->
          <mat-divider />
          <button
            mat-menu-item
            class="menu-item--danger"
            type="button"
            (click)="openDeactivateDialog(item)"
          >
            <mat-icon appIcon="block" />
            <span>غیرفعال‌سازی</span>
          </button>
        }
        @if (canDelete()) {
          <button
            mat-menu-item
            class="menu-item--danger"
            type="button"
            (click)="openDeleteExecutionsDialog(item)"
          >
            <mat-icon appIcon="delete" />
            <span>حذف همه سوابق</span>
          </button>
        }
      </ng-template>
    </mat-menu>
  `,
  styleUrl: './pm-plan-section.scss',
})
export class PmPlanSection {
  private readonly dialog = inject(MatDialog);

  /** The equipment whose plan this is, as the folder read it. */
  readonly equipment = input.required<AppEquipmentDetail>();
  /** While the folder re-reads the equipment after a change. */
  readonly loading = input(false);
  /** The System Admin deletes a row's executions (issue #110), retired equipment's included. */
  readonly canDelete = input(false);

  /** After a dialog changed the plan — the folder re-reads it. */
  readonly changed = output<void>();
  /** After a row's executions were deleted — the folder re-reads the plan and the history. */
  readonly executionsDeleted = output<void>();

  protected readonly jalaliDate = formatJalaliCalendarDate;

  protected readonly items = computed<AppPmPlanItem[]>(() => [...this.equipment().planItems]);

  /** «برق», «مکانیک», then any activity without a specialty — plan order kept inside each. */
  protected readonly groups = computed(() =>
    groupBySpecialty(this.items(), (item) => item.activitySpecialty),
  );

  /** A retired equipment's plan has stopped for good. */
  protected readonly editable = computed(() => !this.equipment().retired);

  /** No row actions on a read-only plan, so no actions column either — unless the System Admin
   * may still delete its executions. */
  protected readonly columns = computed(() =>
    this.editable() || this.canDelete()
      ? COLUMNS
      : COLUMNS.filter((column) => column !== 'actions'),
  );

  /**
   * The row's «عملیات بیشتر» button, kept from its click. A dialog opened from one of the menu's
   * items would otherwise hand focus back to that item — gone with the menu — and so to <body>.
   */
  private menuTrigger: HTMLElement | undefined;

  /** Where focus goes once a deactivated row — its menu button with it — has left the plan. */
  private readonly addButton = viewChild('addButton', {
    read: ElementRef<HTMLButtonElement>,
  });

  protected rememberMenuTrigger(event: Event): void {
    this.menuTrigger = event.currentTarget as HTMLElement;
  }

  private get identity(): { readonly id: string; readonly name: string } {
    const { id, name } = this.equipment();
    return { id, name };
  }

  protected openAddDialog(): void {
    this.reportChange(
      this.dialog.open<AddPmPlanItemDialog, AddPmPlanItemDialogData, boolean>(AddPmPlanItemDialog, {
        data: { equipment: this.identity },
      }),
    );
  }

  protected openChangeIntervalDialog(item: AppPmPlanItem): void {
    this.reportChange(
      this.dialog.open(ChangePmIntervalDialog, {
        data: { equipmentId: this.identity.id, item },
        restoreFocus: this.menuTrigger,
      }),
    );
  }

  protected openDeactivateDialog(item: AppPmPlanItem): void {
    const ref = this.dialog.open(ConfirmDeactivatePmPlanItemDialog, {
      data: { equipment: this.identity, item },
      restoreFocus: this.menuTrigger,
    });
    // On success the row and its menu button leave the plan, and focus would fall to <body>.
    ref.afterClosed().subscribe((deactivated) => {
      if (deactivated) {
        this.addButton()?.nativeElement.focus();
      }
    });
    this.reportChange(ref);
  }

  protected openDeleteExecutionsDialog(item: AppPmPlanItem): void {
    this.dialog
      .open(ConfirmDeletePmExecutionsDialog, {
        data: { equipmentId: this.identity.id, item },
        restoreFocus: this.menuTrigger,
      })
      .afterClosed()
      .subscribe((deleted) => {
        if (deleted === true) {
          this.executionsDeleted.emit();
        }
      });
  }

  private reportChange(ref: MatDialogRef<unknown, boolean | undefined>): void {
    ref.afterClosed().subscribe((changed) => {
      if (changed) {
        this.changed.emit();
      }
    });
  }
}
