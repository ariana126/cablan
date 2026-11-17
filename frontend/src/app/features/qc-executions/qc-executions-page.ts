import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { CurrentUserStore } from '../../core/identity/current-user-store';
import { canDeleteQcRecords } from '../../core/identity/permissions';
import { PageHeader } from '../../ui/page-header/page-header';
import { QcExecutionHistory } from './qc-execution-history';

/**
 * `/qc-executions` — «سوابق فعالیت‌های QC» under «کنترل کیفیت › گزارشات» (issue #119): every QC
 * record of every equipment, Management and the System Admin. The records, their filters, counts
 * and details are the equipment folder's own (`QcExecutionHistory`), with an «تجهیز» filter and
 * column added; the System Admin may delete a record from its details.
 */
@Component({
  selector: 'app-qc-executions-page',
  imports: [PageHeader, QcExecutionHistory],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack">
      <app-page-header
        heading="سوابق فعالیت‌های QC"
        description="همهٔ ثبت‌های انجام فعالیت‌های QC، با فاصله از انجام قبلی و تعداد انجام هر فعالیت روی هر تجهیز"
      />
      <app-qc-execution-history
        [equipmentId]="null"
        heading="سوابق انجام فعالیت‌ها"
        [canDelete]="canDelete()"
      />
    </div>
  `,
  styleUrl: './qc-executions-page.scss',
})
export class QcExecutionsPage {
  private readonly currentUser = inject(CurrentUserStore);

  protected readonly canDelete = computed(() => canDeleteQcRecords(this.currentUser.role()));
}
