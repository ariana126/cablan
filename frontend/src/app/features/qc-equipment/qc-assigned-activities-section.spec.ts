import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { AppQcEquipment } from '../../core/qc/qc-equipment-gateway';
import { AddQcActivityDialog } from './add-qc-activity-dialog';
import { ConfirmUnassignQcActivityDialog } from './confirm-unassign-qc-activity-dialog';
import { QcAssignedActivitiesSection } from './qc-assigned-activities-section';

const EQUIPMENT: AppQcEquipment = {
  id: 'e1',
  name: 'اکسترودر 1',
  retired: false,
  activities: [
    { activityId: 'q1', activityName: 'بازرسی ابعادی', lastPerformedAt: '2026-09-23T05:30:00Z' },
    { activityId: 'q2', activityName: 'بازرسی ظاهری', lastPerformedAt: null },
  ],
};

async function render(equipment: AppQcEquipment = EQUIPMENT) {
  const fixture = TestBed.createComponent(QcAssignedActivitiesSection);
  fixture.componentRef.setInput('equipment', equipment);
  await fixture.whenStable();
  return { fixture, root: fixture.nativeElement as HTMLElement };
}

const rows = (root: HTMLElement) =>
  Array.from(root.querySelectorAll('tbody tr')).map((row) =>
    Array.from(row.querySelectorAll('td'))
      .slice(0, 2)
      .map((cell) => cell.textContent?.trim()),
  );

const button = (root: HTMLElement, name: string) =>
  Array.from(root.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.trim() === name,
  );

function stubDialog(result: boolean) {
  return vi
    .spyOn(TestBed.inject(MatDialog), 'open')
    .mockReturnValue({ afterClosed: () => of(result) } as MatDialogRef<unknown, boolean>);
}

describe('QcAssignedActivitiesSection', () => {
  it('lists the activities assigned with their last execution, in Tehran time or «بدون سابقه»', async () => {
    const { root } = await render();

    expect(root.querySelector('h2')?.textContent?.trim()).toBe('فعالیت‌های QC تجهیز');
    expect(rows(root)).toEqual([
      ['بازرسی ابعادی', '۱۴۰۵/۰۷/۰۱ ۰۹:۰۰'],
      ['بازرسی ظاهری', 'بدون سابقه'],
    ]);
  });

  it('adds an activity from the catalog’s unassigned ones and says the folder changed', async () => {
    const { fixture, root } = await render();
    const open = stubDialog(true);
    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);

    button(root, 'افزودن فعالیت')?.click();
    await fixture.whenStable();

    expect(open).toHaveBeenCalledWith(
      AddQcActivityDialog,
      expect.objectContaining({
        data: { equipment: { id: 'e1', name: 'اکسترودر 1' }, assignedActivityIds: ['q1', 'q2'] },
      }),
    );
    expect(changed).toHaveBeenCalled();
  });

  it('removes an assignment behind a confirmation, each button told apart by its activity', async () => {
    const { fixture, root } = await render();
    const open = stubDialog(true);
    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);

    const unassign = Array.from(root.querySelectorAll('button')).filter(
      (candidate) => candidate.textContent?.trim() === 'حذف تخصیص',
    );
    expect(unassign).toHaveLength(2);
    const describedBy = unassign[1].getAttribute('aria-describedby') ?? '';
    expect(root.querySelector(`#${describedBy}`)?.textContent?.trim()).toBe('بازرسی ظاهری');

    unassign[1].click();
    await fixture.whenStable();

    expect(open).toHaveBeenCalledWith(
      ConfirmUnassignQcActivityDialog,
      expect.objectContaining({
        data: { equipment: { id: 'e1', name: 'اکسترودر 1' }, activity: EQUIPMENT.activities[1] },
      }),
    );
    expect(changed).toHaveBeenCalled();
  });

  it('keeps a retired equipment’s activities read-only, and says so', async () => {
    const { root } = await render({ ...EQUIPMENT, retired: true });

    expect(rows(root)).toHaveLength(2);
    expect(button(root, 'افزودن فعالیت')).toBeUndefined();
    expect(button(root, 'حذف تخصیص')).toBeUndefined();
    expect(root.textContent).toContain(
      'این تجهیز کنار گذاشته شده است؛ فعالیت‌های QC آن فقط برای مشاهده است.',
    );
  });

  it('says so when nothing is assigned yet, «افزودن فعالیت» still offered', async () => {
    const { root } = await render({ ...EQUIPMENT, activities: [] });

    expect(root.textContent).toContain('هنوز هیچ فعالیت QC به این تجهیز تخصیص داده نشده است.');
    expect(button(root, 'افزودن فعالیت')).toBeDefined();
  });
});
