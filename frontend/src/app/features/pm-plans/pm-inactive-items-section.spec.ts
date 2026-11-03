import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  AppEquipmentDetail,
  AppInactivePmPlanItem,
} from '../../core/maintenance/equipment-gateway';
import { endAlignedColumns } from '../../ui/testing/end-aligned-columns';
import { PmInactiveItemsSection } from './pm-inactive-items-section';
import { region, squeeze, texts } from './testing/pm-plans-queries';

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

  const render = async (equipment: AppEquipmentDetail = ACTIVE): Promise<void> => {
    fixture = TestBed.createComponent(PmInactiveItemsSection);
    fixture.componentRef.setInput('equipment', equipment);
    root = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  };

  const sheet = () => region(root, HEADING);
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
      expect(sheet()!.querySelectorAll('button, a[href]')).toHaveLength(0);
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

  it('says so when no row has been deactivated, with no table', async () => {
    await render({ ...ACTIVE, inactivePlanItems: [] });

    expect(sheet()).toBeDefined();
    expect(sheet()!.querySelector('table')).toBeNull();
    expect(squeeze(sheet()!.textContent)).toContain(
      'هیچ فعالیتی در برنامهٔ این تجهیز غیرفعال نشده است.',
    );
  });

  it('lists a retired equipment’s deactivated rows too', async () => {
    await render({ ...ACTIVE, retired: true });

    expect(rows()).toHaveLength(2);
  });
});
