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
import { EquipmentFormDialog, EquipmentFormDialogData } from './equipment-form-dialog';

interface Submittable {
  onSubmit(): Promise<unknown>;
}

function setValue(element: Element | null, value: string): void {
  const input = element as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function nameInput(root: HTMLElement): HTMLInputElement | null {
  const label = Array.from(root.querySelectorAll('label')).find((element) =>
    element.textContent?.trim().startsWith('نام تجهیز'),
  );
  const id = label?.getAttribute('for');
  return id ? root.querySelector(`#${id}`) : null;
}

function setUp(data: EquipmentFormDialogData) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: data },
    ],
  });
  const fixture = TestBed.createComponent(EquipmentFormDialog);
  return {
    fixture,
    close,
    httpMock: TestBed.inject(HttpTestingController),
    root: fixture.nativeElement as HTMLElement,
    submit: () => (fixture.componentInstance as unknown as Submittable).onSubmit(),
  };
}

const buttonTexts = (root: HTMLElement): string[] =>
  Array.from(root.querySelectorAll('button')).map((button) => button.textContent?.trim() ?? '');

describe('EquipmentFormDialog', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('asks for the name alone, titled and submitted as «ثبت تجهیز»', async () => {
    const { fixture, root } = setUp({ mode: 'create' });
    await fixture.whenStable();

    expect(root.querySelector('h2')?.textContent?.trim()).toBe('ثبت تجهیز');
    expect(nameInput(root)?.value).toBe('');
    expect(buttonTexts(root)).toContain('ثبت تجهیز');
  });

  it('registers the equipment and closes on success', async () => {
    const { fixture, root, close, httpMock, submit } = setUp({ mode: 'create' });
    await fixture.whenStable();

    setValue(nameInput(root), 'اکسترودر 1');
    await fixture.whenStable();
    const submitted = submit();
    const request = httpMock.expectOne({ method: 'POST', url: '/api/equipment' });
    expect(request.request.body).toEqual({ name: 'اکسترودر 1' });
    request.flush({ id: '1' }, { status: 201, statusText: 'Created' });
    await submitted;

    // The new id, so the page can offer the equipment's folder straight away.
    expect(close).toHaveBeenCalledWith({ id: '1' });
  });

  it('refuses a blank name on the field, without asking the API', async () => {
    const { fixture, root, close, submit } = setUp({ mode: 'create' });
    await fixture.whenStable();

    setValue(nameInput(root), '   ');
    await submit();
    await fixture.whenStable();

    expect(root.querySelector('mat-error')?.textContent?.trim()).toBe('نام تجهیز را وارد کنید.');
    expect(close).not.toHaveBeenCalled();
  });

  it('shows a taken name on the name field and stays open', async () => {
    const { fixture, root, close, httpMock, submit } = setUp({ mode: 'create' });
    await fixture.whenStable();

    setValue(nameInput(root), 'اکسترودر 1');
    await fixture.whenStable();
    const submitted = submit();
    httpMock.expectOne({ method: 'POST', url: '/api/equipment' }).flush(
      {
        type: PROBLEM.equipmentNameTaken,
        title: 'Equipment Name Taken',
        status: 409,
        detail: 'تجهیزی با این نام قبلا ثبت شده است',
      },
      { status: 409, statusText: 'Conflict' },
    );
    await submitted;
    await fixture.whenStable();

    expect(root.querySelector('mat-error')?.textContent?.trim()).toBe(
      'تجهیزی با این نام قبلاً ثبت شده است.',
    );
    expect(close).not.toHaveBeenCalled();
  });

  it('says which PM plan uses the equipment and stays open when the rename is refused', async () => {
    const { fixture, root, close, httpMock, submit } = setUp({
      mode: 'edit',
      equipment: { id: '7', name: 'اکسترودر 1', retired: false, activePlanItemCount: 1 },
    });
    await fixture.whenStable();

    setValue(nameInput(root), 'اکسترودر اصلی');
    await fixture.whenStable();
    const submitted = submit();
    httpMock
      .expectOne({ method: 'PATCH', url: '/api/equipment/7' })
      .flush(
        recordHasDependentsBody(
          [{ kind: 'equipment-pm-plan', count: 1, names: ['اکسترودر 1'] }],
          'Equipment',
        ),
        CONFLICT,
      );
    await submitted;
    await fixture.whenStable();

    expect(close).not.toHaveBeenCalled();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'امکان ویرایش این اطلاعات وجود ندارد، زیرا در برنامه PM ۱ تجهیز («اکسترودر 1») استفاده شده است.',
    );
  });

  it('renames the equipment it was opened for', async () => {
    const { fixture, root, close, httpMock, submit } = setUp({
      mode: 'edit',
      equipment: { id: '7', name: 'اکسترودر 1', retired: false, activePlanItemCount: 0 },
    });
    await fixture.whenStable();

    expect(root.querySelector('h2')?.textContent?.trim()).toBe('ویرایش تجهیز');
    expect(nameInput(root)?.value).toBe('اکسترودر 1');
    expect(buttonTexts(root)).toContain('ذخیره تغییرات');
    expect(buttonTexts(root)).not.toContain('ثبت تجهیز');

    setValue(nameInput(root), 'اکسترودر اصلی');
    await fixture.whenStable();
    const submitted = submit();
    const request = httpMock.expectOne({ method: 'PATCH', url: '/api/equipment/7' });
    expect(request.request.body).toEqual({ name: 'اکسترودر اصلی' });
    request.flush(null, { status: 204, statusText: 'No Content' });
    await submitted;

    expect(close).toHaveBeenCalledWith({ id: '7' });
  });

  describe('what it already knows before saving', () => {
    const IN_PLAN = { id: '7', name: 'اکسترودر 1', retired: false, activePlanItemCount: 2 };
    const notice = (root: HTMLElement) => root.querySelector('.dialog-notice');

    it('says up front that equipment in a PM plan cannot be renamed', async () => {
      const { fixture, root, httpMock } = setUp({ mode: 'edit', equipment: IN_PLAN });
      await signInAs(Role.technical_manager, httpMock);
      await fixture.whenStable();

      expect(notice(root)?.textContent).toContain(
        'این تجهیز در برنامهٔ PM استفاده شده است و نام آن قابل ویرایش نیست.',
      );
      // A notice, not the refusal: the dialog's alert stays the API's answer.
      expect(notice(root)?.getAttribute('role')).toBeNull();
    });

    it('says nothing when no PM plan holds it', async () => {
      const { fixture, root, httpMock } = setUp({
        mode: 'edit',
        equipment: { ...IN_PLAN, activePlanItemCount: 0 },
      });
      await signInAs(Role.technical_manager, httpMock);
      await fixture.whenStable();

      expect(notice(root)).toBeNull();
    });

    // The System Admin may correct the name; the correction confirmation still asks.
    it('says nothing to the System Admin', async () => {
      const { fixture, root, httpMock } = setUp({ mode: 'edit', equipment: IN_PLAN });
      await signInAs(Role.system_admin, httpMock);
      await fixture.whenStable();

      expect(notice(root)).toBeNull();
    });
  });

  describe("the System Admin's correction of a name in use (issue #110)", () => {
    const IN_USE = recordHasDependentsBody(
      [{ kind: 'equipment-pm-plan', count: 1, names: ['اکسترودر 1'] }],
      'Equipment',
    );
    const PATCH = { method: 'PATCH', url: '/api/equipment/7' };

    async function renameAs(role: Role, retired = false) {
      const context = setUp({
        mode: 'edit',
        equipment: { id: '7', name: 'اکسترودر 1', retired, activePlanItemCount: 1 },
      });
      await signInAs(role, context.httpMock);
      await context.fixture.whenStable();
      setValue(nameInput(context.root), 'اکسترودر اصلی');
      await context.fixture.whenStable();
      return context;
    }

    it('re-sends the rename with the correction applied once the System Admin confirms it', async () => {
      const { fixture, close, httpMock, submit } = await renameAs(Role.system_admin);
      const open = answerCorrectionConfirmation(true);

      const submitted = submit();
      httpMock.expectOne(PATCH).flush(IN_USE, CONFLICT);
      const corrected = await vi.waitFor(() => httpMock.expectOne(PATCH));
      expect(corrected.request.body).toEqual({
        name: 'اکسترودر اصلی',
        applyToRelatedRecords: true,
      });
      corrected.flush(null, { status: 204, statusText: 'No Content' });
      await submitted;
      await fixture.whenStable();

      expect(askedToConfirm(open)).toBe(true);
      expect(close).toHaveBeenCalledWith({ id: '7' });
    });

    it('sends nothing more and stays open, saying nothing, when the System Admin declines', async () => {
      const { fixture, root, close, httpMock, submit } = await renameAs(Role.system_admin);
      answerCorrectionConfirmation(false);

      const submitted = submit();
      httpMock.expectOne(PATCH).flush(IN_USE, CONFLICT);
      await submitted;
      await fixture.whenStable();

      expect(close).not.toHaveBeenCalled();
      expect(root.querySelector('[role="alert"]')).toBeNull();
      expect(nameInput(root)?.value).toBe('اکسترودر اصلی');
    });

    it('shows a taken name on the field when the confirmed correction is refused', async () => {
      const { fixture, root, close, httpMock, submit } = await renameAs(Role.system_admin);
      answerCorrectionConfirmation(true);

      const submitted = submit();
      httpMock.expectOne(PATCH).flush(IN_USE, CONFLICT);
      (await vi.waitFor(() => httpMock.expectOne(PATCH))).flush(
        { type: PROBLEM.equipmentNameTaken },
        CONFLICT,
      );
      await submitted;
      await fixture.whenStable();

      expect(close).not.toHaveBeenCalled();
      expect(nameInput(root)?.closest('mat-form-field')?.textContent).toContain(
        'تجهیزی با این نام قبلاً ثبت شده است.',
      );
    });

    // Retired equipment nothing references is refused as retired, not as in use: there is nothing
    // related to confirm, so the System Admin's rename simply goes through as a correction.
    it('renames retired equipment that nothing references, as a correction', async () => {
      const { fixture, close, httpMock, submit } = await renameAs(Role.system_admin, true);
      const open = answerCorrectionConfirmation(true);

      const submitted = submit();
      httpMock.expectOne(PATCH).flush({ type: PROBLEM.equipmentRetired }, CONFLICT);
      const corrected = await vi.waitFor(() => httpMock.expectOne(PATCH));
      expect(corrected.request.body).toEqual({
        name: 'اکسترودر اصلی',
        applyToRelatedRecords: true,
      });
      corrected.flush(null, { status: 204, statusText: 'No Content' });
      await submitted;
      await fixture.whenStable();

      expect(askedToConfirm(open)).toBe(false);
      expect(close).toHaveBeenCalledWith({ id: '7' });
    });

    it('keeps refusing a Technical Manager’s rename in use, without asking', async () => {
      const { fixture, root, close, httpMock, submit } = await renameAs(Role.technical_manager);
      const open = answerCorrectionConfirmation(true);

      const submitted = submit();
      httpMock.expectOne(PATCH).flush(IN_USE, CONFLICT);
      await submitted;
      await fixture.whenStable();

      expect(askedToConfirm(open)).toBe(false);
      expect(close).not.toHaveBeenCalled();
      expect(root.querySelector('[role="alert"]')?.textContent).toContain(
        'امکان ویرایش این اطلاعات وجود ندارد',
      );
    });
  });
});
