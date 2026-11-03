import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { provideJalaliDateAdapter } from '../../core/material/jalali-date-adapter';
import { endAlignedColumns } from '../../ui/testing/end-aligned-columns';
import { PmOverviewPage } from './pm-overview-page';

const occurrence = (overrides: Record<string, unknown>) => ({
  equipmentId: 'e1',
  equipmentName: 'اکسترودر 1',
  equipmentRetired: false,
  planItemId: 'p1',
  activityId: 'a1',
  activityName: 'تعویض روغن',
  dueDate: '2026-10-23',
  calendarDate: '2026-10-23',
  status: 'upcoming',
  performedAt: null,
  performedById: null,
  performedBy: null,
  daysLate: null,
  notes: null,
  ...overrides,
});

const OCCURRENCES = [
  occurrence({
    dueDate: '2026-09-23',
    calendarDate: '2026-09-23',
    status: 'on_time',
    performedAt: '2026-09-23T07:00:00.000Z',
    performedById: 'u1',
    performedBy: 'مسلمی',
  }),
  occurrence({
    dueDate: '2026-10-23',
    calendarDate: '2026-10-25',
    status: 'late',
    performedAt: '2026-10-25T07:00:00.000Z',
    performedById: 'u1',
    performedBy: 'مسلمی',
    daysLate: 2,
  }),
  occurrence({ dueDate: '2026-11-22', calendarDate: '2026-11-22', status: 'upcoming' }),
];

const FILTER_OPTIONS = {
  equipment: [
    { id: 'e1', name: 'اکسترودر 1', retired: false },
    { id: 'e2', name: 'اکسترودر 2', retired: true },
  ],
  activities: [{ id: 'a1', name: 'تعویض روغن' }],
  performers: [{ id: 'u1', name: 'مسلمی' }],
};

const OVERVIEW = '/api/pm-schedule/overview';
const CALENDAR = '/api/pm-schedule/calendar';

/** 1405/08/30 runs to 21 November; 1405/08/01 was 23 October. Today, 1 November, is 1405/08/10. */
const ABAN_1405 = { from: '2026-10-23', to: '2026-11-21' };

const tick = () => TestBed.inject(ApplicationRef).tick();

const paramsOf = (request: TestRequest): Record<string, string | null> =>
  Object.fromEntries(
    request.request.params.keys().map((key) => [key, request.request.params.get(key)]),
  );

const texts = (elements: Iterable<Element>): string[] =>
  Array.from(elements).map((element) => element.textContent?.replace(/\s+/g, ' ').trim() ?? '');

/** Answers the one pending read of `url` with no rows, returning the parameters it asked with. */
function answered(httpMock: HttpTestingController, url: string): Record<string, string | null> {
  const request = expectRead(httpMock, url);
  const params = paramsOf(request);
  request.flush([]);
  return params;
}

function setUp() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      provideJalaliDateAdapter(),
    ],
  });
  const fixture = TestBed.createComponent(PmOverviewPage);
  tick();
  const httpMock = TestBed.inject(HttpTestingController);
  httpMock.expectOne('/api/pm-schedule/filter-options').flush(FILTER_OPTIONS);
  return { fixture, httpMock, root: fixture.nativeElement as HTMLElement };
}

const expectRead = (httpMock: HttpTestingController, url: string) =>
  httpMock.expectOne((request) => request.method === 'GET' && request.url === url);

function viewToggle(root: HTMLElement, name: string): HTMLButtonElement {
  const toggle = Array.from(
    root.querySelectorAll<HTMLButtonElement>('mat-button-toggle button'),
  ).find((button) => button.textContent?.trim() === name);
  if (!toggle) {
    throw new Error(`no view toggle «${name}»`);
  }
  return toggle;
}

async function inTableView(occurrences: unknown[] = OCCURRENCES) {
  const context = setUp();
  expectRead(context.httpMock, CALENDAR).flush([]);
  await context.fixture.whenStable();
  viewToggle(context.root, 'جدول PM').click();
  tick();
  expectRead(context.httpMock, OVERVIEW).flush(occurrences);
  await context.fixture.whenStable();
  return context;
}

function select(root: HTMLElement, label: string): HTMLElement {
  const field = Array.from(root.querySelectorAll('mat-form-field')).find(
    (candidate) => candidate.querySelector('mat-label')?.textContent?.trim() === label,
  );
  const trigger = field?.querySelector<HTMLElement>('.mat-mdc-select-trigger');
  if (!trigger) {
    throw new Error(`no select «${label}»`);
  }
  return trigger;
}

