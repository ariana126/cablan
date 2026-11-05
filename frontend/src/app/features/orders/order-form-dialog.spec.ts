import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
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
import { OrderFormDialog, OrderFormDialogData } from './order-form-dialog';
import { order, STANDARD_BOMS } from './testing/orders-fixtures';

const POST = { method: 'POST', url: '/api/orders' };
const PATCH = { method: 'PATCH', url: '/api/orders/o1' };
const NO_CONTENT = { status: 204, statusText: 'No Content' };
const IN_USE = recordHasDependentsBody(
  [{ kind: 'daily-bom', count: 1, names: ['ORD-5001'] }],
  'order',
);

function setUp(data: OrderFormDialogData) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: data },
    ],
  });
  const fixture = TestBed.createComponent(OrderFormDialog);
  const httpMock = TestBed.inject(HttpTestingController);
  return { fixture, close, httpMock, root: fixture.nativeElement as HTMLElement };
}

function fieldLabelled(root: HTMLElement, label: string): HTMLElement {
  const field = Array.from(root.querySelectorAll('mat-form-field')).find(
    (candidate) => candidate.querySelector('mat-label')?.textContent?.trim() === label,
  );
  if (!field) {
    throw new Error(`No field labelled «${label}»`);
  }
  return field as HTMLElement;
}

function orderNumberInput(root: HTMLElement): HTMLInputElement {
  return fieldLabelled(root, 'شماره سفارش').querySelector('input') as HTMLInputElement;
}

async function typeOrderNumber(fixture: ComponentFixture<unknown>, value: string) {
  const input = orderNumberInput(fixture.nativeElement);
  input.value = value;
  input.dispatchEvent(new Event('input'));
  await fixture.whenStable();
}

async function openMiCodes(fixture: ComponentFixture<unknown>): Promise<HTMLElement[]> {
  fieldLabelled(fixture.nativeElement, 'کدهای MI')
    .querySelector<HTMLElement>('.mat-mdc-select-trigger')
    ?.click();
  await fixture.whenStable();
  return Array.from(document.body.querySelectorAll<HTMLElement>('mat-option'));
}

/** Clicks each option holding one of `miCodes` — a click toggles it in a multiple select. */
async function toggleMiCodes(fixture: ComponentFixture<unknown>, miCodes: readonly string[]) {
  const options = await openMiCodes(fixture);
  for (const miCode of miCodes) {
    options.find((option) => option.textContent?.includes(miCode))?.click();
    await fixture.whenStable();
  }
}

function submitButton(root: HTMLElement): HTMLButtonElement {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button[type="submit"]')).find(
    (button) => button.textContent?.trim() === 'ثبت',
  ) as HTMLButtonElement;
}

async function submit(fixture: ComponentFixture<unknown>) {
  submitButton(fixture.nativeElement).click();
  await fixture.whenStable();
}

const errorOf = (root: HTMLElement, label: string) =>
  fieldLabelled(root, label).querySelector('mat-error')?.textContent?.trim();

const alertOf = (root: HTMLElement) =>
  root.querySelector('[role="alert"]')?.textContent?.replace(/\s+/g, ' ').trim();

