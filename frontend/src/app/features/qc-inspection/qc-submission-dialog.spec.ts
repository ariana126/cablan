import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
import { QcSubmissionDialog, QcSubmissionDialogData } from './qc-submission-dialog';

const DATA: QcSubmissionDialogData = {
  equipment: { id: 'e1', name: 'اکسترودر 1' },
  activities: [
    { activityId: 'q1', activityName: 'بازرسی ابعادی', notes: 'خراش جزئی' },
    { activityId: 'q2', activityName: 'بازرسی ظاهری', notes: '' },
  ],
};

const SUBMIT = { method: 'POST', url: '/api/qc-equipment/e1/executions' };

const recorded = (activityId: string, activityName: string) => ({
  activityId,
  activityName,
  outcome: 'recorded',
  executionId: `x-${activityId}`,
  problemType: null,
});

const notAssigned = (activityId: string, activityName: string) => ({
  activityId,
  activityName,
  outcome: 'refused',
  executionId: null,
  problemType: 'qc-activity-not-assigned',
});

async function setUp(data: QcSubmissionDialogData = DATA) {
  const close = vi.fn();
  const keydown = new Subject<KeyboardEvent>();
  const backdropClick = new Subject<MouseEvent>();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: MatDialogRef,
        useValue: {
          close,
          disableClose: true,
          keydownEvents: () => keydown,
          backdropClick: () => backdropClick,
        },
      },
      { provide: MAT_DIALOG_DATA, useValue: data },
    ],
  });
  const fixture = TestBed.createComponent(QcSubmissionDialog);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    close,
    keydown,
    backdropClick,
    root,
    httpMock: TestBed.inject(HttpTestingController),
  };
}

type Context = Awaited<ReturnType<typeof setUp>>;

const buttonNamed = (root: HTMLElement, name: string) =>
  Array.from(root.querySelectorAll('button')).find(
    (button) => (button.getAttribute('aria-label') ?? button.textContent?.trim()) === name,
  );

const buttonNames = (root: HTMLElement) =>
  Array.from(root.querySelectorAll('button')).map(
    (button) => button.getAttribute('aria-label') ?? button.textContent?.trim(),
  );

function trackingNumberField(root: HTMLElement): HTMLInputElement {
  const label = Array.from(root.querySelectorAll('label')).find((candidate) =>
    candidate.textContent?.trim().startsWith('شماره ردیابی'),
  );
  return root.querySelector<HTMLInputElement>(`#${label?.getAttribute('for')}`)!;
}

async function typeTrackingNumber({ fixture, root }: Context, value: string) {
  const input = trackingNumberField(root);
  input.value = value;
  input.dispatchEvent(new Event('input'));
  await fixture.whenStable();
}

async function submit(context: Context, trackingNumber = 'TR-100') {
  await typeTrackingNumber(context, trackingNumber);
  buttonNamed(context.root, 'ثبت')?.click();
  await context.fixture.whenStable();
}

/** The answer is handled a promise later than the flush, so a macrotask passes before the check. */
async function settle({ fixture }: Context) {
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
}

async function answer(context: Context, results: object[]) {
  const request = context.httpMock.expectOne(SUBMIT);
  request.flush({ results });
  await settle(context);
  return request.request.body;
}

async function click(context: Context, name: string) {
  buttonNamed(context.root, name)?.click();
  await context.fixture.whenStable();
}

const resultItems = (root: HTMLElement) =>
  Array.from(root.querySelectorAll('.result')).map((item) =>
    item.textContent?.replace(/\s+/g, ' ').trim(),
  );

