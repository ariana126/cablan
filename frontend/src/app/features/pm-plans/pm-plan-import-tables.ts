import { ChangeDetectionStrategy, Component, input } from '@angular/core';
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
import {
  AppPmPlanImportConflict,
  AppPmPlanImportError,
  AppPmPlanImportItem,
} from '../../core/maintenance/pm-plan-import-gateway';
import { PersianNumberPipe } from '../../ui/persian-number/persian-number-pipe';
import { StackedTable } from '../../ui/stacked-table/stacked-table';
import { cellValue, differenceLabel } from './pm-plan-import-report';

const TABLE_IMPORTS = [
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
  StackedTable,
];

/*
 * The PM-plan import dialog's three tables (issue #127), each a framed `mat-table` that folds into
 * cards on a phone (`appStackedTable`). Header texts are the acceptance suite's keys: it tells the
 * errors table by its «علت» column and the differences table by its «اختلاف» column. Rows keep the
 * server's (file) order. Identifiers from the workbook — sheet, cell, column and the spreadsheet row
 * number — keep Latin digits, so they read as Excel shows them; intervals and dates are Persian.
 */

/** Rows the file names: those confirming adds (or added), and those already in force. */
@Component({
  selector: 'app-pm-plan-import-items-table',
  imports: [...TABLE_IMPORTS, PersianNumberPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="import-table" appStackedTable>
      <table mat-table [dataSource]="items()">
        <ng-container matColumnDef="equipment">
          <th mat-header-cell *matHeaderCellDef>تجهیز</th>
          <td mat-cell *matCellDef="let item">{{ item.equipmentName }}</td>
        </ng-container>
        <ng-container matColumnDef="activity">
          <th mat-header-cell *matHeaderCellDef>فعالیت</th>
          <td mat-cell *matCellDef="let item">{{ item.activityName }}</td>
        </ng-container>
        <ng-container matColumnDef="intervalDays">
          <th mat-header-cell *matHeaderCellDef><span class="cell-end">دوره (روز)</span></th>
          <td mat-cell *matCellDef="let item">
            <span class="cell-end">{{ item.intervalDays | persianNumber }}</span>
          </td>
        </ng-container>
        <ng-container matColumnDef="firstDueDate">
          <th mat-header-cell *matHeaderCellDef><span class="cell-end">اولین موعد</span></th>
          <td mat-cell *matCellDef="let item">
            <span class="cell-end">{{ jalaliDate(item.firstDueDate) }}</span>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let item; columns: columns"></tr>
      </table>
    </div>
  `,
  styleUrl: './pm-plan-import-tables.scss',
})
export class PmPlanImportItemsTable {
  readonly items = input.required<readonly AppPmPlanImportItem[]>();

  protected readonly columns = ['equipment', 'activity', 'intervalDays', 'firstDueDate'];
  protected readonly jalaliDate = formatJalaliCalendarDate;
}

/** Every cell the check refused, where it is and why — the reason in the server's own words. */
@Component({
  selector: 'app-pm-plan-import-errors-table',
  imports: TABLE_IMPORTS,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="import-table" appStackedTable>
      <table mat-table [dataSource]="errors()">
        <ng-container matColumnDef="sheet">
          <th mat-header-cell *matHeaderCellDef>شیت</th>
          <td mat-cell *matCellDef="let error">
            <span class="cell-id">{{ error.sheet }}</span>
          </td>
        </ng-container>
        <ng-container matColumnDef="cell">
          <th mat-header-cell *matHeaderCellDef>خانه</th>
          <td mat-cell *matCellDef="let error">
            <span class="cell-id">{{ error.cell }}</span>
          </td>
        </ng-container>
        <ng-container matColumnDef="row">
          <th mat-header-cell *matHeaderCellDef>ردیف</th>
          <td mat-cell *matCellDef="let error">
            <span class="cell-id">{{ error.row }}</span>
          </td>
        </ng-container>
        <ng-container matColumnDef="column">
          <th mat-header-cell *matHeaderCellDef>ستون</th>
          <td mat-cell *matCellDef="let error">
            <span class="cell-id">{{ error.column }}</span>
          </td>
        </ng-container>
        <ng-container matColumnDef="value">
          <th mat-header-cell *matHeaderCellDef>مقدار</th>
          <td mat-cell *matCellDef="let error" class="import-table__value">
            {{ value(error.value) }}
          </td>
        </ng-container>
        <ng-container matColumnDef="reason">
          <th mat-header-cell *matHeaderCellDef>علت</th>
          <td mat-cell *matCellDef="let error" class="import-table__reason">{{ error.message }}</td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let error; columns: columns"></tr>
      </table>
    </div>
  `,
  styleUrl: './pm-plan-import-tables.scss',
})
export class PmPlanImportErrorsTable {
  readonly errors = input.required<readonly AppPmPlanImportError[]>();

  protected readonly columns = ['sheet', 'cell', 'row', 'column', 'value', 'reason'];
  protected readonly value = cellValue;
}

/** Rows the file names that are active with another interval or first due date: what differs, then
 * the file's values beside the active row's. Reported only — the active row is never changed. */
@Component({
  selector: 'app-pm-plan-import-conflicts-table',
  imports: [...TABLE_IMPORTS, PersianNumberPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="import-table" appStackedTable>
      <table mat-table [dataSource]="conflicts()">
        <ng-container matColumnDef="equipment">
          <th mat-header-cell *matHeaderCellDef>تجهیز</th>
          <td mat-cell *matCellDef="let conflict">{{ conflict.equipmentName }}</td>
        </ng-container>
        <ng-container matColumnDef="activity">
          <th mat-header-cell *matHeaderCellDef>فعالیت</th>
          <td mat-cell *matCellDef="let conflict">{{ conflict.activityName }}</td>
        </ng-container>
        <ng-container matColumnDef="difference">
          <th mat-header-cell *matHeaderCellDef>اختلاف</th>
          <td mat-cell *matCellDef="let conflict" class="import-table__difference">
            {{ difference(conflict.differences) }}
          </td>
        </ng-container>
        <ng-container matColumnDef="intervalDays">
          <th mat-header-cell *matHeaderCellDef>
            <span class="cell-end">دوره در فایل (روز)</span>
          </th>
          <td mat-cell *matCellDef="let conflict">
            <span class="cell-end">{{ conflict.intervalDays | persianNumber }}</span>
          </td>
        </ng-container>
        <ng-container matColumnDef="existingIntervalDays">
          <th mat-header-cell *matHeaderCellDef>
            <span class="cell-end">دوره فعلی (روز)</span>
          </th>
          <td mat-cell *matCellDef="let conflict">
            <span class="cell-end">{{ conflict.existingIntervalDays | persianNumber }}</span>
          </td>
        </ng-container>
        <ng-container matColumnDef="firstDueDate">
          <th mat-header-cell *matHeaderCellDef>
            <span class="cell-end">اولین موعد در فایل</span>
          </th>
          <td mat-cell *matCellDef="let conflict">
            <span class="cell-end">{{ jalaliDate(conflict.firstDueDate) }}</span>
          </td>
        </ng-container>
        <ng-container matColumnDef="existingFirstDueDate">
          <th mat-header-cell *matHeaderCellDef>
            <span class="cell-end">اولین موعد فعلی</span>
          </th>
          <td mat-cell *matCellDef="let conflict">
            <span class="cell-end">{{ jalaliDate(conflict.existingFirstDueDate) }}</span>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let conflict; columns: columns"></tr>
      </table>
    </div>
  `,
  styleUrl: './pm-plan-import-tables.scss',
})
export class PmPlanImportConflictsTable {
  readonly conflicts = input.required<readonly AppPmPlanImportConflict[]>();

  protected readonly columns = [
    'equipment',
    'activity',
    'difference',
    'intervalDays',
    'existingIntervalDays',
    'firstDueDate',
    'existingFirstDueDate',
  ];
  protected readonly jalaliDate = formatJalaliCalendarDate;
  protected readonly difference = differenceLabel;
}
