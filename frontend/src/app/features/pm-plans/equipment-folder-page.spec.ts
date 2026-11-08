import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Role } from '../../api/model';
import { signInAs } from '../../core/identity/testing/sign-in-as';
import { provideJalaliDateAdapter } from '../../core/material/jalali-date-adapter';
import { EquipmentFolderPage } from './equipment-folder-page';
import { controlNamed, region, squeeze, texts } from './testing/pm-plans-queries';

const ITEM = {
  id: 'p1',
  activityId: 'a1',
  activityName: 'تعویض روغن',
  intervalDays: 30,
  firstDueDate: '2026-09-23',
  nextDueDate: '2026-10-23',
};

const INACTIVE_ITEM = {
  id: 'p0',
  activityId: 'a2',
  activityName: 'بررسی تابلو برق',
  intervalDays: 7,
  firstDueDate: '2026-09-01',
  deactivatedAt: '2026-09-20T06:30:00.000Z',
};

const INACTIVE = 'فعالیت\u200cهای غیرفعال';

const ACTIVE = {
  id: 'e1',
  name: 'اکسترودر 1',
  retired: false,
  planItems: [ITEM],
  inactivePlanItems: [],
};
const OTHER = {
  id: 'e2',
  name: 'اکسترودر 2',
  retired: false,
  planItems: [],
  inactivePlanItems: [],
};
const RETIRED = {
  id: 'e3',
  name: 'اکسترودر قدیمی',
  retired: true,
  planItems: [ITEM],
  inactivePlanItems: [INACTIVE_ITEM],
};
/** Every activity of its plan deactivated — the folder still opens, and lists them. */
const ALL_DEACTIVATED = {
  id: 'e4',
  name: 'اکسترودر 4',
  retired: false,
  planItems: [],
  inactivePlanItems: [INACTIVE_ITEM],
};

const HISTORY = [
  {
    id: 'x1',
    activityName: 'تعویض روغن',
    dueDate: '2026-09-23',
    performedAt: '2026-09-23T07:00:00.000Z',
    performedBy: 'مسلمی',
    status: 'on_time',
    notes: null,
    daysLate: null,
  },
];