describe('QcSubmissionDialog', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('names the equipment, lists the ticked activities and asks for the tracking number', async () => {
    const { root } = await setUp();

    expect(root.querySelector('h2')?.textContent?.trim()).toBe('اکسترودر 1');
    expect(root.textContent).toContain('بازرسی ابعادی');
    expect(root.textContent).toContain('بازرسی ظاهری');
    expect(trackingNumberField(root)).not.toBeNull();
    expect(buttonNames(root)).toEqual(['انصراف', 'ثبت']);
  });

  it.each([
    ['empty', ''],
    ['only spaces', '   '],
  ])('refuses an %s tracking number on the field, sending nothing', async (_, value) => {
    const context = await setUp();

    await submit(context, value);

    expect(context.root.querySelector('mat-error')?.textContent?.trim()).toBe(
      'شماره ردیابی را وارد کنید.',
    );
  });

  it('sends every ticked activity with its notes, one tracking number and a fresh submission id', async () => {
    const context = await setUp();

    await submit(context);
    const body = await answer(context, [
      recorded('q1', 'بازرسی ابعادی'),
      recorded('q2', 'بازرسی ظاهری'),
    ]);

    expect(body).toEqual({
      submissionId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      ),
      trackingNumber: 'TR-100',
      activities: [{ activityId: 'q1', notes: 'خراش جزئی' }, { activityId: 'q2' }],
    });
  });

  it('shows each activity as recorded, and offers only «بستن»', async () => {
    const context = await setUp();

    await submit(context);
    await answer(context, [recorded('q1', 'بازرسی ابعادی'), recorded('q2', 'بازرسی ظاهری')]);

    expect(resultItems(context.root)).toEqual(['بازرسی ابعادی ثبت شد', 'بازرسی ظاهری ثبت شد']);
    expect(context.root.querySelector('[role="status"]')?.textContent).toContain('ثبت شد');
    expect(buttonNames(context.root)).toEqual(['بستن']);
  });

  it('closes with what was recorded', async () => {
    const context = await setUp();
    await submit(context);
    await answer(context, [recorded('q1', 'بازرسی ابعادی'), notAssigned('q2', 'بازرسی ظاهری')]);

    await click(context, 'بستن');

    expect(context.close).toHaveBeenCalledWith({ sent: true, recorded: ['q1'] });
  });

  it('says why an activity was refused, and offers to send the same submission again', async () => {
    const context = await setUp();
    await submit(context);
    const first = await answer(context, [
      recorded('q1', 'بازرسی ابعادی'),
      notAssigned('q2', 'بازرسی ظاهری'),
    ]);

    expect(resultItems(context.root)).toEqual([
      'بازرسی ابعادی ثبت شد',
      'بازرسی ظاهری ثبت نشد "بازرسی ظاهری" به "اکسترودر 1" تخصیص داده نشده است.',
    ]);
    expect(buttonNames(context.root)).toEqual(['بستن', 'ارسال دوباره']);

    await click(context, 'ارسال دوباره');
    const second = await answer(context, [
      recorded('q1', 'بازرسی ابعادی'),
      recorded('q2', 'بازرسی ظاهری'),
    ]);

    expect(second).toEqual(first);
    expect(resultItems(context.root)).toEqual(['بازرسی ابعادی ثبت شد', 'بازرسی ظاهری ثبت شد']);
  });

  it('locks the tracking number once the submission is sent', async () => {
    const context = await setUp();
    await submit(context);
    await answer(context, [recorded('q1', 'بازرسی ابعادی'), notAssigned('q2', 'بازرسی ظاهری')]);

    expect(trackingNumberField(context.root).readOnly).toBe(true);
  });

  it('names a refused activity that no longer exists by what was ticked', async () => {
    const context = await setUp();
    await submit(context);
    await answer(context, [
      recorded('q1', 'بازرسی ابعادی'),
      {
        ...notAssigned('q2', 'بازرسی ظاهری'),
        activityName: null,
        problemType: 'qc-activity-not-found',
      },
    ]);

    expect(resultItems(context.root)[1]).toBe(
      'بازرسی ظاهری ثبت نشد این فعالیت QC دیگر وجود ندارد.',
    );
  });

  it('offers to send the same submission again when no answer came', async () => {
    const context = await setUp();
    await submit(context);
    const first = context.httpMock.expectOne(SUBMIT);
    first.error(new ProgressEvent('error'), { status: 0 });
    await settle(context);

    expect(context.root.querySelector('[role="alert"]')?.textContent).toContain(
      'پاسخ ثبت از سرور نرسید.',
    );
    expect(trackingNumberField(context.root).readOnly).toBe(true);
    expect(buttonNames(context.root)).toEqual(['انصراف', 'ارسال دوباره']);

    await click(context, 'ارسال دوباره');
    const second = await answer(context, [
      recorded('q1', 'بازرسی ابعادی'),
      recorded('q2', 'بازرسی ظاهری'),
    ]);

    expect(second).toEqual(first.request.body);
    expect(context.root.querySelector('[role="alert"]')).toBeNull();
  });

  it('shows a refusal of the whole submission in its alert, with «بستن» only', async () => {
    const context = await setUp();
    await submit(context);
    context.httpMock
      .expectOne(SUBMIT)
      .flush(
        { type: PROBLEM.equipmentRetired, status: 409 },
        { status: 409, statusText: 'Conflict' },
      );
    await settle(context);

    expect(context.root.querySelector('[role="alert"]')?.textContent).toContain(
      '«اکسترودر 1» کنار گذاشته شده است؛ ثبت انجام ممکن نیست.',
    );
    expect(buttonNames(context.root)).toEqual(['بستن']);

    await click(context, 'بستن');
    expect(context.close).toHaveBeenCalledWith({ sent: true, recorded: [] });
  });

  it('puts the API’s refusal of the tracking number on its field and lets it be corrected', async () => {
    const context = await setUp();
    await submit(context);
    context.httpMock.expectOne(SUBMIT).flush(
      {
        type: PROBLEM.validationError,
        status: 400,
        errors: [{ field: 'trackingNumber', message: 'trackingNumber should not be empty' }],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await settle(context);

    expect(context.root.querySelector('mat-error')?.textContent?.trim()).toBe(
      'شماره ردیابی را وارد کنید.',
    );
    expect(trackingNumberField(context.root).readOnly).toBe(false);
    expect(buttonNames(context.root)).toEqual(['انصراف', 'ثبت']);
  });

  it('closes having sent nothing on «انصراف»', async () => {
    const context = await setUp();

    await click(context, 'انصراف');

    expect(context.close).toHaveBeenCalledWith({ sent: false, recorded: [] });
  });

  it('closes with the same outcome on Escape, once sent', async () => {
    const context = await setUp();
    await submit(context);
    await answer(context, [recorded('q1', 'بازرسی ابعادی'), recorded('q2', 'بازرسی ظاهری')]);

    context.keydown.next(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(context.close).toHaveBeenCalledWith({ sent: true, recorded: ['q1', 'q2'] });
  });

  it('closes on a click outside it', async () => {
    const context = await setUp();

    context.backdropClick.next(new MouseEvent('click'));

    expect(context.close).toHaveBeenCalledWith({ sent: false, recorded: [] });
  });

  it('draws a new submission id for every new submission', async () => {
    const first = await setUp();
    await submit(first);
    const firstBody = await answer(first, [recorded('q1', 'بازرسی ابعادی')]);
    TestBed.resetTestingModule();

    const second = await setUp();
    await submit(second);
    const secondBody = await answer(second, [recorded('q1', 'بازرسی ابعادی')]);

    expect(secondBody.submissionId).not.toBe(firstBody.submissionId);
  });
});
