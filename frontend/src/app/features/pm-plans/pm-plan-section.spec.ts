import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEquipmentDetail, AppPmPlanItem } from '../../core/maintenance/equipment-gateway';
import { endAlignedColumns } from '../../ui/testing/end-aligned-columns';
import { AddPmPlanItemDialog } from './add-pm-plan-item-dialog';
import { ChangePmIntervalDialog } from './change-pm-interval-dialog';
import { ConfirmDeactivatePmPlanItemDialog } from './confirm-deactivate-pm-plan-item-dialog';
import { ConfirmDeletePmExecutionsDialog } from './confirm-delete-pm-executions-dialog';
import { PmPlanSection } from './pm-plan-section';
import { controlNamed, region, texts } from './testing/pm-plans-queries';

const ITEM: AppPmPlanItem = {
  id: 'p1',
  activityId: 'a1',
  activityName: 'تعویض روغن',
  activitySpecialty: 'mechanical',
  intervalDays: 30,
  firstDueDate: '2026-09-23',
  nextDueDate: '2026-10-23',
};

const SECOND_ITEM: AppPmPlanItem = {
  id: 'p2',
  activityId: 'a2',
  activityName: 'بررسی تابلو برق',
  activitySpecialty: 'electrical',
  intervalDays: 7,
  firstDueDate: '2026-09-23',
  nextDueDate: '2026-09-30',
};

const ACTIVE: AppEquipmentDetail = {
  id: 'e1',
  name: 'اکسترودر 1',
  retired: false,
  planItems: [ITEM, SECOND_ITEM],
  inactivePlanItems: [],
};

