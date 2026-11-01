import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FileSaver } from '../../core/files/file-saver';
import { PmOccurrenceDetailsDialog } from '../pm-schedule/pm-occurrence-details-dialog';
import { RecordExecutionDialog } from '../pm-schedule/record-execution-dialog';
import { PmDashboardPage } from './pm-dashboard-page';

const DASHBOARD_URL = '/api/pm-dashboard';
const EQUIPMENT_URL = '/api/equipment';

const EQUIPMENT = [
  { id: 'e1', name: 'اکسترودر 1', retired: false, activePlanItemCount: 2 },
  { id: 'e2', name: 'اکسترودر 2', retired: false, activePlanItemCount: 1 },
  { id: 'e3', name: 'اکسترودر 3', retired: true, activePlanItemCount: 0 },
];

const occurrence = (overrides: Record<string, unknown>) => ({
  equipmentId: 'e1',
  equipmentName: 'اکسترودر 1',
  equipmentRetired: false,
  planItemId: 'p1',
  activityId: 'a1',
  activityName: 'تعویض روغن',
  dueDate: '2026-10-02',
  status: 'upcoming',
  daysOverdue: 0,
  daysLate: null,
  missedOn: null,
  performedAt: null,
  performedByName: null,
  notes: null,
  doneToday: false,
  recordable: false,
  ...overrides,
});

const DASHBOARD = {
  today: '2026-10-02',
  generatedAt: '2026-10-02T06:30:00.000Z',
  periodDays: 30,
  periodFrom: '2026-09-03',
  periodTo: '2026-10-02',
  current: { dueToday: 1, overdue: 2, doneToday: 1 },
  missedCount: 3,
  performance: {
    considered: 10,
    onTime: 7,
    late: 2,
    notDone: 1,
    adherencePercent: 70,
    completionPercent: 90,
    averageDaysLate: 3,
  },
  trend: {
    daily: [
      {
        from: '2026-10-01',
        to: '2026-10-01',
        considered: 2,
        onTime: 1,
        late: 1,
        adherencePercent: 50,
        completionPercent: 100,
      },
    ],
    weekly: [
      {
        from: '2026-09-18',
        to: '2026-09-24',
        considered: 4,
        onTime: 3,
        late: 0,
        adherencePercent: 75,
        completionPercent: 75,
      },
      {
        from: '2026-09-25',
        to: '2026-10-01',
        considered: 6,
        onTime: 4,
        late: 2,
        adherencePercent: 67,
        completionPercent: 100,
      },
    ],
  },
  coverage: {
    activeEquipment: 2,
    withPlan: 1,
    withoutPlan: 1,
    coveragePercent: 50,
    equipmentWithoutPlan: [{ id: 'e2', name: 'اکسترودر 2' }],
  },
  mostOverdueEquipment: [
    { equipmentId: 'e1', equipmentName: 'اکسترودر 1', overdueCount: 2, totalDaysOverdue: 8 },
  ],
  upcoming: [
    {
      equipmentId: 'e1',
      equipmentName: 'اکسترودر 1',
      planItemId: 'p3',
      activityName: 'روانکاری',
      dueDate: '2026-10-03',
    },
  ],
  occurrences: [
    occurrence({ planItemId: 'p1', status: 'due', recordable: true }),
    occurrence({
      planItemId: 'p2',
      activityName: 'بررسی تابلو برق',
      dueDate: '2026-09-27',
      status: 'overdue',
      daysOverdue: 5,
      recordable: true,
    }),
    occurrence({
      planItemId: 'p4',
      equipmentId: 'e2',
      equipmentName: 'اکسترودر 2',
      activityName: 'تمیزکاری',
      dueDate: '2026-09-26',
      status: 'late',
      daysLate: 6,
      performedAt: '2026-10-02T05:00:00.000Z',
      performedByName: 'رضازاده',
      doneToday: true,
    }),
    occurrence({
      planItemId: 'p5',
      dueDate: '2026-09-20',
      status: 'missed',
      missedOn: '2026-09-27',
    }),
  ],
};

