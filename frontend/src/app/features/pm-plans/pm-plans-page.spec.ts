import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { accessibleName, region, squeeze } from './testing/pm-plans-queries';
import { PmPlansPage } from './pm-plans-page';

const EQUIPMENT = [
  { id: 'e1', name: 'اکسترودر 1', retired: false, activePlanItemCount: 2 },
  { id: 'e2', name: 'اکسترودر 2', retired: false, activePlanItemCount: 1 },
  { id: 'e5', name: 'دستگاه بسته بندی', retired: false, activePlanItemCount: 0 },
  { id: 'e3', name: 'اکسترودر قدیمی', retired: true, activePlanItemCount: 0 },
];

const BOARD = 'تجهیزات فعال';
const ARCHIVE = 'تجهیزات کنار گذاشته شده';

describe('PmPlansPage — the board of equipment folders', () => {
  let fixture: ComponentFixture<PmPlansPage>;
  let httpMock: HttpTestingController;
  let root: HTMLElement;

  const tick = () => TestBed.inject(ApplicationRef).tick();

  const createPage = async (equipment: readonly object[] = EQUIPMENT): Promise<void> => {
    fixture = TestBed.createComponent(PmPlansPage);
    httpMock = TestBed.inject(HttpTestingController);
    root = fixture.nativeElement as HTMLElement;
    tick();
    httpMock.expectOne({ method: 'GET', url: '/api/equipment' }).flush(equipment);
    await fixture.whenStable();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'pm-plans/:equipmentId', children: [] }]),
      ],
    });
  });

  afterEach(() => {
    httpMock.verify();
  });

  const board = () => region(root, BOARD);

  const archive = () =>
    Array.from(root.querySelectorAll('mat-expansion-panel')).find(
      (panel) => squeeze(panel.querySelector('mat-panel-title')?.textContent) === ARCHIVE,
    );

  const cardsIn = (scope: Element | undefined): HTMLAnchorElement[] =>
    Array.from(scope?.querySelectorAll<HTMLAnchorElement>('a[href]') ?? []);

  const cardIn = (scope: Element | undefined, name: string) =>
    cardsIn(scope).find((card) => accessibleName(card) === name);

  const search = async (text: string): Promise<void> => {
    const field = root.querySelector<HTMLInputElement>('input[type="search"]')!;
    field.value = text;
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };

  describe('the active equipment', () => {
    beforeEach(() => createPage());

    it('opens with «پرونده فنی تجهیزات» as its heading', () => {
      expect(root.querySelector('h1')?.textContent?.trim()).toBe('پرونده فنی تجهیزات');
    });

    it('is a region named «تجهیزات فعال»', () => {
      expect(board()).toBeDefined();
    });

    it('holds a folder for every active piece of equipment, plan or no plan, in the API’s order', () => {
      expect(cardsIn(board()).map(accessibleName)).toEqual([
        'اکسترودر 1',
        'اکسترودر 2',
        'دستگاه بسته بندی',
      ]);
    });

    it('never holds retired equipment', () => {
      expect(cardIn(board(), 'اکسترودر قدیمی')).toBeUndefined();
    });

    it('makes each folder a link to its own page, named by the equipment alone', () => {
      const card = cardIn(board(), 'اکسترودر 1')!;

      expect(card.getAttribute('href')).toBe('/pm-plans/e1');
      expect(accessibleName(card)).toBe('اکسترودر 1');
    });

    it('describes each folder by its active activities, in Persian digits', () => {
      const card = cardIn(board(), 'اکسترودر 1')!;
      const description = root.querySelector(`#${card.getAttribute('aria-describedby')}`);

      expect(card.contains(description)).toBe(true);
      expect(squeeze(description?.textContent)).toBe('۲ فعالیت فعال');
      expect(squeeze(cardIn(board(), 'اکسترودر 2')?.textContent)).toContain('۱ فعالیت فعال');
    });

    it('says «بدون برنامه PM» on a folder with nothing in its plan', () => {
      expect(squeeze(cardIn(board(), 'دستگاه بسته بندی')?.textContent)).toContain('بدون برنامه PM');
    });

    it('opens the equipment’s folder when its card is clicked', async () => {
      cardIn(board(), 'اکسترودر 2')!.click();
      await fixture.whenStable();

      expect(TestBed.inject(Router).url).toBe('/pm-plans/e2');
    });

    it('offers no plan, history or define-plan action of its own', () => {
      expect(region(root, 'برنامه PM')).toBeUndefined();
      expect(region(root, 'سابقه PM')).toBeUndefined();
      expect(root.textContent).not.toContain('تعریف برنامه برای تجهیز');
    });

    it('narrows the folders by name as the visitor types in «جستجوی تجهیز»', async () => {
      expect(
        squeeze(root.querySelector('input[type="search"]')?.closest('mat-form-field')?.textContent),
      ).toBe('جستجوی تجهیز');

      await search('۲');

      expect(cardsIn(board()).map(accessibleName)).toEqual(['اکسترودر 2']);
    });

    it('says when the search matches nothing, and offers to clear it', async () => {
      await search('میکسر');

      expect(cardsIn(board())).toEqual([]);
      expect(board()?.textContent).toContain('هیچ تجهیزی یافت نشد.');

      Array.from(board()!.querySelectorAll('button'))
        .find((button) => squeeze(button.textContent) === 'پاک کردن جستجو')
        ?.click();
      await fixture.whenStable();

      expect(cardsIn(board())).toHaveLength(3);
    });
  });

  it('says when no active equipment is registered yet', async () => {
    await createPage([EQUIPMENT[3]]);

    expect(cardsIn(board())).toEqual([]);
    expect(board()?.textContent).toContain('هنوز هیچ تجهیز فعالی ثبت نشده است.');
  });

  it('offers to retry when the list cannot be read', async () => {
    fixture = TestBed.createComponent(PmPlansPage);
    httpMock = TestBed.inject(HttpTestingController);
    root = fixture.nativeElement as HTMLElement;
    tick();
    httpMock
      .expectOne({ method: 'GET', url: '/api/equipment' })
      .flush(null, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(board()?.querySelector('[role="alert"]')?.textContent).toContain(
      'فهرست تجهیزات بارگذاری نشد.',
    );
  });

  // Retiring stops a plan for good but keeps the folder and its history, which stay reachable.
  describe('the archive of retired equipment', () => {
    const openArchive = async (): Promise<void> => {
      archive()?.querySelector<HTMLElement>('mat-expansion-panel-header')?.click();
      await fixture.whenStable();
    };

    it('is a «تجهیزات کنار گذاشته شده» panel, collapsed at first', async () => {
      await createPage();

      expect(
        archive()?.querySelector('mat-expansion-panel-header')?.getAttribute('aria-expanded'),
      ).toBe('false');
    });

    it('holds a folder per retired equipment, linking to its page', async () => {
      await createPage();
      await openArchive();

      const card = cardIn(archive(), 'اکسترودر قدیمی');
      expect(cardsIn(archive()).map(accessibleName)).toEqual(['اکسترودر قدیمی']);
      expect(card?.getAttribute('href')).toBe('/pm-plans/e3');
      expect(squeeze(card?.textContent)).toContain('کنار گذاشته شده');
    });

    it('is there even with nothing retired, saying so', async () => {
      await createPage(EQUIPMENT.slice(0, 3));
      await openArchive();

      expect(cardsIn(archive())).toEqual([]);
      expect(archive()?.textContent).toContain('هیچ تجهیزی کنار گذاشته نشده است.');
    });

    it('is narrowed by the same search', async () => {
      await createPage();
      await search('اکسترودر 1');
      await openArchive();

      expect(cardsIn(archive())).toEqual([]);
      expect(archive()?.textContent).toContain('هیچ تجهیزی یافت نشد.');
    });
  });

  it('says access is denied when the API refuses the list', async () => {
    fixture = TestBed.createComponent(PmPlansPage);
    httpMock = TestBed.inject(HttpTestingController);
    root = fixture.nativeElement as HTMLElement;
    tick();
    httpMock
      .expectOne({ method: 'GET', url: '/api/equipment' })
      .flush(null, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();

    expect(root.textContent).toContain('شما دسترسی لازم برای مشاهده این بخش را ندارید.');
    expect(board()).toBeUndefined();
    expect(archive()).toBeUndefined();
  });
});
