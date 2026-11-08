import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CONFLICT,
  recordHasDependentsBody,
} from '../../core/http/testing/record-has-dependents-problem';
import {
  ConfirmDeleteOrderDialog,
  ConfirmDeleteOrderDialogData,
} from './confirm-delete-order-dialog';
import { order } from './testing/orders-fixtures';

const DELETE = { method: 'DELETE', url: '/api/orders/o1' };

function setUp(data: ConfirmDeleteOrderDialogData) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: data },
    ],
  });
  const fixture = TestBed.createComponent(ConfirmDeleteOrderDialog);
  return {
    fixture,
    close,
    httpMock: TestBed.inject(HttpTestingController),
    root: fixture.nativeElement as HTMLElement,
  };
}

async function confirm(fixture: ComponentFixture<unknown>) {
  Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'))
    .find((button) => button.textContent?.trim() === 'حذف')
    ?.click();
  await fixture.whenStable();
}

const text = (root: HTMLElement) => root.textContent?.replace(/\s+/g, ' ');

describe('ConfirmDeleteOrderDialog', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('names the order it deletes and says it cannot be undone', async () => {
    const { fixture, root } = setUp({ order: order(), deletesDailyBoms: false });
    await fixture.whenStable();

    expect(text(root)).toContain('سفارش «ORD-5001» حذف می‌شود.');
    expect(text(root)).toContain('این کار قابل بازگشت نیست.');
    expect(text(root)).not.toContain('آنالیز روزانه');
  });

  it('tells the System Admin exactly how many daily BOMs go with an order in use', async () => {
    const { fixture, root } = setUp({
      order: order({ dailyBomCount: 12 }),
      deletesDailyBoms: true,
    });
    await fixture.whenStable();

    expect(text(root)).toContain('۱۲ آنالیز روزانه همراه آن حذف می‌شود.');
  });

  it('confirms with a button named exactly «حذف»', async () => {
    const { fixture, root } = setUp({ order: order(), deletesDailyBoms: false });
    await fixture.whenStable();

    const names = Array.from(root.querySelectorAll('button')).map((button) =>
      button.textContent?.trim(),
    );
    expect(names).toContain('حذف');
  });

  it('deletes the order and closes', async () => {
    const { fixture, httpMock, close } = setUp({ order: order(), deletesDailyBoms: false });
    await fixture.whenStable();

    await confirm(fixture);
    httpMock.expectOne(DELETE).flush(null, { status: 204, statusText: 'No Content' });

    await vi.waitFor(() => expect(close).toHaveBeenCalledWith(true));
  });

  it('says where an order in use is used, and stays open', async () => {
    const { fixture, root, httpMock, close } = setUp({
      order: order({ dailyBomCount: 1 }),
      deletesDailyBoms: false,
    });
    await fixture.whenStable();

    await confirm(fixture);
    httpMock
      .expectOne(DELETE)
      .flush(
        recordHasDependentsBody([{ kind: 'daily-bom', count: 1, names: ['ORD-5001'] }], 'order'),
        CONFLICT,
      );

    await vi.waitFor(() =>
      expect(root.querySelector('[role="alert"]')?.textContent?.replace(/\s+/g, ' ')).toContain(
        'امکان حذف این اطلاعات وجود ندارد، زیرا در ۱ آنالیز روزانه («ORD-5001») استفاده شده است.',
      ),
    );
    expect(close).not.toHaveBeenCalled();
  });
});
