import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  StandardBomReportDetailDialog,
  StandardBomReportDetailDialogData,
} from './standard-bom-report-detail-dialog';

function setUp(data: StandardBomReportDetailDialogData) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close: vi.fn() } },
    ],
  });

  const fixture = TestBed.createComponent(StandardBomReportDetailDialog);
  TestBed.inject(ApplicationRef).tick();

  return {
    fixture,
    httpMock: TestBed.inject(HttpTestingController),
    root: fixture.nativeElement as HTMLElement,
  };
}

const detailResponse = {
  id: '1',
  miCode: '1001',
  brand: 'لگراند',
  productName: 'کابل شبکه U/UTP 0.42 LEGRAND',
  standardLength: 305,
  active: true,
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

describe('StandardBomReportDetailDialog', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('shows a loading indicator before the detail arrives', () => {
    const { httpMock, root } = setUp({ id: '1', miCode: '1001' });

    expect(root.querySelector('mat-progress-bar')).not.toBeNull();

    httpMock
      .expectOne({ method: 'GET', url: '/api/standard-boms/report/detail/1001' })
      .flush(detailResponse);
  });

  it('flattens every component/material pair into its own row, in order', async () => {
    const { fixture, httpMock, root } = setUp({ id: '1', miCode: '1001' });
    httpMock
      .expectOne({ method: 'GET', url: '/api/standard-boms/report/detail/1001' })
      .flush(detailResponse);
    await fixture.whenStable();

    const table = root.querySelector('[aria-label="اجزا و مواد اولیه"]');
    const rows = Array.from(table?.querySelectorAll('tbody tr') ?? []).map((row) =>
      Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim()),
    );

    expect(rows).toEqual([
      ['مغزی', 'مسی', '10'],
      ['مغزی', 'آلومینیوم', '5'],
      ['روکش', 'مسی', '8'],
    ]);
  });

  it('shows the standard length, description and total weight', async () => {
    const { fixture, httpMock, root } = setUp({ id: '1', miCode: '1001' });
    httpMock
      .expectOne({ method: 'GET', url: '/api/standard-boms/report/detail/1001' })
      .flush(detailResponse);
    await fixture.whenStable();

    expect(root.textContent).toContain('305');
    expect(root.textContent).toContain('بررسی کیفیت اولیه');
    expect(root.textContent).toContain('23');
  });

  it('shows a generic error and a retry button when the detail fails to load', async () => {
    const { fixture, httpMock, root } = setUp({ id: '1', miCode: '1001' });
    httpMock
      .expectOne({ method: 'GET', url: '/api/standard-boms/report/detail/1001' })
      .flush({ title: 'Internal Server Error' }, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    const alert = root.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('بارگذاری نشد');
  });
});
