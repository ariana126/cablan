import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BomPreviewDialog, BomPreviewDialogData } from './bom-preview-dialog';

function setUp(data: BomPreviewDialogData = { id: 'bom-1' }) {
  const dialogRef = { close: vi.fn() };

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: dialogRef },
    ],
  });

  const fixture = TestBed.createComponent(BomPreviewDialog);
  TestBed.inject(ApplicationRef).tick();

  return {
    fixture,
    dialogRef,
    httpMock: TestBed.inject(HttpTestingController),
    root: fixture.nativeElement as HTMLElement,
  };
}

/** One line above its standard, one below, one exactly on it. */
const weightDifferences = {
  lines: [
    {
      componentId: 'c1',
      componentName: 'مغزی',
      materialId: 'm1',
      materialName: 'مس',
      actualWeight: 12.5,
      standardWeight: 10,
      difference: 2.5,
    },
    {
      componentId: 'c1',
      componentName: 'مغزی',
      materialId: 'm2',
      materialName: 'آلومینیوم',
      actualWeight: 4,
      standardWeight: 5.5,
      difference: 1.5,
    },
    {
      componentId: 'c2',
      componentName: 'روکش',
      materialId: 'm3',
      materialName: 'پی‌وی‌سی',
      actualWeight: 8,
      standardWeight: 8,
      difference: 0,
    },
  ],
};

function expectWeightDifferences(httpMock: HttpTestingController) {
  return httpMock.expectOne({ method: 'GET', url: '/api/boms/bom-1/weight-differences' });
}

function table(root: HTMLElement): HTMLElement | null {
  return root.querySelector('table[aria-label="اختلاف وزن مواد اولیه"]');
}

function cells(root: HTMLElement): (string | undefined)[][] {
  return Array.from(table(root)?.querySelectorAll('tbody tr') ?? []).map((row) =>
    Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim()),
  );
}

function findButton(root: HTMLElement, text: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === text,
  );
}

describe('BomPreviewDialog', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('is titled «پیش‌نمایش آنالیز روزانه»', () => {
    const { httpMock, root } = setUp();

    expect(root.querySelector('h2')?.textContent?.trim()).toBe('پیش‌نمایش آنالیز روزانه');

    expectWeightDifferences(httpMock).flush(weightDifferences);
  });

  it('shows a loading indicator before the weight differences arrive', () => {
    const { httpMock, root } = setUp();

    expect(root.querySelector('mat-progress-bar')).not.toBeNull();
    expect(table(root)).toBeNull();

    expectWeightDifferences(httpMock).flush(weightDifferences);
  });

  it('heads the table with the component, material, weight and difference — and no standard weight', async () => {
    const { fixture, httpMock, root } = setUp();
    expectWeightDifferences(httpMock).flush(weightDifferences);
    await fixture.whenStable();

    const headers = Array.from(table(root)?.querySelectorAll('thead th') ?? []).map((th) =>
      th.textContent?.trim(),
    );

    expect(headers).toEqual(['نام جز', 'نام مواد اولیه', 'وزن مواد اولیه', 'اختلاف وزن']);
  });

  it('lists every material line with its actual weight in Persian digits', async () => {
    const { fixture, httpMock, root } = setUp();
    expectWeightDifferences(httpMock).flush(weightDifferences);
    await fixture.whenStable();

    expect(cells(root).map((row) => row.slice(0, 3))).toEqual([
      ['مغزی', 'مس', '۱۲٫۵'],
      ['مغزی', 'آلومینیوم', '۴'],
      ['روکش', 'پی‌وی‌سی', '۸'],
    ]);
  });

  it('shows each difference as a pill pointing above or below the standard, and none for an exact match', async () => {
    const { fixture, httpMock, root } = setUp();
    expectWeightDifferences(httpMock).flush(weightDifferences);
    await fixture.whenStable();

    const differenceCells = Array.from(table(root)?.querySelectorAll('tbody tr') ?? []).map(
      (row) => row.querySelectorAll('td')[3],
    );
    const pills = differenceCells.map((cell) => ({
      value: cell?.querySelector('.weight-difference__value')?.textContent?.trim(),
      spoken: cell?.querySelector('.visually-hidden')?.textContent?.trim(),
    }));

    expect(pills.slice(0, 2)).toEqual([
      { value: '۲٫۵', spoken: 'بیشتر از استاندارد' },
      { value: '۱٫۵', spoken: 'کمتر از استاندارد' },
    ]);
    expect(differenceCells[2]?.querySelector('app-weight-difference')).toBeNull();
    expect(differenceCells[2]?.textContent?.trim()).toBe('');
  });

  it('never shows the standard weight', async () => {
    const { fixture, httpMock, root } = setUp();
    expectWeightDifferences(httpMock).flush(weightDifferences);
    await fixture.whenStable();

    // ۱۰ and ۵٫۵ are the first two lines' standard weights; nothing else on the dialog reads so.
    expect(root.textContent).not.toContain('۱۰');
    expect(root.textContent).not.toContain('۵٫۵');
  });

  it('tells the visitor when the differences could not be loaded, and lets them retry', async () => {
    const { fixture, httpMock, root } = setUp();
    expectWeightDifferences(httpMock).flush(
      { title: 'Internal Server Error' },
      { status: 500, statusText: 'Server Error' },
    );
    await fixture.whenStable();

    expect(root.textContent).toContain('اختلاف وزن مواد اولیه بارگذاری نشد.');
    expect(table(root)).toBeNull();

    findButton(root, 'تلاش دوباره')?.dispatchEvent(new Event('click'));
    TestBed.inject(ApplicationRef).tick();

    expectWeightDifferences(httpMock).flush(weightDifferences);
    await fixture.whenStable();

    expect(cells(root)).toHaveLength(3);
  });

  it('closes with nothing to do on «تایید»', async () => {
    const { fixture, httpMock, root, dialogRef } = setUp();
    expectWeightDifferences(httpMock).flush(weightDifferences);
    await fixture.whenStable();

    findButton(root, 'تایید')?.dispatchEvent(new Event('click'));

    expect(dialogRef.close).toHaveBeenCalledWith();
  });

  it('closes asking for the edit form on «ویرایش»', async () => {
    const { fixture, httpMock, root, dialogRef } = setUp();
    expectWeightDifferences(httpMock).flush(weightDifferences);
    await fixture.whenStable();

    findButton(root, 'ویرایش')?.dispatchEvent(new Event('click'));

    expect(dialogRef.close).toHaveBeenCalledWith('edit');
  });

  it('still offers «ویرایش» when the differences failed to load', async () => {
    const { fixture, httpMock, root } = setUp();
    expectWeightDifferences(httpMock).flush(
      { title: 'Internal Server Error' },
      { status: 500, statusText: 'Server Error' },
    );
    await fixture.whenStable();

    expect(findButton(root, 'ویرایش')).toBeDefined();
    expect(findButton(root, 'تایید')).toBeDefined();
  });
});
