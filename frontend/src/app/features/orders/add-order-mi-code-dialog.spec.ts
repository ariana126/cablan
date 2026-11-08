import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
import { CONFLICT } from '../../core/http/testing/record-has-dependents-problem';
import { AddOrderMiCodeDialog, AddOrderMiCodeDialogData } from './add-order-mi-code-dialog';
import { fieldLabelled, pickMiCode, shownOptions, typeInto } from './testing/autocomplete';
import { MI_CODE_OPTIONS, order } from './testing/orders-fixtures';

const POST = { method: 'POST', url: '/api/orders/o1/mi-codes' };
const DATA: AddOrderMiCodeDialogData = {
  order: order({
    miCodes: [{ standardBomId: 's1', miCode: '1001', productId: 'p1', productName: 'کابل 2.5' }],
  }),
  miCodeOptions: MI_CODE_OPTIONS,
};

function setUp(data: AddOrderMiCodeDialogData = DATA) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: data },
    ],
  });
  const fixture = TestBed.createComponent(AddOrderMiCodeDialog);
  return {
    fixture,
    close,
    httpMock: TestBed.inject(HttpTestingController),
    root: fixture.nativeElement as HTMLElement,
  };
}

const miCodeInput = (root: HTMLElement) =>
  fieldLabelled(root, 'کد MI').querySelector('input') as HTMLInputElement;

async function add(fixture: ComponentFixture<unknown>) {
  Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'))
    .find((button) => button.textContent?.trim() === 'افزودن')
    ?.click();
  await fixture.whenStable();
}

const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, ' ').trim();

describe('AddOrderMiCodeDialog', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    document.body.querySelectorAll('.cdk-overlay-container').forEach((node) => node.remove());
  });

  it('names the order it adds to', async () => {
    const { fixture, root } = setUp();
    await fixture.whenStable();

    expect(text(root)).toContain('سفارش ORD-5001');
  });

  it('lists the codes already assigned, with their products', async () => {
    const { fixture, root } = setUp();
    await fixture.whenStable();

    const assigned = Array.from(root.querySelectorAll('.assigned-codes li')).map(text);
    expect(assigned).toEqual(['1001 کابل 2.5']);
  });

  it('names its picker «کد MI», a combobox offering only the codes the order lacks', async () => {
    const { fixture, root } = setUp();
    await fixture.whenStable();

    expect(miCodeInput(root).getAttribute('role')).toBe('combobox');
    await typeInto(fixture, miCodeInput(root), '');
    expect(shownOptions()).toEqual(['1002 — کابل 2.5', '2001 — کابل 4']);
  });

  it('narrows the offer to what is typed, by code or by product', async () => {
    const { fixture, root } = setUp();
    await fixture.whenStable();

    await typeInto(fixture, miCodeInput(root), 'کابل 4');

    expect(shownOptions()).toEqual(['2001 — کابل 4']);
  });

  it('adds the chosen code and closes', async () => {
    const { fixture, root, httpMock, close } = setUp();
    await fixture.whenStable();

    await pickMiCode(fixture, miCodeInput(root), '2001');
    await add(fixture);

    const request = httpMock.expectOne(POST);
    expect(request.request.body).toEqual({ miCode: '2001' });
    request.flush(null, { status: 204, statusText: 'No Content' });
    await vi.waitFor(() => expect(close).toHaveBeenCalledWith(true));
  });

  it('asks for a code instead of sending none', async () => {
    const { fixture, root, close } = setUp();
    await fixture.whenStable();

    await add(fixture);

    expect(text(root.querySelector('mat-error'))).toBe('کد MI را انتخاب کنید.');
    expect(close).not.toHaveBeenCalled();
  });

  it('asks for a code from the list instead of sending whatever was typed', async () => {
    const { fixture, root, close } = setUp();
    await fixture.whenStable();

    await typeInto(fixture, miCodeInput(root), '20');
    await add(fixture);

    expect(text(root.querySelector('mat-error'))).toBe('کد MI را از فهرست انتخاب کنید.');
    expect(close).not.toHaveBeenCalled();
  });

  it('says on the field when the code was assigned meanwhile, and stays open', async () => {
    const { fixture, root, httpMock, close } = setUp();
    await fixture.whenStable();

    await pickMiCode(fixture, miCodeInput(root), '2001');
    await add(fixture);
    httpMock
      .expectOne(POST)
      .flush({ type: PROBLEM.orderMiCodeAlreadyAssigned, status: 409 }, CONFLICT);

    await vi.waitFor(() =>
      expect(text(root.querySelector('mat-error'))).toBe(
        'این کد MI قبلاً به این سفارش تخصیص داده شده است.',
      ),
    );
    expect(close).not.toHaveBeenCalled();
  });

  it('says access is denied in the dialog', async () => {
    const { fixture, root, httpMock } = setUp();
    await fixture.whenStable();

    await pickMiCode(fixture, miCodeInput(root), '2001');
    await add(fixture);
    httpMock.expectOne(POST).flush(null, { status: 403, statusText: 'Forbidden' });

    await vi.waitFor(() =>
      expect(text(root.querySelector('[role="alert"]'))).toContain(
        'شما اجازهٔ انجام این عملیات را ندارید.',
      ),
    );
  });

  it('says so when every code is on the order already', async () => {
    const { fixture, root } = setUp({ order: order(), miCodeOptions: MI_CODE_OPTIONS.slice(0, 2) });
    await fixture.whenStable();

    expect(text(root)).toContain('همهٔ کدهای MI به این سفارش تخصیص داده شده‌اند.');
  });
});
