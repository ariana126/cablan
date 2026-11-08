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
import { fieldLabelled, pickMiCode, shownOptions, typeInto } from './testing/autocomplete';
import { MI_CODE_OPTIONS, order } from './testing/orders-fixtures';

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

const CREATE: OrderFormDialogData = { mode: 'create', miCodeOptions: MI_CODE_OPTIONS };

function orderNumberInput(root: HTMLElement): HTMLInputElement {
  return fieldLabelled(root, 'شماره سفارش').querySelector('input') as HTMLInputElement;
}

function miCodesInput(root: HTMLElement): HTMLInputElement {
  return fieldLabelled(root, 'کدهای MI').querySelector('input') as HTMLInputElement;
}

async function typeOrderNumber(fixture: ComponentFixture<unknown>, value: string) {
  const input = orderNumberInput(fixture.nativeElement);
  input.value = value;
  input.dispatchEvent(new Event('input'));
  await fixture.whenStable();
}

/** Picks each of `miCodes` from the «کدهای MI» autocomplete, one after the other. */
async function chooseMiCodes(fixture: ComponentFixture<unknown>, miCodes: readonly string[]) {
  for (const miCode of miCodes) {
    await pickMiCode(fixture, miCodesInput(fixture.nativeElement), miCode);
  }
}

const chips = (root: HTMLElement) =>
  Array.from(root.querySelectorAll('mat-chip-row')).map((chip) =>
    chip.textContent?.replace(/\s+/g, ' ').trim(),
  );

const removeButton = (root: HTMLElement, miCode: string) =>
  root.querySelector<HTMLButtonElement>(`button[aria-label="برداشتن ${miCode}"]`);

