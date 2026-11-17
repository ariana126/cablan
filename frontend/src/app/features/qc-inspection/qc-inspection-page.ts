import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
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

import { AppQcEquipment } from '../../core/qc/qc-equipment-gateway';
import { QcInspectionsGateway } from '../../core/qc/qc-inspections-gateway';
import { qcLastExecution } from '../../core/qc/qc-time';
import { DataSheet } from '../../ui/data-sheet/data-sheet';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { Icon } from '../../ui/icon/icon';
import { PageHeader } from '../../ui/page-header/page-header';
import { QcRecordDialog } from './qc-record-dialog';
import { QcScanDialog } from './qc-scan-dialog';

const COLUMNS = ['activity', 'lastPerformedAt'];

/**
 * `/qc-inspection` — «بازرسی حین تولید» under «کنترل کیفیت» (issue #119), the QC inspector's page
 * (Management and the System Admin too). «اسکن QR تجهیز» opens the camera (`QcScanDialog`); a code it
 * recognises opens that equipment's recording dialog (`QcRecordDialog`) in its place, and when that
 * closes the list below is read again.
 *
 * Below, every in-service equipment with QC activities assigned (`GET /qc-inspections`, by name),
 * each a `<section>` named by its `h3` — the equipment's name — around a table «فعالیت» | «آخرین
 * انجام» («بدون سابقه» when never recorded), which the inspector plans the next inspections from.
 * The acceptance suite finds each table as the first after the heading naming the equipment, and
 * waits for the sheet's progress bar to go. Recording starts from a scan only: the code on the
 * machine is the proof the inspector stood at it.
 */
@Component({
  selector: 'app-qc-inspection-page',
  imports: [
    DataSheet,
    EmptyState,
    ErrorBanner,
    Icon,
    MatButton,
    MatCell,
    MatCellDef,
    MatColumnDef,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatIcon,
    MatRow,
    MatRowDef,
    MatTable,
    PageHeader,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack">
      <app-page-header
        heading="بازرسی حین تولید"
        description="QR چسبانده شده روی تجهیز را اسکن کنید تا انجام فعالیت‌های QC آن را ثبت کنید."
      >
        <ng-container ngProjectAs="[pageHeaderActions]">
          <button #scanButton matButton="filled" type="button" (click)="scan()">
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
              <section class="inspection-box" [attr.aria-labelledby]="headingId(item)">
                <h3 class="inspection-box__title" [id]="headingId(item)">{{ item.name }}</h3>
                <table mat-table [dataSource]="item.activities">
                  <ng-container matColumnDef="activity">
                    <th mat-header-cell *matHeaderCellDef>فعالیت</th>
                    <td mat-cell *matCellDef="let activity" class="inspection-box__activity">
                      {{ activity.activityName }}
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="lastPerformedAt">
                    <th mat-header-cell *matHeaderCellDef>
                      <span class="cell-end">آخرین انجام</span>
                    </th>
                    <td mat-cell *matCellDef="let activity">
                      <span
                        class="cell-end"
                        [class.inspection-box__none]="activity.lastPerformedAt === null"
                        >{{ lastExecution(activity.lastPerformedAt) }}</span
                      >
                    </td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="columns"></tr>
                  <tr mat-row *matRowDef="let row; columns: columns"></tr>
                </table>
              </section>
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
  private readonly scanButton = viewChild('scanButton', { read: ElementRef<HTMLButtonElement> });

  protected readonly columns = COLUMNS;
  protected readonly lastExecution = qcLastExecution;

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

  protected headingId(item: AppQcEquipment): string {
    return `qc-inspection-${item.id}`;
  }

  /** One dialog at a time: the scan closes with the equipment, the recording opens in its place. */
  protected scan(): void {
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
        this.dialog
          .open(QcRecordDialog, { data: { equipment }, restoreFocus: returnFocusTo ?? true })
          .afterClosed()
          .subscribe(() => this.inspectionsResource.reload());
      });
  }
}
