import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
import { CONFLICT } from '../../core/http/testing/record-has-dependents-problem';
import { AddOrderMiCodeDialog, AddOrderMiCodeDialogData } from './add-order-mi-code-dialog';
import { order, STANDARD_BOMS } from './testing/orders-fixtures';

const POST = { method: 'POST', url: '/api/orders/o1/mi-codes' };

function setUp(data: AddOrderMiCodeDialogData) {
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

async function openOptions(fixture: ComponentFixture<unknown>): Promise<HTMLElement[]> {
  (fixture.nativeElement as HTMLElement)
    .querySelector<HTMLElement>('.mat-mdc-select-trigger')
    ?.click();
  await fixture.whenStable();
  return Array.from(document.body.querySelectorAll<HTMLElement>('mat-option'));
}

async function choose(fixture: ComponentFixture<unknown>, miCode: string) {
  (await openOptions(fixture)).find((option) => option.textContent?.includes(miCode))?.click();
  await fixture.whenStable();
}

async function add(fixture: ComponentFixture<unknown>) {
  Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'))
    .find((button) => button.textContent?.trim() === 'افزودن')
    ?.click();
  await fixture.whenStable();
}

describe('AddOrderMiCodeDialog', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    document.body.querySelectorAll('.cdk-overlay-container').forEach((node) => node.remove());
  });

  it('names its select «کد MI» and offers only the codes the order does not hold yet', async () => {
    const { fixture, root } = setUp({ order: order(), standardBoms: STANDARD_BOMS });
    await fixture.whenStable();

    expect(root.querySelector('mat-label')?.textContent?.trim()).toBe('کد MI');
    const options = await openOptions(fixture);
    expect(options.map((option) => option.textContent?.trim())).toEqual(['2001 — افق']);
  });

  it('adds the chosen code and closes', async () => {
    const { fixture, httpMock, close } = setUp({ order: order(), standardBoms: STANDARD_BOMS });
    await fixture.whenStable();

    await choose(fixture, '2001');
    await add(fixture);

    const request = httpMock.expectOne(POST);
    expect(request.request.body).toEqual({ miCode: '2001' });
    request.flush(null, { status: 204, statusText: 'No Content' });
    await vi.waitFor(() => expect(close).toHaveBeenCalledWith(true));
  });

  it('asks for a code instead of sending none', async () => {
    const { fixture, root, close } = setUp({ order: order(), standardBoms: STANDARD_BOMS });
    await fixture.whenStable();

    await add(fixture);

    expect(root.querySelector('mat-error')?.textContent?.trim()).toBe('کد MI را انتخاب کنید.');
    expect(close).not.toHaveBeenCalled();
  });

  it('says on the field when the code was assigned meanwhile, and stays open', async () => {
    const { fixture, root, httpMock, close } = setUp({
      order: order(),
      standardBoms: STANDARD_BOMS,
    });
    await fixture.whenStable();

    await choose(fixture, '2001');
    await add(fixture);
    httpMock
      .expectOne(POST)
      .flush({ type: PROBLEM.orderMiCodeAlreadyAssigned, status: 409 }, CONFLICT);

    await vi.waitFor(() =>
      expect(root.querySelector('mat-error')?.textContent?.trim()).toBe(
        'این کد MI قبلاً به این سفارش تخصیص داده شده است.',
      ),
    );
    expect(close).not.toHaveBeenCalled();
  });

  it('says access is denied in the dialog', async () => {
    const { fixture, root, httpMock } = setUp({ order: order(), standardBoms: STANDARD_BOMS });
    await fixture.whenStable();

    await choose(fixture, '2001');
    await add(fixture);
    httpMock.expectOne(POST).flush(null, { status: 403, statusText: 'Forbidden' });

    await vi.waitFor(() =>
      expect(root.querySelector('[role="alert"]')?.textContent).toContain(
        'شما اجازهٔ انجام این عملیات را ندارید.',
      ),
    );
  });

  it('says so when every code is on the order already', async () => {
    const { fixture, root } = setUp({
      order: order(),
      standardBoms: STANDARD_BOMS.slice(0, 2),
    });
    await fixture.whenStable();

    expect(root.textContent).toContain('همهٔ کدهای MI به این سفارش تخصیص داده شده‌اند.');
  });
});
