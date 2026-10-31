import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';

import { endAlignedColumns } from '../../ui/testing/end-aligned-columns';
import { PmOverviewPage } from './pm-overview-page';

const OCCURRENCES = [
  {
    equipmentId: 'e1',
    equipmentName: 'اکسترودر 1',
    planItemId: 'p1',
    activityName: 'تعویض روغن',
    dueDate: '2026-09-23',
    status: 'on_time',
    performedAt: '2026-09-23T07:00:00.000Z',
    performedBy: 'مسلمی',
    daysLate: null,
  },
  {
    equipmentId: 'e1',
    equipmentName: 'اکسترودر 1',
    planItemId: 'p1',
    activityName: 'تعویض روغن',
    dueDate: '2026-10-23',
    status: 'late',
    performedAt: '2026-10-25T07:00:00.000Z',
    performedBy: 'مسلمی',
    daysLate: 2,
  },
  {
    equipmentId: 'e1',
    equipmentName: 'اکسترودر 1',
    planItemId: 'p1',
    activityName: 'تعویض روغن',
    dueDate: '2026-11-22',
    status: 'upcoming',
    performedAt: null,
    performedBy: null,
    daysLate: null,
  },
];

const URL = '/api/pm-schedule/overview';

function setUp() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  const fixture = TestBed.createComponent(PmOverviewPage);
  TestBed.inject(ApplicationRef).tick();
  return {
    fixture,
    httpMock: TestBed.inject(HttpTestingController),
    root: fixture.nativeElement as HTMLElement,
  };
}

async function loaded(occurrences: unknown[] = OCCURRENCES) {
  const context = setUp();
  context.httpMock.expectOne({ method: 'GET', url: URL }).flush(occurrences);
  await context.fixture.whenStable();
  return context;
}

const texts = (elements: Iterable<Element>): string[] =>
  Array.from(elements).map((element) => element.textContent?.replace(/\s+/g, ' ').trim() ?? '');

describe('PmOverviewPage', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('opens with «گزارش PM» as its heading', async () => {
    const { root } = await loaded();

    expect(root.querySelector('h1')?.textContent?.trim()).toBe('گزارش PM');
  });

  it('shows a progress bar until the occurrences arrive, and none after', async () => {
    const { fixture, httpMock, root } = setUp();

    expect(root.querySelector('[role="progressbar"]')?.getAttribute('aria-label')).toBe(
      'در حال بارگذاری گزارش PM',
    );

    httpMock.expectOne({ method: 'GET', url: URL }).flush(OCCURRENCES);
    await fixture.whenStable();

    expect(root.querySelector('[role="progressbar"]')).toBeNull();
  });

  it('heads the table with the seven columns the overview is read by', async () => {
    const { root } = await loaded();

    expect(texts(root.querySelectorAll('thead th'))).toEqual([
      'تجهیز',
      'فعالیت',
      'موعد',
      'وضعیت',
      'مقدار تاخیر',
      'انجام دهنده',
      'زمان انجام',
    ]);
  });

  // A date pushed to the end edge under a header left on the start edge reads as the next column's.
  it('lines every value up under its own column header', async () => {
    const { root } = await loaded();

    expect(endAlignedColumns(root.querySelector('table')!)).toEqual({
      headers: [false, false, true, false, true, false, true],
      cells: [false, false, true, false, true, false, true],
    });
  });

  it('shows a performed occurrence with who did it and when, in Jalali', async () => {
    const { root } = await loaded();
    const cells = texts(root.querySelectorAll('tbody tr.mat-mdc-row')[0].querySelectorAll('td'));

    expect(cells.slice(0, 6)).toEqual([
      'اکسترودر 1',
      'تعویض روغن',
      '۱۴۰۵/۰۷/۰۱',
      'بموقع',
      '-',
      'مسلمی',
    ]);
    expect(cells[6]).toMatch(/^۱۴۰۵\/۰۷\/۰۱ [۰-۹]{2}:[۰-۹]{2}$/);
  });

  it('shows how many days late a late occurrence was done', async () => {
    const { root } = await loaded();
    const cells = texts(root.querySelectorAll('tbody tr.mat-mdc-row')[1].querySelectorAll('td'));

    expect(cells[3]).toBe('با تاخیر');
    expect(cells[4]).toBe('۲ روز');
  });

  it('shows a dash for who and when, and a hyphen for the delay, while an occurrence is not performed', async () => {
    const { root } = await loaded();
    const cells = texts(root.querySelectorAll('tbody tr.mat-mdc-row')[2].querySelectorAll('td'));

    expect(cells).toEqual(['اکسترودر 1', 'تعویض روغن', '۱۴۰۵/۰۹/۰۱', 'آینده', '-', '—', '—']);
  });

  it('still draws the table when there is no plan yet, with no occurrence rows', async () => {
    const { root } = await loaded([]);

    expect(root.querySelectorAll('thead th')).toHaveLength(7);
    expect(root.querySelectorAll('tbody tr.mat-mdc-row')).toHaveLength(0);
    expect(root.textContent).toContain('هنوز هیچ موعدی در برنامهٔ تجهیزات نیست.');
  });

  it('offers a retry when the overview fails to load', async () => {
    const { fixture, httpMock, root } = setUp();

    httpMock
      .expectOne({ method: 'GET', url: URL })
      .flush({ title: 'Boom' }, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(root.textContent).toContain('گزارش PM بارگذاری نشد.');
  });

  it('says access is denied when the API refuses the overview', async () => {
    const { fixture, httpMock, root } = setUp();

    httpMock
      .expectOne({ method: 'GET', url: URL })
      .flush({ title: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();

    expect(root.textContent).toContain('شما دسترسی لازم برای مشاهده این بخش را ندارید.');
  });
});
