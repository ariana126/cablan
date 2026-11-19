import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
import {
  AppPmPlanImport,
  AppPmPlanImportConflict,
  AppPmPlanImportError,
  AppPmPlanImportItem,
} from '../../core/maintenance/pm-plan-import-gateway';
import { PmPlanImportDialog, PmPlanImportDialogData } from './pm-plan-import-dialog';
import { accessibleName, region, squeeze, texts } from './testing/pm-plans-queries';

const OIL_CHANGE: AppPmPlanImportItem = {
  cell: 'C3',
  equipmentId: 'e1',
  equipmentName: 'کمپرسور هوا',
  activityId: 'a1',
  activityName: 'تعویض روغن',
  intervalDays: 30,
  firstDueDate: '2026-11-21',
};

const PANEL_CHECK: AppPmPlanImportItem = {
  cell: 'D3',
  equipmentId: 'e1',
  equipmentName: 'کمپرسور هوا',
  activityId: 'a2',
  activityName: 'بررسی تابلو برق',
  intervalDays: 7,
  firstDueDate: '2026-11-21',
};

const CONFLICT: AppPmPlanImportConflict = {
  cell: 'C4',
  equipmentId: 'e2',
  equipmentName: 'اکسترودر 1',
  activityId: 'a1',
  activityName: 'تعویض روغن',
  intervalDays: 30,
  firstDueDate: '2026-11-21',
  existingIntervalDays: 15,
  existingFirstDueDate: '2026-09-23',
  differences: ['intervalDays', 'firstDueDate'],
};

const UNKNOWN_ACTIVITY: AppPmPlanImportError = {
  sheet: 'pm',
  cell: 'D1',
  row: 1,
  column: 'D',
  value: 'روغن کاری',
  reason: 'activity-not-found',
  message: 'فعالیت تعریف نشده است',
};

const EMPTY_DATE: AppPmPlanImportError = {
  sheet: 'pm',
  cell: 'B3',
  row: 3,
  column: 'B',
  value: '',
  reason: 'first-due-date-required',
  message: 'اولین موعد خالی است',
};

function report(parts: Partial<AppPmPlanImport> = {}): AppPmPlanImport {
  const errors = parts.errors ?? [];
  const toCreate = parts.toCreate ?? [OIL_CHANGE];
  const alreadyExisting = parts.alreadyExisting ?? [];
  const conflicts = parts.conflicts ?? [];
  return {
    sheetName: 'pm',
    counts: {
      toCreate: toCreate.length,
      alreadyExisting: alreadyExisting.length,
      conflicts: conflicts.length,
      errors: errors.length,
    },
    errors,
    toCreate,
    alreadyExisting,
    conflicts,
  };
}

const FILE = new File(['xlsx'], 'pm.xlsx');

