import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AppEquipmentDetail,
  AppInactivePmPlanItem,
} from '../../core/maintenance/equipment-gateway';
import { endAlignedColumns } from '../../ui/testing/end-aligned-columns';
import { ConfirmDeletePmExecutionsDialog } from './confirm-delete-pm-executions-dialog';
import { ConfirmDeletePmPlanItemDialog } from './confirm-delete-pm-plan-item-dialog';
import { PmInactiveItemsSection } from './pm-inactive-items-section';
import { accessibleName, region, squeeze, texts } from './testing/pm-plans-queries';

const HEADING = 'فعالیت‌های غیرفعال';

const OIL_CHANGE: AppInactivePmPlanItem = {
  id: 'p1',
  activityId: 'a1',
  activityName: 'تعویض روغن',
  activitySpecialty: 'mechanical',
  intervalDays: 30,
  firstDueDate: '2026-09-23',
  // 10:00 in Tehran.
  deactivatedAt: '2026-10-02T06:30:00.000Z',
};

const PANEL_CHECK: AppInactivePmPlanItem = {
  id: 'p2',
  activityId: 'a2',
  activityName: 'بررسی تابلو برق',
  activitySpecialty: 'mechanical',
  intervalDays: 7,
  firstDueDate: '2026-09-30',
  // 00:30 the next day in Tehran, while UTC is still on the 2nd.
  deactivatedAt: '2026-10-02T21:00:00.000Z',
};

const ACTIVE: AppEquipmentDetail = {
  id: 'e1',
  name: 'اکسترودر 1',
  retired: false,
  planItems: [],
  inactivePlanItems: [OIL_CHANGE, PANEL_CHECK],
};