describe('EquipmentFolderPage — one equipment’s technical folder', () => {
  let fixture: ComponentFixture<EquipmentFolderPage>;
  let httpMock: HttpTestingController;
  let root: HTMLElement;

  const tick = () => TestBed.inject(ApplicationRef).tick();

  /**
   * Renders what a flushed equipment read brings in — the sections, whose history read then goes
   * out. Not `whenStable()`: that waits for the history read itself, which is still unanswered.
   */
  const renderSections = async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    tick();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'pm-plans', children: [] }]),
        provideJalaliDateAdapter(),
      ],
    });
    fixture = TestBed.createComponent(EquipmentFolderPage);
    httpMock = TestBed.inject(HttpTestingController);
    root = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    httpMock.verify();
  });

  /** Opens the folder for `id` and answers its reads: the equipment, then its history. */
  const open = async (detail: { id: string } = ACTIVE, history: object[] = HISTORY) => {
    fixture.componentRef.setInput('equipmentId', detail.id);
    tick();
    httpMock.expectOne({ method: 'GET', url: `/api/equipment/${detail.id}` }).flush(detail);
    await renderSections();
    httpMock
      .expectOne({ method: 'GET', url: `/api/equipment/${detail.id}/maintenance-history` })
      .flush(history);
    await fixture.whenStable();
  };

  const failToOpen = async (id: string, status: number, statusText: string) => {
    fixture.componentRef.setInput('equipmentId', id);
    tick();
    httpMock
      .expectOne({ method: 'GET', url: `/api/equipment/${id}` })
      .flush(null, { status, statusText });
    await fixture.whenStable();
  };

  /** «فعالیت‌های غیرفعال» opens collapsed (issue #112); its toggle shows the rows. */
  const showInactive = async () => {
    root.querySelector<HTMLButtonElement>('button[aria-controls][aria-expanded="false"]')?.click();
    await fixture.whenStable();
  };

  const backLink = () => controlNamed(root, 'بازگشت به پرونده‌ها') as HTMLAnchorElement | undefined;
  const status = () => squeeze(root.querySelector('header [role="status"]')?.textContent);

  describe('the header', () => {
    it('names the folder by the equipment, as the page’s one heading', async () => {
      await open();

      expect(texts(root.querySelectorAll('h1'))).toEqual(['اکسترودر 1']);
    });

    it('says an active equipment is «فعال»', async () => {
      await open();

      expect(status()).toBe('فعال');
    });

    it('says a retired equipment is «کنار گذاشته شده»', async () => {
      await open(RETIRED);

      expect(status()).toBe('کنار گذاشته شده');
    });

    it('leads back to the folders with «بازگشت به پرونده‌ها»', async () => {
      await open();

      expect(backLink()?.getAttribute('href')).toBe('/pm-plans');
    });
  });

  describe('the summary under the header (issue #112)', () => {
    // 1405/08/17: ITEM's next due date, 1405/08/01, has passed.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 10, 8, 10, 0));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const tiles = () =>
      Array.from(
        root.querySelectorAll('[role="group"][aria-label="خلاصه پرونده"] app-stat-tile'),
      ).map(
        // Label, figure and note are blocks of their own, read one after another.
        (tile) =>
          texts(
            tile.querySelectorAll('.stat-tile__label, .stat-tile__value, .stat-tile__note'),
          ).join(' '),
      );

    it('counts the active plan rows and the overdue ones, and names the nearest due date', async () => {
      const twoItems = {
        ...ACTIVE,
        planItems: [ITEM, { ...ITEM, id: 'p2', activityId: 'a2', nextDueDate: '2026-12-01' }],
      };
      await open(twoItems);

      expect(tiles()).toEqual([
        'فعالیت‌های فعال PM ۲',
        'عقب افتاده ۱ موعد گذشته و انجام نشده',
        'نزدیک‌ترین موعد PM ۱۴۰۵/۰۸/۰۱',
      ]);
    });

    it('says there is no due date without an active plan', async () => {
      await open(OTHER, []);

      expect(tiles()).toEqual([
        'فعالیت‌های فعال PM ۰',
        'عقب افتاده ۰ موعد گذشته و انجام نشده',
        'نزدیک‌ترین موعد PM — بدون برنامهٔ فعال',
      ]);
    });

    it('says a retired equipment’s PM is stopped', async () => {
      await open(RETIRED);

      expect(tiles()).toEqual([
        'فعالیت‌های فعال PM ۱',
        'عقب افتاده ۰ موعد گذشته و انجام نشده',
        'نزدیک‌ترین موعد PM — PM متوقف است',
      ]);
    });
  });

  describe('the sections', () => {
    it('stacks «برنامه PM», «فعالیت‌های غیرفعال», then «سابقه PM»', async () => {
      await open();

      expect(texts(root.querySelectorAll('section h2'))).toEqual([
        'برنامه PM',
        INACTIVE,
        'سابقه PM',
      ]);
    });

    it('lists the deactivated rows apart from the active plan, even with no active row left', async () => {
      await open(ALL_DEACTIVATED, []);

      expect(region(root, 'برنامه PM')!.textContent).toContain(
        'هنوز فعالیتی در برنامهٔ این تجهیز نیست.',
      );
      await showInactive();
      expect(texts(region(root, INACTIVE)!.querySelectorAll('tbody td'))[0]).toBe(
        'بررسی تابلو برق',
      );
    });

    it('lists a retired equipment’s deactivated rows', async () => {
      await open(RETIRED);

      await showInactive();
      expect(region(root, INACTIVE)!.querySelectorAll('tbody tr.mat-mdc-row')).toHaveLength(1);
    });

    it('shows the plan section, with «افزودن فعالیت», even when the plan is empty', async () => {
      await open(OTHER, []);

      const plan = region(root, 'برنامه PM')!;
      expect(controlNamed(plan, 'افزودن فعالیت')).toBeDefined();
      expect(plan.textContent).toContain('هنوز فعالیتی در برنامهٔ این تجهیز نیست.');
    });

    it('re-reads the equipment after a plan change, never the history', async () => {
      await open();
      vi.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({
        afterClosed: () => of(true),
      } as MatDialogRef<unknown, unknown>);

      controlNamed(region(root, 'برنامه PM')!, 'افزودن فعالیت')!.click();
      tick();
      httpMock
        .expectOne({ method: 'GET', url: '/api/equipment/e1' })
        .flush({ ...ACTIVE, planItems: [] });
      await fixture.whenStable();

      httpMock.expectNone('/api/equipment/e1/maintenance-history');
      expect(region(root, 'برنامه PM')?.textContent).toContain(
        'هنوز فعالیتی در برنامهٔ این تجهیز نیست.',
      );
    });
  });

  describe("the System Admin's deletions (issue #110)", () => {
    const answerEveryDialog = (answer: boolean) =>
      vi.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({
        afterClosed: () => of(answer),
      } as MatDialogRef<unknown, unknown>);

    it('offers them to the System Admin only', async () => {
      await open();
      expect(controlNamed(region(root, 'سابقه PM')!, 'حذف سابقه')).toBeUndefined();

      localStorage.clear();
      await signInAs(Role.system_admin, httpMock);
      tick();

      expect(controlNamed(region(root, 'سابقه PM')!, 'حذف سابقه')).toBeDefined();
    });

    it('re-reads the plan once an execution is deleted from the history, whose own list re-reads', async () => {
      localStorage.clear();
      await signInAs(Role.system_admin, httpMock);
      await open();
      answerEveryDialog(true);

      controlNamed(region(root, 'سابقه PM')!, 'حذف سابقه')!.click();
      tick();

      httpMock.expectOne({ method: 'GET', url: '/api/equipment/e1/maintenance-history' }).flush([]);
      httpMock.expectOne({ method: 'GET', url: '/api/equipment/e1' }).flush(ACTIVE);
      await fixture.whenStable();
    });

    it('re-reads the plan and the history once a deactivated row is deleted', async () => {
      localStorage.clear();
      await signInAs(Role.system_admin, httpMock);
      await open(ALL_DEACTIVATED);
      answerEveryDialog(true);

      await showInactive();
      controlNamed(region(root, INACTIVE)!, 'حذف ردیف')!.click();
      tick();

      httpMock
        .expectOne({ method: 'GET', url: '/api/equipment/e4' })
        .flush({ ...ALL_DEACTIVATED, inactivePlanItems: [] });
      httpMock.expectOne({ method: 'GET', url: '/api/equipment/e4/maintenance-history' }).flush([]);
      await fixture.whenStable();
    });
  });

  // The route param keys every read: another folder never shows the one before.
  it('shows nothing of the previous folder while another one loads', async () => {
    await open();

    fixture.componentRef.setInput('equipmentId', 'e2');
    tick();

    expect(root.textContent).not.toContain('اکسترودر 1');
    expect(root.textContent).not.toContain('تعویض روغن');
    expect(region(root, 'برنامه PM')).toBeUndefined();

    httpMock.expectOne({ method: 'GET', url: '/api/equipment/e2' }).flush(OTHER);
    await renderSections();
    httpMock.expectOne({ method: 'GET', url: '/api/equipment/e2/maintenance-history' }).flush([]);
    await fixture.whenStable();

    expect(texts(root.querySelectorAll('h1'))).toEqual(['اکسترودر 2']);
  });

  describe('when the folder cannot be opened', () => {
    it('says an unknown equipment’s folder was not found, and keeps the way back', async () => {
      await failToOpen('nope', 404, 'Not Found');

      expect(root.querySelector('[role="alert"]')?.textContent).toContain('این پرونده پیدا نشد.');
      expect(backLink()?.getAttribute('href')).toBe('/pm-plans');
      expect(region(root, 'برنامه PM')).toBeUndefined();
      expect(region(root, 'سابقه PM')).toBeUndefined();
    });

    it('offers to retry any other failure', async () => {
      await failToOpen('e1', 500, 'Server Error');

      expect(root.querySelector('[role="alert"]')?.textContent).toContain(
        'پرونده تجهیز بارگذاری نشد.',
      );
      controlNamed(root, 'تلاش دوباره')!.click();
      tick();
      httpMock.expectOne({ method: 'GET', url: '/api/equipment/e1' }).flush(ACTIVE);
      await renderSections();
      httpMock.expectOne({ method: 'GET', url: '/api/equipment/e1/maintenance-history' }).flush([]);
      await fixture.whenStable();

      expect(texts(root.querySelectorAll('h1'))).toEqual(['اکسترودر 1']);
    });

    it('says access is denied when the API refuses it', async () => {
      await failToOpen('e1', 403, 'Forbidden');

      expect(root.textContent).toContain('شما دسترسی لازم برای مشاهده این بخش را ندارید.');
      expect(backLink()).toBeDefined();
    });
  });
});