describe('PmPlanImportDialog', () => {
  let httpMock: HttpTestingController;

  afterEach(() => {
    httpMock.verify();
  });

  async function setUp(checked: AppPmPlanImport) {
    const dialogRef = { close: vi.fn(), disableClose: false };
    const data: PmPlanImportDialogData = { file: FILE, report: checked };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(PmPlanImportDialog);
    await fixture.whenStable();
    return { fixture, dialogRef, root: fixture.nativeElement as HTMLElement };
  }

  const button = (root: HTMLElement, name: string) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (candidate) => accessibleName(candidate) === name,
    );

  const headersOf = (scope: Element | undefined) =>
    texts(scope?.querySelectorAll('thead th') ?? []);

  const rowsOf = (scope: Element | undefined) =>
    Array.from(scope?.querySelectorAll('tbody tr') ?? []).map((row) =>
      texts(row.querySelectorAll('td')),
    );

  describe('the check', () => {
    it('is titled «بارگذاری برنامه PM از اکسل»', async () => {
      const { root } = await setUp(report());

      expect(squeeze(root.querySelector('h2')?.textContent)).toBe('بارگذاری برنامه PM از اکسل');
    });

    it('says how many plan rows the file can add', async () => {
      const { root } = await setUp(report({ toCreate: [OIL_CHANGE, PANEL_CHECK] }));

      expect(squeeze(root.textContent)).toContain('۲ برنامه قابل ثبت است');
    });

    it('lists the plan rows it would add, dates in Jalali', async () => {
      const { root } = await setUp(report({ toCreate: [OIL_CHANGE] }));
      const section = region(root, 'برنامه‌های قابل ثبت');

      expect(headersOf(section)).toEqual(['تجهیز', 'فعالیت', 'دوره (روز)', 'اولین موعد']);
      expect(rowsOf(section)).toEqual([['کمپرسور هوا', 'تعویض روغن', '۳۰', '۱۴۰۵/۰۸/۳۰']]);
    });

    it('lists every error with its sheet, cell, row, column, value and reason', async () => {
      const { root } = await setUp(report({ errors: [UNKNOWN_ACTIVITY, EMPTY_DATE] }));
      const section = region(root, 'خطاها');

      expect(headersOf(section)).toEqual(['شیت', 'خانه', 'ردیف', 'ستون', 'مقدار', 'علت']);
      expect(rowsOf(section)).toEqual([
        ['pm', 'D1', '1', 'D', 'روغن کاری', 'فعالیت تعریف نشده است'],
        ['pm', 'B3', '3', 'B', '—', 'اولین موعد خالی است'],
      ]);
    });

    it('draws no errors section for a file without errors', async () => {
      const { root } = await setUp(report());

      expect(region(root, 'خطاها')).toBeUndefined();
    });

    it('lists what is already in force under «از قبل موجود»', async () => {
      const { root } = await setUp(report({ alreadyExisting: [PANEL_CHECK] }));
      const section = region(root, 'از قبل موجود');

      expect(headersOf(section)).toEqual(['تجهیز', 'فعالیت', 'دوره (روز)', 'اولین موعد']);
      expect(rowsOf(section)).toEqual([['کمپرسور هوا', 'بررسی تابلو برق', '۷', '۱۴۰۵/۰۸/۳۰']]);
    });

    it('lists what differs from an active row, the file’s values beside the current ones', async () => {
      const { root } = await setUp(report({ conflicts: [CONFLICT] }));
      const section = region(root, 'اختلاف با برنامه موجود');

      expect(headersOf(section)).toEqual([
        'تجهیز',
        'فعالیت',
        'اختلاف',
        'دوره در فایل (روز)',
        'دوره فعلی (روز)',
        'اولین موعد در فایل',
        'اولین موعد فعلی',
      ]);
      expect(rowsOf(section)).toEqual([
        ['اکسترودر 1', 'تعویض روغن', 'دوره و اولین موعد', '۳۰', '۱۵', '۱۴۰۵/۰۸/۳۰', '۱۴۰۵/۰۷/۰۱'],
      ]);
    });

    it('draws neither «از قبل موجود» nor the differences when there are none', async () => {
      const { root } = await setUp(report());

      expect(region(root, 'از قبل موجود')).toBeUndefined();
      expect(region(root, 'اختلاف با برنامه موجود')).toBeUndefined();
    });

    it('offers «تایید» and «انصراف», and no «بستن» yet', async () => {
      const { root } = await setUp(report());

      expect(button(root, 'تایید')?.disabled).toBe(false);
      expect(button(root, 'انصراف')).toBeDefined();
      expect(button(root, 'بستن')).toBeUndefined();
    });

    it('cannot be confirmed while the file has errors, and says why', async () => {
      const { root } = await setUp(report({ errors: [UNKNOWN_ACTIVITY] }));

      expect(button(root, 'تایید')?.disabled).toBe(true);
      expect(squeeze(root.querySelector('.dialog-notice')?.textContent)).toContain(
        'تا وقتی فایل خطا دارد هیچ برنامه‌ای ثبت نمی‌شود',
      );
    });

    it('cannot be confirmed when the file adds nothing', async () => {
      const { root } = await setUp(report({ toCreate: [], alreadyExisting: [PANEL_CHECK] }));

      expect(button(root, 'تایید')?.disabled).toBe(true);
    });

    it('closes on «انصراف» having added nothing', async () => {
      const { root, dialogRef } = await setUp(report());

      button(root, 'انصراف')?.click();

      expect(dialogRef.close).toHaveBeenCalledWith(false);
    });
  });

  describe('confirming', () => {
    it('sends the same file again to the import', async () => {
      const { fixture, root } = await setUp(report());

      button(root, 'تایید')?.click();
      const request = httpMock.expectOne({ method: 'POST', url: '/api/pm-plan-imports' });
      expect((request.request.body as FormData).get('file')).toBe(FILE);
      request.flush(report(), { status: 201, statusText: 'Created' });
      await fixture.whenStable();
    });

    it('shows what was added, and «بستن» in place of «تایید» and «انصراف»', async () => {
      const { fixture, root } = await setUp(report({ toCreate: [OIL_CHANGE, PANEL_CHECK] }));

      button(root, 'تایید')?.click();
      httpMock
        .expectOne({ method: 'POST', url: '/api/pm-plan-imports' })
        .flush(report({ toCreate: [OIL_CHANGE, PANEL_CHECK], alreadyExisting: [] }), {
          status: 201,
          statusText: 'Created',
        });
      await fixture.whenStable();

      expect(squeeze(root.textContent)).toContain('۲ برنامه ثبت شد.');
      expect(squeeze(root.textContent)).not.toContain('قابل ثبت است');
      expect(rowsOf(region(root, 'برنامه‌های ثبت شده'))).toHaveLength(2);
      expect(button(root, 'تایید')).toBeUndefined();
      expect(button(root, 'انصراف')).toBeUndefined();
      expect(button(root, 'بستن')).toBeDefined();
    });

    it('closes on «بستن» saying the plans changed', async () => {
      const { fixture, root, dialogRef } = await setUp(report());

      button(root, 'تایید')?.click();
      httpMock
        .expectOne({ method: 'POST', url: '/api/pm-plan-imports' })
        .flush(report(), { status: 201, statusText: 'Created' });
      await fixture.whenStable();
      button(root, 'بستن')?.click();

      expect(dialogRef.close).toHaveBeenCalledWith(true);
    });

    it('keeps the result open until «بستن», so the board is refreshed on every way out', async () => {
      const { fixture, root, dialogRef } = await setUp(report());

      button(root, 'تایید')?.click();
      httpMock
        .expectOne({ method: 'POST', url: '/api/pm-plan-imports' })
        .flush(report(), { status: 201, statusText: 'Created' });
      await fixture.whenStable();

      expect(dialogRef.disableClose).toBe(true);
    });

    it('shows the errors the import found, and cannot be confirmed again', async () => {
      const { fixture, root, dialogRef } = await setUp(report());

      button(root, 'تایید')?.click();
      httpMock.expectOne({ method: 'POST', url: '/api/pm-plan-imports' }).flush(
        {
          type: PROBLEM.pmPlanImportHasErrors,
          status: 400,
          errors: [UNKNOWN_ACTIVITY],
        },
        { status: 400, statusText: 'Bad Request' },
      );
      await fixture.whenStable();

      expect(squeeze(root.querySelector('[role="alert"]')?.textContent)).toContain(
        'فایل برنامه PM خطا دارد و هیچ برنامه‌ای ثبت نشد.',
      );
      expect(rowsOf(region(root, 'خطاها'))).toEqual([
        ['pm', 'D1', '1', 'D', 'روغن کاری', 'فعالیت تعریف نشده است'],
      ]);
      expect(button(root, 'تایید')?.disabled).toBe(true);
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it('says any other refusal in its alert and stays open to try again', async () => {
      const { fixture, root, dialogRef } = await setUp(report());

      button(root, 'تایید')?.click();
      httpMock
        .expectOne({ method: 'POST', url: '/api/pm-plan-imports' })
        .flush(null, { status: 403, statusText: 'Forbidden' });
      await fixture.whenStable();

      expect(squeeze(root.querySelector('[role="alert"]')?.textContent)).toContain(
        'شما اجازهٔ انجام این عملیات را ندارید.',
      );
      expect(button(root, 'تایید')?.disabled).toBe(false);
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it('cannot be confirmed twice while the import is under way', async () => {
      const { fixture, root } = await setUp(report());

      button(root, 'تایید')?.click();
      // A request in flight holds `whenStable()`; render without waiting for it.
      TestBed.inject(ApplicationRef).tick();

      expect(button(root, 'تایید')?.disabled).toBe(true);
      httpMock
        .expectOne({ method: 'POST', url: '/api/pm-plan-imports' })
        .flush(report(), { status: 201, statusText: 'Created' });
      await fixture.whenStable();
    });
  });
});