const EMPTY_DASHBOARD = {
  ...DASHBOARD,
  current: { dueToday: 0, overdue: 0, doneToday: 0 },
  missedCount: 0,
  performance: {
    considered: 0,
    onTime: 0,
    late: 0,
    notDone: 0,
    adherencePercent: null,
    completionPercent: null,
    averageDaysLate: null,
  },
  trend: { daily: [], weekly: [] },
  coverage: {
    activeEquipment: 0,
    withPlan: 0,
    withoutPlan: 0,
    coveragePercent: null,
    equipmentWithoutPlan: [],
  },
  mostOverdueEquipment: [],
  upcoming: [],
  occurrences: [],
};

const tick = () => TestBed.inject(ApplicationRef).tick();

function setUp() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  const fixture = TestBed.createComponent(PmDashboardPage);
  tick();
  const httpMock = TestBed.inject(HttpTestingController);
  httpMock.expectOne({ method: 'GET', url: EQUIPMENT_URL }).flush(EQUIPMENT);
  return { fixture, httpMock, root: fixture.nativeElement as HTMLElement };
}

const expectDashboardRead = (httpMock: HttpTestingController): TestRequest =>
  httpMock.expectOne((request) => request.method === 'GET' && request.url === DASHBOARD_URL);

const paramsOf = (request: TestRequest): Record<string, string> =>
  Object.fromEntries(
    request.request.params.keys().map((key) => [key, request.request.params.get(key) ?? '']),
  );

async function loaded(dashboard: object = DASHBOARD) {
  const context = setUp();
  expectDashboardRead(context.httpMock).flush(dashboard);
  await context.fixture.whenStable();
  return context;
}

const text = (element: Element | null | undefined): string =>
  element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const texts = (elements: Iterable<Element>): string[] => Array.from(elements).map(text);

/** A `<section>` named by its heading, as a screen reader and the acceptance suite find it. */
function region(root: HTMLElement, name: string): HTMLElement {
  const found = Array.from(root.querySelectorAll<HTMLElement>('section[aria-labelledby]')).find(
    (section) => text(root.querySelector(`#${section.getAttribute('aria-labelledby')}`)) === name,
  );
  if (!found) {
    throw new Error(`no region «${name}»`);
  }
  return found;
}

/** `<dt>` → `<dd>` pairs, in order. */
function figures(section: HTMLElement): Record<string, string> {
  const labels = texts(section.querySelectorAll('dl dt'));
  const values = texts(section.querySelectorAll('dl dd'));
  return Object.fromEntries(labels.map((label, index) => [label, values[index]]));
}

function button(scope: HTMLElement, startingWith: string): HTMLButtonElement {
  const found = Array.from(scope.querySelectorAll<HTMLButtonElement>('button')).find((candidate) =>
    (candidate.getAttribute('aria-label') ?? text(candidate)).startsWith(startingWith),
  );
  if (!found) {
    throw new Error(`no button starting «${startingWith}»`);
  }
  return found;
}

