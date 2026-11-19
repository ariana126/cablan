import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import {
  MatExpansionPanel,
  MatExpansionPanelHeader,
  MatExpansionPanelTitle,
} from '@angular/material/expansion';
import { MatIcon } from '@angular/material/icon';

import { formatPersianNumber } from '../../core/i18n/persian-numerals';
import { CurrentUserStore } from '../../core/identity/current-user-store';
import { canImportPmPlans } from '../../core/identity/permissions';
import { matchesSearch } from '../../core/i18n/search-normalizer';
import { AppEquipment, EquipmentGateway } from '../../core/maintenance/equipment-gateway';
import { PmPlanImportGateway } from '../../core/maintenance/pm-plan-import-gateway';
import { DataSheet } from '../../ui/data-sheet/data-sheet';
import { EquipmentFolderCard } from '../../ui/equipment-folder-card/equipment-folder-card';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { Icon } from '../../ui/icon/icon';
import { PageHeader } from '../../ui/page-header/page-header';
import { TableSearch } from '../../ui/table-search/table-search';
import { PmPlanImportDialog } from './pm-plan-import-dialog';
import { mapPmPlanImportPreviewError } from './pm-plan-import-errors';

/**
 * `/pm-plans` — «پرونده فنی تجهیزات» under «فنی»: the shelf of equipment folders (issue #92), the
 * digital form of the technical unit's per-machine binders. The region «تجهیزات فعال» holds one
 * folder per piece of equipment in service — with a PM plan or without — in the API's order, drawn
 * from `GET /api/equipment` alone (no request per folder). Each folder is a link to the equipment's
 * own page, `/pm-plans/:equipmentId`, where its plan and history live.
 *
 * Retired equipment is never on the board: its folders sit in the «تجهیزات کنار گذاشته شده» panel,
 * collapsed and always there, because a retired machine's history stays worth reading.
 * «جستجوی تجهیز» narrows both by name.
 *
 * A search that finds retired equipment says so on the board and opens the archive (issue #112),
 * so the match is never hidden in a closed panel; clearing the search closes it again. The visitor
 * may still close or open it by hand meanwhile.
 *
 * The System Admin also gets «بارگذاری از اکسل» (issue #127): it opens the browser's file chooser,
 * sends the chosen workbook for the server's check and opens the report (`PmPlanImportDialog`),
 * where «تایید» imports it; the board re-reads once plans were added. A file the server could not
 * check is said in a banner under the header.
 */
