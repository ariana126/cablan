import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatDivider } from '@angular/material/divider';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuContent, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
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

import { matchesSearch } from '../../core/i18n/search-normalizer';
import { CurrentUserStore } from '../../core/identity/current-user-store';
import { canReach } from '../../core/identity/navigation';
import {
  canCorrectRecordsInUse,
  canDeleteMaintenanceRecords,
  canReactivateEquipment,
} from '../../core/identity/permissions';
import { AppEquipment, EquipmentGateway } from '../../core/maintenance/equipment-gateway';
import { CopyId } from '../../ui/copy-id-button/copy-id';
import { DataSheet } from '../../ui/data-sheet/data-sheet';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { EquipmentStatus } from '../../ui/equipment-status/equipment-status';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { PageHeader } from '../../ui/page-header/page-header';
import { TableSearch } from '../../ui/table-search/table-search';
import { ConfirmDeleteEquipmentDialog } from './confirm-delete-equipment-dialog';
import { ConfirmRetireEquipmentDialog } from './confirm-retire-equipment-dialog';
import { EquipmentFormDialog, EquipmentSaved } from './equipment-form-dialog';
import { ReactivateEquipmentDialog } from './reactivate-equipment-dialog';
import { Icon } from '../../ui/icon/icon';

const DISPLAYED_COLUMNS = ['name', 'state', 'actions'];

/**
 * `/equipment` — «تجهیزات / دستگاه» under «اطلاعات پایه». The equipment a PM plan is kept for:
 * registered and renamed by name, retired from the row's actions menu. Retired equipment stays in
 * the list, marked, because its maintenance history does; it offers no actions — except to the
 * System Admin (issue #110), who may still rename it and, from its menu, «فعال سازی دوباره» or
 * «حذف تجهیز» it.
 *
 * Issue #112's hierarchy: the name first, its status a quieter pill, then the row's way into the
 * equipment's folder («مشاهده پرونده فنی», for every row a role may open folders from), the
 * low-emphasis «ویرایش», and the rare and dangerous actions in the «عملیات بیشتر» menu, the
 * dangerous ones under a divider in the error colour. A registration is confirmed by a snackbar
 * whose action opens the new equipment's folder.
 */
