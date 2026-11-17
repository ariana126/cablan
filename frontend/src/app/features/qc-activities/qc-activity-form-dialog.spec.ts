import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Role } from '../../api/model';
import { PROBLEM } from '../../core/http/problem-details';
import {
  CONFLICT,
  recordHasDependentsBody,
} from '../../core/http/testing/record-has-dependents-problem';
import { signInAs } from '../../core/identity/testing/sign-in-as';
import {
  answerCorrectionConfirmation,
  askedToConfirm,
} from '../../ui/correction-confirmation/testing/answer-correction-confirmation';
import { QcActivityFormDialog, QcActivityFormDialogData } from './qc-activity-form-dialog';

interface Submittable {
  onSubmit(): Promise<unknown>;
}

function nameInput(root: HTMLElement): HTMLInputElement | null {
  const label = Array.from(root.querySelectorAll('label')).find((element) =>
    element.textContent?.trim().startsWith('عنوان فعالیت'),
  );
  const id = label?.getAttribute('for');
  return id ? root.querySelector(`#${id}`) : null;
}

function type(root: HTMLElement, value: string): void {
  const input = nameInput(root) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

const buttonTexts = (root: HTMLElement): (string | undefined)[] =>
  Array.from(root.querySelectorAll('button')).map((button) => button.textContent?.trim());

function setUp(data: QcActivityFormDialogData) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: data },
    ],
  });
  const fixture = TestBed.createComponent(QcActivityFormDialog);
  return {
    fixture,
    close,
    httpMock: TestBed.inject(HttpTestingController),
    root: fixture.nativeElement as HTMLElement,
    submit: () => (fixture.componentInstance as unknown as Submittable).onSubmit(),
  };
}

const ACTIVITY = { id: 'q1', name: 'بازرسی ابعادی', assignedEquipmentCount: 1 };
const PATCH = { method: 'PATCH', url: '/api/qc-activities/q1' };

