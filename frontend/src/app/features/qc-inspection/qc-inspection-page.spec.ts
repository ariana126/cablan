import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { QcInspectionPage } from './qc-inspection-page';
import { QcRecordDialog } from './qc-record-dialog';
import { QcScanDialog } from './qc-scan-dialog';

const LIST = { method: 'GET', url: '/api/qc-inspections' };
const EQUIPMENT = [
  {
    id: 'e1',
    name: 'اکسترودر 1',
    retired: false,
    activities: [
      { activityId: 'q1', activityName: 'بازرسی ابعادی', lastPerformedAt: '2026-09-23T06:30:00Z' },
      { activityId: 'q2', activityName: 'بازرسی ظاهری', lastPerformedAt: null },
    ],
  },
  {
    id: 'e2',
    name: 'اکسترودر 2',
    retired: false,
    activities: [{ activityId: 'q1', activityName: 'بازرسی ابعادی', lastPerformedAt: null }],
  },
];

function render() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  const fixture = TestBed.createComponent(QcInspectionPage);
  TestBed.inject(ApplicationRef).tick();
  return {
    fixture,
    httpMock: TestBed.inject(HttpTestingController),
    root: fixture.nativeElement as HTMLElement,
  };
}

async function loaded(list: object = EQUIPMENT) {
  const context = render();
  context.httpMock.expectOne(LIST).flush(list);
  await context.fixture.whenStable();
  return context;
}

/** The table following the heading that names `equipment`: its headers and its rows' cells. */
function tableOf(root: HTMLElement, equipment: string) {
  const heading = Array.from(root.querySelectorAll('h2, h3, h4')).find(
    (candidate) => candidate.textContent?.trim() === equipment,
  );
  const table = heading?.closest('section')?.querySelector('table');
  return {
    headers: Array.from(table?.querySelectorAll('thead th') ?? []).map((cell) =>
      cell.textContent?.trim(),
    ),
    rows: Array.from(table?.querySelectorAll('tbody tr') ?? []).map((row) =>
      Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim()),
    ),
  };
}

const scanButton = (root: HTMLElement) =>
  Array.from(root.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === 'اسکن QR تجهیز',
  );

describe('QcInspectionPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('is headed «بازرسی حین تولید», with «اسکن QR تجهیز» its action', async () => {
    const { root } = await loaded();

    expect(root.querySelector('h1')?.textContent?.trim()).toBe('بازرسی حین تولید');
    expect(scanButton(root)).toBeDefined();
  });

  it('shows a progress bar until the list is in, and none after', async () => {
    const { fixture, httpMock, root } = render();
    TestBed.inject(ApplicationRef).tick();
    expect(root.querySelector('[role="progressbar"]')).not.toBeNull();

    httpMock.expectOne(LIST).flush(EQUIPMENT);
    await fixture.whenStable();
    expect(root.querySelector('[role="progressbar"]')).toBeNull();
  });

  it('lists each equipment under its own heading: activity and last execution, or «بدون سابقه»', async () => {
    const { root } = await loaded();

    expect(tableOf(root, 'اکسترودر 1')).toEqual({
      headers: ['فعالیت', 'آخرین انجام'],
      rows: [
        ['بازرسی ابعادی', '۱۴۰۵/۰۷/۰۱ ۱۰:۰۰'],
        ['بازرسی ظاهری', 'بدون سابقه'],
      ],
    });
    expect(tableOf(root, 'اکسترودر 2').rows).toEqual([['بازرسی ابعادی', 'بدون سابقه']]);
  });

  it('says so when no equipment has an activity to inspect', async () => {
    const { root } = await loaded([]);

    expect(root.textContent).toContain('هیچ تجهیز فعالی فعالیت QC تخصیص‌یافته ندارد.');
  });

  it('opens the recording dialog on the scanned equipment, then re-reads the list', async () => {
    const { fixture, httpMock, root } = await loaded();
    const open = vi.spyOn(TestBed.inject(MatDialog), 'open').mockImplementation(
      (component: unknown) =>
        ({
          afterClosed: () => of(component === QcScanDialog ? EQUIPMENT[0] : undefined),
        }) as MatDialogRef<unknown, unknown>,
    );

    scanButton(root)?.click();
    TestBed.inject(ApplicationRef).tick();

    expect(open.mock.calls.map(([component]) => component)).toEqual([QcScanDialog, QcRecordDialog]);
    expect(open.mock.calls[1][1]).toEqual(
      expect.objectContaining({ data: { equipment: EQUIPMENT[0] } }),
    );
    httpMock.expectOne(LIST).flush(EQUIPMENT);
    await fixture.whenStable();
  });

  it('opens nothing more when the scan is cancelled', async () => {
    const { fixture, httpMock, root } = await loaded();
    const open = vi
      .spyOn(TestBed.inject(MatDialog), 'open')
      .mockReturnValue({ afterClosed: () => of(undefined) } as MatDialogRef<unknown, unknown>);

    scanButton(root)?.click();
    await fixture.whenStable();

    expect(open).toHaveBeenCalledTimes(1);
    httpMock.expectNone(LIST);
  });
});
