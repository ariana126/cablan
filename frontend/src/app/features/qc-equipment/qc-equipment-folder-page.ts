import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  viewChild,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatAnchor } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';

import { CurrentUserStore } from '../../core/identity/current-user-store';
import { canDeleteQcRecords } from '../../core/identity/permissions';
import { AppQcEquipment, QcEquipmentGateway } from '../../core/qc/qc-equipment-gateway';
import { EquipmentStatus } from '../../ui/equipment-status/equipment-status';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { Icon } from '../../ui/icon/icon';
import { QcExecutionHistory } from '../qc-executions/qc-execution-history';
import { QcAssignedActivitiesSection } from './qc-assigned-activities-section';

/** The page's heading until the equipment's own name is known (and when it never will be). */
const UNNAMED_FOLDER = 'پرونده QC تجهیز';

/**
 * `/qc-equipment/:equipmentId` — one equipment's QC folder (issue #119), modelled on its technical
 * folder (`/pm-plans/:equipmentId`): a header naming the equipment (the `<h1>`), its status and the
 * way back to the shelf, then two sections — «فعالیت‌های QC تجهیز» (what is assigned, with each
 * one's last execution) and «سوابق انجام فعالیت‌ها» (its records, filtered, counted, each opening its
 * details; the System Admin deletes one there).
 *
 * The page owns `GET /api/qc-equipment/:id` (keyed on the route's id, so two folders never mix) and
 * renders the sections only once it is in: an unknown id is one «این پرونده پیدا نشد.» banner.
 * An assignment change re-reads the equipment; a record deleted re-reads it too, since its last
 * executions follow the records that remain.
 */
@Component({
  selector: 'app-qc-equipment-folder-page',
  imports: [
    EquipmentStatus,
    ErrorBanner,
    Icon,
    MatAnchor,
    MatIcon,
    MatProgressBar,
    QcAssignedActivitiesSection,
    QcExecutionHistory,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack">
      <header class="folder-cover">
        <a matButton class="folder-cover__back" routerLink="/qc-equipment">
          <mat-icon appIcon="back" />
          بازگشت به پرونده‌ها
        </a>
        <div class="folder-cover__identity">
          <span
            class="folder-cover__tile"
            [class.folder-cover__tile--muted]="equipment()?.retired !== false"
          >
            <mat-icon appIcon="folder-check" />
          </span>
          <div class="folder-cover__text stack stack--hair">
            @if (equipment()) {
              <p class="folder-cover__kicker">پرونده QC تجهیز</p>
            }
            <h1 class="folder-cover__title" tabindex="-1">{{ heading() }}</h1>
          </div>
          @if (equipment(); as current) {
            <app-equipment-status [retired]="current.retired" />
          }
        </div>
      </header>

      @if (equipmentResource.isLoading() && !equipment()) {
        <mat-progress-bar mode="indeterminate" aria-label="در حال بارگذاری پرونده QC تجهیز" />
      }
      <!-- A failed re-read is said above the folder already on screen, which stays (the records'
           filters with it); only a folder never read, or one gone, is the banner alone. -->
      @if (equipmentResource.error(); as error) {
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
              message="پرونده QC تجهیز بارگذاری نشد."
              retryLabel="تلاش دوباره"
              (retry)="equipmentResource.reload()"
            />
          }
        }
      }
      @if (shownEquipment(); as current) {
        <app-qc-assigned-activities-section
          [equipment]="current"
          [loading]="equipmentResource.isLoading()"
          (changed)="onAssignmentsChanged()"
        />
        <app-qc-execution-history
          [equipmentId]="current.id"
          heading="سوابق انجام فعالیت‌ها"
          [canDelete]="canDelete()"
          (changed)="equipmentResource.reload()"
        />
      }
    </div>
  `,
  styleUrl: './qc-equipment-folder-page.scss',
})
export class QcEquipmentFolderPage {
  private readonly gateway = inject(QcEquipmentGateway);
  private readonly currentUser = inject(CurrentUserStore);

  /** The route's `:equipmentId`, bound by `withComponentInputBinding()`. */
  readonly equipmentId = input.required<string>();

  protected readonly equipmentResource = rxResource({
    params: () => this.equipmentId(),
    stream: ({ params: id }) => this.gateway.get(id),
  });

  /**
   * The folder last read for this id: kept through a failed re-read (a resource in error has no
   * value), dropped when the route names another equipment.
   */
  protected readonly equipment = linkedSignal<
    { id: string; value: AppQcEquipment | undefined },
    AppQcEquipment | undefined
  >({
    source: () => ({
      id: this.equipmentId(),
      value: this.equipmentResource.hasValue() ? this.equipmentResource.value() : undefined,
    }),
    computation: (source, previous) =>
      source.value ??
      (previous !== undefined && previous.source.id === source.id ? previous.value : undefined),
  });

  /** What the sections show: nothing once the API says the equipment is gone. */
  protected readonly shownEquipment = computed(() => {
    const error = this.equipmentResource.error();
    return error !== undefined && this.failure(error) === 'not-found'
      ? undefined
      : this.equipment();
  });

  protected readonly heading = computed(() => this.equipment()?.name ?? UNNAMED_FOLDER);

  /** The System Admin deletes QC records; nobody else is offered it. */
  protected readonly canDelete = computed(() => canDeleteQcRecords(this.currentUser.role()));

  private readonly history = viewChild(QcExecutionHistory);

  /** A new or removed assignment changes the folder, and the activities the records filter by. */
  protected onAssignmentsChanged(): void {
    this.equipmentResource.reload();
    this.history()?.reload();
  }

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
