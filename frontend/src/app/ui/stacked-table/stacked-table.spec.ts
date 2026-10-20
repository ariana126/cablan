import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
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
import { describe, expect, it } from 'vitest';

import { StackedTable } from './stacked-table';

interface Row {
  name: string;
  weight: string;
}

@Component({
  imports: [
    StackedTable,
    MatTable,
    MatColumnDef,
    MatHeaderCell,
    MatHeaderCellDef,
    MatCell,
    MatCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatRow,
    MatRowDef,
  ],
  template: `
    <div appStackedTable>
      <table mat-table [dataSource]="rows()">
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>{{ nameHeader() }}</th>
          <td mat-cell *matCellDef="let row">{{ row.name }}</td>
        </ng-container>
        <ng-container matColumnDef="weight">
          <th mat-header-cell *matHeaderCellDef>
            <span class="cell-end">وزن (کیلوگرم)</span>
          </th>
          <td mat-cell *matCellDef="let row">{{ row.weight }}</td>
        </ng-container>
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef>
            <span class="visually-hidden">عملیات</span>
          </th>
          <td mat-cell *matCellDef="let row">
            <button type="button">ویرایش {{ row.name }}</button>
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns"></tr>
      </table>
    </div>
  `,
})
class Host {
  readonly columns = ['name', 'weight', 'actions'];
  readonly nameHeader = signal('نام');
  readonly rows = signal<Row[]>([{ name: 'مس', weight: '۱٫۲' }]);
}

async function render() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  return { fixture, root: fixture.nativeElement as HTMLElement };
}

/** MutationObserver callbacks run as a microtask after the DOM change that queued them. */
const flushObservers = () => new Promise<void>((resolve) => setTimeout(resolve));

function labelsOf(root: HTMLElement): (string | null)[][] {
  return Array.from(root.querySelectorAll('tbody tr')).map((row) =>
    Array.from(row.querySelectorAll('td')).map((cell) => cell.getAttribute('data-label')),
  );
}

describe('StackedTable', () => {
  it('marks its host as a stacked table, which is what the narrow-width layout keys on', async () => {
    const { root } = await render();

    expect(root.querySelector('[appStackedTable]')?.classList).toContain('stacked-table');
  });

  it("labels every cell with its column's header text", async () => {
    const { root } = await render();
    await flushObservers();

    expect(labelsOf(root)).toEqual([['نام', 'وزن (کیلوگرم)', null]]);
  });

  it('gives no label to a column whose header is for a screen reader only', async () => {
    const { root } = await render();
    await flushObservers();

    const actionsCell = root.querySelector('tbody tr td:last-child');
    expect(actionsCell?.hasAttribute('data-label')).toBe(false);
  });

  it('labels the rows that arrive after the table first rendered', async () => {
    const { fixture, root } = await render();

    fixture.componentInstance.rows.set([
      { name: 'مس', weight: '۱٫۲' },
      { name: 'آلومینیوم', weight: '۰٫۸' },
    ]);
    await fixture.whenStable();
    await flushObservers();

    expect(labelsOf(root)).toEqual([
      ['نام', 'وزن (کیلوگرم)', null],
      ['نام', 'وزن (کیلوگرم)', null],
    ]);
  });

  it('follows a header whose text changes', async () => {
    const { fixture, root } = await render();

    fixture.componentInstance.nameHeader.set('نام جز');
    await fixture.whenStable();
    await flushObservers();

    expect(labelsOf(root)[0][0]).toBe('نام جز');
  });

  it('leaves the table, its rows and its cells in the accessibility tree as a table', async () => {
    const { root } = await render();
    await flushObservers();

    expect(root.querySelector('table')?.getAttribute('role')).toBe('table');
    expect(root.querySelector('tbody tr')?.getAttribute('role')).toBe('row');
    expect(root.querySelector('thead th')?.getAttribute('role')).toBe('columnheader');
    expect(root.querySelector('tbody td')?.getAttribute('role')).toBe('cell');
  });
});
