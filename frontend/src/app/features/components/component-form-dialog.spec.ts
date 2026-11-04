import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CONFLICT,
  recordHasDependentsBody,
} from '../../core/http/testing/record-has-dependents-problem';
import { Role } from '../../api/model';
import { signInAs } from '../../core/identity/testing/sign-in-as';
import {
  answerCorrectionConfirmation,
  askedToConfirm,
} from '../../ui/correction-confirmation/testing/answer-correction-confirmation';
import { ComponentFormDialog, ComponentFormDialogData } from './component-form-dialog';

/** The subset of the submit pipeline a spec needs to await directly. */
interface Submittable {
  onSubmit(): Promise<unknown>;
}

function setValue(element: Element | null, value: string): void {
  const input = element as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function findByLabel(root: HTMLElement, label: string): HTMLInputElement | null {
  const labels = Array.from(root.querySelectorAll('label'));
  const match = labels.find((element) => element.textContent?.trim().startsWith(label));
  const forAttr = match?.getAttribute('for');
  return forAttr ? root.querySelector(`#${forAttr}`) : null;
}

function setUp(data: ComponentFormDialogData) {
  const close = vi.fn();

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: data },
    ],
  });

  const fixture = TestBed.createComponent(ComponentFormDialog);
  const httpMock = TestBed.inject(HttpTestingController);

  return { fixture, close, httpMock, root: fixture.nativeElement as HTMLElement };
}

describe('ComponentFormDialog', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  describe('create mode', () => {
    it('starts with an empty name field', async () => {
      const { fixture, root } = setUp({ mode: 'create' });
      await fixture.whenStable();

      expect(findByLabel(root, 'اسم جز')?.value).toBe('');
    });

    it('registers the component and closes the dialog on success', async () => {
      const { fixture, root, close, httpMock } = setUp({ mode: 'create' });
      await fixture.whenStable();

      setValue(findByLabel(root, 'اسم جز'), 'پیچ شش‌گوش');
      await fixture.whenStable();

      const page = fixture.componentInstance as unknown as Submittable;
      const submitted = page.onSubmit();
      const request = httpMock.expectOne({ method: 'POST', url: '/api/components' });
      expect(request.request.body).toEqual({ name: 'پیچ شش‌گوش' });
      request.flush({ id: '1' }, { status: 201, statusText: 'Created' });
      await submitted;

      expect(close).toHaveBeenCalledWith(true);
    });

    it('does not close and reports the field when the name is empty', async () => {
      const { fixture, root, close } = setUp({ mode: 'create' });
      await fixture.whenStable();

      const page = fixture.componentInstance as unknown as Submittable;
      await page.onSubmit();
      await fixture.whenStable();

      expect(close).not.toHaveBeenCalled();
      const nameField = findByLabel(root, 'اسم جز')?.closest('mat-form-field');
      expect(nameField?.textContent).toContain('نام را وارد کنید');
    });

    it('does not close and reports the field when the name is already taken', async () => {
      const { fixture, root, close, httpMock } = setUp({ mode: 'create' });
      await fixture.whenStable();

      setValue(findByLabel(root, 'اسم جز'), 'پیچ شش‌گوش');
      await fixture.whenStable();

      const page = fixture.componentInstance as unknown as Submittable;
      const submitted = page.onSubmit();
      httpMock
        .expectOne({ method: 'POST', url: '/api/components' })
        .flush(
          { type: 'https://my-api-doc.dev/problems/component-name-already-exists' },
          { status: 409, statusText: 'Conflict' },
        );
      await submitted;
      await fixture.whenStable();

      expect(close).not.toHaveBeenCalled();
      const nameField = findByLabel(root, 'اسم جز')?.closest('mat-form-field');
      expect(nameField?.textContent).toContain('این نام قبلاً برای جز دیگری ثبت شده است');
    });
  });

  describe('edit mode', () => {
    const component = { id: 'component-1', name: 'پیچ شش‌گوش' };

    it('pre-fills the form from the given component', async () => {
      const { fixture, root } = setUp({ mode: 'edit', component });
      await fixture.whenStable();

      expect(findByLabel(root, 'اسم جز')?.value).toBe('پیچ شش‌گوش');
    });

    it('renames the component and closes the dialog on success', async () => {
      const { fixture, root, close, httpMock } = setUp({ mode: 'edit', component });
      await fixture.whenStable();

      setValue(findByLabel(root, 'اسم جز'), 'پیچ آلن');
      await fixture.whenStable();

      const page = fixture.componentInstance as unknown as Submittable;
      const submitted = page.onSubmit();
      const request = httpMock.expectOne({ method: 'PATCH', url: '/api/components/component-1' });
      expect(request.request.body).toEqual({ name: 'پیچ آلن' });
      request.flush(null, { status: 204, statusText: 'No Content' });
      await submitted;

      expect(close).toHaveBeenCalledWith(true);
    });

    it('says where the component is used and stays open when the rename is refused', async () => {
      const { fixture, root, close, httpMock } = setUp({ mode: 'edit', component });
      await fixture.whenStable();

      setValue(findByLabel(root, 'اسم جز'), 'پیچ آلن');
      await fixture.whenStable();

      const page = fixture.componentInstance as unknown as Submittable;
      const submitted = page.onSubmit();
      httpMock.expectOne({ method: 'PATCH', url: '/api/components/component-1' }).flush(
        recordHasDependentsBody(
          [
            { kind: 'product', count: 1, names: ['کابل NYY'] },
            { kind: 'standard-bom', count: 1, names: ['MI-100'] },
          ],
          'Component',
        ),
        CONFLICT,
      );
      await submitted;
      await fixture.whenStable();

      expect(close).not.toHaveBeenCalled();
      expect(root.querySelector('[role="alert"]')?.textContent).toContain(
        'امکان ویرایش این اطلاعات وجود ندارد، زیرا در ۱ محصول («کابل NYY») و ۱ آنالیز استاندارد («MI-100») استفاده شده است.',
      );
    });
  });

  describe("the System Admin's correction of a component in use (issue #110)", () => {
    const component = { id: 'component-1', name: 'عایق' };
    const PATCH = { method: 'PATCH', url: '/api/components/component-1' };

    async function correct(answer: boolean) {
      localStorage.clear();
      const context = setUp({ mode: 'edit', component });
      const open = answerCorrectionConfirmation(answer);
      await signInAs(Role.system_admin, context.httpMock);
      await context.fixture.whenStable();
      setValue(findByLabel(context.root, 'اسم جز'), 'عایق PVC');
      await context.fixture.whenStable();
      const submitted = (context.fixture.componentInstance as unknown as Submittable).onSubmit();
      context.httpMock
        .expectOne(PATCH)
        .flush(recordHasDependentsBody(undefined, 'Component'), CONFLICT);
      return { ...context, open, submitted };
    }

    it('re-sends the rename with the correction applied once confirmed', async () => {
      const { httpMock, close, open, submitted } = await correct(true);

      const corrected = await vi.waitFor(() => httpMock.expectOne(PATCH));
      expect(corrected.request.body).toEqual({ name: 'عایق PVC', applyToRelatedRecords: true });
      corrected.flush(null, { status: 204, statusText: 'No Content' });
      await submitted;

      expect(askedToConfirm(open)).toBe(true);
      expect(close).toHaveBeenCalledWith(true);
    });

    it('changes nothing and stays open when the correction is not confirmed', async () => {
      const { fixture, root, close, submitted } = await correct(false);

      await submitted;
      await fixture.whenStable();

      expect(close).not.toHaveBeenCalled();
      expect(root.querySelector('[role="alert"]')).toBeNull();
    });
  });
});
