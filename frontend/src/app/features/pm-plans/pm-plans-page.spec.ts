import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AddPmPlanItemDialog } from './add-pm-plan-item-dialog';
import { ChangePmIntervalDialog } from './change-pm-interval-dialog';
import { ConfirmRemovePmPlanItemDialog } from './confirm-remove-pm-plan-item-dialog';
import { endAlignedColumns } from '../../ui/testing/end-aligned-columns';
import { PmExecutionDetailsDialog } from './pm-execution-details-dialog';
import { PmPlansPage } from './pm-plans-page';

const EQUIPMENT = [
  { id: 'e1', name: 'اکسترودر 1', retired: false, activePlanItemCount: 2 },
  { id: 'e2', name: 'اکسترودر 2', retired: false, activePlanItemCount: 1 },
  { id: 'e5', name: 'دستگاه بسته بندی', retired: false, activePlanItemCount: 0 },
  { id: 'e3', name: 'اکسترودر قدیمی', retired: true, activePlanItemCount: 0 },
];

const ITEM = {
  id: 'p1',
  activityId: 'a1',
  activityName: 'تعویض روغن',
  intervalDays: 30,
  firstDueDate: '2026-09-23',
  nextDueDate: '2026-10-23',
};

const SECOND_ITEM = {
  id: 'p2',
  activityId: 'a2',
  activityName: 'بررسی تابلو برق',
  intervalDays: 7,
  firstDueDate: '2026-09-23',
  nextDueDate: '2026-09-30',
};

interface Detail {
  id: string;
  name: string;
  retired: boolean;
  planItems: (typeof ITEM)[];
}

const DETAIL: Detail = {
  id: 'e1',
  name: 'اکسترودر 1',
  retired: false,
  planItems: [ITEM, SECOND_ITEM],
};
const SECOND_DETAIL: Detail = {
  id: 'e2',
  name: 'اکسترودر 2',
  retired: false,
  planItems: [SECOND_ITEM],
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

const BOARD = 'تجهیزات دارای برنامه PM';
const RETIRED = 'تجهیزات کنار گذاشته شده';

const squeeze = (text: string | null | undefined): string =>
  text?.replace(/\s+/g, ' ').trim() ?? '';

const texts = (elements: Iterable<Element>): string[] =>
  Array.from(elements).map((element) => squeeze(element.textContent));

/** The text a screen reader names an element by: its content, minus what is `aria-hidden`. */
const accessibleName = (element: Element): string => {
  const walk = (node: Node): string => {
    if (node instanceof Element && node.getAttribute('aria-hidden') === 'true') {
      return '';
    }
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent ?? '';
    }
    return Array.from(node.childNodes).map(walk).join(' ');
  };
  return element.getAttribute('aria-label') ?? squeeze(walk(element));
};

