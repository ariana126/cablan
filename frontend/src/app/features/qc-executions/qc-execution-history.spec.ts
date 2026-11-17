import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { provideJalaliDateAdapter } from '../../core/material/jalali-date-adapter';
import { QcExecutionDetailsDialog } from './qc-execution-details-dialog';
import { QcExecutionHistory } from './qc-execution-history';
import { EXECUTION } from './testing/qc-execution';

const FIRST = {
  ...EXECUTION,
  id: 'x1',
  performedAt: '2026-09-23T05:30:00.000Z',
  trackingNumber: 'TR-100',
  notes: null,
  previousPerformedAt: null,
  intervalMinutes: null,
};

const HISTORY = {
  executions: [EXECUTION, FIRST],
  counts: [
    {
      equipmentId: 'e1',
      equipmentName: 'اکسترودر 1',
      activityId: 'q1',
      activityName: 'بازرسی ابعادی',
      count: 2,
    },
  ],
};

const OPTIONS = {
  equipment: [
    { id: 'e1', name: 'اکسترودر 1', retired: false },
    { id: 'e2', name: 'اکسترودر 2', retired: true },
  ],
  activities: [
    { id: 'q1', name: 'بازرسی ابعادی' },
    { id: 'q2', name: 'بازرسی ظاهری' },
  ],
  performers: [{ id: 'u1', name: 'نیکروش' }],
};

const isHistory = (request: { url: string }) => request.url === '/api/qc-executions';

async function render(inputs: { equipmentId: string | null; canDelete?: boolean }) {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideJalaliDateAdapter()],
  });
  const fixture = TestBed.createComponent(QcExecutionHistory);
  fixture.componentRef.setInput('equipmentId', inputs.equipmentId);
  fixture.componentRef.setInput('heading', 'سوابق انجام فعالیت‌ها');
  fixture.componentRef.setInput('canDelete', inputs.canDelete ?? false);
  TestBed.inject(ApplicationRef).tick();
  const httpMock = TestBed.inject(HttpTestingController);
  httpMock.expectOne({ method: 'GET', url: '/api/qc-executions/filter-options' }).flush(OPTIONS);
  const first = httpMock.expectOne(isHistory);
  return { fixture, httpMock, root: fixture.nativeElement as HTMLElement, first };
}

async function loaded(inputs: { equipmentId: string | null; canDelete?: boolean }) {
  const context = await render(inputs);
  context.first.flush(HISTORY);
  await context.fixture.whenStable();
  return context;
}

/** The rows of the table whose header row holds `header`, each as its cells' text. */
function tableRows(root: HTMLElement, header: string): string[][] {
  const table = Array.from(root.querySelectorAll('table')).find((candidate) =>
    Array.from(candidate.querySelectorAll('th')).some(
      (cell) => cell.textContent?.trim() === header,
    ),
  );
  return Array.from(table?.querySelectorAll('tbody tr') ?? []).map((row) =>
    Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim() ?? ''),
  );
}

const headers = (root: HTMLElement, header: string): string[] => {
  const table = Array.from(root.querySelectorAll('table')).find((candidate) =>
    Array.from(candidate.querySelectorAll('th')).some(
      (cell) => cell.textContent?.trim() === header,
    ),
  );
  return Array.from(table?.querySelectorAll('th') ?? []).map(
    (cell) => cell.textContent?.trim() ?? '',
  );
};

async function choose(
  fixture: { whenStable(): Promise<unknown> },
  root: HTMLElement,
  label: string,
  option: string,
) {
  const field = Array.from(root.querySelectorAll('mat-form-field')).find(
    (candidate) => candidate.querySelector('mat-label')?.textContent?.trim() === label,
  );
  field?.querySelector<HTMLElement>('.mat-mdc-select-trigger')?.click();
  await fixture.whenStable();
  const options = Array.from(document.body.querySelectorAll<HTMLElement>('mat-option'));
  const texts = options.map((candidate) => candidate.textContent?.trim());
  options.find((candidate) => candidate.textContent?.trim() === option)?.click();
  // The pick starts a request, which holds stability until the test flushes it.
  TestBed.inject(ApplicationRef).tick();
  return texts;
}

