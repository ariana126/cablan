import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { QrCameraScanner } from '../../core/qc/qr-camera-scanner';
import { QcInspectionPage } from './qc-inspection-page';
import { QcRecordingDialog, QcRecordingDialogData } from './qc-recording-dialog';
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

  it('only shows each equipment’s activities: no checkbox, no notes, no «ثبت انجام» without a scan', async () => {
    const { root } = await loaded();

    expect(root.querySelector('input, textarea, mat-checkbox')).toBeNull();
    expect(
      Array.from(root.querySelectorAll('button')).map((each) => each.textContent?.trim()),
    ).not.toContain('ثبت انجام');
  });

  it('names every equipment’s section by its heading', async () => {
    const { root } = await loaded();

    const names = Array.from(root.querySelectorAll('section'))
      .map((section) => root.querySelector(`#${section.getAttribute('aria-labelledby')}`))
      .filter((heading) => heading?.tagName === 'H3')
      .map((heading) => heading?.textContent?.trim());
    expect(names).toEqual(['اکسترودر 1', 'اکسترودر 2']);
  });

  describe('after a scan', () => {
    /** The scan closes with `scanned`; the recording dialog after it closes with `recorded`. */
    function scanning(scanned: object | undefined, recorded: boolean | undefined) {
      const open = vi.spyOn(TestBed.inject(MatDialog), 'open').mockImplementation(
        (component) =>
          ({
            afterClosed: () => of(component === QcScanDialog ? scanned : recorded),
          }) as MatDialogRef<unknown, unknown>,
      );
      return open;
    }

    const recordingData = (open: ReturnType<typeof scanning>, call: number) =>
      open.mock.calls[call][1]?.data as QcRecordingDialogData;

    it('opens the recording dialog for the scanned equipment, focus to return to «اسکن QR تجهیز»', async () => {
      const { fixture, root } = await loaded();
      const open = scanning(EQUIPMENT[1], false);

      scanButton(root)?.click();
      await fixture.whenStable();

      expect(open.mock.calls.map(([component]) => component)).toEqual([
        QcScanDialog,
        QcRecordingDialog,
      ]);
      expect(recordingData(open, 1).equipment).toEqual(EQUIPMENT[1]);
      expect(open.mock.calls[1][1]).toEqual(
        expect.objectContaining({ restoreFocus: scanButton(root), disableClose: true }),
      );
    });

    it('re-reads the list once the recording dialog closes having sent something', async () => {
      const { fixture, httpMock, root } = await loaded();
      scanning(EQUIPMENT[0], true);

      scanButton(root)?.click();
      TestBed.inject(ApplicationRef).tick();

      httpMock.expectOne(LIST).flush(EQUIPMENT);
      await fixture.whenStable();
    });

    it('reads nothing again when nothing was sent', async () => {
      const { fixture, httpMock, root } = await loaded();
      scanning(EQUIPMENT[0], false);

      scanButton(root)?.click();
      await fixture.whenStable();

      httpMock.expectNone(LIST);
    });

    it('keeps each equipment’s checklist on the page, so scanning it again finds it as it was left', async () => {
      const { fixture, root } = await loaded();
      const scanThe = async (equipment: object) => {
        const open = scanning(equipment, false);
        scanButton(root)?.click();
        await fixture.whenStable();
        const { checklist } = recordingData(open, 1);
        open.mockRestore();
        return checklist;
      };

      const first = await scanThe(EQUIPMENT[0]);
      const other = await scanThe(EQUIPMENT[1]);
      const again = await scanThe(EQUIPMENT[0]);

      expect(again).toBe(first);
      expect(other).not.toBe(first);
    });

    it('opens nothing more when the scan is cancelled', async () => {
      const { fixture, httpMock, root } = await loaded();
      const open = scanning(undefined, undefined);

      scanButton(root)?.click();
      await fixture.whenStable();

      expect(open).toHaveBeenCalledTimes(1);
      httpMock.expectNone(LIST);
    });
  });

  describe('a scan through the camera', () => {
    const ID_1 = '550e8400-e29b-41d4-a716-446655440001';
    const ID_2 = '550e8400-e29b-41d4-a716-446655440002';
    const LIST_WITH_IDS = [
      { ...EQUIPMENT[0], id: ID_1 },
      { ...EQUIPMENT[1], id: ID_2 },
    ];

    /** A camera that decodes whatever the spec shows it. */
    class FakeCamera {
      private onText: ((text: string) => void) | undefined;

      start(_video: HTMLVideoElement, onText: (text: string) => void) {
        this.onText = onText;
        return Promise.resolve({ stop: () => undefined });
      }

      get started(): boolean {
        return this.onText !== undefined;
      }

      show(text: string): void {
        this.onText?.(text);
      }
    }

    afterEach(() =>
      document.body.querySelectorAll('.cdk-overlay-container').forEach((node) => node.remove()),
    );

    it('offers recording for the scanned equipment only', async () => {
      const camera = new FakeCamera();
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          { provide: QrCameraScanner, useValue: camera },
        ],
      });
      const fixture = TestBed.createComponent(QcInspectionPage);
      TestBed.inject(ApplicationRef).tick();
      const httpMock = TestBed.inject(HttpTestingController);
      httpMock.expectOne(LIST).flush(LIST_WITH_IDS);
      await fixture.whenStable();

      scanButton(fixture.nativeElement)?.click();
      await vi.waitFor(() => expect(camera.started).toBe(true));
      camera.show(`CABLAN-EQ:${ID_1}`);
      httpMock.expectOne(`/api/qc-inspections/${ID_1}`).flush(LIST_WITH_IDS[0]);

      const dialog = await vi.waitFor(() => {
        const found = Array.from(document.querySelectorAll('[role="dialog"]')).find(
          (each) => each.querySelector('h2')?.textContent?.trim() === 'اکسترودر 1',
        );
        expect(found?.querySelectorAll('input[type="checkbox"]').length).toBe(2);
        return found!;
      });
      const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
      expect(dialogs.map((each) => each.querySelector('h2')?.textContent?.trim())).toEqual([
        'اکسترودر 1',
      ]);
      expect(
        Array.from(dialog.querySelectorAll('label')).map((label) => label.textContent?.trim()),
      ).toEqual(['بازرسی ابعادی', 'بازرسی ظاهری']);
    });
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
