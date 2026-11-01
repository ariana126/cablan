import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatAnchor } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';

import { AppEquipmentDetail, EquipmentGateway } from '../../core/maintenance/equipment-gateway';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { Icon } from '../../ui/icon/icon';
import { EquipmentStatus } from './equipment-status';
import { PmHistorySection } from './pm-history-section';
import { PmInactiveItemsSection } from './pm-inactive-items-section';
import { PmPlanSection } from './pm-plan-section';

/** The page's heading until the equipment's own name is known (and when it never will be). */
const UNNAMED_FOLDER = 'پرونده فنی تجهیز';

/**
 * `/pm-plans/:equipmentId` — one equipment's technical folder (issue #92), the digital binder a
 * factory keeps per machine. Its header names the equipment (the page's `<h1>`), says whether it is
 * «فعال» or «کنار گذاشته شده», and leads back with «بازگشت به پرونده‌ها». Under it the folder's
 * sections are stacked, each its own component and its own region: «برنامه PM», «فعالیت‌های غیرفعال»
 * (the plan rows deactivated for good, issue #91), then «سابقه PM».
 * A later section (failures, repairs, parts, documents) is one more component in that stack.
 *
 * Everything is keyed on the route's `equipmentId`: moving to another folder drops the one before
 * at once — its sections unmount until the new equipment is in — so two folders never mix. The
 * sections render only once the equipment is read, so an unknown id shows one «این پرونده پیدا
 * نشد.» banner (the way back stays in the header), not a failed request per section.
 */
@Component({
  selector: 'app-equipment-folder-page',
  imports: [
    EquipmentStatus,
    ErrorBanner,
    Icon,
    MatAnchor,
    MatIcon,
    MatProgressBar,
    PmHistorySection,
    PmInactiveItemsSection,
    PmPlanSection,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack">
      <header class="folder-cover">
        <a matButton class="folder-cover__back" routerLink="/pm-plans">
          <mat-icon appIcon="back" />
          بازگشت به پرونده‌ها
        </a>
        <div class="folder-cover__identity">
          <span
            class="folder-cover__tile"
            [class.folder-cover__tile--muted]="equipment()?.retired !== false"
          >
            <mat-icon appIcon="folder" />
          </span>
          <div class="folder-cover__text stack stack--hair">
            @if (equipment()) {
              <p class="folder-cover__kicker">پرونده فنی تجهیز</p>
            }
            <h1 class="folder-cover__title" tabindex="-1">{{ heading() }}</h1>
          </div>
          @if (equipment(); as current) {
            <app-equipment-status [retired]="current.retired" />
          }
        </div>
      </header>

      @if (equipmentResource.isLoading() && !equipment()) {
        <mat-progress-bar mode="indeterminate" aria-label="در حال بارگذاری پرونده تجهیز" />
      } @else if (equipmentResource.error(); as error) {
        @switch (failure(error)) {
          @case ('not-found') {
            <app-error-banner
              message="این پرونده پیدا نشد."
              detail="تجهیزی با این نشانی ثبت نشده است. از «بازگشت به پرونده‌ها» پروندهٔ دیگری را باز کنید."
            />
          }
          @case ('forbidden') {
            <app-error-banner message="شما دسترسی لازم برای مشاهده این بخش را ندارید." />
          }
          @default {
            <app-error-banner
              message="پرونده تجهیز بارگذاری نشد."
              retryLabel="تلاش دوباره"
              (retry)="equipmentResource.reload()"
            />
          }
        }
      } @else if (equipment(); as current) {
        <app-pm-plan-section
          [equipment]="current"
          [loading]="equipmentResource.isLoading()"
          (changed)="equipmentResource.reload()"
        />
        <app-pm-inactive-items-section
          [equipment]="current"
          [loading]="equipmentResource.isLoading()"
        />
        <app-pm-history-section [equipmentId]="current.id" [equipmentName]="current.name" />
      }
    </div>
  `,
  styleUrl: './equipment-folder-page.scss',
})
export class EquipmentFolderPage {
  private readonly gateway = inject(EquipmentGateway);

  /** The route's `:equipmentId`, bound by `withComponentInputBinding()`. */
  readonly equipmentId = input.required<string>();

  /** Re-read on a plan change (`reloading` keeps the value); reset on another folder. */
  protected readonly equipmentResource = rxResource({
    params: () => this.equipmentId(),
    stream: ({ params: id }) => this.gateway.get(id),
  });

  protected readonly equipment = computed<AppEquipmentDetail | undefined>(() =>
    this.equipmentResource.hasValue() ? this.equipmentResource.value() : undefined,
  );

  protected readonly heading = computed(() => this.equipment()?.name ?? UNNAMED_FOLDER);

  protected failure(error: unknown): 'not-found' | 'forbidden' | 'other' {
    if (error instanceof HttpErrorResponse) {
      // A malformed id is refused as a bad request; to a visitor it is the same missing folder.
      if (error.status === 404 || error.status === 400) {
        return 'not-found';
      }
      if (error.status === 403) {
        return 'forbidden';
      }
    }
    return 'other';
  }
}