describe('QcExecutionHistory', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  describe('in an equipment’s folder', () => {
    it('reads that equipment’s records only', async () => {
      const { first } = await render({ equipmentId: 'e1' });

      expect(first.request.params.get('equipmentId')).toBe('e1');
      expect(first.request.params.keys()).toEqual(['equipmentId']);
      first.flush(HISTORY);
    });

    it('lists each record: activity, who recorded it, when in Tehran, and the interval', async () => {
      const { root } = await loaded({ equipmentId: 'e1' });

      expect(headers(root, 'ثبت کننده')).toEqual([
        'فعالیت',
        'ثبت کننده',
        'زمان انجام',
        'فاصله از انجام قبلی',
        'عملیات',
      ]);
      expect(tableRows(root, 'ثبت کننده').map((row) => row.slice(0, 4))).toEqual([
        ['بازرسی ابعادی', 'نیکروش', '۱۴۰۵/۰۷/۰۲ ۱۲:۲۰', '۱ روز و ۳ ساعت و ۲۰ دقیقه'],
        ['بازرسی ابعادی', 'نیکروش', '۱۴۰۵/۰۷/۰۱ ۰۹:۰۰', 'بدون سابقه قبلی'],
      ]);
    });

    it('counts the records per activity, without an equipment column or filter', async () => {
      const { root } = await loaded({ equipmentId: 'e1' });

      expect(headers(root, 'تعداد')).toEqual(['فعالیت', 'تعداد']);
      expect(tableRows(root, 'تعداد')).toEqual([['بازرسی ابعادی', '۲']]);
      const labels = Array.from(root.querySelectorAll('mat-label')).map((label) =>
        label.textContent?.trim(),
      );
      expect(labels).not.toContain('تجهیز');
      expect(labels).toEqual(expect.arrayContaining(['فعالیت', 'ثبت کننده', 'شماره ردیابی']));
    });

    it('asks again for the activity chosen', async () => {
      const { fixture, root, httpMock } = await loaded({ equipmentId: 'e1' });

      expect(await choose(fixture, root, 'فعالیت', 'بازرسی ظاهری')).toEqual([
        'همه',
        'بازرسی ابعادی',
        'بازرسی ظاهری',
      ]);
      const request = httpMock.expectOne(isHistory);
      expect(request.request.params.get('activityId')).toBe('q2');
      expect(request.request.params.get('equipmentId')).toBe('e1');
      request.flush({ executions: [], counts: [] });
      await fixture.whenStable();

      expect(root.textContent).toContain('سابقه‌ای با این فیلترها یافت نشد.');
    });

    it('asks again for the tracking number typed, once typing pauses', async () => {
      const { root, httpMock } = await loaded({ equipmentId: 'e1' });

      const field = Array.from(root.querySelectorAll('mat-form-field')).find(
        (candidate) => candidate.querySelector('mat-label')?.textContent?.trim() === 'شماره ردیابی',
      );
      const input = field!.querySelector('input')!;
      input.value = 'TR-10';
      input.dispatchEvent(new Event('input'));

      const request: TestRequest = await vi.waitFor(() => {
        TestBed.inject(ApplicationRef).tick();
        return httpMock.expectOne(isHistory);
      });
      expect(request.request.params.get('trackingNumber')).toBe('TR-10');
      request.flush(HISTORY);
    });

    it('says when the equipment has no record yet', async () => {
      const { fixture, root, first } = await render({ equipmentId: 'e1' });
      first.flush({ executions: [], counts: [] });
      await fixture.whenStable();

      expect(root.textContent).toContain('هنوز سابقه‌ای ثبت نشده است.');
      expect(root.querySelector('table')).toBeNull();
    });
  });

  describe('in the plant-wide report', () => {
    it('reads every record, and names the equipment in the rows and the counts', async () => {
      const { root, first, fixture } = await render({ equipmentId: null });
      expect(first.request.params.keys()).toEqual([]);
      first.flush(HISTORY);
      await fixture.whenStable();

      expect(headers(root, 'ثبت کننده')[0]).toBe('تجهیز');
      expect(tableRows(root, 'تعداد')).toEqual([['اکسترودر 1', 'بازرسی ابعادی', '۲']]);
    });

    it('filters by equipment, retired equipment marked', async () => {
      const { fixture, root, httpMock } = await loaded({ equipmentId: null });

      expect(await choose(fixture, root, 'تجهیز', 'اکسترودر 2 (کنار گذاشته شده)')).toEqual([
        'همه',
        'اکسترودر 1',
        'اکسترودر 2 (کنار گذاشته شده)',
      ]);
      const request = httpMock.expectOne(isHistory);
      expect(request.request.params.get('equipmentId')).toBe('e2');
      request.flush(HISTORY);
    });
  });

  it('re-reads the filter options with the records when asked to reload', async () => {
    const { fixture, httpMock } = await loaded({ equipmentId: 'e1' });

    fixture.componentInstance.reload();
    TestBed.inject(ApplicationRef).tick();

    httpMock.expectOne(isHistory).flush(HISTORY);
    httpMock.expectOne({ method: 'GET', url: '/api/qc-executions/filter-options' }).flush(OPTIONS);
    await fixture.whenStable();
  });

  describe('a row’s details', () => {
    function stubDetails(outcome: 'deleted' | undefined) {
      return vi
        .spyOn(TestBed.inject(MatDialog), 'open')
        .mockReturnValue({ afterClosed: () => of(outcome) } as MatDialogRef<unknown, unknown>);
    }

    const detailsButton = (root: HTMLElement) =>
      Array.from(root.querySelectorAll('button')).find(
        (button) => button.getAttribute('aria-label') === 'جزئیات بازرسی ابعادی ۱۴۰۵/۰۷/۰۲ ۱۲:۲۰',
      );

    it('opens the record in full, with the deletion offered as the page allows', async () => {
      const { fixture, root } = await loaded({ equipmentId: 'e1', canDelete: true });
      const open = stubDetails(undefined);

      detailsButton(root)?.click();
      await fixture.whenStable();

      expect(open).toHaveBeenCalledWith(QcExecutionDetailsDialog, {
        data: { execution: EXECUTION, canDelete: true },
      });
    });

    it('re-reads the records and says so after a deletion', async () => {
      const { fixture, root, httpMock } = await loaded({ equipmentId: 'e1', canDelete: true });
      stubDetails('deleted');
      const changed = vi.fn();
      fixture.componentInstance.changed.subscribe(changed);

      detailsButton(root)?.click();
      TestBed.inject(ApplicationRef).tick();

      httpMock.expectOne(isHistory).flush({ ...HISTORY, executions: [FIRST] });
      // A deleted record can take the last of a recorder or an activity with it.
      httpMock
        .expectOne({ method: 'GET', url: '/api/qc-executions/filter-options' })
        .flush(OPTIONS);
      await fixture.whenStable();
      expect(changed).toHaveBeenCalled();
      expect(tableRows(root, 'ثبت کننده')).toHaveLength(1);
    });
  });
});