async function openSelect(
  fixture: { whenStable(): Promise<unknown> },
  root: HTMLElement,
  label: string,
) {
  select(root, label).click();
  await fixture.whenStable();
  return Array.from(document.body.querySelectorAll<HTMLElement>('mat-option'));
}

function chooseOption(options: HTMLElement[], text: string): void {
  const option = options.find((candidate) => candidate.textContent?.trim() === text);
  if (!option) {
    throw new Error(`no option «${text}» among ${texts(options).join('، ')}`);
  }
  option.click();
}

/** Picks a day of the month a date field's calendar opens on, through its toggle. */
async function pickDay(
  fixture: { whenStable(): Promise<unknown> },
  root: HTMLElement,
  boundName: string,
  day: string,
) {
  root
    .querySelector<HTMLButtonElement>(`button[aria-label="باز کردن تقویم ${boundName}"]`)!
    .click();
  await fixture.whenStable();
  // The latest calendar: one that just closed may still be leaving the overlay.
  const calendars = document.body.querySelectorAll('mat-datepicker-content');
  const calendar = calendars[calendars.length - 1];
  const cell = Array.from(
    calendar?.querySelectorAll<HTMLElement>('.mat-calendar-body-cell') ?? [],
  ).find((candidate) => candidate.textContent?.trim() === day);
  if (!cell) {
    throw new Error(`no day «${day}» in the calendar of «${boundName}»`);
  }
  cell.click();
}

