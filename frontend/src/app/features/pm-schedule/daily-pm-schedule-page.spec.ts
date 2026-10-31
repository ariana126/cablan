import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { endAlignedColumns } from '../../ui/testing/end-aligned-columns';
import { DailyPmSchedulePage } from './daily-pm-schedule-page';
import { RecordExecutionDialog } from './record-execution-dialog';

const TASKS = [
  {
    equipmentId: 'e1',
    equipmentName: 'اکسترودر 1',
    planItemId: 'p1',
    activityId: 'a1',
    activityName: 'تعویض روغن',
    dueDate: '2026-10-07',
    status: 'due',
    daysOverdue: 0,
  },
  {
    equipmentId: 'e1',
    equipmentName: 'اکسترودر 1',
    planItemId: 'p2',
    activityId: 'a2',
    activityName: 'بررسی تابلو برق',
    dueDate: '2026-10-02',
    status: 'overdue',
    daysOverdue: 5,
  },
];

const URL = '/api/pm-schedule/daily';

function setUp() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  const fixture = TestBed.createComponent(DailyPmSchedulePage);
  TestBed.inject(ApplicationRef).tick();
  return {
    fixture,
    httpMock: TestBed.inject(HttpTestingController),
    root: fixture.nativeElement as HTMLElement,
  };
}

async function loaded(tasks: unknown[] = TASKS) {
  const context = setUp();
  context.httpMock.expectOne({ method: 'GET', url: URL }).flush(tasks);
  await context.fixture.whenStable();
  return context;
}

const texts = (elements: Iterable<Element>): string[] =>
  Array.from(elements).map((element) => element.textContent?.replace(/\s+/g, ' ').trim() ?? '');

describe('DailyPmSchedulePage', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('opens with «برنامه روزانه PM» as its heading', async () => {
    const { root } = await loaded();

    expect(root.querySelector('h1')?.textContent?.trim()).toBe('برنامه روزانه PM');
  });

  // Without a loading signal an empty list could not be told from one still on its way.
  it('shows a progress bar until the list arrives, and none after', async () => {
    const { fixture, httpMock, root } = setUp();

    expect(root.querySelector('[role="progressbar"]')).not.toBeNull();

    httpMock.expectOne({ method: 'GET', url: URL }).flush(TASKS);
    await fixture.whenStable();

    expect(root.querySelector('[role="progressbar"]')).toBeNull();
  });

  it('heads the table with the equipment, activity, due date, status and days overdue', async () => {
    const { root } = await loaded();

    expect(texts(root.querySelectorAll('thead th')).slice(0, 5)).toEqual([
      'تجهیز',
      'فعالیت',
      'موعد',
      'وضعیت',
      'روزهای تاخیر',
    ]);
  });

  // A value pushed to the end edge under a header left on the start edge reads as the next column's.
  it('lines every value up under its own column header', async () => {
    const { root } = await loaded();

    expect(endAlignedColumns(root.querySelector('table')!)).toEqual({
      headers: [false, false, true, false, true, false],
      cells: [false, false, true, false, true, false],
    });
  });

  it('shows each task with its Jalali due date, status and days overdue in Persian digits', async () => {
    const { root } = await loaded();
    const rows = root.querySelectorAll('tbody tr.mat-mdc-row');

    expect(texts(rows[0].querySelectorAll('td')).slice(0, 5)).toEqual([
      'اکسترودر 1',
      'تعویض روغن',
      '۱۴۰۵/۰۷/۱۵',
      'سررسیده',
      '۰',
    ]);
    expect(texts(rows[1].querySelectorAll('td')).slice(0, 5)).toEqual([
      'اکسترودر 1',
      'بررسی تابلو برق',
      '۱۴۰۵/۰۷/۱۰',
      'عقب افتاده',
      '۵',
    ]);
  });

  it('still draws the table when nothing is due, with no task rows', async () => {
    const { root } = await loaded([]);

    expect(root.querySelectorAll('thead th').length).toBeGreaterThan(0);
    expect(root.querySelectorAll('tbody tr.mat-mdc-row')).toHaveLength(0);
    expect(root.textContent).toContain('امروز کار سررسیده یا عقب افتاده‌ای نیست.');
  });

  it('opens the record dialog from the row’s «ثبت انجام», then re-reads the list', async () => {
    const { fixture, httpMock, root } = await loaded();
    const open = vi
      .spyOn(TestBed.inject(MatDialog), 'open')
      .mockReturnValue({ afterClosed: () => of(true) } as MatDialogRef<unknown, boolean>);

    const button = root.querySelector<HTMLButtonElement>(
      '[aria-label="ثبت انجام تعویض روغن اکسترودر 1"]',
    );
    expect(button?.textContent?.trim()).toBe('ثبت انجام');
    button?.click();
    TestBed.inject(ApplicationRef).tick();

    expect(open).toHaveBeenCalledWith(RecordExecutionDialog, { data: { task: TASKS[0] } });
    httpMock.expectOne({ method: 'GET', url: URL }).flush([TASKS[1]]);
    await fixture.whenStable();

    expect(root.querySelectorAll('tbody tr.mat-mdc-row')).toHaveLength(1);
  });

  it('says access is denied when the API refuses the list', async () => {
    const { fixture, httpMock, root } = setUp();

    httpMock
      .expectOne({ method: 'GET', url: URL })
      .flush({ title: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();

    expect(root.textContent).toContain('شما دسترسی لازم برای مشاهده این بخش را ندارید.');
  });
});
