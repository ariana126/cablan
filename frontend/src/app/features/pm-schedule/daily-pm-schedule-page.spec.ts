import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppDailyPmTask } from '../../core/maintenance/pm-schedule-gateway';
import { endAlignedColumns } from '../../ui/testing/end-aligned-columns';
import { DailyPmSchedulePage } from './daily-pm-schedule-page';
import { RecordExecutionDialog } from './record-execution-dialog';

const TASKS: AppDailyPmTask[] = [
  {
    equipmentId: 'e1',
    equipmentName: 'اکسترودر 1',
    planItemId: 'p1',
    activityId: 'a1',
    activityName: 'تعویض روغن',
    activitySpecialty: 'mechanical',
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
    activitySpecialty: 'mechanical',
    dueDate: '2026-10-02',
    status: 'overdue',
    daysOverdue: 5,
  },
];

/** Two pieces of equipment, every group: the API's order is equipment name, then plan order. */
const GROUPED: AppDailyPmTask[] = [
  { ...TASKS[0], planItemId: 'p1', activityName: 'تعویض روغن', activitySpecialty: 'mechanical' },
  { ...TASKS[0], planItemId: 'p2', activityName: 'بررسی تابلو', activitySpecialty: 'electrical' },
  { ...TASKS[0], planItemId: 'p3', activityName: 'روانکاری', activitySpecialty: null },
  { ...TASKS[0], planItemId: 'p4', activityName: 'گریسکاری', activitySpecialty: 'mechanical' },
  {
    ...TASKS[0],
    equipmentId: 'e2',
    equipmentName: 'کشش 2',
    planItemId: 'p5',
    activityName: 'تعویض تسمه',
    activitySpecialty: 'mechanical',
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

  /** A region inside `root`, found by the heading that names it. */
  const region = (root: Element, heading: string): Element | undefined =>
    Array.from(root.querySelectorAll('section[aria-labelledby]')).find(
      (section) =>
        texts([root.querySelector(`#${section.getAttribute('aria-labelledby')}`)!])[0] === heading,
    );

  it('gives each piece of equipment a section headed by its name, in the API’s order', async () => {
    const { root } = await loaded(GROUPED);

    expect(texts(root.querySelectorAll('h3'))).toEqual(['اکسترودر 1', 'کشش 2']);
    expect(region(root, 'اکسترودر 1')).toBeDefined();
    expect(region(root, 'کشش 2')).toBeDefined();
  });

  it('groups an equipment’s tasks into «برق», «مکانیک» and «تخصص تعیین نشده», each its own table, keeping the API’s order', async () => {
    const { root } = await loaded(GROUPED);
    const extruder = region(root, 'اکسترودر 1')!;

    expect(texts(extruder.querySelectorAll('h4'))).toEqual(['برق', 'مکانیک', 'تخصص تعیین نشده']);
    const activities = (specialty: string) =>
      texts(region(extruder, specialty)!.querySelectorAll('tbody td.mat-column-activity'));
    expect(activities('برق')).toEqual(['بررسی تابلو']);
    expect(activities('مکانیک')).toEqual(['تعویض روغن', 'گریسکاری']);
    expect(activities('تخصص تعیین نشده')).toEqual(['روانکاری']);
    expect(extruder.querySelectorAll('table')).toHaveLength(3);
    expect(texts(region(root, 'کشش 2')!.querySelectorAll('h4'))).toEqual(['مکانیک']);
  });

  it('keeps every column, the equipment included, in every group’s table', async () => {
    const { root } = await loaded(GROUPED);

    for (const table of Array.from(root.querySelectorAll('table'))) {
      expect(texts(table.querySelectorAll('thead th')).slice(0, 5)).toEqual([
        'تجهیز',
        'فعالیت',
        'موعد',
        'وضعیت',
        'روزهای تاخیر',
      ]);
    }
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

  // The message, with no progress bar, is what tells "nothing is due" from "not loaded yet".
  it('says so in a paragraph when nothing is due, with no table', async () => {
    const { root } = await loaded([]);

    expect(root.querySelector('table')).toBeNull();
    expect(root.querySelector('[role="progressbar"]')).toBeNull();
    expect(texts(root.querySelectorAll('p'))).toContain('امروز کار سررسیده یا عقب افتاده‌ای نیست.');
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