describe('PmPlansPage', () => {
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
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  });

  afterEach(() => {
    httpMock.verify();
  });

  /** A region, found the way a screen reader reaches it: by the heading that names it. */
  const region = (heading: string) =>
    Array.from(root.querySelectorAll('section[aria-labelledby]')).find(
      (section) =>
        squeeze(root.querySelector(`#${section.getAttribute('aria-labelledby')}`)?.textContent) ===
        heading,
    );

  const board = () => region(BOARD);

  /** The retired equipment's expansion panel. */
  const retiredPanel = () =>
    Array.from(root.querySelectorAll('mat-expansion-panel')).find(
      (panel) => squeeze(panel.querySelector('mat-panel-title')?.textContent) === RETIRED,
    );

  const cardsIn = (scope: Element | undefined): HTMLButtonElement[] =>
    Array.from(scope?.querySelectorAll<HTMLButtonElement>('button[aria-pressed]') ?? []);

  const cardIn = (scope: Element | undefined, name: string) =>
    cardsIn(scope).find((card) => accessibleName(card) === name);

  const buttonNamed = (name: string) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => accessibleName(button) === name,
    );

  /** Clicks a card and answers the two reads the selection starts. */
  const select = async (card: HTMLButtonElement | undefined, detail: Detail): Promise<void> => {
    card!.click();
    tick();
    httpMock.expectOne({ method: 'GET', url: `/api/equipment/${detail.id}` }).flush(detail);
    httpMock
      .expectOne({ method: 'GET', url: `/api/equipment/${detail.id}/maintenance-history` })
      .flush(HISTORY);
    await fixture.whenStable();
  };

  const chooseEquipment = (detail: Detail = DETAIL) => select(cardIn(board(), detail.name), detail);

  const search = async (text: string): Promise<void> => {
    const field = root.querySelector<HTMLInputElement>('input[type="search"]')!;
    field.value = text;
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };

  const stubDialog = (result: unknown) =>
    vi
      .spyOn(TestBed.inject(MatDialog), 'open')
      .mockReturnValue({ afterClosed: () => of(result) } as MatDialogRef<unknown, unknown>);

  const menuTrigger = (record: string) =>
    root.querySelector<HTMLButtonElement>(`[aria-label="عملیات بیشتر برای ${record}"]`);

  const chooseRowAction = async (record: string, action: string): Promise<void> => {
    menuTrigger(record)?.click();
    await fixture.whenStable();
    Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'))
      .find((item) => item.textContent?.trim() === action)
      ?.click();
  };

  const addButton = () => buttonNamed('افزودن فعالیت');

  describe('the board', () => {
    beforeEach(() => createPage());

    it('opens with «پرونده فنی تجهیزات» as its heading', () => {
      expect(root.querySelector('h1')?.textContent?.trim()).toBe('پرونده فنی تجهیزات');
    });

    it('is a region named «تجهیزات دارای برنامه PM»', () => {
      expect(board()).toBeDefined();
    });

    it('holds a card for each active piece of equipment with a plan, and nothing else', () => {
      expect(cardsIn(board()).map(accessibleName)).toEqual(['اکسترودر 1', 'اکسترودر 2']);
    });

    it('makes each card a real button, named by the equipment alone', () => {
      const card = cardIn(board(), 'اکسترودر 1')!;

      expect(card.tagName).toBe('BUTTON');
      expect(card.type).toBe('button');
      expect(accessibleName(card)).toBe('اکسترودر 1');
    });

    it('shows each card’s active activity count in Persian digits, as its description', () => {
      const card = cardIn(board(), 'اکسترودر 1')!;
      const description = root.querySelector(`#${card.getAttribute('aria-describedby')}`);

      expect(card.contains(description)).toBe(true);
      expect(squeeze(description?.textContent)).toBe('۲ فعالیت فعال');
      expect(squeeze(cardIn(board(), 'اکسترودر 2')?.textContent)).toContain('۱ فعالیت فعال');
    });

    it('selects no card and shows no plan before one is clicked', () => {
      expect(cardsIn(board()).map((card) => card.getAttribute('aria-pressed'))).toEqual([
        'false',
        'false',
      ]);
      expect(root.textContent).toContain('برای دیدن برنامهٔ PM، یک تجهیز را انتخاب کنید.');
      expect(region('برنامه PM')).toBeUndefined();
      expect(addButton()).toBeUndefined();
    });

    it('presses the clicked card and shows its plan and history', async () => {
      await chooseEquipment();

      expect(cardIn(board(), 'اکسترودر 1')?.getAttribute('aria-pressed')).toBe('true');
      expect(cardIn(board(), 'اکسترودر 2')?.getAttribute('aria-pressed')).toBe('false');
      expect(region('برنامه PM')).toBeDefined();
      expect(region('سابقه PM')).toBeDefined();
    });

    it('replaces the plan and history when another card is clicked', async () => {
      await chooseEquipment();

      await select(cardIn(board(), 'اکسترودر 2'), SECOND_DETAIL);

      expect(cardIn(board(), 'اکسترودر 1')?.getAttribute('aria-pressed')).toBe('false');
      expect(cardIn(board(), 'اکسترودر 2')?.getAttribute('aria-pressed')).toBe('true');
      expect(texts(region('برنامه PM')!.querySelectorAll('tbody tr td:first-child'))).toEqual([
        'بررسی تابلو برق',
      ]);
    });

    it('narrows the board by name as the visitor types in «جستجوی تجهیز»', async () => {
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

      buttonNamed('پاک کردن جستجو')?.click();
      await fixture.whenStable();

      expect(cardsIn(board()).map(accessibleName)).toEqual(['اکسترودر 1', 'اکسترودر 2']);
    });
  });

  it('says when no active equipment has a plan yet', async () => {
    await createPage([EQUIPMENT[2], EQUIPMENT[3]]);

    expect(cardsIn(board())).toEqual([]);
    expect(board()?.textContent).toContain('هنوز هیچ تجهیزی برنامهٔ PM ندارد.');
  });

  describe('«تعریف برنامه برای تجهیز»', () => {
    it('offers the active equipment without a plan in the add-item dialog', async () => {
      await createPage();
      const open = stubDialog(undefined);

      buttonNamed('تعریف برنامه برای تجهیز')?.click();

      expect(open).toHaveBeenCalledWith(AddPmPlanItemDialog, {
        data: { candidates: [{ id: 'e5', name: 'دستگاه بسته بندی' }] },
      });
    });

    it('re-reads the board and selects the equipment the plan was defined for', async () => {
      await createPage();
      stubDialog('e5');

      buttonNamed('تعریف برنامه برای تجهیز')?.click();
      tick();
      httpMock
        .expectOne({ method: 'GET', url: '/api/equipment' })
        .flush(
          EQUIPMENT.map((equipment) =>
            equipment.id === 'e5' ? { ...equipment, activePlanItemCount: 1 } : equipment,
          ),
        );
      httpMock
        .expectOne({ method: 'GET', url: '/api/equipment/e5' })
        .flush({ id: 'e5', name: 'دستگاه بسته بندی', retired: false, planItems: [ITEM] });
      httpMock.expectOne({ method: 'GET', url: '/api/equipment/e5/maintenance-history' }).flush([]);
      await fixture.whenStable();

      expect(cardIn(board(), 'دستگاه بسته بندی')?.getAttribute('aria-pressed')).toBe('true');
      expect(texts(region('برنامه PM')!.querySelectorAll('tbody tr td:first-child'))).toEqual([
        'تعویض روغن',
      ]);
    });

    it('stays reachable but explains itself when every active equipment already has a plan', async () => {
      await createPage([EQUIPMENT[0], EQUIPMENT[3]]);
      const open = stubDialog(undefined);
      const button = buttonNamed('تعریف برنامه برای تجهیز')!;

      button.click();

      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect(open).not.toHaveBeenCalled();
      expect(
        squeeze(root.querySelector(`#${button.getAttribute('aria-describedby')}`)?.textContent),
      ).toBe('همهٔ تجهیزات فعال برنامهٔ PM دارند.');
    });
  });

  // Retiring stops a plan for good but keeps its history, which must stay reachable.
  describe('retired equipment', () => {
    const RETIRED_DETAIL: Detail = {
      id: 'e3',
      name: 'اکسترودر قدیمی',
      retired: true,
      planItems: [ITEM],
    };

    beforeEach(() => createPage());

    const openRetiredPanel = async (): Promise<void> => {
      retiredPanel()?.querySelector<HTMLElement>('mat-expansion-panel-header')?.click();
      await fixture.whenStable();
    };

    it('is never on the board, but in a collapsed «تجهیزات کنار گذاشته شده» panel', () => {
      expect(cardIn(board(), 'اکسترودر قدیمی')).toBeUndefined();
      expect(
        retiredPanel()?.querySelector('mat-expansion-panel-header')?.getAttribute('aria-expanded'),
      ).toBe('false');
      expect(cardsIn(retiredPanel()).map(accessibleName)).toEqual(['اکسترودر قدیمی']);
    });

    it('is narrowed by the same search', async () => {
      await search('اکسترودر 1');

      expect(cardsIn(retiredPanel())).toEqual([]);
    });

    describe('once chosen', () => {
      beforeEach(async () => {
        await openRetiredPanel();
        await select(cardIn(retiredPanel(), 'اکسترودر قدیمی'), RETIRED_DETAIL);
      });

      it('is pressed', () => {
        expect(cardIn(retiredPanel(), 'اکسترودر قدیمی')?.getAttribute('aria-pressed')).toBe('true');
      });

      it('shows the plan read-only: nothing to add, edit or remove', () => {
        expect(addButton()).toBeUndefined();
        expect(menuTrigger('تعویض روغن')).toBeNull();
        expect(texts(region('برنامه PM')!.querySelectorAll('thead th'))).toEqual([
          'فعالیت',
          'دوره (روز)',
          'اولین موعد',
          'موعد بعدی',
        ]);
      });

      it('says why the plan cannot change', () => {
        expect(root.textContent).toContain('این تجهیز کنار گذاشته شده و برنامهٔ آن متوقف است.');
      });

      it('still shows its maintenance history', () => {
        expect(
          texts(region('سابقه PM')!.querySelectorAll('tbody tr')[0].querySelectorAll('td'))[0],
        ).toBe('تعویض روغن');
      });
    });
  });

  describe('the chosen equipment’s plan and history', () => {
    beforeEach(() => createPage());

    it('heads the plan «برنامه PM» and the history «سابقه PM»', async () => {
      await chooseEquipment();

      expect(texts(root.querySelectorAll('section h2'))).toEqual([BOARD, 'برنامه PM', 'سابقه PM']);
    });

    it('offers «افزودن فعالیت» in the «برنامه PM» sheet, not in the page header', async () => {
      await chooseEquipment();

      expect(addButton()).toBeDefined();
      expect(region('برنامه PM')?.contains(addButton()!)).toBe(true);
      expect(root.querySelector('app-page-header')?.contains(addButton()!)).toBe(false);
    });

    it('points an empty plan at «افزودن فعالیت»', async () => {
      await chooseEquipment({ ...DETAIL, planItems: [] });

      expect(root.textContent).toContain('هنوز فعالیتی در برنامهٔ این تجهیز نیست.');
      expect(root.textContent).toContain('با «افزودن فعالیت» اولین فعالیت را اضافه کنید.');
    });

    it('shows the plan items with their interval and Jalali due dates', async () => {
      await chooseEquipment();

      const plan = region('برنامه PM')!.querySelector('table')!;
      expect(texts(plan.querySelectorAll('thead th')).slice(0, 4)).toEqual([
        'فعالیت',
        'دوره (روز)',
        'اولین موعد',
        'موعد بعدی',
      ]);
      expect(
        texts(plan.querySelectorAll('tbody tr')[0].querySelectorAll('td')).slice(0, 4),
      ).toEqual(['تعویض روغن', '۳۰', '۱۴۰۵/۰۷/۰۱', '۱۴۰۵/۰۸/۰۱']);
    });

    it('shows the maintenance history, newest first, without its notes', async () => {
      await chooseEquipment();

      const history = region('سابقه PM')!.querySelector('table')!;
      expect(texts(history.querySelectorAll('thead th'))).toEqual([
        'فعالیت',
        'موعد',
        'انجام دهنده',
        'زمان انجام',
        'وضعیت',
        'عملیات',
      ]);
      const cells = texts(history.querySelectorAll('tbody tr')[0].querySelectorAll('td'));
      expect(cells.slice(0, 3)).toEqual(['تعویض روغن', '۱۴۰۵/۰۷/۰۱', 'مسلمی']);
      expect(cells[3]).toMatch(/^۱۴۰۵\/۰۷\/۰۱ [۰-۹]{2}:[۰-۹]{2}$/);
      expect(cells.slice(4)).toEqual(['بموقع', 'جزئیات']);
    });

    // A date pushed to the end edge under a header left on the start edge reads as the next column's.
    it('lines every value up under its own column header, in the plan and the history', async () => {
      await chooseEquipment();

      const plan = region('برنامه PM')!.querySelector('table')!;
      const history = region('سابقه PM')!.querySelector('table')!;
      expect(endAlignedColumns(plan)).toEqual({
        headers: [false, true, true, true, false],
        cells: [false, true, true, true, false],
      });
      expect(endAlignedColumns(history)).toEqual({
        headers: [false, true, false, true, false, false],
        cells: [false, true, false, true, false, false],
      });
    });

    it('opens a history row’s details from its «جزئیات», named by the activity and due date', async () => {
      await chooseEquipment();
      const open = vi
        .spyOn(TestBed.inject(MatDialog), 'open')
        .mockReturnValue({} as MatDialogRef<unknown>);

      root.querySelector<HTMLButtonElement>('[aria-label="جزئیات تعویض روغن ۱۴۰۵/۰۷/۰۱"]')?.click();

      expect(open).toHaveBeenCalledWith(PmExecutionDetailsDialog, {
        data: { equipmentName: 'اکسترودر 1', execution: { ...HISTORY[0], notes: '' } },
      });
    });

    /** Answers the re-reads a plan change starts: the plan and the board, never the history. */
    const answerReReads = async (detail: Detail, equipment: readonly object[]): Promise<void> => {
      tick();
      httpMock.expectOne({ method: 'GET', url: `/api/equipment/${detail.id}` }).flush(detail);
      httpMock.expectOne({ method: 'GET', url: '/api/equipment' }).flush(equipment);
      await fixture.whenStable();
    };

    it('opens the add dialog for the chosen equipment, then re-reads its plan and the board', async () => {
      await chooseEquipment();
      const open = stubDialog('e1');

      addButton()?.click();

      expect(open).toHaveBeenCalledWith(AddPmPlanItemDialog, {
        data: { equipment: { id: 'e1', name: 'اکسترودر 1' } },
      });
      await answerReReads(DETAIL, EQUIPMENT);
    });

    it('changes an item’s interval from its row menu’s «ویرایش», then re-reads', async () => {
      await chooseEquipment();
      const open = stubDialog(true);

      await chooseRowAction('تعویض روغن', 'ویرایش');

      expect(open).toHaveBeenCalledWith(ChangePmIntervalDialog, {
        data: { equipmentId: 'e1', item: ITEM },
        restoreFocus: menuTrigger('تعویض روغن'),
      });
      await answerReReads(DETAIL, EQUIPMENT);
    });

    it('removes an item from its row menu’s «حذف», behind a confirmation, then re-reads', async () => {
      await chooseEquipment();
      const open = stubDialog(true);

      await chooseRowAction('تعویض روغن', 'حذف');

      expect(open).toHaveBeenCalledWith(ConfirmRemovePmPlanItemDialog, {
        data: { equipment: { id: 'e1', name: 'اکسترودر 1' }, item: ITEM },
        restoreFocus: menuTrigger('تعویض روغن'),
      });
      await answerReReads({ ...DETAIL, planItems: [SECOND_ITEM] }, EQUIPMENT);
    });

    it('drops the card once its last item is removed, but keeps the plan and history in view', async () => {
      await chooseEquipment(SECOND_DETAIL);
      stubDialog(true);

      await chooseRowAction('بررسی تابلو برق', 'حذف');
      await answerReReads(
        { ...SECOND_DETAIL, planItems: [] },
        EQUIPMENT.map((equipment) =>
          equipment.id === 'e2' ? { ...equipment, activePlanItemCount: 0 } : equipment,
        ),
      );

      expect(cardIn(board(), 'اکسترودر 2')).toBeUndefined();
      expect(region('برنامه PM')?.textContent).toContain('هنوز فعالیتی در برنامهٔ این تجهیز نیست.');
      expect(
        texts(region('سابقه PM')!.querySelectorAll('tbody tr')[0].querySelectorAll('td'))[0],
      ).toBe('تعویض روغن');
    });

    it('does nothing more when a dialog is cancelled', async () => {
      await chooseEquipment();
      stubDialog(undefined);

      addButton()?.click();
      tick();

      httpMock.expectNone('/api/equipment');
      httpMock.expectNone('/api/equipment/e1');
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
  });
});
