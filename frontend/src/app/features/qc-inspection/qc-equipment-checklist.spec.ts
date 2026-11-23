import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { AppQcEquipment } from '../../core/qc/qc-equipment-gateway';
import { QcEquipmentChecklist } from './qc-equipment-checklist';
import { QcSubmissionDialog, QcSubmissionOutcome } from './qc-submission-dialog';

const EQUIPMENT: AppQcEquipment = {
  id: 'e1',
  name: 'اکسترودر 1',
  retired: false,
  activities: [
    { activityId: 'q1', activityName: 'بازرسی ابعادی', lastPerformedAt: '2026-09-23T06:30:00Z' },
    { activityId: 'q2', activityName: 'بازرسی ظاهری', lastPerformedAt: null },
    { activityId: 'q3', activityName: 'بازرسی رنگ', lastPerformedAt: null },
  ],
};

async function render(outcome: Observable<QcSubmissionOutcome | undefined> = of(undefined)) {
  TestBed.configureTestingModule({});
  const open = vi
    .spyOn(TestBed.inject(MatDialog), 'open')
    .mockReturnValue({ afterClosed: () => outcome } as MatDialogRef<unknown, unknown>);
  const fixture = TestBed.createComponent(QcEquipmentChecklist);
  fixture.componentRef.setInput('equipment', EQUIPMENT);
  const submitted = vi.fn();
  fixture.componentInstance.submitted.subscribe(submitted);
  await fixture.whenStable();
  return { fixture, open, submitted, root: fixture.nativeElement as HTMLElement };
}

type Context = Awaited<ReturnType<typeof render>>;

/** The control a `<label for>` with exactly this text names. */
function labelled<T extends HTMLElement>(root: HTMLElement, name: string): T | null {
  const label = Array.from(root.querySelectorAll('label')).find(
    (candidate) => candidate.textContent?.replace(/\s+/g, ' ').trim() === name,
  );
  const id = label?.getAttribute('for');
  return id ? root.querySelector<T>(`#${id}`) : null;
}

const checkbox = (root: HTMLElement, activity: string) =>
  labelled<HTMLInputElement>(root, activity);

const notes = (root: HTMLElement, activity: string) =>
  labelled<HTMLTextAreaElement>(root, `توضیحات ${activity}`);

const recordButton = (root: HTMLElement) =>
  Array.from(root.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === 'ثبت انجام',
  );

async function tick({ fixture, root }: Context, activity: string) {
  checkbox(root, activity)?.click();
  await fixture.whenStable();
}

async function writeNotes({ fixture, root }: Context, activity: string, text: string) {
  const field = notes(root, activity)!;
  field.value = text;
  field.dispatchEvent(new Event('input'));
  await fixture.whenStable();
}

async function record({ fixture, root }: Context) {
  recordButton(root)?.click();
  await fixture.whenStable();
}

describe('QcEquipmentChecklist', () => {
  it('is a region named by the equipment’s heading', async () => {
    const { root } = await render();

    const section = root.querySelector('section');
    const heading = root.querySelector('h3');
    expect(heading?.textContent?.trim()).toBe('اکسترودر 1');
    expect(section?.getAttribute('aria-labelledby')).toBe(heading?.id);
  });

  it('keeps the table «فعالیت» | «آخرین انجام», each activity and its last execution', async () => {
    const { root } = await render();

    const table = root.querySelector('table');
    expect(
      Array.from(table?.querySelectorAll('thead th') ?? []).map((cell) => cell.textContent?.trim()),
    ).toEqual(['فعالیت', 'آخرین انجام']);
    expect(
      Array.from(table?.querySelectorAll('tbody tr') ?? []).map((row) =>
        Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim()),
      ),
    ).toEqual([
      ['بازرسی ابعادی', '۱۴۰۵/۰۷/۰۱ ۱۰:۰۰'],
      ['بازرسی ظاهری', 'بدون سابقه'],
      ['بازرسی رنگ', 'بدون سابقه'],
    ]);
  });

  it('offers each activity as a checkbox named by it and described by the equipment', async () => {
    const { root } = await render();

    const box = checkbox(root, 'بازرسی ابعادی');
    expect(box?.type).toBe('checkbox');
    expect(box?.getAttribute('aria-describedby')).toContain(root.querySelector('h3')?.id);
    expect(checkbox(root, 'بازرسی ظاهری')).not.toBeNull();
  });

  it('offers notes for a ticked activity only, and takes them away when it is unticked', async () => {
    const context = await render();
    expect(notes(context.root, 'بازرسی ابعادی')).toBeNull();

    await tick(context, 'بازرسی ابعادی');
    expect(notes(context.root, 'بازرسی ابعادی')).not.toBeNull();
    expect(notes(context.root, 'بازرسی ظاهری')).toBeNull();

    await tick(context, 'بازرسی ابعادی');
    expect(notes(context.root, 'بازرسی ابعادی')).toBeNull();
  });

  it('stops the notes at the API’s 2000 characters', async () => {
    const context = await render();
    await tick(context, 'بازرسی ابعادی');

    expect(notes(context.root, 'بازرسی ابعادی')?.maxLength).toBe(2000);
  });

  it('tells the inspector to choose an activity when nothing is ticked, and opens nothing', async () => {
    const context = await render();

    await record(context);

    expect(context.root.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
      'دست کم یک فعالیت باید انتخاب شود.',
    );
    expect(context.open).not.toHaveBeenCalled();

    await tick(context, 'بازرسی ابعادی');
    expect(context.root.querySelector('[role="alert"]')).toBeNull();
  });

  it('opens the submission on the ticked activities, in their order, with their notes', async () => {
    const context = await render();
    await tick(context, 'بازرسی رنگ');
    await tick(context, 'بازرسی ابعادی');
    await writeNotes(context, 'بازرسی ابعادی', 'خراش جزئی');

    await record(context);

    expect(context.open).toHaveBeenCalledWith(
      QcSubmissionDialog,
      expect.objectContaining({
        disableClose: true,
        data: {
          equipment: { id: 'e1', name: 'اکسترودر 1' },
          activities: [
            { activityId: 'q1', activityName: 'بازرسی ابعادی', notes: 'خراش جزئی' },
            { activityId: 'q3', activityName: 'بازرسی رنگ', notes: '' },
          ],
        },
      }),
    );
  });

  it('clears what was recorded, keeps what was not, and says a submission went out', async () => {
    const context = await render(of({ sent: true, recorded: ['q1'] }));
    await tick(context, 'بازرسی ابعادی');
    await tick(context, 'بازرسی ظاهری');
    await writeNotes(context, 'بازرسی ظاهری', 'دوباره بررسی شود');

    await record(context);

    expect(checkbox(context.root, 'بازرسی ابعادی')?.checked).toBe(false);
    expect(checkbox(context.root, 'بازرسی ظاهری')?.checked).toBe(true);
    expect(notes(context.root, 'بازرسی ظاهری')?.value).toBe('دوباره بررسی شود');
    expect(context.submitted).toHaveBeenCalledTimes(1);
  });

  it('keeps every tick, and says nothing, when the submission was cancelled unsent', async () => {
    const context = await render(of({ sent: false, recorded: [] }));
    await tick(context, 'بازرسی ابعادی');

    await record(context);

    expect(checkbox(context.root, 'بازرسی ابعادی')?.checked).toBe(true);
    expect(context.submitted).not.toHaveBeenCalled();
  });
});
