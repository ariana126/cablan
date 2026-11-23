import { HttpErrorResponse } from '@angular/common/http';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';

import { AppQcEquipment } from '../../core/qc/qc-equipment-gateway';
import { QcInspectionsGateway } from '../../core/qc/qc-inspections-gateway';
import { DataSheet } from '../../ui/data-sheet/data-sheet';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { Icon } from '../../ui/icon/icon';
import { PageHeader } from '../../ui/page-header/page-header';
import { QcEquipmentChecklist } from './qc-equipment-checklist';
import { QcScanDialog } from './qc-scan-dialog';

/**
 * `/qc-inspection` — «بازرسی حین تولید» under «کنترل کیفیت» (issue #119), the QC inspector's page
 * (Management and the System Admin too).
 *
 * Every in-service equipment with QC activities assigned (`GET /qc-inspections`, by name) is a
 * checklist (`QcEquipmentChecklist`, issue #132): a `<section>` named by its `h3` — the equipment's
 * name — around a table «فعالیت» | «آخرین انجام» («بدون سابقه» when never recorded), each activity a
 * checkbox, and the section's «ثبت انجام» recording the ticked ones with one tracking number. The
 * list is read again whenever a checklist sent something. The acceptance suite finds each table as
 * the first after the heading naming the equipment, and waits for the sheet's progress bar to go.
 *
 * «اسکن QR تجهیز» opens the camera (`QcScanDialog`); a code it recognises reads the list again and
 * puts focus on that equipment's checklist. `?scan=true` (the home page's «اسکن QR تجهیز» shortcut,
 * issue #130) starts that scan on arrival.
 */
@Component({
  selector: 'app-qc-inspection-page',
  imports: [
    DataSheet,
    EmptyState,
    ErrorBanner,
    Icon,
    MatButton,
    MatIcon,
    PageHeader,
    QcEquipmentChecklist,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack">
      <app-page-header
        heading="بازرسی حین تولید"
        description="فعالیت‌های انجام‌شده هر تجهیز را علامت بزنید و ثبت کنید؛ با اسکن QR روی تجهیز، فهرست همان تجهیز آماده می‌شود."
      >
        <ng-container ngProjectAs="[pageHeaderActions]">
          <button #scanButton matButton="filled" type="button" (click)="startScan()">
            <mat-icon appIcon="qr-code" />
            اسکن QR تجهیز
          </button>
        </ng-container>
      </app-page-header>

      <app-data-sheet
        heading="فعالیت‌های QC تجهیزات"
        [count]="inspectionsResource.status() === 'loading' ? null : equipment().length"
        [loading]="inspectionsResource.isLoading()"
        loadingLabel="در حال بارگذاری فعالیت‌های QC تجهیزات"
      >
        @if (inspectionsResource.status() === 'loading') {
          <!-- The sheet's progress bar says it. -->
        } @else if (forbidden()) {
          <app-error-banner message="شما دسترسی لازم برای مشاهده این بخش را ندارید." />
        } @else if (inspectionsResource.error()) {
          <app-error-banner
            message="فعالیت‌های QC تجهیزات بارگذاری نشد."
            retryLabel="تلاش دوباره"
            (retry)="inspectionsResource.reload()"
          />
        } @else if (equipment().length === 0) {
          <app-empty-state
            message="هیچ تجهیز فعالی فعالیت QC تخصیص‌یافته ندارد."
            description="فعالیت‌های QC در «کنترل کیفیت › پرونده QC تجهیزات» به تجهیزات تخصیص داده می‌شوند."
          />
        } @else {
          <div class="inspection-boxes">
            @for (item of equipment(); track item.id) {
              <app-qc-equipment-checklist
                [equipment]="item"
                (submitted)="inspectionsResource.reload()"
              />
            }
          </div>
        }
      </app-data-sheet>
    </div>
  `,
  styleUrl: './qc-inspection-page.scss',
})
export class QcInspectionPage {
  private readonly gateway = inject(QcInspectionsGateway);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly scanButton = viewChild('scanButton', { read: ElementRef<HTMLButtonElement> });

  /**
   * `?scan=true` — how the home page's «اسکن QR تجهیز» shortcut starts a scan (issue #130). The page
   * starts it once, exactly as its own «اسکن QR تجهیز» does, then drops the parameter so a reload
   * or the back button does not open the camera again.
   */
  readonly scan = input<string>();

  /** The equipment a scan just named, until its checklist has focus. */
  private readonly scanned = signal<string | undefined>(undefined);

  constructor() {
    this.focusTheScannedChecklist();
    // After the first render, so the scan dialog has the page's own button to hand focus back to.
    afterNextRender(() => {
      if (this.scan() !== 'true') {
        return;
      }
      this.startScan();
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { scan: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });
  }

  protected readonly inspectionsResource = rxResource({
    stream: () => this.gateway.list(),
    defaultValue: [] as AppQcEquipment[],
  });

  protected readonly equipment = computed<AppQcEquipment[]>(() =>
    this.inspectionsResource.hasValue() ? this.inspectionsResource.value() : [],
  );

  protected readonly forbidden = computed(() => {
    const error = this.inspectionsResource.error();
    return error instanceof HttpErrorResponse && error.status === 403;
  });

  /**
   * The scan closes with the equipment; the list is read again (its last executions may have moved
   * since the page opened) and focus goes to that equipment's first activity, ready to tick.
   */
  protected startScan(): void {
    const returnFocusTo = this.scanButton()?.nativeElement;
    this.dialog
      .open<QcScanDialog, unknown, AppQcEquipment>(QcScanDialog, {
        restoreFocus: returnFocusTo ?? true,
      })
      .afterClosed()
      .subscribe((equipment) => {
        if (equipment === undefined) {
          return;
        }
        this.scanned.set(equipment.id);
        this.inspectionsResource.reload();
      });
  }

  /** Once the list is in again, the scanned equipment's checklist takes focus. */
  private focusTheScannedChecklist(): void {
    effect(() => {
      const equipmentId = this.scanned();
      if (equipmentId === undefined || this.inspectionsResource.isLoading()) {
        return;
      }
      this.equipment();
      untracked(() => this.scanned.set(undefined));
      afterNextRender(
        () =>
          this.host.nativeElement
            .querySelector<HTMLElement>(
              `section[aria-labelledby="qc-inspection-${equipmentId}"] input[type="checkbox"]`,
            )
            ?.focus(),
        { injector: this.injector },
      );
    });
  }
}