@Component({
  selector: 'app-pm-plans-page',
  imports: [
    DataSheet,
    EmptyState,
    EquipmentFolderCard,
    ErrorBanner,
    Icon,
    MatButton,
    MatExpansionPanel,
    MatExpansionPanelHeader,
    MatExpansionPanelTitle,
    MatIcon,
    PageHeader,
    TableSearch,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack">
      <app-page-header
        heading="پرونده فنی تجهیزات"
        description="پرونده هر تجهیز، با برنامهٔ PM و سابقهٔ انجام آن؛ برای باز کردن پرونده روی تجهیز بزنید."
      >
        <!-- One root for the slot: a control-flow block with several is not projected into it. -->
        <ng-container ngProjectAs="[pageHeaderActions]">
          @if (canImport() && !forbidden()) {
            <!-- The browser's file chooser, opened by the button below; never shown or focused. -->
            <input
              #fileInput
              type="file"
              accept=".xlsx"
              aria-label="فایل اکسل برنامه PM"
              hidden
              (change)="onFileChosen(fileInput)"
            />
            <button
              #importButton
              matButton="outlined"
              type="button"
              [disabled]="checking()"
              (click)="fileInput.click()"
            >
              <mat-icon appIcon="upload" />بارگذاری از اکسل
            </button>
          }
        </ng-container>
      </app-page-header>

      @if (importError(); as message) {
        <app-error-banner [message]="message" />
      }

      @if (forbidden()) {
        <app-error-banner message="شما دسترسی لازم برای مشاهده این بخش را ندارید." />
      } @else {
        <app-data-sheet
          heading="تجهیزات فعال"
          [count]="equipmentResource.status() === 'loading' ? null : board().length"
          [loading]="equipmentResource.isLoading() || checking()"
          [loadingLabel]="checking() ? 'در حال بررسی فایل اکسل' : 'در حال بارگذاری تجهیزات'"
        >
          <app-table-search ngProjectAs="[sheetSearch]" label="جستجوی تجهیز" [(value)]="search" />

          @if (equipmentResource.status() === 'loading') {
            <!-- The sheet's progress bar says it. -->
          } @else if (equipmentResource.error()) {
            <app-error-banner
              message="فهرست تجهیزات بارگذاری نشد."
              retryLabel="تلاش دوباره"
              (retry)="equipmentResource.reload()"
            />
          } @else if (board().length > 0) {
            <div class="shelf">
              @for (equipment of board(); track equipment.id) {
                <app-equipment-folder-card
                  [link]="['/pm-plans', equipment.id]"
                  [name]="equipment.name"
                  [detail]="planLabel(equipment)"
                />
              }
            </div>
            @if (searchFindsRetired()) {
              <p class="shelf__note" role="status">
                {{ matchingRetiredCount() }} تجهیز دیگر در «تجهیزات کنار گذاشته شده» پیدا شد.
              </p>
            }
          } @else if (searchFindsRetired()) {
            <app-empty-state
              [message]="
                'هیچ تجهیز فعالی با این نام نیست؛ ' +
                matchingRetiredCount() +
                ' تجهیز در «تجهیزات کنار گذاشته شده» پیدا شد.'
              "
              actionLabel="پاک کردن جستجو"
              (action)="search.set('')"
            />
          } @else if (active().length > 0) {
            <app-empty-state
              message="هیچ تجهیزی یافت نشد."
              actionLabel="پاک کردن جستجو"
              (action)="search.set('')"
            />
          } @else {
            <app-empty-state
              message="هنوز هیچ تجهیز فعالی ثبت نشده است."
              description="تجهیزات در «اطلاعات پایه»، صفحهٔ «تجهیزات / دستگاه» ثبت می‌شوند."
            />
          }
        </app-data-sheet>

        <!-- Retired equipment keeps its folder and history, so it stays reachable — out of the way. -->
        <mat-expansion-panel
          class="archive"
          [expanded]="archiveOpen()"
          (expandedChange)="archiveOpen.set($event)"
        >
          <mat-expansion-panel-header>
            <mat-panel-title>تجهیزات کنار گذاشته شده</mat-panel-title>
          </mat-expansion-panel-header>
          @if (matchingRetired().length > 0) {
            <div class="shelf shelf--flush">
              @for (equipment of matchingRetired(); track equipment.id) {
                <app-equipment-folder-card
                  [link]="['/pm-plans', equipment.id]"
                  [name]="equipment.name"
                  detail="کنار گذاشته شده"
                  [retired]="true"
                />
              }
            </div>
          } @else if (retired().length > 0) {
            <p class="archive__note">هیچ تجهیزی یافت نشد.</p>
          } @else {
            <p class="archive__note">هیچ تجهیزی کنار گذاشته نشده است.</p>
          }
        </mat-expansion-panel>
      }
    </div>
  `,
  styleUrl: './pm-plans-page.scss',
})
export class PmPlansPage {
  private readonly gateway = inject(EquipmentGateway);
  private readonly importGateway = inject(PmPlanImportGateway);
  private readonly currentUser = inject(CurrentUserStore);
  private readonly dialog = inject(MatDialog);

  protected readonly equipmentResource = rxResource({
    stream: () => this.gateway.list(),
    defaultValue: [] as AppEquipment[],
  });

  /** «جستجوی تجهیز» — narrows the board and the archive by name. */
  protected readonly search = signal('');

  private readonly allEquipment = computed<AppEquipment[]>(() =>
    this.equipmentResource.hasValue() ? this.equipmentResource.value() : [],
  );

  /** Every piece of equipment in service, plan or no plan, API order. */
  protected readonly active = computed(() =>
    this.allEquipment().filter((equipment) => !equipment.retired),
  );

  protected readonly board = computed(() => this.active().filter(this.matchesSearch));

  protected readonly retired = computed(() =>
    this.allEquipment().filter((equipment) => equipment.retired),
  );

  protected readonly matchingRetired = computed(() => this.retired().filter(this.matchesSearch));

  /** A search under way that finds retired equipment — whose match must not stay in a closed panel. */
  protected readonly searchFindsRetired = computed(
    () => this.search().trim() !== '' && this.matchingRetired().length > 0,
  );

  protected readonly matchingRetiredCount = computed(() =>
    formatPersianNumber(this.matchingRetired().length),
  );

  /** Follows the search (open while it finds retired equipment), and the visitor's own toggling. */
  protected readonly archiveOpen = linkedSignal(() => this.searchFindsRetired());

  private readonly matchesSearch = (equipment: AppEquipment): boolean =>
    matchesSearch(equipment.name, this.search());

  protected readonly forbidden = computed(() => {
    const error = this.equipmentResource.error();
    return error instanceof HttpErrorResponse && error.status === 403;
  });

  /** «بارگذاری از اکسل» is the System Admin's alone (the API's 403 for everyone else). */
  protected readonly canImport = computed(() => canImportPmPlans(this.currentUser.role()));

  // `read: ElementRef` — on a `matButton` the template reference names the component.
  private readonly importButton = viewChild('importButton', { read: ElementRef<HTMLElement> });

  /** Whether a chosen workbook is being checked by the server. */
  protected readonly checking = signal(false);

  /** Why the last chosen workbook produced no report, or `''`. */
  protected readonly importError = signal('');

  /**
   * Sends the chosen workbook for the server's check and opens the report; nothing is added until
   * its «تایید». The input is emptied first, so choosing the same file again — after fixing it in
   * Excel — still fires `change`.
   */
  protected onFileChosen(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (file === undefined) {
      return;
    }

    this.checking.set(true);
    this.importError.set('');
    this.importGateway.preview(file).subscribe({
      next: (report) => {
        this.checking.set(false);
        this.dialog
          // The button was disabled while the file was read, so it no longer has focus for the
          // dialog to remember; name it, or closing the dialog leaves focus on <body>.
          .open(PmPlanImportDialog, {
            restoreFocus: this.importButton()?.nativeElement,
            panelClass: 'dialog--wide',
            data: { file, report },
          })
          .afterClosed()
          .subscribe((imported) => {
            if (imported) {
              this.equipmentResource.reload();
            }
          });
      },
      error: (error: unknown) => {
        this.checking.set(false);
        this.importError.set(mapPmPlanImportPreviewError(error));
      },
    });
  }

  protected planLabel(equipment: AppEquipment): string {
    return equipment.activePlanItemCount > 0
      ? `${formatPersianNumber(equipment.activePlanItemCount)} فعالیت فعال`
      : 'بدون برنامه PM';
  }
}