async function removeMiCode(fixture: ComponentFixture<unknown>, miCode: string) {
  removeButton(fixture.nativeElement, miCode)?.click();
  await fixture.whenStable();
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
    it('names its MI code picker «کدهای MI», a combobox', async () => {
      const { fixture, root } = setUp(CREATE);
      await fixture.whenStable();

      expect(miCodesInput(root).getAttribute('role')).toBe('combobox');
    });

    it('offers every MI code with its product', async () => {
      const { fixture, root } = setUp(CREATE);
      await fixture.whenStable();

      await typeInto(fixture, miCodesInput(root), '');

      expect(shownOptions()).toEqual(['1001 — کابل 2.5', '1002 — کابل 2.5', '2001 — کابل 4']);
    });

    it('narrows the offer to what is typed, by code or by product', async () => {
      const { fixture, root } = setUp(CREATE);
      await fixture.whenStable();

      await typeInto(fixture, miCodesInput(root), 'کابل 4');
      expect(shownOptions()).toEqual(['2001 — کابل 4']);

      await typeInto(fixture, miCodesInput(root), '100');
      expect(shownOptions()).toEqual(['1001 — کابل 2.5', '1002 — کابل 2.5']);
    });

    it('shows each picked code as a chip, and no longer offers it', async () => {
      const { fixture, root } = setUp(CREATE);
      await fixture.whenStable();

      await chooseMiCodes(fixture, ['1002']);

      expect(chips(root)).toEqual(['1002 — کابل 2.5']);
      expect(miCodesInput(root).value).toBe('');
      await typeInto(fixture, miCodesInput(root), '');
      expect(shownOptions()).toEqual(['1001 — کابل 2.5', '2001 — کابل 4']);
    });

    it('takes a chip back with its «برداشتن» button', async () => {
      const { fixture, root } = setUp(CREATE);
      await fixture.whenStable();
      await chooseMiCodes(fixture, ['1001', '2001']);

      await removeMiCode(fixture, '1001');

      expect(chips(root)).toEqual(['2001 — کابل 4']);
    });

    it('stars both fields as required, as its subtitle says', async () => {
      const { fixture, root } = setUp(CREATE);
      await fixture.whenStable();

      for (const label of ['شماره سفارش', 'کدهای MI']) {
        expect(
          fieldLabelled(root, label).querySelector('.mat-mdc-form-field-required-marker'),
        ).not.toBeNull();
      }
    });

    it('defines the order with its number and the MI codes chosen, then closes', async () => {
      const { fixture, httpMock, close } = setUp(CREATE);
      await fixture.whenStable();

      await typeOrderNumber(fixture, ' ORD-5001 ');
      await chooseMiCodes(fixture, ['1001', '2001']);
      await submit(fixture);

      const request = httpMock.expectOne(POST);
      expect(request.request.body).toEqual({ orderNumber: 'ORD-5001', miCodes: ['1001', '2001'] });
      request.flush({ id: 'o1' }, { status: 201, statusText: 'Created' });
      await vi.waitFor(() => expect(close).toHaveBeenCalledWith(true));
    });

    it('keeps «ثبت» enabled and asks for both fields instead of sending an empty form', async () => {
      const { fixture, root, close } = setUp(CREATE);
      await fixture.whenStable();

      expect(submitButton(root).disabled).toBe(false);
      await submit(fixture);

      expect(errorOf(root, 'شماره سفارش')).toBe('شماره سفارش را وارد کنید.');
      expect(errorOf(root, 'کدهای MI')).toBe('دست کم یک کد MI انتخاب کنید.');
      expect(close).not.toHaveBeenCalled();
    });

    it('asks for the order number instead of sending a blank one', async () => {
      const { fixture, root, close } = setUp(CREATE);
      await fixture.whenStable();

      await typeOrderNumber(fixture, '   ');
      await chooseMiCodes(fixture, ['1001']);
      await submit(fixture);

      expect(errorOf(root, 'شماره سفارش')).toBe('شماره سفارش را وارد کنید.');
      expect(close).not.toHaveBeenCalled();
    });

    it('asks for an MI code instead of sending none', async () => {
      const { fixture, root, close } = setUp(CREATE);
      await fixture.whenStable();

      await typeOrderNumber(fixture, 'ORD-5001');
      await submit(fixture);

      expect(errorOf(root, 'کدهای MI')).toBe('دست کم یک کد MI انتخاب کنید.');
      expect(close).not.toHaveBeenCalled();
    });

    it('says on the number field that the number is taken, and stays open', async () => {
      const { fixture, root, httpMock, close } = setUp(CREATE);
      await fixture.whenStable();

      await typeOrderNumber(fixture, 'ORD-۵۰۰۱');
      await chooseMiCodes(fixture, ['1002']);
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
      const { fixture, root, httpMock } = setUp(CREATE);
      await fixture.whenStable();

      await typeOrderNumber(fixture, 'ORD-5001');
      await chooseMiCodes(fixture, ['1001']);
      await submit(fixture);
      httpMock.expectOne(POST).flush(null, { status: 403, statusText: 'Forbidden' });

      await vi.waitFor(() =>
        expect(alertOf(root)).toContain('شما اجازهٔ انجام این عملیات را ندارید.'),
      );
    });
  });

  describe('editing an order', () => {
    it('starts from the order as it is, each code removable', async () => {
      const { fixture, root } = setUp({
        mode: 'edit',
        order: order(),
        miCodeOptions: MI_CODE_OPTIONS,
      });
      await fixture.whenStable();

      expect(orderNumberInput(root).value).toBe('ORD-5001');
      expect(chips(root)).toEqual(['1001 — کابل 2.5', '1002 — کابل 2.5']);
      expect(removeButton(root, '1001')).not.toBeNull();
      expect(miCodesInput(root).disabled).toBe(false);
    });

    it('sends the number and the whole MI code list', async () => {
      const { fixture, httpMock, close } = setUp({
        mode: 'edit',
        order: order(),
        miCodeOptions: MI_CODE_OPTIONS,
      });
      await fixture.whenStable();

      await typeOrderNumber(fixture, 'ORD-7002');
      await removeMiCode(fixture, '1002');
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
        miCodeOptions: MI_CODE_OPTIONS,
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
    it('locks the MI codes of an order with daily BOMs, and says only the number can change', async () => {
      const { fixture, root } = setUp({
        mode: 'edit',
        order: order({ dailyBomCount: 2 }),
        miCodeOptions: MI_CODE_OPTIONS,
      });
      await fixture.whenStable();

      expect(chips(root)).toEqual(['1001 — کابل 2.5', '1002 — کابل 2.5']);
      expect(removeButton(root, '1001')).toBeNull();
      expect(miCodesInput(root).disabled).toBe(true);
      expect(fieldLabelled(root, 'کدهای MI').querySelector('mat-hint')?.textContent?.trim()).toBe(
        'این سفارش در آنالیز روزانه ثبت شده است؛ فقط شمارهٔ آن را می‌توان اصلاح کرد.',
      );
    });

    async function renumber(answer: boolean, removeCode = false, dailyBomCount = 0) {
      const context = setUp({
        mode: 'edit',
        order: order({ dailyBomCount }),
        miCodeOptions: MI_CODE_OPTIONS,
      });
      const open = answerCorrectionConfirmation(answer);
      await signInAs(Role.system_admin, context.httpMock);
      await context.fixture.whenStable();
      await typeOrderNumber(context.fixture, 'ORD-5010');
      if (removeCode) {
        await removeMiCode(context.fixture, '1002');
      }
      await submit(context.fixture);
      context.httpMock.expectOne(PATCH).flush(IN_USE, CONFLICT);
      return { ...context, open };
    }

    it('re-sends the renumbering with the correction applied once confirmed', async () => {
      const { httpMock, close, open } = await renumber(true, false, 1);

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
