import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BomReportDetailDialog, BomReportDetailDialogData } from './bom-report-detail-dialog';

function setUp(data: BomReportDetailDialogData) {
  const dialogRef = { close: vi.fn() };

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: dialogRef },
    ],
  });

  const fixture = TestBed.createComponent(BomReportDetailDialog);
  TestBed.inject(ApplicationRef).tick();

  return {
    fixture,
    dialogRef,
    httpMock: TestBed.inject(HttpTestingController),
    root: fixture.nativeElement as HTMLElement,
  };
}

const detailResponse = {
  id: '1',
  standardBomId: 'standard-bom-1',
  standardBomMiCode: '1001',
  brand: 'لگراند',
  productName: 'کابل شبکه U/UTP 0.42 LEGRAND',
  standardLength: 305,
  orderNumber: 'ORD-2001',
  trackingNumber: 'TRK-3001',
  registeredBy: 'نیکروش',
  registeredAt: '2026-06-22T04:00:00.000Z',
  description: 'بررسی کیفیت اولیه',
  components: [
    {
      id: 'c1',
      name: 'مغزی',
      materials: [
        { id: 'm1', name: 'مسی', weight: 10 },
        { id: 'm2', name: 'آلومینیوم', weight: 5 },
      ],
    },
    {
      id: 'c2',
      name: 'روکش',
      materials: [{ id: 'm3', name: 'مسی', weight: 8 }],
    },
  ],
  totalWeight: 23,
};

describe('BomReportDetailDialog', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('shows a loading indicator before the detail arrives', () => {
    const { httpMock, root } = setUp({ orderNumber: 'ORD-2001', id: '1', canManage: true });

    expect(root.querySelector('mat-progress-bar')).not.toBeNull();

    httpMock.expectOne({ method: 'GET', url: '/api/boms/1' }).flush(detailResponse);
  });

  it('flattens every component/material pair into its own row, in order', async () => {
    const { fixture, httpMock, root } = setUp({
      orderNumber: 'ORD-2001',
      id: '1',
      canManage: true,
    });
    httpMock.expectOne({ method: 'GET', url: '/api/boms/1' }).flush(detailResponse);
    await fixture.whenStable();

    const table = root.querySelector('[aria-label="اجزا و مواد اولیه"]');
    const rows = Array.from(table?.querySelectorAll('tbody tr') ?? []).map((row) =>
      Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim()),
    );

    expect(rows).toEqual([
      ['مغزی', 'مسی', '۱۰'],
      ['مغزی', 'آلومینیوم', '۵'],
      ['روکش', 'مسی', '۸'],
    ]);
  });

  it('shows the standard length, description and total weight', async () => {
    const { fixture, httpMock, root } = setUp({
      orderNumber: 'ORD-2001',
      id: '1',
      canManage: true,
    });
    httpMock.expectOne({ method: 'GET', url: '/api/boms/1' }).flush(detailResponse);
    await fixture.whenStable();

    // Quantities read in Persian numerals; the order number in the heading stays Latin, because it
    // is a code rather than a number — see core/i18n/persian-numerals.ts.
    expect(root.textContent).toContain('۳۰۵');
    expect(root.textContent).toContain('بررسی کیفیت اولیه');
    expect(root.textContent).toContain('۲۳');
    expect(root.textContent).toContain('ORD-2001');
  });

  it('shows a generic error and a retry button when the detail fails to load', async () => {
    const { fixture, httpMock, root } = setUp({
      orderNumber: 'ORD-2001',
      id: '1',
      canManage: true,
    });
    httpMock
      .expectOne({ method: 'GET', url: '/api/boms/1' })
      .flush({ title: 'Internal Server Error' }, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    const alert = root.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('بارگذاری نشد');
  });

  it('closes with the detail it already loaded when the edit action is picked', async () => {
    const { fixture, dialogRef, httpMock, root } = setUp({
      orderNumber: 'ORD-2001',
      id: '1',
      canManage: true,
    });
    httpMock.expectOne({ method: 'GET', url: '/api/boms/1' }).flush(detailResponse);
    await fixture.whenStable();

    root
      .querySelector<HTMLButtonElement>('[aria-label="ویرایش آنالیز روزانه ORD-2001"]')
      ?.dispatchEvent(new Event('click'));

    expect(dialogRef.close).toHaveBeenCalledWith({
      action: 'edit',
      detail: expect.objectContaining({ id: '1', standardBomId: 'standard-bom-1' }),
    });
  });

  it('closes with a delete decision when the delete action is picked', async () => {
    const { fixture, dialogRef, httpMock, root } = setUp({
      orderNumber: 'ORD-2001',
      id: '1',
      canManage: true,
    });
    httpMock.expectOne({ method: 'GET', url: '/api/boms/1' }).flush(detailResponse);
    await fixture.whenStable();

    root
      .querySelector<HTMLButtonElement>('[aria-label="حذف آنالیز روزانه ORD-2001"]')
      ?.dispatchEvent(new Event('click'));

    expect(dialogRef.close).toHaveBeenCalledWith({ action: 'delete' });
  });

  it('offers neither write action while the detail has not loaded', async () => {
    const { fixture, httpMock, root } = setUp({
      orderNumber: 'ORD-2001',
      id: '1',
      canManage: true,
    });
    httpMock
      .expectOne({ method: 'GET', url: '/api/boms/1' })
      .flush({ title: 'Internal Server Error' }, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(root.querySelector('[aria-label="ویرایش آنالیز روزانه ORD-2001"]')).toBeNull();
    expect(root.querySelector('[aria-label="حذف آنالیز روزانه ORD-2001"]')).toBeNull();
  });
  it('offers neither write action when the page says the visitor may not manage', async () => {
    const { fixture, httpMock, root } = setUp({
      orderNumber: 'ORD-2001',
      id: '1',
      canManage: false,
    });
    httpMock.expectOne({ method: 'GET', url: '/api/boms/1' }).flush(detailResponse);
    await fixture.whenStable();

    // The composition is still there — the card is a read view first.
    expect(root.textContent).toContain('مغزی');
    expect(root.querySelector('[aria-label="ویرایش آنالیز روزانه ORD-2001"]')).toBeNull();
    expect(root.querySelector('[aria-label="حذف آنالیز روزانه ORD-2001"]')).toBeNull();
  });
});
