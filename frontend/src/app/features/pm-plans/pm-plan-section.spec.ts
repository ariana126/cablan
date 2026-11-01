import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEquipmentDetail } from '../../core/maintenance/equipment-gateway';
import { endAlignedColumns } from '../../ui/testing/end-aligned-columns';
import { AddPmPlanItemDialog } from './add-pm-plan-item-dialog';
import { ChangePmIntervalDialog } from './change-pm-interval-dialog';
import { ConfirmRemovePmPlanItemDialog } from './confirm-remove-pm-plan-item-dialog';
import { PmPlanSection } from './pm-plan-section';
import { controlNamed, region, texts } from './testing/pm-plans-queries';

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

const ACTIVE: AppEquipmentDetail = {
  id: 'e1',
  name: 'اکسترودر 1',
  retired: false,
  planItems: [ITEM, SECOND_ITEM],
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

  const render = async (equipment: AppEquipmentDetail = ACTIVE): Promise<void> => {
    fixture = TestBed.createComponent(PmPlanSection);
    fixture.componentRef.setInput('equipment', equipment);
    changes = 0;
    fixture.componentInstance.changed.subscribe(() => changes++);
    root = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  };

  const plan = () => region(root, 'برنامه PM');
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

    it('shows each item with its interval and Jalali due dates', () => {
      const table = plan()!.querySelector('table')!;
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

    it('removes an item from its row menu’s «حذف», behind a confirmation', async () => {
      const open = stubDialog(true);

      await chooseRowAction('تعویض روغن', 'حذف');

      expect(open).toHaveBeenCalledWith(ConfirmRemovePmPlanItemDialog, {
        data: { equipment: { id: 'e1', name: 'اکسترودر 1' }, item: ITEM },
        restoreFocus: menuTrigger('تعویض روغن'),
      });
      expect(changes).toBe(1);
    });

    it('reports nothing when a dialog is cancelled', () => {
      stubDialog(undefined);

      addButton()!.click();

      expect(changes).toBe(0);
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
      expect(texts(plan()!.querySelectorAll('thead th'))).toEqual([
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