describe('QcActivityFormDialog', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('asks for «عنوان فعالیت» under «تعریف فعالیت QC» and submits with «ثبت»', async () => {
    const { fixture, root } = setUp({ mode: 'create' });
    await fixture.whenStable();

    expect(root.querySelector('h2')?.textContent?.trim()).toBe('تعریف فعالیت QC');
    expect(nameInput(root)?.value).toBe('');
    expect(buttonTexts(root)).toContain('ثبت');
  });

  it('stops the title at the API’s 200 characters', async () => {
    const { fixture, root } = setUp({ mode: 'create' });
    await fixture.whenStable();

    expect(nameInput(root)?.getAttribute('maxlength')).toBe('200');
  });

  it('defines the activity and closes on success', async () => {
    const { fixture, root, close, httpMock, submit } = setUp({ mode: 'create' });
    await fixture.whenStable();

    type(root, 'بازرسی ابعادی');
    await fixture.whenStable();
    const submitted = submit();
    const request = httpMock.expectOne({ method: 'POST', url: '/api/qc-activities' });
    expect(request.request.body).toEqual({ name: 'بازرسی ابعادی' });
    request.flush({ id: 'q1' }, { status: 201, statusText: 'Created' });
    await submitted;

    expect(close).toHaveBeenCalledWith(true);
  });

  it.each([
    ['empty', ''],
    ['only spaces', '   '],
  ])(
    'refuses an %s name on the field, «ثبت» still enabled, without asking the API',
    async (_, value) => {
      const { fixture, root, close, submit } = setUp({ mode: 'create' });
      await fixture.whenStable();

      type(root, value);
      await fixture.whenStable();
      const submitButton = Array.from(root.querySelectorAll('button')).find(
        (button) => button.textContent?.trim() === 'ثبت',
      );
      expect(submitButton?.disabled).toBe(false);
      await submit();
      await fixture.whenStable();

      expect(root.querySelector('mat-error')?.textContent?.trim()).toBe(
        'عنوان فعالیت را وارد کنید.',
      );
      expect(close).not.toHaveBeenCalled();
    },
  );

  it('shows a taken name on the field and stays open', async () => {
    const { fixture, root, close, httpMock, submit } = setUp({ mode: 'create' });
    await fixture.whenStable();

    type(root, 'بازرسی ابعادی');
    await fixture.whenStable();
    const submitted = submit();
    httpMock
      .expectOne({ method: 'POST', url: '/api/qc-activities' })
      .flush({ type: PROBLEM.qcActivityNameTaken, status: 409 }, CONFLICT);
    await submitted;
    await fixture.whenStable();

    expect(root.querySelector('mat-error')?.textContent?.trim()).toBe(
      'فعالیت QC با این عنوان قبلاً تعریف شده است.',
    );
    expect(close).not.toHaveBeenCalled();
  });

  it('opens on the activity it edits and saves with «ذخیره تغییرات»', async () => {
    const { fixture, root, close, httpMock, submit } = setUp({ mode: 'edit', activity: ACTIVITY });
    await fixture.whenStable();

    expect(root.querySelector('h2')?.textContent?.trim()).toBe('ویرایش فعالیت QC');
    expect(nameInput(root)?.value).toBe('بازرسی ابعادی');
    expect(buttonTexts(root)).toContain('ذخیره تغییرات');

    type(root, 'بازرسی ابعاد');
    await fixture.whenStable();
    const submitted = submit();
    const request = httpMock.expectOne(PATCH);
    expect(request.request.body).toEqual({ name: 'بازرسی ابعاد' });
    request.flush(null, { status: 204, statusText: 'No Content' });
    await submitted;

    expect(close).toHaveBeenCalledWith(true);
  });

  it('says where the activity is used and stays open when the rename is refused', async () => {
    const { fixture, root, close, httpMock, submit } = setUp({ mode: 'edit', activity: ACTIVITY });
    await fixture.whenStable();

    type(root, 'بازرسی ابعاد');
    await fixture.whenStable();
    const submitted = submit();
    httpMock
      .expectOne(PATCH)
      .flush(
        recordHasDependentsBody(
          [{ kind: 'qc-assigned-equipment', count: 1, names: ['اکسترودر 1'] }],
          'qc-activity',
        ),
        CONFLICT,
      );
    await submitted;
    await fixture.whenStable();

    expect(close).not.toHaveBeenCalled();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'امکان ویرایش این اطلاعات وجود ندارد، زیرا در ۱ تجهیز («اکسترودر 1») استفاده شده است.',
    );
  });

  describe("the System Admin's correction of an activity in use", () => {
    const IN_USE = recordHasDependentsBody(
      [{ kind: 'qc-activity-execution', count: 3, names: [] }],
      'qc-activity',
    );

    it('asks to confirm, then re-sends the rename with applyToRelatedRecords and closes', async () => {
      const { fixture, root, close, httpMock, submit } = setUp({
        mode: 'edit',
        activity: ACTIVITY,
      });
      await signInAs(Role.system_admin, httpMock);
      const open = answerCorrectionConfirmation(true);
      await fixture.whenStable();

      type(root, 'بازرسی ابعاد');
      await fixture.whenStable();
      const submitted = submit();
      httpMock.expectOne(PATCH).flush(IN_USE, CONFLICT);
      await vi.waitFor(() => expect(askedToConfirm(open)).toBe(true));
      const resent = await vi.waitFor(() => httpMock.expectOne(PATCH));
      expect(resent.request.body).toEqual({ name: 'بازرسی ابعاد', applyToRelatedRecords: true });
      resent.flush(null, { status: 204, statusText: 'No Content' });
      await submitted;

      expect(close).toHaveBeenCalledWith(true);
    });

    it('is not asked of Management, who sees the refusal', async () => {
      const { fixture, root, close, httpMock, submit } = setUp({
        mode: 'edit',
        activity: ACTIVITY,
      });
      await signInAs(Role.management, httpMock);
      const open = answerCorrectionConfirmation(true);
      await fixture.whenStable();

      type(root, 'بازرسی ابعاد');
      await fixture.whenStable();
      const submitted = submit();
      httpMock.expectOne(PATCH).flush(IN_USE, CONFLICT);
      await submitted;
      await fixture.whenStable();

      expect(askedToConfirm(open)).toBe(false);
      expect(close).not.toHaveBeenCalled();
      expect(root.querySelector('[role="alert"]')?.textContent).toContain('۳ سابقه انجام QC');
    });
  });
});