@Component({
  selector: 'app-equipment-page',
  imports: [
    DataSheet,
    EmptyState,
    EquipmentStatus,
    ErrorBanner,
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
    PageHeader,
    RouterLink,
    TableSearch,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack">
      <app-page-header
        heading="مدیریت تجهیزات / دستگاه"
        description="تجهیزات و دستگاه‌هایی که برنامهٔ تعمیرات پیشگیرانه برایشان تعریف می‌شود"
      >
        <ng-container ngProjectAs="[pageHeaderActions]">
          @if (!forbidden()) {
            <button #addButton matButton="filled" type="button" (click)="openCreateDialog()">
              <mat-icon>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </mat-icon>
              افزودن تجهیز
            </button>
          }
        </ng-container>
      </app-page-header>

      <app-data-sheet
        heading="فهرست تجهیزات"
        [count]="equipmentResource.isLoading() || equipmentResource.error() ? null : rows().length"
        [loading]="equipmentResource.isLoading()"
        loadingLabel="در حال بارگذاری فهرست تجهیزات"
      >
        @if (all().length > 0) {
          <app-table-search sheetSearch label="جستجوی نام تجهیز" [(value)]="query" />
        }

        @if (equipmentResource.isLoading()) {
          <!-- The sheet's progress bar says it. -->
        } @else if (forbidden()) {
          <app-error-banner message="شما دسترسی لازم برای مشاهده این بخش را ندارید." />
        } @else if (equipmentResource.error()) {
          <app-error-banner
            message="فهرست تجهیزات بارگذاری نشد."
            retryLabel="تلاش دوباره"
            (retry)="equipmentResource.reload()"
          />
        } @else if (all().length === 0) {
          <app-empty-state message="هیچ تجهیزی ثبت نشده است." />
        } @else if (rows().length === 0) {
          <app-empty-state
            message="تجهیزی با این نام یافت نشد."
            actionLabel="پاک کردن جستجو"
            (action)="query.set('')"
          />
        } @else {
          <table mat-table [dataSource]="rows()">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>نام</th>
              <td mat-cell *matCellDef="let equipment" class="equipment-name">
                {{ equipment.name }}
              </td>
            </ng-container>

            <ng-container matColumnDef="state">
              <th mat-header-cell *matHeaderCellDef>وضعیت</th>
              <td mat-cell *matCellDef="let equipment">
                <app-equipment-status [retired]="equipment.retired" [announced]="false" />
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>
                <span class="visually-hidden">عملیات</span>
              </th>
              <td mat-cell *matCellDef="let equipment">
                <div class="cell-actions">
                  @if (canOpenFolder()) {
                    <a
                      matButton
                      class="button--small"
                      [routerLink]="['/pm-plans', equipment.id]"
                      [attr.aria-label]="'مشاهده پرونده فنی ' + equipment.name"
                    >
                      <mat-icon appIcon="folder" />
                      مشاهده پرونده فنی
                    </a>
                  }
                  @if (!equipment.retired || canCorrect()) {
                    <button
                      matButton
                      class="button--small"
                      type="button"
                      [attr.aria-label]="'ویرایش ' + equipment.name"
                      (click)="openEditDialog(equipment)"
                    >
                      <mat-icon appIcon="edit" />
                      ویرایش
                    </button>
                    <button
                      matIconButton
                      class="icon-button--small"
                      type="button"
                      [attr.aria-label]="'عملیات بیشتر برای ' + equipment.name"
                      [matMenuTriggerFor]="rowMenu"
                      [matMenuTriggerData]="{ equipment }"
                      (click)="rememberMenuTrigger($event)"
                    >
                      <mat-icon appIcon="more" />
                    </button>
                  }
                </div>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
          </table>
        }
      </app-data-sheet>

      <mat-menu #rowMenu="matMenu">
        <ng-template matMenuContent let-equipment="equipment">
          <button mat-menu-item type="button" (click)="copyId.copy(equipment.id)">
            <mat-icon>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="9" y="9" width="12" height="12" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </mat-icon>
            <span>کپی شناسه</span>
          </button>
          @if (equipment.retired) {
            @if (canReactivate()) {
              <button mat-menu-item type="button" (click)="openReactivateDialog(equipment)">
                <mat-icon appIcon="retry" />
                <span>فعال سازی دوباره</span>
              </button>
            }
            @if (canDelete()) {
              <mat-divider />
              <button
                mat-menu-item
                class="menu-item--danger"
                type="button"
                (click)="openDeleteDialog(equipment)"
              >
                <mat-icon appIcon="delete" />
                <span>حذف تجهیز</span>
              </button>
            }
          } @else {
            <mat-divider />
            <button
              mat-menu-item
              class="menu-item--danger"
              type="button"
              (click)="openRetireDialog(equipment)"
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
                  <circle cx="12" cy="12" r="9" />
                  <path d="M5.6 5.6l12.8 12.8" />
                </svg>
              </mat-icon>
              <span>کنار گذاشتن</span>
            </button>
          }
        </ng-template>
      </mat-menu>
    </div>
  `,
  styleUrl: './equipment-page.scss',
})
export class EquipmentPage {
  private readonly gateway = inject(EquipmentGateway);
  private readonly dialog = inject(MatDialog);
  protected readonly copyId = inject(CopyId);
  private readonly currentUser = inject(CurrentUserStore);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  /** Whether this role may open `/pm-plans/:id` — the row's link and the snackbar's offer. */
  protected readonly canOpenFolder = computed(() => canReach('pm-plans', this.currentUser.role()));

  /** Issue #110: the System Admin's exceptions — retired equipment renamed, reactivated, deleted. */
  protected readonly canCorrect = computed(() => canCorrectRecordsInUse(this.currentUser.role()));
  protected readonly canReactivate = computed(() =>
    canReactivateEquipment(this.currentUser.role()),
  );
  protected readonly canDelete = computed(() =>
    canDeleteMaintenanceRecords(this.currentUser.role()),
  );

  /** Where focus goes once a deleted equipment — its menu button with it — has left the list. */
  private readonly addButton = viewChild('addButton', { read: ElementRef<HTMLButtonElement> });

  protected readonly displayedColumns = DISPLAYED_COLUMNS;

  protected readonly equipmentResource = rxResource({
    stream: () => this.gateway.list(),
    defaultValue: [] as AppEquipment[],
  });

  protected readonly query = signal('');

  protected readonly all = computed<AppEquipment[]>(() =>
    this.equipmentResource.hasValue() ? this.equipmentResource.value() : [],
  );

  protected readonly rows = computed<AppEquipment[]>(() => {
    const query = this.query();
    return this.all().filter((equipment) => matchesSearch(equipment.name, query));
  });

  protected readonly forbidden = computed(() => {
    const error = this.equipmentResource.error();
    return error instanceof HttpErrorResponse && error.status === 403;
  });

  /**
   * The row's «عملیات بیشتر» button, kept from its click. A dialog opened from one of the menu's
   * items would otherwise hand focus back to that item — gone with the menu — and so to <body>.
   */
  private menuTrigger: HTMLElement | undefined;

  protected rememberMenuTrigger(event: Event): void {
    this.menuTrigger = event.currentTarget as HTMLElement;
  }

  protected openCreateDialog(): void {
    this.dialog
      .open<EquipmentFormDialog, unknown, EquipmentSaved>(EquipmentFormDialog, {
        data: { mode: 'create' },
      })
      .afterClosed()
      .subscribe((saved) => {
        if (!saved) {
          return;
        }
        this.equipmentResource.reload();
        this.offerFolder(saved.id);
      });
  }

  protected openEditDialog(equipment: AppEquipment): void {
    this.dialog
      .open<EquipmentFormDialog, unknown, EquipmentSaved>(EquipmentFormDialog, {
        data: { mode: 'edit', equipment },
      })
      .afterClosed()
      .subscribe((saved) => {
        if (!saved) {
          return;
        }
        this.equipmentResource.reload();
        this.snackBar.open('تغییرات ذخیره شد.', undefined, { duration: 5000 });
      });
  }

  /**
   * The next step after registering is usually the equipment's PM plan, so the confirmation offers
   * its folder. Not the only way there: the new row's «مشاهده پرونده فنی» link stays, for anyone
   * who misses a snackbar.
   */
  private offerFolder(id: string): void {
    if (!this.canOpenFolder()) {
      this.snackBar.open('تجهیز ثبت شد.', undefined, { duration: 5000 });
      return;
    }
    this.snackBar
      .open('تجهیز ثبت شد.', 'مشاهده پرونده فنی', { duration: 8000 })
      .onAction()
      .subscribe(() => void this.router.navigate(['/pm-plans', id]));
  }

  protected openRetireDialog(equipment: AppEquipment): void {
    this.reloadWhenTrue(
      this.dialog.open(ConfirmRetireEquipmentDialog, {
        data: { equipment },
        restoreFocus: this.menuTrigger,
      }),
    );
  }

  protected openReactivateDialog(equipment: AppEquipment): void {
    this.reloadWhenTrue(
      this.dialog.open(ReactivateEquipmentDialog, {
        data: { equipment },
        restoreFocus: this.menuTrigger,
      }),
    );
  }

  protected openDeleteDialog(equipment: AppEquipment): void {
    const ref = this.dialog.open(ConfirmDeleteEquipmentDialog, {
      data: { equipment },
      restoreFocus: this.menuTrigger,
    });
    ref.afterClosed().subscribe((deleted) => {
      if (deleted === true) {
        this.addButton()?.nativeElement.focus();
      }
    });
    this.reloadWhenTrue(ref);
  }

  private reloadWhenTrue(ref: MatDialogRef<unknown, boolean>): void {
    ref.afterClosed().subscribe((changed) => {
      if (changed === true) {
        this.equipmentResource.reload();
      }
    });
  }
}
