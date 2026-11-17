import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
import { AppQcEquipment } from '../../core/qc/qc-equipment-gateway';
import { QcRecordDialog } from './qc-record-dialog';

const EQUIPMENT: AppQcEquipment = {
  id: 'e1',
  name: 'اکسترودر 1',
  retired: false,
  activities: [
    { activityId: 'q1', activityName: 'بازرسی ابعادی', lastPerformedAt: null },
    { activityId: 'q2', activityName: 'بازرسی ظاهری', lastPerformedAt: '2026-09-23T06:30:00Z' },
  ],
};

const RECORD_Q1 = { method: 'POST', url: '/api/qc-equipment/e1/activities/q1/executions' };

async function setUp() {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: { equipment: EQUIPMENT } },
    ],
  });
  const fixture = TestBed.createComponent(QcRecordDialog);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  return { fixture, close, root, httpMock: TestBed.inject(HttpTestingController) };
}

const buttonNamed = (root: HTMLElement, name: string) =>
  Array.from(root.querySelectorAll('button')).find(
    (button) => (button.getAttribute('aria-label') ?? button.textContent?.trim()) === name,
  );

function field(root: HTMLElement, label: string): HTMLInputElement | HTMLTextAreaElement | null {
  const element = Array.from(root.querySelectorAll('label')).find((candidate) =>
    candidate.textContent?.trim().startsWith(label),
  );
  const id = element?.getAttribute('for');
  return id ? root.querySelector(`#${id}`) : null;
}

function type(root: HTMLElement, label: string, value: string): void {
  const input = field(root, label)!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

async function startRecording(context: Awaited<ReturnType<typeof setUp>>, activity: string) {
  buttonNamed(context.root, `ثبت انجام ${activity}`)?.click();
  await context.fixture.whenStable();
}

const submit = (root: HTMLElement) =>
  root.querySelector<HTMLFormElement>('form')?.dispatchEvent(new Event('submit'));

describe('QcRecordDialog', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('names the equipment and lists its activities, each with its own «ثبت انجام»', async () => {
    const { root } = await setUp();

    expect(root.querySelector('h2')?.textContent?.trim()).toBe('اکسترودر 1');
    expect(buttonNamed(root, 'ثبت انجام بازرسی ابعادی')).toBeDefined();
    expect(buttonNamed(root, 'ثبت انجام بازرسی ظاهری')).toBeDefined();
    expect(root.textContent).toContain('بدون سابقه');
    expect(root.textContent).toContain('۱۴۰۵/۰۷/۰۱ ۱۰:۰۰');
  });

  it('records one activity with its tracking number and notes, then says so in the list', async () => {
    const context = await setUp();
    const { fixture, root, httpMock } = context;
    await startRecording(context, 'بازرسی ابعادی');

    expect(root.querySelector('h3')?.textContent?.trim()).toBe('بازرسی ابعادی');
    type(root, 'شماره ردیابی', 'TR-100');
    type(root, 'توضیحات', 'خراش جزئی');
    await fixture.whenStable();
    submit(root);
    const request = httpMock.expectOne(RECORD_Q1);
    expect(request.request.body).toEqual({ trackingNumber: 'TR-100', notes: 'خراش جزئی' });
    request.flush({ id: 'x1' }, { status: 201, statusText: 'Created' });
    await vi.waitFor(() =>
      httpMock.expectOne({ method: 'GET', url: '/api/qc-inspections/e1' }).flush({
        ...EQUIPMENT,
        activities: [
          { ...EQUIPMENT.activities[0], lastPerformedAt: '2026-09-24T05:30:00Z' },
          EQUIPMENT.activities[1],
        ],
      }),
    );
    await fixture.whenStable();

    expect(root.querySelector('[role="status"]')?.textContent).toContain(
      'انجام «بازرسی ابعادی» ثبت شد.',
    );
    expect(root.textContent).toContain('۱۴۰۵/۰۷/۰۲ ۰۹:۰۰');
    // Each activity's recording is its own: the other is still offered.
    expect(buttonNamed(root, 'ثبت انجام بازرسی ظاهری')).toBeDefined();
  });

  it.each([
    ['empty', ''],
    ['only spaces', '   '],
  ])('refuses an %s tracking number on the field, sending nothing', async (_, value) => {
    const context = await setUp();
    const { fixture, root } = context;
    await startRecording(context, 'بازرسی ابعادی');

    type(root, 'شماره ردیابی', value);
    await fixture.whenStable();
    submit(root);
    await fixture.whenStable();

    expect(root.querySelector('mat-error')?.textContent?.trim()).toBe('شماره ردیابی را وارد کنید.');
  });

  it('shows the API’s words when the activity is no longer assigned, and records nothing', async () => {
    const context = await setUp();
    const { fixture, root, httpMock } = context;
    await startRecording(context, 'بازرسی ابعادی');

    type(root, 'شماره ردیابی', 'TR-100');
    await fixture.whenStable();
    submit(root);
    httpMock.expectOne(RECORD_Q1).flush(
      {
        type: PROBLEM.qcActivityNotAssigned,
        status: 409,
        detail: '"بازرسی ابعادی" به "اکسترودر 1" تخصیص داده نشده است.',
      },
      { status: 409, statusText: 'Conflict' },
    );
    await fixture.whenStable();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      '"بازرسی ابعادی" به "اکسترودر 1" تخصیص داده نشده است.',
    );
  });

  it('stops the tracking number at 100 characters and the notes at 2000', async () => {
    const context = await setUp();
    await startRecording(context, 'بازرسی ابعادی');

    expect(field(context.root, 'شماره ردیابی')?.getAttribute('maxlength')).toBe('100');
    expect(field(context.root, 'توضیحات')?.getAttribute('maxlength')).toBe('2000');
  });

  it('goes back to the list without recording', async () => {
    const context = await setUp();
    const { root } = context;
    await startRecording(context, 'بازرسی ابعادی');

    buttonNamed(root, 'بازگشت به فهرست')?.click();
    await context.fixture.whenStable();

    expect(buttonNamed(root, 'ثبت انجام بازرسی ابعادی')).toBeDefined();
    expect(field(root, 'شماره ردیابی')).toBeNull();
  });
});
