import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PersianPaginatorIntl } from '../../../core/material/persian-paginator-intl';
import { SessionStore } from '../../../core/identity/session-store';
import { StandardBomReportDetailDialog } from './standard-bom-report-detail-dialog';
import { StandardBomReportFilterDialog } from './standard-bom-report-filter-dialog';
import { StandardBomReportsPage } from './standard-bom-reports-page';

const filterOptions = {
  brands: ['لگراند', 'نگزنس'],
  activeStatuses: [true, false],
  productNames: ['کابل شبکه U/UTP 0.42 LEGRAND'],
  componentNames: ['مغزی', 'روکش'],
};

const row1 = {
  id: '1',
  miCode: '1001',
  brand: 'لگراند',
  productName: 'کابل شبکه U/UTP 0.42 LEGRAND',
  active: true,
};

function setUp() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: MatPaginatorIntl, useClass: PersianPaginatorIntl },
    ],
  });

  const fixture = TestBed.createComponent(StandardBomReportsPage);
  TestBed.inject(ApplicationRef).tick();

  return {
    fixture,
    httpMock: TestBed.inject(HttpTestingController),
    root: fixture.nativeElement as HTMLElement,
  };
}

function tick(): void {
  TestBed.inject(ApplicationRef).tick();
}

function flushFilterOptions(httpMock: HttpTestingController): void {
  httpMock
    .expectOne({ method: 'GET', url: '/api/standard-boms/report/filter-options' })
    .flush(filterOptions);
}

function expectReportRequest(httpMock: HttpTestingController) {
  return httpMock.expectOne({ method: 'POST', url: '/api/standard-boms/report' });
}

function flushInitial(httpMock: HttpTestingController, items = [row1], total = 1): void {
  flushFilterOptions(httpMock);
  expectReportRequest(httpMock).flush({ items, total });
}

function findButton(root: HTMLElement, text: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === text,
  );
}

