import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  MatExpansionPanel,
  MatExpansionPanelHeader,
  MatExpansionPanelTitle,
} from '@angular/material/expansion';

import { formatPersianNumber } from '../../core/i18n/persian-numerals';
import { matchesSearch } from '../../core/i18n/search-normalizer';
import { AppQcEquipmentSummary, QcEquipmentGateway } from '../../core/qc/qc-equipment-gateway';
import { DataSheet } from '../../ui/data-sheet/data-sheet';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { EquipmentFolderCard } from '../../ui/equipment-folder-card/equipment-folder-card';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { PageHeader } from '../../ui/page-header/page-header';
import { TableSearch } from '../../ui/table-search/table-search';

/**
 * `/qc-equipment` — «پرونده QC تجهیزات» under «کنترل کیفیت» (issue #119), modelled on «پرونده فنی
 * تجهیزات» (`/pm-plans`): a shelf of equipment folders, one per equipment in service in the region
 * «تجهیزات فعال», each a link to its QC folder `/qc-equipment/:equipmentId`, its line saying how many
 * QC activities it holds. Retired equipment's folders stay readable in the collapsed «تجهیزات کنار
 * گذاشته شده» panel, opened by a search that finds one. One request: `GET /api/qc-equipment`.
 */
@Component({
  selector: 'app-qc-equipment-page',
  imports: [
    DataSheet,
    EmptyState,
    EquipmentFolderCard,
    ErrorBanner,
    MatExpansionPanel,
    MatExpansionPanelHeader,
    MatExpansionPanelTitle,
    PageHeader,
    TableSearch,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack">
      <app-page-header
        heading="پرونده QC تجهیزات"
        description="پرونده کنترل کیفیت هر تجهیز، با فعالیت‌های QC تخصیص‌یافته و سوابق انجام آن‌ها؛ برای باز کردن پرونده روی تجهیز بزنید."
      />

      @if (forbidden()) {
        <app-error-banner message="شما دسترسی لازم برای مشاهده این بخش را ندارید." />
      } @else {
        <app-data-sheet
          heading="تجهیزات فعال"
          [count]="equipmentResource.status() === 'loading' ? null : board().length"
          [loading]="equipmentResource.isLoading()"
          loadingLabel="در حال بارگذاری تجهیزات"
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
                  [link]="['/qc-equipment', equipment.id]"
                  [name]="equipment.name"
                  [detail]="activitiesLabel(equipment)"
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
                  [link]="['/qc-equipment', equipment.id]"
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
  styleUrl: './qc-equipment-page.scss',
})
export class QcEquipmentPage {
  private readonly gateway = inject(QcEquipmentGateway);

  protected readonly equipmentResource = rxResource({
    stream: () => this.gateway.list(),
    defaultValue: [] as AppQcEquipmentSummary[],
  });

  protected readonly search = signal('');

  private readonly allEquipment = computed<AppQcEquipmentSummary[]>(() =>
    this.equipmentResource.hasValue() ? this.equipmentResource.value() : [],
  );

  protected readonly active = computed(() =>
    this.allEquipment().filter((equipment) => !equipment.retired),
  );
  protected readonly board = computed(() => this.active().filter(this.matchesSearch));
  protected readonly retired = computed(() =>
    this.allEquipment().filter((equipment) => equipment.retired),
  );
  protected readonly matchingRetired = computed(() => this.retired().filter(this.matchesSearch));

  protected readonly searchFindsRetired = computed(
    () => this.search().trim() !== '' && this.matchingRetired().length > 0,
  );
  protected readonly matchingRetiredCount = computed(() =>
    formatPersianNumber(this.matchingRetired().length),
  );

  /** Follows the search (open while it finds retired equipment), and the visitor's own toggling. */
  protected readonly archiveOpen = linkedSignal(() => this.searchFindsRetired());

  private readonly matchesSearch = (equipment: AppQcEquipmentSummary): boolean =>
    matchesSearch(equipment.name, this.search());

  protected readonly forbidden = computed(() => {
    const error = this.equipmentResource.error();
    return error instanceof HttpErrorResponse && error.status === 403;
  });

  protected activitiesLabel(equipment: AppQcEquipmentSummary): string {
    return equipment.assignedActivityCount > 0
      ? `${formatPersianNumber(equipment.assignedActivityCount)} فعالیت QC`
      : 'بدون فعالیت QC';
  }
}
