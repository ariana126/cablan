import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConfirmDeleteQcActivityDialog } from './confirm-delete-qc-activity-dialog';
import { QcActivitiesPage } from './qc-activities-page';
import { QcActivityFormDialog } from './qc-activity-form-dialog';

const LIST = { method: 'GET', url: '/api/qc-activities' };
const ACTIVITIES = [
  { id: 'q1', name: 'آزمون کشش', assignedEquipmentCount: 0 },
  { id: 'q2', name: 'بازرسی ابعادی', assignedEquipmentCount: 12 },
];

async function loaded(
  list: object = ACTIVITIES,
  status: { status: number; statusText: string } = { status: 200, statusText: 'OK' },
) {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  const fixture = TestBed.createComponent(QcActivitiesPage);
  TestBed.inject(ApplicationRef).tick();
  const httpMock = TestBed.inject(HttpTestingController);
  httpMock.expectOne(LIST).flush(list, status);
  await fixture.whenStable();
  return { fixture, httpMock, root: fixture.nativeElement as HTMLElement };
}

const button = (root: HTMLElement, name: string) =>
  Array.from(root.querySelectorAll('button')).find(
    (candidate) => (candidate.getAttribute('aria-label') ?? candidate.textContent?.trim()) === name,
  );

function stubDialog(result: boolean) {
  return vi
    .spyOn(TestBed.inject(MatDialog), 'open')
    .mockReturnValue({ afterClosed: () => of(result) } as MatDialogRef<unknown, boolean>);
}

describe('QcActivitiesPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('is headed «فعالیت‌های QC», with «تعریف فعالیت QC» as its action', async () => {
    const { root } = await loaded();

    expect(root.querySelector('h1')?.textContent?.trim()).toBe('فعالیت‌های QC');
    expect(button(root, 'تعریف فعالیت QC')).toBeDefined();
  });

  it('lists each activity with how many equipment it is assigned to, in Persian digits', async () => {
    const { root } = await loaded();

    const rows = Array.from(root.querySelectorAll('tr[mat-row]')).map((row) =>
      Array.from(row.querySelectorAll('td'))
        .slice(0, 2)
        .map((cell) => cell.textContent?.trim()),
    );
    expect(rows).toEqual([
      ['آزمون کشش', '۰'],
      ['بازرسی ابعادی', '۱۲'],
    ]);
  });

  it('says so when no activity is defined yet', async () => {
    const { root } = await loaded([]);

    expect(root.textContent).toContain('هنوز هیچ فعالیت QC تعریف نشده است.');
    expect(root.querySelector('table')).toBeNull();
  });

  it('narrows the list by the name search', async () => {
    const { fixture, root } = await loaded();

    const search = root.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'کشش';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(
      Array.from(root.querySelectorAll('td.mat-column-name')).map((cell) =>
        cell.textContent?.trim(),
      ),
    ).toEqual(['آزمون کشش']);
  });

  it('opens the define dialog and re-reads the list once an activity was defined', async () => {
    const { fixture, root, httpMock } = await loaded();
    const open = stubDialog(true);

    button(root, 'تعریف فعالیت QC')?.click();
    TestBed.inject(ApplicationRef).tick();

    expect(open).toHaveBeenCalledWith(QcActivityFormDialog, { data: { mode: 'create' } });
    httpMock.expectOne(LIST).flush(ACTIVITIES);
    await fixture.whenStable();
  });

  it('opens the edit dialog on the row’s activity', async () => {
    const { fixture, root, httpMock } = await loaded();
    const open = stubDialog(false);

    button(root, 'ویرایش بازرسی ابعادی')?.click();
    await fixture.whenStable();

    expect(open).toHaveBeenCalledWith(
      QcActivityFormDialog,
      expect.objectContaining({ data: { mode: 'edit', activity: ACTIVITIES[1] } }),
    );
    httpMock.expectNone(LIST);
  });

  it('confirms a delete in its own dialog and re-reads the list once deleted', async () => {
    const { fixture, root, httpMock } = await loaded();
    const open = stubDialog(true);

    button(root, 'حذف آزمون کشش')?.click();
    TestBed.inject(ApplicationRef).tick();

    expect(open).toHaveBeenCalledWith(
      ConfirmDeleteQcActivityDialog,
      expect.objectContaining({ data: { activity: ACTIVITIES[0] } }),
    );
    httpMock.expectOne(LIST).flush(ACTIVITIES.slice(1));
    await fixture.whenStable();
  });

  it('says the visitor may not see the page when the API refuses them', async () => {
    const { root } = await loaded({ title: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'شما دسترسی لازم برای مشاهده این بخش را ندارید.',
    );
    expect(button(root, 'تعریف فعالیت QC')).toBeUndefined();
  });
});
