import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of, Subject } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppQcEquipment } from '../../core/qc/qc-equipment-gateway';
import { QcChecklist } from './qc-checklist';
import { QcRecordingDialog, QcRecordingDialogData } from './qc-recording-dialog';
import {
  QcSubmissionDialog,
  QcSubmissionDialogData,
  QcSubmissionOutcome,
} from './qc-submission-dialog';

const EQUIPMENT: AppQcEquipment = {
  id: 'e1',
  name: 'اکسترودر 1',
  retired: false,
  activities: [
    { activityId: 'q1', activityName: 'بازرسی ابعادی', lastPerformedAt: null },
    { activityId: 'q2', activityName: 'بازرسی ظاهری', lastPerformedAt: null },
  ],
};

const INSPECTION = { method: 'GET', url: '/api/qc-inspections/e1' };

const RECORDED: QcSubmissionOutcome = {
  sent: true,
  recorded: ['q1'],
  settled: true,
  trackingNumber: 'TR-100',
};

/** Sent, but no answer came: the submission is still pending. */
const UNANSWERED: QcSubmissionOutcome = {
  sent: true,
  recorded: [],
  settled: false,
  trackingNumber: 'TR-100',
};

/**
 * The recording dialog for `EQUIPMENT` on `checklist`; each submission dialog it opens closes with
 * the next of `outcomes`.
 */
function render(checklist = new QcChecklist(), ...outcomes: (QcSubmissionOutcome | undefined)[]) {
  const close = vi.fn();
  const keydown = new Subject<KeyboardEvent>();
  const backdrop = new Subject<MouseEvent>();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: MAT_DIALOG_DATA,
        useValue: { equipment: EQUIPMENT, checklist } satisfies QcRecordingDialogData,
      },
      {
        provide: MatDialogRef,
        useValue: { close, keydownEvents: () => keydown, backdropClick: () => backdrop },
      },
    ],
  });
  const queue = outcomes.length ? outcomes : [undefined];
  const open = vi.spyOn(TestBed.inject(MatDialog), 'open').mockImplementation(() => {
    const outcome = queue.length > 1 ? queue.shift() : queue[0];
    return { afterClosed: () => of(outcome) } as MatDialogRef<unknown, unknown>;
  });
  const fixture = TestBed.createComponent(QcRecordingDialog);
  return {
    fixture,
    close,
    open,
    keydown,
    backdrop,
    checklist,
    httpMock: TestBed.inject(HttpTestingController),
    root: fixture.nativeElement as HTMLElement,
  };
}

type Context = ReturnType<typeof render>;

const buttonNamed = (root: HTMLElement, name: string) =>
  Array.from(root.querySelectorAll('button')).find((button) => button.textContent?.trim() === name);

function checkbox(root: HTMLElement, activity: string): HTMLInputElement | null {
  const label = Array.from(root.querySelectorAll('label')).find(
    (candidate) => candidate.textContent?.trim() === activity,
  );
  const id = label?.getAttribute('for');
  return id ? root.querySelector<HTMLInputElement>(`#${id}`) : null;
}

async function tickAndRecord({ fixture, root }: Context, activity: string) {
  checkbox(root, activity)?.click();
  await fixture.whenStable();
  buttonNamed(root, 'ثبت انجام')?.click();
  TestBed.inject(ApplicationRef).tick();
}

const submissionOf = (open: Context['open'], call: number) =>
  (open.mock.calls[call][1] as { data: QcSubmissionDialogData }).data.submission;

describe('QcRecordingDialog', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('is titled exactly by the equipment’s name, with no close button in its head', async () => {
    const { fixture, root } = render();
    await fixture.whenStable();

    expect(root.querySelector('h2')?.textContent?.trim()).toBe('اکسترودر 1');
    expect(root.querySelector('app-dialog-head button')).toBeNull();
  });

  it('offers that equipment’s activities as checkboxes, with «ثبت انجام»', async () => {
    const { fixture, root } = render();
    await fixture.whenStable();

    expect(checkbox(root, 'بازرسی ابعادی')?.type).toBe('checkbox');
    expect(checkbox(root, 'بازرسی ظاهری')?.type).toBe('checkbox');
    expect(buttonNamed(root, 'ثبت انجام')).toBeDefined();
  });

  it('is left by «پایان» alone — nothing in it is named «بستن»', async () => {
    const { fixture, root } = render();
    await fixture.whenStable();

    const names = Array.from(root.querySelectorAll('button')).map(
      (button) => button.getAttribute('aria-label') ?? button.textContent?.trim(),
    );
    expect(names).toContain('پایان');
    expect(names).not.toContain('بستن');
  });

  it('closes with `false` when nothing was sent', async () => {
    const { fixture, root, close } = render();
    await fixture.whenStable();

    buttonNamed(root, 'پایان')?.click();

    expect(close).toHaveBeenCalledWith(false);
  });

  it('closes with `false` on Escape and a click outside too', async () => {
    const { fixture, close, keydown, backdrop } = render();
    await fixture.whenStable();

    keydown.next(new KeyboardEvent('keydown', { key: 'Escape' }));
    backdrop.next(new MouseEvent('click'));

    expect(close.mock.calls).toEqual([[false], [false]]);
  });

  it('opens the submission on the ticked activities, stacked over it', async () => {
    const context = render();
    await context.fixture.whenStable();

    await tickAndRecord(context, 'بازرسی ظاهری');

    expect(context.open).toHaveBeenCalledWith(
      QcSubmissionDialog,
      expect.objectContaining({
        disableClose: true,
        data: expect.objectContaining({
          equipment: { id: 'e1', name: 'اکسترودر 1' },
          activities: [{ activityId: 'q2', activityName: 'بازرسی ظاهری', notes: '' }],
        }),
      }),
    );
  });

  it('once something was sent, re-reads the equipment’s last executions and closes with `true`', async () => {
    const context = render(new QcChecklist(), RECORDED);
    await context.fixture.whenStable();

    await tickAndRecord(context, 'بازرسی ابعادی');
    context.httpMock.expectOne(INSPECTION).flush({
      ...EQUIPMENT,
      activities: [
        { ...EQUIPMENT.activities[0], lastPerformedAt: '2026-09-23T06:30:00Z' },
        EQUIPMENT.activities[1],
      ],
    });
    await context.fixture.whenStable();

    expect(context.root.textContent).toContain('۱۴۰۵/۰۷/۰۱ ۱۰:۰۰');
    buttonNamed(context.root, 'پایان')?.click();
    expect(context.close).toHaveBeenCalledWith(true);
  });

  it('resumes an unanswered submission, same id and tracking number, when reopened on the same checklist', async () => {
    const checklist = new QcChecklist();
    const first = render(checklist, UNANSWERED);
    await first.fixture.whenStable();
    await tickAndRecord(first, 'بازرسی ابعادی');
    first.httpMock.expectOne(INSPECTION).flush(EQUIPMENT);
    await first.fixture.whenStable();
    buttonNamed(first.root, 'پایان')?.click();
    const sent = submissionOf(first.open, 0);
    first.fixture.destroy();
    TestBed.resetTestingModule();

    const again = render(checklist);
    await again.fixture.whenStable();
    expect(checkbox(again.root, 'بازرسی ابعادی')?.checked).toBe(true);
    buttonNamed(again.root, 'ثبت انجام')?.click();
    await again.fixture.whenStable();

    expect(submissionOf(again.open, 0)).toEqual({
      submissionId: sent.submissionId,
      trackingNumber: 'TR-100',
    });
  });
});