describe('PmInactiveItemsSection — «فعالیت‌های غیرفعال» in an equipment’s folder', () => {
  let fixture: ComponentFixture<PmInactiveItemsSection>;
  let root: HTMLElement;

  /** The section opens collapsed (issue #112); most cases look at it opened by its toggle. */
  const render = async (
    equipment: AppEquipmentDetail = ACTIVE,
    canDelete = false,
    expanded = true,
  ): Promise<void> => {
    fixture = TestBed.createComponent(PmInactiveItemsSection);
    fixture.componentRef.setInput('equipment', equipment);
    fixture.componentRef.setInput('canDelete', canDelete);
    root = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    if (expanded) {
      toggle()?.click();
      await fixture.whenStable();
    }
  };

  const sheet = () => region(root, HEADING);
  const toggle = () => root.querySelector<HTMLButtonElement>('button[aria-expanded]');
  const rows = () => Array.from(sheet()!.querySelectorAll('tbody tr.mat-mdc-row'));

  describe('with deactivated rows', () => {
    beforeEach(() => render());

    it('is a region named «فعالیت‌های غیرفعال»', () => {
      expect(sheet()).toBeDefined();
    });

    it('lists them under «فعالیت», «دوره (روز)», «اولین موعد» and «زمان غیرفعال شدن»', () => {
      expect(texts(sheet()!.querySelectorAll('thead th'))).toEqual([
        'فعالیت',
        'دوره (روز)',
        'اولین موعد',
        'زمان غیرفعال شدن',
      ]);
    });

    it('shows each in the API’s order, its first due date in Jalali and when it was deactivated in Tehran time', () => {
      expect(rows().map((row) => texts(row.querySelectorAll('td')))).toEqual([
        ['تعویض روغن', '۳۰', '۱۴۰۵/۰۷/۰۱', '۱۴۰۵/۰۷/۱۰ ۱۰:۰۰'],
        ['بررسی تابلو برق', '۷', '۱۴۰۵/۰۷/۰۸', '۱۴۰۵/۰۷/۱۱ ۰۰:۳۰'],
      ]);
    });

    // A date pushed to the end edge under a header left on the start edge reads as the next column's.
    it('lines every value up under its own column header', () => {
      expect(endAlignedColumns(sheet()!.querySelector('table')!)).toEqual({
        headers: [false, true, true, true],
        cells: [false, true, true, true],
      });
    });

    // A deactivated row is final: it cannot be reactivated, re-scheduled or executed again.
    it('offers nothing to do with them', () => {
      expect(sheet()!.querySelectorAll('table button, table a[href]')).toHaveLength(0);
    });
  });

  describe('collapsed as it opens (issue #112)', () => {
    beforeEach(() => render(ACTIVE, false, false));

    it('keeps its heading and says how many rows it holds', () => {
      expect(sheet()).toBeDefined();
      expect(squeeze(sheet()!.textContent)).toContain('۲ نتیجه');
    });

    it('draws no table until opened, its toggle saying so', () => {
      expect(sheet()!.querySelector('table')).toBeNull();
      expect(toggle()?.getAttribute('aria-expanded')).toBe('false');
      expect(squeeze(toggle()?.textContent)).toBe('نمایش');
    });

    it('opens and closes again from the same toggle', async () => {
      toggle()!.click();
      await fixture.whenStable();

      expect(toggle()?.getAttribute('aria-expanded')).toBe('true');
      expect(squeeze(toggle()?.textContent)).toBe('پنهان کردن');
      const content = root.querySelector(`#${toggle()!.getAttribute('aria-controls')}`);
      expect(content?.querySelectorAll('tbody tr.mat-mdc-row')).toHaveLength(2);

      toggle()!.click();
      await fixture.whenStable();
      expect(sheet()!.querySelector('table')).toBeNull();
    });
  });

  it('groups them by specialty, «برق» before «مکانیک», each group its own table with every column', async () => {
    await render({
      ...ACTIVE,
      inactivePlanItems: [OIL_CHANGE, { ...PANEL_CHECK, activitySpecialty: 'electrical' }],
    });

    expect(texts(sheet()!.querySelectorAll('h3'))).toEqual(['برق', 'مکانیک']);
    const groupRows = (specialty: string) =>
      Array.from(region(sheet()!, specialty)!.querySelectorAll('tbody tr.mat-mdc-row')).map((row) =>
        texts(row.querySelectorAll('td')),
      );
    expect(groupRows('برق')).toEqual([['بررسی تابلو برق', '۷', '۱۴۰۵/۰۷/۰۸', '۱۴۰۵/۰۷/۱۱ ۰۰:۳۰']]);
    expect(groupRows('مکانیک')).toEqual([['تعویض روغن', '۳۰', '۱۴۰۵/۰۷/۰۱', '۱۴۰۵/۰۷/۱۰ ۱۰:۰۰']]);
  });

  it('says so when no row has been deactivated, with no table and nothing to open', async () => {
    await render({ ...ACTIVE, inactivePlanItems: [] }, false, false);

    expect(sheet()).toBeDefined();
    expect(sheet()!.querySelector('table')).toBeNull();
    expect(toggle()).toBeNull();
    expect(squeeze(sheet()!.textContent)).toContain(
      'هیچ فعالیتی در برنامهٔ این تجهیز غیرفعال نشده است.',
    );
  });

  it('lists a retired equipment’s deactivated rows too', async () => {
    await render({ ...ACTIVE, retired: true });

    expect(rows()).toHaveLength(2);
  });

  describe("the System Admin's deletions (issue #110)", () => {
    let changes: number;

    beforeEach(async () => {
      await render(ACTIVE, true);
      changes = 0;
      fixture.componentInstance.changed.subscribe(() => changes++);
    });

    /** A row's button by its exact accessible name. */
    const buttonOf = (row: Element, name: string) =>
      Array.from(row.querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => accessibleName(button) === name,
      );

    const stubDialog = (result: unknown) =>
      vi
        .spyOn(TestBed.inject(MatDialog), 'open')
        .mockReturnValue({ afterClosed: () => of(result) } as MatDialogRef<unknown, unknown>);

    it('offers «حذف همه سوابق» and «حذف ردیف» on each row, described by its activity and interval', () => {
      const [row] = rows();
      for (const name of ['حذف همه سوابق', 'حذف ردیف']) {
        const button = buttonOf(row, name)!;
        const description = (button.getAttribute('aria-describedby') ?? '')
          .split(' ')
          .map((id) => squeeze(root.querySelector(`#${id}`)?.textContent))
          .join(' ');
        expect(description).toBe('تعویض روغن ۳۰');
      }
    });

    it('deletes the row behind a confirmation, and reports the change', () => {
      const open = stubDialog(true);

      buttonOf(rows()[0], 'حذف ردیف')!.click();

      expect(open).toHaveBeenCalledWith(ConfirmDeletePmPlanItemDialog, {
        data: { equipmentId: 'e1', item: OIL_CHANGE },
      });
      expect(changes).toBe(1);
    });

    it('deletes the row’s executions behind a confirmation, and reports the change', () => {
      const open = stubDialog(true);

      buttonOf(rows()[1], 'حذف همه سوابق')!.click();

      expect(open).toHaveBeenCalledWith(ConfirmDeletePmExecutionsDialog, {
        data: { equipmentId: 'e1', item: PANEL_CHECK },
      });
      expect(changes).toBe(1);
    });

    it('reports nothing when a deletion is not confirmed', () => {
      stubDialog(false);

      buttonOf(rows()[0], 'حذف ردیف')!.click();

      expect(changes).toBe(0);
    });
  });
});
