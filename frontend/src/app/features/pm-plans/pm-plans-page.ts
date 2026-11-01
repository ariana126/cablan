import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  MatExpansionPanel,
  MatExpansionPanelHeader,
  MatExpansionPanelTitle,
} from '@angular/material/expansion';

import { formatPersianNumber } from '../../core/i18n/persian-numerals';
import { matchesSearch } from '../../core/i18n/search-normalizer';
import { AppEquipment, EquipmentGateway } from '../../core/maintenance/equipment-gateway';
import { DataSheet } from '../../ui/data-sheet/data-sheet';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { PageHeader } from '../../ui/page-header/page-header';
import { TableSearch } from '../../ui/table-search/table-search';
import { PmEquipmentCard } from './pm-equipment-card';

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
 */
@Component({
  selector: 'app-pm-plans-page',
  imports: [
    DataSheet,
    EmptyState,
    ErrorBanner,
    MatExpansionPanel,
    MatExpansionPanelHeader,
    MatExpansionPanelTitle,
    PageHeader,
    PmEquipmentCard,
    TableSearch,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack">
      <app-page-header
        heading="پرونده فنی تجهیزات"
        description="پرونده هر تجهیز، با برنامهٔ PM و سابقهٔ انجام آن؛ برای باز کردن پرونده روی تجهیز بزنید."
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
                <app-pm-equipment-card
                  [equipmentId]="equipment.id"
                  [name]="equipment.name"
                  [detail]="planLabel(equipment)"
                />
              }
            </div>
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
        <mat-expansion-panel class="archive">
          <mat-expansion-panel-header>
            <mat-panel-title>تجهیزات کنار گذاشته شده</mat-panel-title>
          </mat-expansion-panel-header>
          @if (matchingRetired().length > 0) {
            <div class="shelf shelf--flush">
              @for (equipment of matchingRetired(); track equipment.id) {
                <app-pm-equipment-card
                  [equipmentId]="equipment.id"
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

  private readonly matchesSearch = (equipment: AppEquipment): boolean =>
    matchesSearch(equipment.name, this.search());

  protected readonly forbidden = computed(() => {
    const error = this.equipmentResource.error();
    return error instanceof HttpErrorResponse && error.status === 403;
  });

  protected planLabel(equipment: AppEquipment): string {
    return equipment.activePlanItemCount > 0
      ? `${formatPersianNumber(equipment.activePlanItemCount)} فعالیت فعال`
      : 'بدون برنامه PM';
  }
}