describe('PmOverviewPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 1, 10, 0));
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    vi.useRealTimers();
  });

  it('opens with «برنامه PM» as its heading', async () => {
    const { fixture, httpMock, root } = setUp();
    expectRead(httpMock, CALENDAR).flush([]);
    await fixture.whenStable();

    expect(root.querySelector('h1')?.textContent?.trim()).toBe('برنامه PM');
  });

  describe('the view switch', () => {
    it('offers the calendar and the table as one choice, the calendar first and chosen', async () => {
      const { fixture, httpMock, root } = setUp();
      expectRead(httpMock, CALENDAR).flush([]);
      await fixture.whenStable();

      const toggles = Array.from(root.querySelectorAll('mat-button-toggle button'));
      expect(texts(toggles)).toEqual(['تقویم PM', 'جدول PM']);
      expect(toggles.map((toggle) => toggle.getAttribute('role'))).toEqual(['radio', 'radio']);
      expect(toggles.map((toggle) => toggle.getAttribute('aria-checked'))).toEqual([
        'true',
        'false',
      ]);
      expect(root.querySelector('section[aria-label="تقویم PM"]')).not.toBeNull();
      expect(root.querySelector('table')).toBeNull();
    });

    // The API's today is Tehran's; a browser elsewhere must not open on the month before.
    it('opens both views on Tehran’s current month, not the browser’s', async () => {
      // 00:30 on 1405/08/01 in Tehran — still 1405/07/30 on a UTC browser's own clock.
      vi.setSystemTime(new Date('2026-10-22T21:00:00Z'));
      const { fixture, httpMock, root } = setUp();

      expect(answered(httpMock, CALENDAR)).toEqual(ABAN_1405);
      await fixture.whenStable();
      viewToggle(root, 'جدول PM').click();
      tick();
      expect(answered(httpMock, OVERVIEW)).toEqual(ABAN_1405);
    });

    it('reads the calendar for the whole of the current Jalali month', async () => {
      const { fixture, httpMock } = setUp();

      const request = expectRead(httpMock, CALENDAR);
      expect(paramsOf(request)).toEqual(ABAN_1405);
      request.flush([]);
      await fixture.whenStable();
    });

    it('reads the table for the current Jalali month by due date, and shows its range only there', async () => {
      const { fixture, httpMock, root } = setUp();
      expectRead(httpMock, CALENDAR).flush([]);
      await fixture.whenStable();
      expect(root.textContent).not.toContain('از تاریخ');

      viewToggle(root, 'جدول PM').click();
      tick();

      const request = expectRead(httpMock, OVERVIEW);
      expect(paramsOf(request)).toEqual(ABAN_1405);
      request.flush(OCCURRENCES);
      await fixture.whenStable();

      expect(root.querySelector('section[aria-label="تقویم PM"]')).toBeNull();
      expect(root.querySelector('table')).not.toBeNull();
      const labels = texts(root.querySelectorAll('mat-label'));
      expect(labels).toContain('از تاریخ');
      expect(labels).toContain('تا تاریخ');
    });
  });

  describe('the shared filters', () => {
    it('labels its five selects, each starting on «همه»', async () => {
      const { fixture, httpMock, root } = setUp();
      expectRead(httpMock, CALENDAR).flush([]);
      await fixture.whenStable();

      for (const label of ['تجهیز', 'فعالیت', 'وضعیت', 'انجام دهنده', 'تخصص']) {
        expect(select(root, label).textContent?.trim()).toBe('همه');
      }
    });

    it('marks retired equipment in its option', async () => {
      const { fixture, httpMock, root } = setUp();
      expectRead(httpMock, CALENDAR).flush([]);
      await fixture.whenStable();

      const options = await openSelect(fixture, root, 'تجهیز');

      expect(texts(options)).toEqual(['همه', 'اکسترودر 1', 'اکسترودر 2 (کنار گذاشته شده)']);
    });

    it('offers the six statuses in the page’s words', async () => {
      const { fixture, httpMock, root } = setUp();
      expectRead(httpMock, CALENDAR).flush([]);
      await fixture.whenStable();

      const options = await openSelect(fixture, root, 'وضعیت');

      expect(texts(options)).toEqual([
        'همه',
        'بموقع',
        'با تاخیر',
        'انجام نشده',
        'عقب افتاده',
        'سررسیده',
        'آینده',
      ]);
    });

    it('asks the API again with the chosen filter, under a progress bar from the same render', async () => {
      const { fixture, httpMock, root } = setUp();
      expectRead(httpMock, CALENDAR).flush([]);
      await fixture.whenStable();

      chooseOption(await openSelect(fixture, root, 'انجام دهنده'), 'مسلمی');
      tick();

      expect(root.querySelector('[role="progressbar"]')).not.toBeNull();
      const request = expectRead(httpMock, CALENDAR);
      expect(paramsOf(request)).toEqual({ ...ABAN_1405, performedById: 'u1' });
      request.flush([]);
      await fixture.whenStable();

      expect(root.querySelector('[role="progressbar"]')).toBeNull();
    });

    it('puts «تخصص» beside «انجام دهنده», offering «همه», «برق» and «مکانیک»', async () => {
      const { fixture, httpMock, root } = setUp();
      expectRead(httpMock, CALENDAR).flush([]);
      await fixture.whenStable();

      const labels = texts(root.querySelectorAll('.pm-filters mat-label'));
      expect(labels.indexOf('تخصص')).toBe(labels.indexOf('انجام دهنده') + 1);
      expect(texts(await openSelect(fixture, root, 'تخصص'))).toEqual(['همه', 'برق', 'مکانیک']);
    });

    it('narrows the calendar by specialty, ANDed with the other filters, under a progress bar', async () => {
      const { fixture, httpMock, root } = setUp();
      expectRead(httpMock, CALENDAR).flush([]);
      await fixture.whenStable();
      chooseOption(await openSelect(fixture, root, 'انجام دهنده'), 'مسلمی');
      tick();
      expectRead(httpMock, CALENDAR).flush([]);
      await fixture.whenStable();

      chooseOption(await openSelect(fixture, root, 'تخصص'), 'برق');
      tick();

      expect(root.querySelector('[role="progressbar"]')).not.toBeNull();
      const request = expectRead(httpMock, CALENDAR);
      expect(paramsOf(request)).toEqual({
        ...ABAN_1405,
        performedById: 'u1',
        specialty: 'electrical',
      });
      request.flush([]);
      await fixture.whenStable();
      expect(root.querySelector('[role="progressbar"]')).toBeNull();
    });

    it('keeps the specialty when the view changes', async () => {
      const { fixture, httpMock, root } = setUp();
      expectRead(httpMock, CALENDAR).flush([]);
      await fixture.whenStable();
      chooseOption(await openSelect(fixture, root, 'تخصص'), 'مکانیک');
      tick();
      expectRead(httpMock, CALENDAR).flush([]);
      await fixture.whenStable();

      viewToggle(root, 'جدول PM').click();
      tick();

      expect(answered(httpMock, OVERVIEW)).toEqual({ ...ABAN_1405, specialty: 'mechanical' });
    });

    it('keeps the filters when the view changes', async () => {
      const { fixture, httpMock, root } = setUp();
      expectRead(httpMock, CALENDAR).flush([]);
      await fixture.whenStable();
      chooseOption(await openSelect(fixture, root, 'وضعیت'), 'با تاخیر');
      tick();
      expectRead(httpMock, CALENDAR).flush([]);
      await fixture.whenStable();

      viewToggle(root, 'جدول PM').click();
      tick();

      expect(answered(httpMock, OVERVIEW)).toEqual({ ...ABAN_1405, status: 'late' });
    });

    it('puts every filter back on «همه» with «پاک کردن فیلترها»', async () => {
      const { fixture, httpMock, root } = setUp();
      expectRead(httpMock, CALENDAR).flush([]);
      await fixture.whenStable();
      chooseOption(await openSelect(fixture, root, 'فعالیت'), 'تعویض روغن');
      tick();
      expectRead(httpMock, CALENDAR).flush([]);
      await fixture.whenStable();
      chooseOption(await openSelect(fixture, root, 'تخصص'), 'برق');
      tick();
      expectRead(httpMock, CALENDAR).flush([]);
      await fixture.whenStable();

      Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent?.trim() === 'پاک کردن فیلترها')!
        .click();
      tick();

      const request = expectRead(httpMock, CALENDAR);
      expect(paramsOf(request)).toEqual(ABAN_1405);
      request.flush([]);
      await fixture.whenStable();
      expect(select(root, 'فعالیت').textContent?.trim()).toBe('همه');
      expect(select(root, 'تخصص').textContent?.trim()).toBe('همه');
    });
  });

  describe('the table', () => {
    it('heads the table with the seven columns the overview is read by', async () => {
      const { root } = await inTableView();

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
      const { root } = await inTableView();

      expect(endAlignedColumns(root.querySelector('table')!)).toEqual({
        headers: [false, false, true, false, true, false, true],
        cells: [false, false, true, false, true, false, true],
      });
    });

    it('shows a performed occurrence with who did it and when, in Jalali', async () => {
      const { root } = await inTableView();
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
      const { root } = await inTableView();
      const cells = texts(root.querySelectorAll('tbody tr.mat-mdc-row')[1].querySelectorAll('td'));

      expect(cells[3]).toBe('با تاخیر');
      expect(cells[4]).toBe('۲ روز');
    });

    it('shows a dash for who and when, and a hyphen for the delay, while an occurrence is not performed', async () => {
      const { root } = await inTableView();
      const cells = texts(root.querySelectorAll('tbody tr.mat-mdc-row')[2].querySelectorAll('td'));

      expect(cells).toEqual(['اکسترودر 1', 'تعویض روغن', '۱۴۰۵/۰۹/۰۱', 'آینده', '-', '—', '—']);
    });

    it('draws every row the API sends, unpaginated, in its order', async () => {
      const many = Array.from({ length: 40 }, (_, index) =>
        occurrence({ planItemId: `p${index}`, activityName: `فعالیت ${index}` }),
      );
      const { root } = await inTableView(many);

      expect(root.querySelectorAll('tbody tr.mat-mdc-row')).toHaveLength(40);
      expect(root.querySelector('mat-paginator')).toBeNull();
      expect(
        texts(root.querySelectorAll('tbody tr.mat-mdc-row td:nth-child(2)')).slice(0, 2),
      ).toEqual(['فعالیت 0', 'فعالیت 1']);
    });

    it('still draws the table when the range holds nothing, with the reason under it', async () => {
      const { root } = await inTableView([]);

      expect(root.querySelectorAll('thead th')).toHaveLength(7);
      expect(root.querySelectorAll('tbody tr.mat-mdc-row')).toHaveLength(0);
      expect(root.textContent).toContain('هیچ موعدی در این بازه یافت نشد.');
    });

    it('reloads as soon as a bound changes, with no apply button', async () => {
      const { fixture, httpMock, root } = await inTableView();

      await pickDay(fixture, root, 'از تاریخ', '۱۰');
      tick();

      expect(root.querySelector('[role="progressbar"]')).not.toBeNull();
      expect(answered(httpMock, OVERVIEW)).toEqual({
        from: '2026-11-01',
        to: ABAN_1405.to,
      });
      expect(texts(root.querySelectorAll('button'))).not.toContain('اعمال بازه');
    });

    it('refuses a start after the end, inline and without asking', async () => {
      const { fixture, httpMock, root } = await inTableView();
      await pickDay(fixture, root, 'از تاریخ', '۲۰');
      tick();
      expectRead(httpMock, OVERVIEW).flush(OCCURRENCES);
      await fixture.whenStable();

      await pickDay(fixture, root, 'تا تاریخ', '۵');
      await fixture.whenStable();

      httpMock.expectNone((request) => request.url === OVERVIEW);
      expect(root.querySelector('mat-error')?.textContent?.trim()).toBe(
        'پایان بازه نباید پیش از آغاز آن باشد.',
      );
      expect(root.querySelector('table')).toBeNull();
      expect(root.textContent).toContain('برای دیدن موعدها، بازهٔ درستی انتخاب کنید.');
    });

    it('puts the range back on the current month with «ماه جاری»', async () => {
      const { fixture, httpMock, root } = await inTableView();
      await pickDay(fixture, root, 'از تاریخ', '۲۰');
      tick();
      expectRead(httpMock, OVERVIEW).flush(OCCURRENCES);
      await fixture.whenStable();

      Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent?.trim() === 'ماه جاری')!
        .click();
      tick();

      expect(answered(httpMock, OVERVIEW)).toEqual(ABAN_1405);
    });

    // A page left open across the turn of a month: «ماه جاری» means the month it is now, in Tehran.
    it('takes «ماه جاری» from Tehran’s clock when pressed', async () => {
      const { httpMock, root } = await inTableView();
      // 00:30 on 1405/09/01 in Tehran; still 21 November (Aban) on a UTC clock.
      vi.setSystemTime(new Date('2026-11-21T21:00:00Z'));

      Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent?.trim() === 'ماه جاری')!
        .click();
      tick();

      expect(answered(httpMock, OVERVIEW)).toEqual({ from: '2026-11-22', to: '2026-12-21' });
    });

    it('keeps its range when the view changes and back', async () => {
      const { fixture, httpMock, root } = await inTableView();
      await pickDay(fixture, root, 'از تاریخ', '۲۰');
      tick();
      expectRead(httpMock, OVERVIEW).flush(OCCURRENCES);
      await fixture.whenStable();

      viewToggle(root, 'تقویم PM').click();
      tick();
      // The calendar keeps its own month: the table's range does not move it.
      expect(answered(httpMock, CALENDAR)).toEqual(ABAN_1405);
      await fixture.whenStable();
      viewToggle(root, 'جدول PM').click();
      tick();

      expect(answered(httpMock, OVERVIEW)).toEqual({
        from: '2026-11-11',
        to: ABAN_1405.to,
      });
    });

    it('offers a retry when the schedule fails to load', async () => {
      const { fixture, httpMock, root } = setUp();
      expectRead(httpMock, CALENDAR).flush([]);
      await fixture.whenStable();
      viewToggle(root, 'جدول PM').click();
      tick();

      expectRead(httpMock, OVERVIEW).flush(
        { title: 'Boom' },
        { status: 500, statusText: 'Server Error' },
      );
      await fixture.whenStable();

      expect(root.textContent).toContain('برنامه PM بارگذاری نشد.');
    });

    it('says access is denied when the API refuses the schedule', async () => {
      const { fixture, httpMock, root } = setUp();
      expectRead(httpMock, CALENDAR).flush(
        { title: 'Forbidden' },
        { status: 403, statusText: 'Forbidden' },
      );
      await fixture.whenStable();

      expect(root.textContent).toContain('شما دسترسی لازم برای مشاهده این بخش را ندارید.');
    });
  });

  describe('the calendar', () => {
    it('moves to another month and reads it, independently of the table', async () => {
      const { fixture, httpMock, root } = setUp();
      expectRead(httpMock, CALENDAR).flush([]);
      await fixture.whenStable();

      Array.from(root.querySelectorAll<HTMLButtonElement>('section[aria-label="تقویم PM"] button'))
        .find((button) => button.textContent?.trim() === 'ماه بعد')!
        .click();
      tick();

      expect(root.querySelector('[role="progressbar"]')).not.toBeNull();
      // آذر ۱۴۰۵: 22 November to 21 December.
      expect(answered(httpMock, CALENDAR)).toEqual({
        from: '2026-11-22',
        to: '2026-12-21',
      });
    });

    it('places each occurrence on its calendar day', async () => {
      const { fixture, httpMock, root } = setUp();
      expectRead(httpMock, CALENDAR).flush([OCCURRENCES[1]]);
      await fixture.whenStable();

      const day = root.querySelector('[role="group"][aria-label="۱۴۰۵/۰۸/۰۳"]');
      expect(texts(day!.querySelectorAll('button'))).toEqual(['اکسترودر 1 · تعویض روغن با تاخیر']);
    });
  });
});