function select(root: HTMLElement, label: string): HTMLElement {
  const field = Array.from(root.querySelectorAll('mat-form-field')).find(
    (candidate) => text(candidate.querySelector('mat-label')) === label,
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

function chooseOption(options: HTMLElement[], name: string): void {
  const option = options.find((candidate) => text(candidate) === name);
  if (!option) {
    throw new Error(`no option «${name}» among ${texts(options).join('، ')}`);
  }
  option.click();
}

const followUpRowTexts = (root: HTMLElement): string[][] =>
  Array.from(
    region(root, 'فعالیت های نیازمند پیگیری').querySelectorAll('tbody tr.mat-mdc-row'),
  ).map((row) => texts(row.querySelectorAll('td')));

describe('PmDashboardPage', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    document.body.querySelectorAll('.cdk-overlay-container').forEach((overlay) => overlay.remove());
  });

  it('opens with «داشبورد مدیریتی فنی» as its heading', async () => {
    const { root } = await loaded();

    expect(text(root.querySelector('h1'))).toBe('داشبورد مدیریتی فنی');
  });

  it('shows a progress bar until the dashboard arrives, and none after', async () => {
    const { fixture, httpMock, root } = setUp();

    expect(root.querySelector('[role="progressbar"]')).not.toBeNull();

    expectDashboardRead(httpMock).flush(DASHBOARD);
    await fixture.whenStable();

    expect(root.querySelector('[role="progressbar"]')).toBeNull();
  });

  describe('filters', () => {
    it('asks for the last 30 days of every piece of equipment by default', async () => {
      const { fixture, httpMock, root } = setUp();

      const request = expectDashboardRead(httpMock);
      expect(paramsOf(request)).toEqual({ periodDays: '30' });
      request.flush(DASHBOARD);
      await fixture.whenStable();
      expect(text(select(root, 'بازه زمانی'))).toBe('30 روز اخیر');
      expect(text(select(root, 'تجهیز'))).toBe('همه تجهیزات');
    });

    it('offers the three periods', async () => {
      const { fixture, root } = await loaded();

      expect(texts(await openSelect(fixture, root, 'بازه زمانی'))).toEqual([
        '7 روز اخیر',
        '30 روز اخیر',
        '90 روز اخیر',
      ]);
    });

    it('offers every piece of equipment after «همه تجهیزات», a retired one marked', async () => {
      const { fixture, root } = await loaded();

      expect(texts(await openSelect(fixture, root, 'تجهیز'))).toEqual([
        'همه تجهیزات',
        'اکسترودر 1',
        'اکسترودر 2',
        'اکسترودر 3 (کنار گذاشته شده)',
      ]);
    });

    it('asks again for the chosen period, under a progress bar from the same render', async () => {
      const { fixture, httpMock, root } = await loaded();

      chooseOption(await openSelect(fixture, root, 'بازه زمانی'), '7 روز اخیر');
      tick();

      expect(root.querySelector('[role="progressbar"]')).not.toBeNull();
      const request = expectDashboardRead(httpMock);
      expect(paramsOf(request)).toEqual({ periodDays: '7' });
      request.flush(DASHBOARD);
      await fixture.whenStable();
      expect(root.querySelector('[role="progressbar"]')).toBeNull();
    });

    it('asks again for the chosen equipment', async () => {
      const { fixture, httpMock, root } = await loaded();

      chooseOption(await openSelect(fixture, root, 'تجهیز'), 'اکسترودر 2');
      tick();

      const request = expectDashboardRead(httpMock);
      expect(paramsOf(request)).toEqual({ periodDays: '30', equipmentId: 'e2' });
      request.flush(DASHBOARD);
      await fixture.whenStable();
    });

    it('re-reads on «به‌روزرسانی» and says when the figures were generated', async () => {
      const { fixture, httpMock, root } = await loaded();

      expect(text(root.querySelector('.pm-dashboard__updated'))).toMatch(
        /^آخرین به‌روزرسانی: ۱۴۰۵\/۰۷\/۱۰ [۰-۹]{2}:[۰-۹]{2}$/,
      );

      button(root, 'به‌روزرسانی').click();
      tick();
      expectDashboardRead(httpMock).flush(DASHBOARD);
      await fixture.whenStable();
    });
  });

  describe('current cards', () => {
    it('shows each card as a button named by its title and its number', async () => {
      const { root } = await loaded();

      for (const [title, value] of [
        ['سررسید امروز', '۱'],
        ['عقب افتاده', '۲'],
        ['انجام شده امروز', '۱'],
        ['موعدهای ازدست رفته', '۳'],
      ]) {
        const card = button(root, title);
        expect(text(card).startsWith(`${title} ${value}`)).toBe(true);
      }
    });

    it('filters the follow-up table to what a card counts, and back', async () => {
      const { fixture, root } = await loaded();

      button(root, 'عقب افتاده').click();
      await fixture.whenStable();

      expect(button(root, 'عقب افتاده').getAttribute('aria-pressed')).toBe('true');
      expect(followUpRowTexts(root).map((row) => row[1])).toEqual(['بررسی تابلو برق']);

      button(root, 'عقب افتاده').click();
      await fixture.whenStable();

      expect(followUpRowTexts(root)).toHaveLength(4);
    });
  });

  describe('«عملکرد PM»', () => {
    it('lists the period’s performance figures', async () => {
      const { root } = await loaded();

      expect(figures(region(root, 'عملکرد PM'))).toMatchObject({
        'درصد پایبندی': '۷۰٪',
        'درصد تکمیل': '۹۰٪',
        'انجام شده بموقع': '۷',
        'انجام شده با تاخیر': '۲',
        'میانگین روزهای تاخیر': '۳ روز',
      });
    });

    it('says there is not enough data when nothing in the period is past due', async () => {
      const { root } = await loaded(EMPTY_DASHBOARD);

      expect(figures(region(root, 'عملکرد PM'))).toMatchObject({
        'درصد پایبندی': 'داده کافی وجود ندارد',
        'درصد تکمیل': 'داده کافی وجود ندارد',
        'میانگین روزهای تاخیر': '-',
      });
    });

    it('filters the follow-up table to a trend point’s occurrences', async () => {
      const { fixture, root } = await loaded();
      const performance = region(root, 'عملکرد PM');

      button(performance, 'نمایش موعدهای ۱۴۰۵/۰۷/۰۳ تا ۱۴۰۵/۰۷/۰۹').click();
      await fixture.whenStable();

      expect(followUpRowTexts(root).map((row) => row[1])).toEqual(['بررسی تابلو برق', 'تمیزکاری']);
    });
  });

  describe('«پوشش برنامه PM»', () => {
    it('lists the coverage figures', async () => {
      const { root } = await loaded();

      expect(figures(region(root, 'پوشش برنامه PM'))).toEqual({
        'تجهیزات فعال': '۲',
        'دارای برنامه': '۱',
        'فاقد برنامه': '۱',
        'درصد پوشش': '۵۰٪',
      });
    });

    it('shows an em dash for coverage when no equipment is active', async () => {
      const { root } = await loaded(EMPTY_DASHBOARD);

      expect(figures(region(root, 'پوشش برنامه PM'))['درصد پوشش']).toBe('—');
    });

    it('lists the equipment without a plan as links to their technical files', async () => {
      const { fixture, root } = await loaded();
      const coverage = region(root, 'پوشش برنامه PM');

      const toggle = button(coverage, 'فاقد برنامه');
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      toggle.click();
      await fixture.whenStable();

      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      const links = Array.from(coverage.querySelectorAll('a'));
      expect(links.map((link) => [text(link), link.getAttribute('href')])).toEqual([
        ['اکسترودر 2', '/pm-plans/e2'],
      ]);
    });
  });

  describe('«بیشترین عقب افتادگی»', () => {
    it('lists the most overdue equipment under its three columns', async () => {
      const { root } = await loaded();
      const table = region(root, 'بیشترین عقب افتادگی').querySelector('table')!;

      expect(texts(table.querySelectorAll('thead th')).slice(0, 3)).toEqual([
        'تجهیز',
        'تعداد کار عقب افتاده',
        'جمع روزهای تاخیر',
      ]);
      expect(
        texts(table.querySelectorAll('tbody tr.mat-mdc-row')[0].querySelectorAll('td')).slice(0, 3),
      ).toEqual(['اکسترودر 1', '۲', '۸']);
    });

    it('filters the follow-up table to a row’s overdue work', async () => {
      const { fixture, root } = await loaded();

      button(region(root, 'بیشترین عقب افتادگی'), 'نمایش کارهای عقب افتاده اکسترودر 1').click();
      await fixture.whenStable();

      expect(followUpRowTexts(root).map((row) => row[1])).toEqual(['بررسی تابلو برق']);
    });

    it('says so when nothing is overdue', async () => {
      const { root } = await loaded(EMPTY_DASHBOARD);
      const section = region(root, 'بیشترین عقب افتادگی');

      expect(section.querySelectorAll('tbody tr.mat-mdc-row')).toHaveLength(0);
      expect(text(section)).toContain('هیچ تجهیزی کار عقب افتاده ندارد.');
    });
  });

  describe('«برنامه هفت روز آینده»', () => {
    it('lists the next seven days with Jalali due dates', async () => {
      const { root } = await loaded();
      const table = region(root, 'برنامه هفت روز آینده').querySelector('table')!;

      expect(texts(table.querySelectorAll('thead th'))).toEqual(['تجهیز', 'فعالیت', 'موعد']);
      expect(
        texts(table.querySelectorAll('tbody tr.mat-mdc-row')[0].querySelectorAll('td')),
      ).toEqual(['اکسترودر 1', 'روانکاری', '۱۴۰۵/۰۷/۱۱']);
    });

    it('says so when nothing is due in the next seven days', async () => {
      const { root } = await loaded(EMPTY_DASHBOARD);

      expect(text(region(root, 'برنامه هفت روز آینده'))).toContain('در هفت روز آینده موعدی نیست.');
    });
  });

  describe('«فعالیت های نیازمند پیگیری»', () => {
    it('heads the table with its six columns', async () => {
      const { root } = await loaded();

      expect(texts(region(root, 'فعالیت های نیازمند پیگیری').querySelectorAll('thead th'))).toEqual(
        ['تجهیز', 'فعالیت', 'تاریخ سررسید', 'وضعیت', 'مقدار تاخیر', 'عملیات'],
      );
    });

    it('shows every occurrence with its Jalali due date, status and delay', async () => {
      const { root } = await loaded();

      expect(followUpRowTexts(root).map((row) => row.slice(0, 5))).toEqual([
        ['اکسترودر 1', 'تعویض روغن', '۱۴۰۵/۰۷/۱۰', 'سررسیده', '-'],
        ['اکسترودر 1', 'بررسی تابلو برق', '۱۴۰۵/۰۷/۰۵', 'عقب افتاده', '۵ روز'],
        ['اکسترودر 2', 'تمیزکاری', '۱۴۰۵/۰۷/۰۴', 'با تاخیر', '۶ روز'],
        ['اکسترودر 1', 'تعویض روغن', '۱۴۰۵/۰۶/۲۹', 'انجام نشده', '-'],
      ]);
    });

    it('narrows the rows by status', async () => {
      const { fixture, root } = await loaded();

      chooseOption(await openSelect(fixture, root, 'وضعیت'), 'انجام نشده');
      await fixture.whenStable();

      expect(followUpRowTexts(root).map((row) => row[3])).toEqual(['انجام نشده']);
    });

    it('narrows the rows by a search of equipment and activity', async () => {
      const { fixture, root } = await loaded();
      const search = region(root, 'فعالیت های نیازمند پیگیری').querySelector<HTMLInputElement>(
        'input[type="search"]',
      )!;

      search.value = 'تمیزکاری';
      search.dispatchEvent(new Event('input'));
      await fixture.whenStable();

      expect(followUpRowTexts(root).map((row) => row[1])).toEqual(['تمیزکاری']);
    });

    it('offers «ثبت انجام» only on recordable rows', async () => {
      const { root } = await loaded();
      const actions = Array.from(
        region(root, 'فعالیت های نیازمند پیگیری').querySelectorAll('tbody tr.mat-mdc-row'),
      ).map((row) =>
        Array.from(row.querySelectorAll('button')).map((candidate) =>
          candidate.getAttribute('aria-label'),
        ),
      );

      expect(actions[0]).toEqual([
        'جزئیات تعویض روغن اکسترودر 1 ۱۴۰۵/۰۷/۱۰',
        'ثبت انجام تعویض روغن اکسترودر 1',
      ]);
      expect(actions[2]).toEqual(['جزئیات تمیزکاری اکسترودر 2 ۱۴۰۵/۰۷/۰۴']);
    });

    it('records through the daily list’s dialog, then re-reads the dashboard', async () => {
      const { fixture, httpMock, root } = await loaded();
      const open = vi
        .spyOn(TestBed.inject(MatDialog), 'open')
        .mockReturnValue({ afterClosed: () => of(true) } as MatDialogRef<unknown, boolean>);

      button(root, 'ثبت انجام بررسی تابلو برق اکسترودر 1').click();
      tick();

      expect(open).toHaveBeenCalledWith(RecordExecutionDialog, {
        data: {
          task: {
            equipmentId: 'e1',
            equipmentName: 'اکسترودر 1',
            planItemId: 'p2',
            activityId: 'a1',
            activityName: 'بررسی تابلو برق',
            dueDate: '2026-09-27',
            status: 'overdue',
            daysOverdue: 5,
          },
        },
      });
      expectDashboardRead(httpMock).flush(DASHBOARD);
      await fixture.whenStable();
    });

    describe('paging', () => {
      /** Thirty recordable rows: two pages of twenty-five. */
      const MANY = {
        ...DASHBOARD,
        occurrences: Array.from({ length: 30 }, (_, index) =>
          occurrence({
            planItemId: `m${index}`,
            activityName: `فعالیت ${index + 1}`,
            status: 'due',
            recordable: true,
          }),
        ),
      };

      async function onSecondPage() {
        const context = await loaded(MANY);
        context.root
          .querySelector<HTMLButtonElement>('.mat-mdc-paginator-navigation-next')!
          .click();
        await context.fixture.whenStable();
        expect(followUpRowTexts(context.root)[0][1]).toBe('فعالیت 26');
        return context;
      }

      // A recording re-reads the same rows: the visitor stays where they were working.
      it('keeps the page after a recording re-reads the dashboard', async () => {
        const { fixture, httpMock, root } = await onSecondPage();
        vi.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({
          afterClosed: () => of(true),
        } as MatDialogRef<unknown, boolean>);

        button(root, 'ثبت انجام فعالیت 26').click();
        tick();
        expectDashboardRead(httpMock).flush(MANY);
        await fixture.whenStable();

        expect(followUpRowTexts(root)[0][1]).toBe('فعالیت 26');
      });

      it('keeps the last page that still exists when a re-read brings fewer rows', async () => {
        const { fixture, httpMock, root } = await onSecondPage();

        button(root, 'به‌روزرسانی').click();
        tick();
        expectDashboardRead(httpMock).flush({
          ...MANY,
          occurrences: MANY.occurrences.slice(0, 20),
        });
        await fixture.whenStable();

        expect(followUpRowTexts(root)[0][1]).toBe('فعالیت 1');
      });

      it('goes back to the first page when a filter changes', async () => {
        const { fixture, root } = await onSecondPage();

        chooseOption(await openSelect(fixture, root, 'وضعیت'), 'سررسیده');
        await fixture.whenStable();

        expect(followUpRowTexts(root)[0][1]).toBe('فعالیت 1');
      });
    });

    it('opens a row’s details from its own data', async () => {
      const { root } = await loaded();
      const open = vi
        .spyOn(TestBed.inject(MatDialog), 'open')
        .mockReturnValue({ afterClosed: () => of(undefined) } as MatDialogRef<unknown, undefined>);

      button(root, 'جزئیات تمیزکاری اکسترودر 2').click();

      expect(open).toHaveBeenCalledWith(
        PmOccurrenceDetailsDialog,
        expect.objectContaining({
          data: {
            occurrence: expect.objectContaining({
              activityName: 'تمیزکاری',
              status: 'late',
              performedBy: 'رضازاده',
              daysLate: 6,
            }),
          },
        }),
      );
    });

    it('exports the filtered rows as a spreadsheet file', async () => {
      const { fixture, root } = await loaded();
      const save = vi.spyOn(TestBed.inject(FileSaver), 'save').mockImplementation(() => undefined);

      button(root, 'موعدهای ازدست رفته').click();
      await fixture.whenStable();
      button(root, 'خروجی اکسل').click();

      expect(save).toHaveBeenCalledTimes(1);
      const [blob, fileName] = save.mock.calls[0];
      expect(fileName).toBe('pm-follow-up-1405-07-10.csv');
      const content = await blob.text();
      expect(content.trim().split('\r\n')).toHaveLength(2);
    });

    it('says so when no row matches', async () => {
      const { root } = await loaded(EMPTY_DASHBOARD);

      expect(text(region(root, 'فعالیت های نیازمند پیگیری'))).toContain(
        'موعدی با این فیلترها نیست.',
      );
    });
  });

  it('says the visitor has no access on a 403', async () => {
    const { fixture, httpMock, root } = setUp();

    expectDashboardRead(httpMock).flush(null, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();

    expect(text(root)).toContain('شما دسترسی لازم برای مشاهده این بخش را ندارید.');
  });
});