describe('StandardBomReportsPage', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('shows a loading indicator before the report arrives', () => {
    const { httpMock, root } = setUp();

    expect(root.querySelector('mat-progress-bar')).not.toBeNull();

    flushInitial(httpMock);
  });

  it('requests the first page with the default sort and every filter field left unset', () => {
    const { httpMock } = setUp();

    flushFilterOptions(httpMock);
    const request = expectReportRequest(httpMock);
    expect(request.request.body).toEqual({
      page: 1,
      pageSize: 20,
      sortBy: 'productName',
      sortDir: 'asc',
    });

    request.flush({ items: [row1], total: 1 });
  });

  it('renders every row, with the active flag rendered as بله', async () => {
    const { fixture, httpMock, root } = setUp();

    flushInitial(httpMock);
    await fixture.whenStable();

    expect(root.textContent).toContain('1001');
    expect(root.textContent).toContain('لگراند');
    expect(root.textContent).toContain('کابل شبکه U/UTP 0.42 LEGRAND');
    expect(root.textContent).toContain('بله');
  });

  it('renders the active flag as خیر for an inactive row', async () => {
    const { fixture, httpMock, root } = setUp();

    flushInitial(httpMock, [{ ...row1, active: false }], 1);
    await fixture.whenStable();

    expect(root.textContent).toContain('خیر');
    expect(root.textContent).not.toContain('بله');
  });

  it('shows exactly the four business columns plus the actions column, in order', async () => {
    const { fixture, httpMock, root } = setUp();

    flushInitial(httpMock);
    await fixture.whenStable();

    const headers = Array.from(root.querySelectorAll('th')).map((th) => th.textContent?.trim());
    expect(headers).toEqual(['کد MI', 'نام محصول', 'برند', 'فعال', 'عملیات']);
  });

  it('shows an empty-state message when nothing matches', async () => {
    const { fixture, httpMock, root } = setUp();

    flushInitial(httpMock, [], 0);
    await fixture.whenStable();

    expect(root.textContent).toContain('هیچ آنالیز استانداردی یافت نشد');
  });

  it('shows a generic error and a retry button when the report fails to load', async () => {
    const { fixture, httpMock, root } = setUp();

    flushFilterOptions(httpMock);
    expectReportRequest(httpMock).flush(
      { title: 'Internal Server Error' },
      { status: 500, statusText: 'Server Error' },
    );
    await fixture.whenStable();

    const alert = root.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('بارگذاری نشد');
    expect(root.querySelector('table')).toBeNull();

    findButton(root, 'تلاش دوباره')?.dispatchEvent(new Event('click'));
    tick();
    expectReportRequest(httpMock).flush({ items: [row1], total: 1 });
  });

  it('requests a later page with the paginator-chosen page size', async () => {
    const { fixture, httpMock, root } = setUp();

    flushInitial(httpMock, [row1], 87);
    await fixture.whenStable();

    const nextPageButton = root.querySelector<HTMLButtonElement>(
      'button.mat-mdc-paginator-navigation-next',
    );
    nextPageButton?.dispatchEvent(new Event('click'));
    tick();

    const request = expectReportRequest(httpMock);
    expect(request.request.body).toEqual({
      page: 2,
      pageSize: 20,
      sortBy: 'productName',
      sortDir: 'asc',
    });

    request.flush({ items: [], total: 87 });
  });

  it('opens a string filter dialog seeded with every distinct value and no prior selection', async () => {
    const { fixture, httpMock, root } = setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(undefined) } as MatDialogRef<unknown, unknown>);

    findButton(root, 'فیلتر برند')?.dispatchEvent(new Event('click'));

    expect(openSpy).toHaveBeenCalledWith(
      StandardBomReportFilterDialog,
      expect.objectContaining({
        data: expect.objectContaining({
          fieldLabel: 'برند',
        }),
      }),
    );
  });

  it('opens the فعال filter dialog with the boolean option list (بله/خیر)', async () => {
    const { fixture, httpMock, root } = setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(undefined) } as MatDialogRef<unknown, unknown>);

    findButton(root, 'فیلتر فعال')?.dispatchEvent(new Event('click'));

    expect(openSpy).toHaveBeenCalled();
  });

  it('re-requests the report with a string filter applied and resets to the first page', async () => {
    const { fixture, httpMock, root } = setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    vi.spyOn(dialog, 'open').mockReturnValue({
      afterClosed: () => of({ selected: ['لگراند'] }),
    } as MatDialogRef<unknown, unknown>);

    findButton(root, 'فیلتر برند')?.dispatchEvent(new Event('click'));
    tick();

    const request = expectReportRequest(httpMock);
    expect(request.request.body).toEqual({
      page: 1,
      pageSize: 20,
      sortBy: 'productName',
      sortDir: 'asc',
      filters: { brands: ['لگراند'] },
    });

    request.flush({ items: [row1], total: 1 });
  });

  it('re-requests the report with the activeStatuses boolean filter applied', async () => {
    const { fixture, httpMock, root } = setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    vi.spyOn(dialog, 'open').mockReturnValue({
      afterClosed: () => of({ selected: [true] }),
    } as MatDialogRef<unknown, unknown>);

    findButton(root, 'فیلتر فعال')?.dispatchEvent(new Event('click'));
    tick();

    const request = expectReportRequest(httpMock);
    expect(request.request.body).toEqual({
      page: 1,
      pageSize: 20,
      sortBy: 'productName',
      sortDir: 'asc',
      filters: { activeStatuses: [true] },
    });

    request.flush({ items: [row1], total: 1 });
  });

  it('opens the detail dialog for the row its button was clicked on', async () => {
    const { fixture, httpMock, root } = setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(undefined) } as MatDialogRef<unknown, unknown>);

    root
      .querySelector<HTMLButtonElement>('[aria-label="جزئیات 1001"]')
      ?.dispatchEvent(new Event('click'));

    expect(openSpy).toHaveBeenCalledWith(
      StandardBomReportDetailDialog,
      expect.objectContaining({ data: { id: '1', miCode: '1001' } }),
    );
  });

  it('has a logout button that clears the session and navigates to the login page', async () => {
    const { fixture, httpMock, root } = setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const session = TestBed.inject(SessionStore);
    session.store('a-token');
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    findButton(root, 'خروج از سیستم')?.dispatchEvent(new Event('click'));

    expect(session.isAuthenticated()).toBe(false);
    expect(navigateSpy).toHaveBeenCalledWith('/login');
  });

  it('sends sortDir desc when the product name header is clicked once', async () => {
    const { fixture, httpMock, root } = setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    root
      .querySelector<HTMLTableCellElement>('th.mat-column-productName')
      ?.dispatchEvent(new MouseEvent('click'));
    tick();

    const request = expectReportRequest(httpMock);
    expect(request.request.body).toEqual({
      page: 1,
      pageSize: 20,
      sortBy: 'productName',
      sortDir: 'desc',
    });

    request.flush({ items: [row1], total: 1 });
  });
});