describe('PmPlanSection — «برنامه PM» in an equipment’s folder', () => {
  let fixture: ComponentFixture<PmPlanSection>;
  let root: HTMLElement;
  let changes: number;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  const render = async (
    equipment: AppEquipmentDetail = ACTIVE,
    canDelete = false,
  ): Promise<void> => {
    fixture = TestBed.createComponent(PmPlanSection);
    fixture.componentRef.setInput('equipment', equipment);
    fixture.componentRef.setInput('canDelete', canDelete);
    changes = 0;
    fixture.componentInstance.changed.subscribe(() => changes++);
    root = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  };

  const plan = () => region(root, 'برنامه PM');
  const group = (specialty: string) => region(plan()!, specialty);
  const addButton = () => (plan() ? controlNamed(plan()!, 'افزودن فعالیت') : undefined);
  const menuTrigger = (activity: string) =>
    root.querySelector<HTMLButtonElement>(`[aria-label="عملیات بیشتر برای ${activity}"]`);

  const stubDialog = (result: unknown) =>
    vi
      .spyOn(TestBed.inject(MatDialog), 'open')
      .mockReturnValue({ afterClosed: () => of(result) } as MatDialogRef<unknown, unknown>);

  const chooseRowAction = async (activity: string, action: string): Promise<void> => {
    menuTrigger(activity)?.click();
    await fixture.whenStable();
    Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'))
      .find((item) => item.textContent?.trim() === action)
      ?.click();
  };

  describe('for active equipment', () => {
    beforeEach(() => render());

    it('is a region named «برنامه PM», counting its items', () => {
      expect(plan()?.textContent).toContain('۲ نتیجه');
    });

    it('offers «افزودن فعالیت» in its own title bar', () => {
      expect(addButton()?.tagName).toBe('BUTTON');
    });

    it('groups the plan by specialty, «برق» before «مکانیک», each group its own table', () => {
      expect(texts(plan()!.querySelectorAll('h3'))).toEqual(['برق', 'مکانیک']);
      expect(texts(group('برق')!.querySelectorAll('tbody td.mat-column-activity'))).toEqual([
        'بررسی تابلو برق',
      ]);
      expect(texts(group('مکانیک')!.querySelectorAll('tbody td.mat-column-activity'))).toEqual([
        'تعویض روغن',
      ]);
    });

    it('heads activities without a specialty «تخصص تعیین نشده», after the other two', async () => {
      await render({
        ...ACTIVE,
        planItems: [{ ...ITEM, activitySpecialty: null }, SECOND_ITEM],
      });

      expect(texts(plan()!.querySelectorAll('h3'))).toEqual(['برق', 'تخصص تعیین نشده']);
    });

    it('shows each item with its interval and Jalali due dates', () => {
      const table = group('مکانیک')!.querySelector('table')!;
      expect(texts(table.querySelectorAll('thead th'))).toEqual([
        'فعالیت',
        'دوره (روز)',
        'اولین موعد',
        'موعد بعدی',
        'عملیات',
      ]);
      expect(
        texts(table.querySelectorAll('tbody tr')[0].querySelectorAll('td')).slice(0, 4),
      ).toEqual(['تعویض روغن', '۳۰', '۱۴۰۵/۰۷/۰۱', '۱۴۰۵/۰۸/۰۱']);
    });

    // A date pushed to the end edge under a header left on the start edge reads as the next column's.
    it('lines every value up under its own column header', () => {
      expect(endAlignedColumns(plan()!.querySelector('table')!)).toEqual({
        headers: [false, true, true, true, false],
        cells: [false, true, true, true, false],
      });
    });

    it('opens the add dialog for this equipment, and reports the change', () => {
      const open = stubDialog(true);

      addButton()!.click();

      expect(open).toHaveBeenCalledWith(AddPmPlanItemDialog, {
        data: { equipment: { id: 'e1', name: 'اکسترودر 1' } },
      });
      expect(changes).toBe(1);
    });

    it('changes an item’s interval from its row menu’s «ویرایش», and reports the change', async () => {
      const open = stubDialog(true);

      await chooseRowAction('تعویض روغن', 'ویرایش');

      expect(open).toHaveBeenCalledWith(ChangePmIntervalDialog, {
        data: { equipmentId: 'e1', item: ITEM },
        restoreFocus: menuTrigger('تعویض روغن'),
      });
      expect(changes).toBe(1);
    });

    it('deactivates an item from its row menu’s «غیرفعال‌سازی», behind a confirmation', async () => {
      const open = stubDialog(true);

      await chooseRowAction('تعویض روغن', 'غیرفعال\u200cسازی');

      expect(open).toHaveBeenCalledWith(ConfirmDeactivatePmPlanItemDialog, {
        data: { equipment: { id: 'e1', name: 'اکسترودر 1' }, item: ITEM },
        restoreFocus: menuTrigger('تعویض روغن'),
      });
      expect(changes).toBe(1);
    });

    // The row — and its menu button, where focus would go back — leaves the plan with it.
    // The dialog answers later, as a real one does — after the menu has closed and settled focus.
    const deactivateAndAnswer = async (answer: boolean): Promise<void> => {
      const closed = new Subject<boolean>();
      vi.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({
        afterClosed: () => closed,
      } as unknown as MatDialogRef<unknown, unknown>);
      await chooseRowAction('تعویض روغن', 'غیرفعال‌سازی');
      // The closing menu hands focus back to its trigger before any dialog could be answered.
      await vi.waitFor(() => expect(document.body.querySelector('[role="menu"]')).toBeNull());
      await fixture.whenStable();
      closed.next(answer);
      closed.complete();
    };

    it('hands focus to «افزودن فعالیت» once an item is deactivated', async () => {
      await deactivateAndAnswer(true);

      expect(document.activeElement).toBe(addButton());
    });

    it('leaves focus to the dialog when a deactivation is cancelled', async () => {
      await deactivateAndAnswer(false);

      expect(document.activeElement).not.toBe(addButton());
    });

    // Only the System Admin deletes anything from a plan (issue #110); for everyone else a row only
    // leaves it by deactivation (issue #91).
    it('offers only «ویرایش» and «غیرفعال‌سازی» in a row menu — no deletion', async () => {
      menuTrigger('تعویض روغن')?.click();
      await fixture.whenStable();

      expect(texts(document.body.querySelectorAll('[role="menuitem"]'))).toEqual([
        'ویرایش',
        'غیرفعال\u200cسازی',
      ]);
    });

    it('reports nothing when a dialog is cancelled', () => {
      stubDialog(undefined);

      addButton()!.click();

      expect(changes).toBe(0);
    });
  });

  describe("the System Admin's deletion of a row's executions (issue #110)", () => {
    it('adds «حذف همه سوابق» to each row menu', async () => {
      await render(ACTIVE, true);
      menuTrigger('تعویض روغن')?.click();
      await fixture.whenStable();

      expect(texts(document.body.querySelectorAll('[role="menuitem"]'))).toEqual([
        'ویرایش',
        'غیرفعال\u200cسازی',
        'حذف همه سوابق',
      ]);
    });

    it('deletes them behind a confirmation naming the row, and reports the deletion', async () => {
      await render(ACTIVE, true);
      let deletions = 0;
      fixture.componentInstance.executionsDeleted.subscribe(() => deletions++);
      const open = stubDialog(true);

      await chooseRowAction('تعویض روغن', 'حذف همه سوابق');

      expect(open).toHaveBeenCalledWith(ConfirmDeletePmExecutionsDialog, {
        data: { equipmentId: 'e1', item: ITEM },
        restoreFocus: menuTrigger('تعویض روغن'),
      });
      expect(deletions).toBe(1);
    });

    it('offers it on a retired equipment’s plan too — and nothing else', async () => {
      await render({ ...ACTIVE, retired: true }, true);
      menuTrigger('تعویض روغن')?.click();
      await fixture.whenStable();

      expect(addButton()).toBeUndefined();
      expect(texts(document.body.querySelectorAll('[role="menuitem"]'))).toEqual(['حذف همه سوابق']);
    });
  });

  it('points an empty plan at «افزودن فعالیت»', async () => {
    await render({ ...ACTIVE, planItems: [] });

    expect(addButton()).toBeDefined();
    expect(plan()?.querySelector('table')).toBeNull();
    expect(plan()?.textContent).toContain('هنوز فعالیتی در برنامهٔ این تجهیز نیست.');
    expect(plan()?.textContent).toContain('با «افزودن فعالیت» اولین فعالیت را اضافه کنید.');
  });

  // Retiring stopped the plan for good: it is kept to be read, not changed.
  describe('for retired equipment', () => {
    beforeEach(() => render({ ...ACTIVE, retired: true }));

    it('offers nothing to add, edit or remove', () => {
      expect(addButton()).toBeUndefined();
      expect(menuTrigger('تعویض روغن')).toBeNull();
      expect(texts(plan()!.querySelector('table')!.querySelectorAll('thead th'))).toEqual([
        'فعالیت',
        'دوره (روز)',
        'اولین موعد',
        'موعد بعدی',
      ]);
    });

    it('says the plan has stopped and is only there to be read', () => {
      expect(plan()?.textContent).toContain(
        'این تجهیز کنار گذاشته شده و برنامهٔ آن متوقف است؛ فقط برای مشاهده است.',
      );
    });
  });
});
