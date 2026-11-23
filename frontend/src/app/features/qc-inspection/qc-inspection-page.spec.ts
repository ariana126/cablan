import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { QcInspectionPage } from './qc-inspection-page';
import { QcScanDialog } from './qc-scan-dialog';
import { QcSubmissionDialog } from './qc-submission-dialog';

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

  it('makes every equipment a checklist: a region named by it, a checkbox per activity', async () => {
    const { root } = await loaded();

    const sections = Array.from(root.querySelectorAll('app-qc-equipment-checklist section'));
    expect(
      sections.map((section) =>
        root.querySelector(`#${section.getAttribute('aria-labelledby')}`)?.textContent?.trim(),
      ),
    ).toEqual(['اکسترودر 1', 'اکسترودر 2']);
    expect(sections[0].querySelectorAll('input[type="checkbox"]')).toHaveLength(2);
    expect(
      Array.from(sections[0].querySelectorAll('button')).map((each) => each.textContent?.trim()),
    ).toEqual(['ثبت انجام']);
  });

  it('re-reads the list once a checklist has sent something', async () => {
    const { fixture, httpMock, root } = await loaded();
    vi.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({
      afterClosed: () => of({ sent: true, recorded: ['q2'] }),
    } as MatDialogRef<unknown, unknown>);
    const section = root.querySelector('app-qc-equipment-checklist section')!;
    section.querySelector<HTMLInputElement>('input[type="checkbox"]')?.click();
    await fixture.whenStable();

    Array.from(section.querySelectorAll('button'))
      .find((each) => each.textContent?.trim() === 'ثبت انجام')
      ?.click();
    TestBed.inject(ApplicationRef).tick();

    httpMock.expectOne(LIST).flush(EQUIPMENT);
    await fixture.whenStable();
  });

  it('after a scan, re-reads the list and puts focus on the scanned equipment’s checklist', async () => {
    const { fixture, httpMock, root } = await loaded();
    const open = vi
      .spyOn(TestBed.inject(MatDialog), 'open')
      .mockReturnValue({ afterClosed: () => of(EQUIPMENT[1]) } as MatDialogRef<unknown, unknown>);

    scanButton(root)?.click();
    TestBed.inject(ApplicationRef).tick();
    httpMock.expectOne(LIST).flush(EQUIPMENT);
    await fixture.whenStable();

    expect(open.mock.calls.map(([component]) => component)).toEqual([QcScanDialog]);
    expect(open.mock.calls).not.toContainEqual([QcSubmissionDialog, expect.anything()]);
    const scanned = root.querySelectorAll('app-qc-equipment-checklist section')[1];
    expect(document.activeElement).toBe(scanned.querySelector('input[type="checkbox"]'));
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

  // Issue #130: the home page's «اسکن QR تجهیز» shortcut lands here with `?scan=true`.
  describe('arriving with ?scan=true', () => {
    function arrive(scan: string | undefined) {
      TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
      });
      const open = vi
        .spyOn(TestBed.inject(MatDialog), 'open')
        .mockReturnValue({ afterClosed: () => of(undefined) } as MatDialogRef<unknown, unknown>);
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      const fixture = TestBed.createComponent(QcInspectionPage);
      if (scan !== undefined) {
        fixture.componentRef.setInput('scan', scan);
      }
      TestBed.inject(ApplicationRef).tick();
      TestBed.inject(HttpTestingController).expectOne(LIST).flush(EQUIPMENT);
      return { fixture, open, navigate };
    }

    it('starts the scan at once, as «اسکن QR تجهیز» does', async () => {
      const { fixture, open } = arrive('true');
      await fixture.whenStable();

      expect(open.mock.calls.map(([component]) => component)).toEqual([QcScanDialog]);
    });

    it('drops the parameter, so a reload or back does not start it again', async () => {
      const { fixture, navigate } = arrive('true');
      await fixture.whenStable();

      expect(navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          queryParams: { scan: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        }),
      );
    });

    it('starts it once, however often the page re-renders', async () => {
      const { fixture, open } = arrive('true');
      await fixture.whenStable();
      TestBed.inject(ApplicationRef).tick();
      await fixture.whenStable();

      expect(open).toHaveBeenCalledTimes(1);
    });

    it('starts nothing without it', async () => {
      const { fixture, open, navigate } = arrive(undefined);
      await fixture.whenStable();

      expect(open).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    });
  });
});
