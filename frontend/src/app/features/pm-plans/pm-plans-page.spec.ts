import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatAutocompleteHarness } from '@angular/material/autocomplete/testing';
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
  { id: 'e1', name: 'اکسترودر 1', retired: false },
  { id: 'e2', name: 'اکسترودر 2', retired: false },
  { id: 'e3', name: 'اکسترودر قدیمی', retired: true },
];

const ITEM = {
  id: 'p1',
  activityId: 'a1',
  activityName: 'تعویض روغن',
  intervalDays: 30,
  firstDueDate: '2026-09-23',
  nextDueDate: '2026-10-23',
};

const DETAIL = { id: 'e1', name: 'اکسترودر 1', retired: false, planItems: [ITEM] };

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

const texts = (elements: Iterable<Element>): string[] =>
  Array.from(elements).map((element) => element.textContent?.replace(/\s+/g, ' ').trim() ?? '');

describe('PmPlansPage', () => {
  let fixture: ComponentFixture<PmPlansPage>;
  let loader: HarnessLoader;
  let httpMock: HttpTestingController;
  let root: HTMLElement;
  const originalScrollIntoView = Element.prototype.scrollIntoView;

  beforeEach(async () => {
    Element.prototype.scrollIntoView = vi.fn();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    fixture = TestBed.createComponent(PmPlansPage);
    loader = TestbedHarnessEnvironment.documentRootLoader(fixture);
    httpMock = TestBed.inject(HttpTestingController);
    root = fixture.nativeElement as HTMLElement;
    TestBed.inject(ApplicationRef).tick();
    httpMock.expectOne({ method: 'GET', url: '/api/equipment' }).flush(EQUIPMENT);
    await fixture.whenStable();
  });

  afterEach(() => {
    Element.prototype.scrollIntoView = originalScrollIntoView;
    httpMock.verify();
  });

  /** Picks the equipment and answers the two reads its plan needs. */
  const chooseEquipment = async (name = 'اکسترودر 1', detail = DETAIL): Promise<void> => {
    const picker = await loader.getHarness(MatAutocompleteHarness);
    await picker.enterText(name);
    // Clicked directly rather than through the harness, which waits for stability — and the two
    // reads the choice starts stay pending until they are flushed below.
    Array.from(document.body.querySelectorAll<HTMLElement>('mat-option'))
      .find((option) => option.textContent?.trim() === name)
      ?.click();
    TestBed.inject(ApplicationRef).tick();
    httpMock.expectOne({ method: 'GET', url: `/api/equipment/${detail.id}` }).flush(detail);
    httpMock
      .expectOne({ method: 'GET', url: `/api/equipment/${detail.id}/maintenance-history` })
      .flush(HISTORY);
    await fixture.whenStable();
  };

  const stubDialog = (result: boolean) =>
    vi
      .spyOn(TestBed.inject(MatDialog), 'open')
      .mockReturnValue({ afterClosed: () => of(result) } as MatDialogRef<unknown, boolean>);

  const menuTrigger = (record: string) =>
    root.querySelector<HTMLButtonElement>(`[aria-label="عملیات بیشتر برای ${record}"]`);

  const chooseRowAction = async (record: string, action: string): Promise<void> => {
    menuTrigger(record)?.click();
    await fixture.whenStable();
    Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'))
      .find((item) => item.textContent?.trim() === action)
      ?.click();
  };

  const addButton = () =>
    Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'افزودن فعالیت به برنامه',
    );

  it('opens with «برنامه PM تجهیزات» as its heading', () => {
    expect(root.querySelector('h1')?.textContent?.trim()).toBe('برنامه PM تجهیزات');
  });

  it('picks the equipment in a picker labelled «تجهیز», a retired one marked as such', async () => {
    const picker = await loader.getHarness(MatAutocompleteHarness);
    await picker.focus();

    expect(root.querySelector('mat-label')?.textContent?.trim()).toBe('تجهیز');
    const options = await picker.getOptions();
    expect(await Promise.all(options.map((option) => option.getText()))).toEqual([
      'اکسترودر 1',
      'اکسترودر 2',
      'اکسترودر قدیمی (کنار گذاشته شده)',
    ]);
  });

  // Retiring stops a plan for good but keeps its history, which must stay reachable.
  describe('for retired equipment', () => {
    const RETIRED = { id: 'e3', name: 'اکسترودر قدیمی', retired: true, planItems: [ITEM] };

    beforeEach(async () => {
      await chooseEquipment('اکسترودر قدیمی (کنار گذاشته شده)', RETIRED);
    });

    it('shows the plan read-only: nothing to add, edit or remove', () => {
      expect(addButton()).toBeUndefined();
      expect(menuTrigger('تعویض روغن')).toBeNull();
      expect(texts(root.querySelectorAll('table')[0].querySelectorAll('thead th'))).toEqual([
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
      const history = root.querySelectorAll('table')[1];
      expect(texts(history.querySelectorAll('tbody tr')[0].querySelectorAll('td'))[0]).toBe(
        'تعویض روغن',
      );
    });
  });

  it('asks for equipment first, and offers no plan action until one is picked', () => {
    expect(root.textContent).toContain('برای دیدن برنامهٔ PM، یک تجهیز انتخاب کنید.');
    expect(addButton()).toBeUndefined();
  });

  it('shows the chosen equipment’s plan items with their interval and Jalali due dates', async () => {
    await chooseEquipment();

    const plan = root.querySelector('table')!;
    expect(texts(plan.querySelectorAll('thead th')).slice(0, 4)).toEqual([
      'فعالیت',
      'دوره (روز)',
      'اولین موعد',
      'موعد بعدی',
    ]);
    expect(texts(plan.querySelectorAll('tbody tr')[0].querySelectorAll('td')).slice(0, 4)).toEqual([
      'تعویض روغن',
      '۳۰',
      '۱۴۰۵/۰۷/۰۱',
      '۱۴۰۵/۰۸/۰۱',
    ]);
  });

  it('says so when the chosen equipment has no plan yet', async () => {
    await chooseEquipment('اکسترودر 1', { ...DETAIL, planItems: [] });

    expect(root.textContent).toContain('هنوز فعالیتی در برنامهٔ این تجهیز نیست.');
  });

  it('shows the equipment’s maintenance history, newest first, without its notes', async () => {
    await chooseEquipment();

    const history = root.querySelectorAll('table')[1];
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

    const [plan, history] = Array.from(root.querySelectorAll('table'));
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

  it('opens the add dialog for the chosen equipment, then re-reads its plan', async () => {
    await chooseEquipment();
    const open = stubDialog(true);

    addButton()?.click();
    TestBed.inject(ApplicationRef).tick();

    expect(open).toHaveBeenCalledWith(AddPmPlanItemDialog, {
      data: { equipment: { id: 'e1', name: 'اکسترودر 1' } },
    });
    httpMock.expectOne({ method: 'GET', url: '/api/equipment/e1' }).flush(DETAIL);
    await fixture.whenStable();
  });

  it('changes an item’s interval from its row menu’s «ویرایش»', async () => {
    await chooseEquipment();
    const open = stubDialog(true);

    await chooseRowAction('تعویض روغن', 'ویرایش');
    TestBed.inject(ApplicationRef).tick();

    expect(open).toHaveBeenCalledWith(ChangePmIntervalDialog, {
      data: { equipmentId: 'e1', item: ITEM },
      restoreFocus: menuTrigger('تعویض روغن'),
    });
    httpMock.expectOne({ method: 'GET', url: '/api/equipment/e1' }).flush(DETAIL);
    await fixture.whenStable();
  });

  it('removes an item from its row menu’s «حذف», behind a confirmation', async () => {
    await chooseEquipment();
    const open = stubDialog(true);

    await chooseRowAction('تعویض روغن', 'حذف');
    TestBed.inject(ApplicationRef).tick();

    expect(open).toHaveBeenCalledWith(ConfirmRemovePmPlanItemDialog, {
      data: { equipment: { id: 'e1', name: 'اکسترودر 1' }, item: ITEM },
      restoreFocus: menuTrigger('تعویض روغن'),
    });
    httpMock.expectOne({ method: 'GET', url: '/api/equipment/e1' }).flush({
      ...DETAIL,
      planItems: [],
    });
    await fixture.whenStable();
  });
});