describe('OrderFormDialog', () => {
  beforeEach(() => localStorage.clear());

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    document.body.querySelectorAll('.cdk-overlay-container').forEach((node) => node.remove());
  });

  describe('defining an order', () => {
    it('offers every standard BOM by its MI code and brand', async () => {
      const { fixture } = setUp({ mode: 'create', standardBoms: STANDARD_BOMS });
      await fixture.whenStable();

      const options = await openMiCodes(fixture);

      expect(options.map((option) => option.textContent?.trim())).toEqual([
        '1001 — لگراند',
        '1002 — کابلان',
        '2001 — افق',
      ]);
    });

    it('stars both fields as required, as its subtitle says', async () => {
      const { fixture, root } = setUp({ mode: 'create', standardBoms: STANDARD_BOMS });
      await fixture.whenStable();

      for (const label of ['شماره سفارش', 'کدهای MI']) {
        expect(
          fieldLabelled(root, label).querySelector('.mat-mdc-form-field-required-marker'),
        ).not.toBeNull();
      }
    });

    it('defines the order with its number and the MI codes chosen, then closes', async () => {
      const { fixture, httpMock, close } = setUp({ mode: 'create', standardBoms: STANDARD_BOMS });
      await fixture.whenStable();

      await typeOrderNumber(fixture, ' ORD-5001 ');
      await toggleMiCodes(fixture, ['1001', '2001']);
      await submit(fixture);

      const request = httpMock.expectOne(POST);
      expect(request.request.body).toEqual({ orderNumber: 'ORD-5001', miCodes: ['1001', '2001'] });
      request.flush({ id: 'o1' }, { status: 201, statusText: 'Created' });
      await vi.waitFor(() => expect(close).toHaveBeenCalledWith(true));
    });

    it('asks for the order number instead of sending an empty one', async () => {
      const { fixture, root, close } = setUp({ mode: 'create', standardBoms: STANDARD_BOMS });
      await fixture.whenStable();

      await typeOrderNumber(fixture, '   ');
      await toggleMiCodes(fixture, ['1001']);
      await submit(fixture);

      expect(errorOf(root, 'شماره سفارش')).toBe('شماره سفارش را وارد کنید.');
      expect(close).not.toHaveBeenCalled();
    });

    it('asks for an MI code instead of sending none', async () => {
      const { fixture, root, close } = setUp({ mode: 'create', standardBoms: STANDARD_BOMS });
      await fixture.whenStable();

      await typeOrderNumber(fixture, 'ORD-5001');
      await submit(fixture);

      expect(errorOf(root, 'کدهای MI')).toBe('دست کم یک کد MI انتخاب کنید.');
      expect(close).not.toHaveBeenCalled();
    });

    it('says on the number field that the number is taken, and stays open', async () => {
      const { fixture, root, httpMock, close } = setUp({
        mode: 'create',
        standardBoms: STANDARD_BOMS,
      });
      await fixture.whenStable();

      await typeOrderNumber(fixture, 'ORD-۵۰۰۱');
      await toggleMiCodes(fixture, ['1002']);
      await submit(fixture);
      httpMock.expectOne(POST).flush({ type: PROBLEM.orderNumberTaken, status: 409 }, CONFLICT);

      await vi.waitFor(() =>
        expect(errorOf(root, 'شماره سفارش')).toBe(
          'این شماره سفارش قبلاً برای سفارش دیگری ثبت شده است.',
        ),
      );
      expect(close).not.toHaveBeenCalled();
    });

    it('says access is denied in the dialog', async () => {
      const { fixture, root, httpMock } = setUp({ mode: 'create', standardBoms: STANDARD_BOMS });
      await fixture.whenStable();

      await typeOrderNumber(fixture, 'ORD-5001');
      await toggleMiCodes(fixture, ['1001']);
      await submit(fixture);
      httpMock.expectOne(POST).flush(null, { status: 403, statusText: 'Forbidden' });

      await vi.waitFor(() =>
        expect(alertOf(root)).toContain('شما اجازهٔ انجام این عملیات را ندارید.'),
      );
    });
  });

  describe('editing an order', () => {
    it('starts from the order as it is', async () => {
      const { fixture, root } = setUp({
        mode: 'edit',
        order: order(),
        standardBoms: STANDARD_BOMS,
      });
      await fixture.whenStable();

      expect(orderNumberInput(root).value).toBe('ORD-5001');
      const selected = (await openMiCodes(fixture)).filter(
        (option) => option.getAttribute('aria-selected') === 'true',
      );
      expect(selected.map((option) => option.textContent?.trim())).toEqual([
        '1001 — لگراند',
        '1002 — کابلان',
      ]);
    });

    it('sends the number and the whole MI code list', async () => {
      const { fixture, httpMock, close } = setUp({
        mode: 'edit',
        order: order(),
        standardBoms: STANDARD_BOMS,
      });
      await fixture.whenStable();

      await typeOrderNumber(fixture, 'ORD-7002');
      await toggleMiCodes(fixture, ['1002']);
      await submit(fixture);

      const request = httpMock.expectOne(PATCH);
      expect(request.request.body).toEqual({ orderNumber: 'ORD-7002', miCodes: ['1001'] });
      request.flush(null, NO_CONTENT);
      await vi.waitFor(() => expect(close).toHaveBeenCalledWith(true));
    });

    it('says where an order in use is used, and stays open', async () => {
      const { fixture, root, httpMock, close } = setUp({
        mode: 'edit',
        order: order(),
        standardBoms: STANDARD_BOMS,
      });
      const open = answerCorrectionConfirmation(true);
      await signInAs(Role.management, httpMock);
      await fixture.whenStable();

      await typeOrderNumber(fixture, 'ORD-5010');
      await submit(fixture);
      httpMock.expectOne(PATCH).flush(IN_USE, CONFLICT);
      await vi.waitFor(() =>
        expect(alertOf(root)).toBe(
          'امکان ویرایش این اطلاعات وجود ندارد، زیرا در ۱ آنالیز روزانه («ORD-5001») استفاده شده است.',
        ),
      );

      expect(askedToConfirm(open)).toBe(false);
      expect(close).not.toHaveBeenCalled();
    });
  });

  describe("the System Admin's correction of an order in use (issue #101)", () => {
    async function renumber(answer: boolean, removeMiCode = false) {
      const context = setUp({ mode: 'edit', order: order(), standardBoms: STANDARD_BOMS });
      const open = answerCorrectionConfirmation(answer);
      await signInAs(Role.system_admin, context.httpMock);
      await context.fixture.whenStable();
      await typeOrderNumber(context.fixture, 'ORD-5010');
      if (removeMiCode) {
        await toggleMiCodes(context.fixture, ['1002']);
      }
      await submit(context.fixture);
      context.httpMock.expectOne(PATCH).flush(IN_USE, CONFLICT);
      return { ...context, open };
    }

    it('re-sends the renumbering with the correction applied once confirmed', async () => {
      const { httpMock, close, open } = await renumber(true);

      const corrected = await vi.waitFor(() => httpMock.expectOne(PATCH));
      expect(corrected.request.body).toEqual({
        orderNumber: 'ORD-5010',
        miCodes: ['1001', '1002'],
        applyToRelatedRecords: true,
      });
      corrected.flush(null, NO_CONTENT);

      await vi.waitFor(() => expect(close).toHaveBeenCalledWith(true));
      expect(askedToConfirm(open)).toBe(true);
    });

    it('changes nothing and stays open when it is not confirmed', async () => {
      const { fixture, root, close, open } = await renumber(false);
      await vi.waitFor(() => expect(askedToConfirm(open)).toBe(true));
      await fixture.whenStable();

      expect(close).not.toHaveBeenCalled();
      expect(root.querySelector('[role="alert"]')).toBeNull();
    });

    it('is not offered when the MI codes change too — the refusal stands', async () => {
      const { root, open } = await renumber(true, true);

      await vi.waitFor(() =>
        expect(alertOf(root)).toContain('امکان ویرایش این اطلاعات وجود ندارد'),
      );
      expect(askedToConfirm(open)).toBe(false);
    });

    it('shows a taken number on the number field after the confirmation', async () => {
      const { fixture, root, httpMock, close } = await renumber(true);

      (await vi.waitFor(() => httpMock.expectOne(PATCH))).flush(
        { type: PROBLEM.orderNumberTaken, status: 409 },
        CONFLICT,
      );
      await vi.waitFor(() =>
        expect(errorOf(root, 'شماره سفارش')).toBe(
          'این شماره سفارش قبلاً برای سفارش دیگری ثبت شده است.',
        ),
      );
      await fixture.whenStable();
      expect(close).not.toHaveBeenCalled();
    });
  });
});
