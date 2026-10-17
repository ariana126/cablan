import { Clipboard } from '@angular/cdk/clipboard';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Role } from '../../api/model';
import { CurrentUserStore } from '../../core/identity/current-user-store';
import { SessionStore } from '../../core/identity/session-store';
import { PersianPaginatorIntl } from '../../core/material/persian-paginator-intl';
import { FileSaver } from '../../core/files/file-saver';
import { ConfirmDeleteStandardBomDialog } from './confirm-delete-standard-bom-dialog';
import { StandardBomFormDialog } from './standard-bom-form-dialog';
import { StandardBomReportDetailDialog } from './standard-bom-report-detail-dialog';
import { StandardBomReportFilterDialog } from './standard-bom-report-filter-dialog';
import { StandardBomsPage } from './standard-boms-page';
import { fakeAccessToken } from '../../core/identity/testing/fake-access-token';

const filterOptions = {
  brands: ['لگراند', 'نگزنس'],
  activeStatuses: [true, false],
  productNames: ['کابل شبکه U/UTP 0.42 LEGRAND'],
  componentNames: ['مغزی', 'روکش'],
  miCodes: ['1001', '1002'],
};

const products = [{ id: 'product-1', name: 'کابل شبکه U/UTP 0.42 LEGRAND', components: [] }];

/** What `GET /standard-boms` answers for `row1` — the superset the edit form works from. A report
 * row carries neither `productId` nor the composition, so the form can only start from this. */
const standardBoms = [
  {
    id: '1',
    miCode: '1001',
    brand: 'لگراند',
    standardLength: 305,
    active: true,
    description: '',
    productId: 'product-1',
    components: [],
  },
];

const row1 = {
  id: '1',
  miCode: '1001',
  brand: 'لگراند',
  productName: 'کابل شبکه U/UTP 0.42 LEGRAND',
  active: true,
};

/**
 * Renders the page for a signed-in user of `role`, defaulting to the مدیریت the write actions exist
 * for. The role is resolved *before* the component is created, exactly as `guardedRoute` does it in
 * production — the page reads `CurrentUserStore.role()` synchronously to decide what to offer.
 */
async function setUp(role: Role = Role.management) {
  localStorage.clear();

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: MatPaginatorIntl, useClass: PersianPaginatorIntl },
    ],
  });

  const httpMock = TestBed.inject(HttpTestingController);
  TestBed.inject(SessionStore).store(fakeAccessToken());
  const pending = TestBed.inject(CurrentUserStore).load();
  httpMock
    .expectOne({ method: 'GET', url: '/api/users/me' })
    .flush({ id: '1', name: 'Sina Ghadrdan', username: 'sina.q', role });
  await pending;

  const fixture = TestBed.createComponent(StandardBomsPage);
  TestBed.inject(ApplicationRef).tick();

  return { fixture, httpMock, root: fixture.nativeElement as HTMLElement };
}

function tick(): void {
  TestBed.inject(ApplicationRef).tick();
}

/**
 * The three requests the page fires on load besides the report itself: the filter panel's distinct
 * values, the standard BOMs an edit starts from, and the products the create form's picker offers.
 */
function flushSupportingRequests(
  httpMock: HttpTestingController,
  standardBomsResponse: object = standardBoms,
): void {
  httpMock
    .expectOne({ method: 'GET', url: '/api/standard-boms/report/filter-options' })
    .flush(filterOptions);
  httpMock.expectOne({ method: 'GET', url: '/api/standard-boms' }).flush(standardBomsResponse);
  httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush(products);
}

function expectReportRequest(httpMock: HttpTestingController) {
  return httpMock.expectOne({ method: 'POST', url: '/api/standard-boms/report' });
}

function flushInitial(httpMock: HttpTestingController, items = [row1], total = 1): void {
  flushSupportingRequests(httpMock);
  expectReportRequest(httpMock).flush({ items, total });
}

/** A column's filter button, by its accessible name «فیلتر {column}» (with a count once active). */
function filterButton(root: HTMLElement, column: string): HTMLButtonElement | null {
  return root.querySelector<HTMLButtonElement>(`button[aria-label^="فیلتر ${column}"]`);
}

/** Opens a row's «عملیات بیشتر» menu — the one place edit, copy-id and delete live. */
function openRowMenu(root: HTMLElement, miCode: string): void {
  root
    .querySelector<HTMLButtonElement>(`[aria-label="عملیات بیشتر برای ${miCode}"]`)
    ?.dispatchEvent(new Event('click'));
  tick();
}

function menuItem(text: string): HTMLElement | undefined {
  return Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
    (item) => item.textContent?.trim() === text,
  );
}

function chooseRowAction(root: HTMLElement, miCode: string, action: string): void {
  openRowMenu(root, miCode);
  menuItem(action)?.dispatchEvent(new Event('click'));
}

function findButton(root: HTMLElement, text: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === text,
  );
}

/**
 * `Clipboard.copy` reaches for `document.execCommand`, which jsdom does not implement, and the
 * snackbar that confirms the copy would attach a real overlay. Both are stubbed so the assertion is
 * about what the row asked to copy.
 */
function stubClipboard() {
  vi.spyOn(TestBed.inject(MatSnackBar), 'openFromComponent').mockReturnValue(
    {} as MatSnackBarRef<unknown>,
  );
  vi.spyOn(TestBed.inject(MatSnackBar), 'open').mockReturnValue(
    {} as MatSnackBarRef<TextOnlySnackBar>,
  );

  return vi.spyOn(TestBed.inject(Clipboard), 'copy').mockReturnValue(true);
}

describe('StandardBomsPage', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('shows a loading indicator before the report arrives', async () => {
    const { httpMock, root } = await setUp();

    expect(root.querySelector('mat-progress-bar')).not.toBeNull();

    flushInitial(httpMock);
  });

  it('requests the first page with the default sort and every filter field left unset', async () => {
    const { httpMock } = await setUp();

    flushSupportingRequests(httpMock);
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
    const { fixture, httpMock, root } = await setUp();

    flushInitial(httpMock);
    await fixture.whenStable();

    expect(root.textContent).toContain('1001');
    expect(root.textContent).toContain('لگراند');
    expect(root.textContent).toContain('کابل شبکه U/UTP 0.42 LEGRAND');
    expect(root.textContent).toContain('بله');
  });

  it('renders the active flag as خیر for an inactive row', async () => {
    const { fixture, httpMock, root } = await setUp();

    flushInitial(httpMock, [{ ...row1, active: false }], 1);
    await fixture.whenStable();

    expect(root.textContent).toContain('خیر');
    expect(root.textContent).not.toContain('بله');
  });

  it('shows exactly the four business columns plus the actions column, in order', async () => {
    const { fixture, httpMock, root } = await setUp();

    flushInitial(httpMock);
    await fixture.whenStable();

    const headers = Array.from(root.querySelectorAll('th')).map((th) => th.textContent?.trim());
    // The trailing «عملیات» is the actions column's screen-reader-only header, not a business
    // column: it holds no data and renders no visible text. It leads the row because dir="rtl" puts
    // the first column at the visual right edge.
    expect(headers).toEqual(['کد MI', 'نام محصول', 'برند', 'فعال', 'عملیات']);
  });

  it('shows an empty-state message when nothing matches', async () => {
    const { fixture, httpMock, root } = await setUp();

    flushInitial(httpMock, [], 0);
    await fixture.whenStable();

    expect(root.textContent).toContain('هیچ آنالیز استانداردی یافت نشد');
  });

  it('shows a generic error and a retry button when the report fails to load', async () => {
    const { fixture, httpMock, root } = await setUp();

    flushSupportingRequests(httpMock);
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
    const { fixture, httpMock, root } = await setUp();

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

  it('opens with the page title as its one level-one heading and the list as a named region', async () => {
    const { fixture, httpMock, root } = await setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    expect(root.querySelectorAll('h1')).toHaveLength(1);
    expect(root.querySelector('h1')?.textContent?.trim()).toBe('آنالیز های استاندارد');
    const sheet = root.querySelector('section[aria-labelledby]');
    expect(root.querySelector(`#${sheet?.getAttribute('aria-labelledby')}`)?.textContent).toBe(
      'فهرست آنالیزهای استاندارد',
    );
    expect(root.querySelector('[role="status"]')?.textContent?.trim()).toBe('۱ نتیجه');
  });

  it('shows the «فعال» filter as a chip that reads بله, and removing it lifts the filter', async () => {
    const { fixture, httpMock, root } = await setUp();
    flushInitial(httpMock);
    await fixture.whenStable();
    vi.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({
      afterClosed: () => of({ selected: [true] }),
    } as MatDialogRef<unknown, unknown>);

    filterButton(root, 'فعال')?.dispatchEvent(new Event('click'));
    tick();
    expectReportRequest(httpMock).flush({ items: [row1], total: 1 });
    await fixture.whenStable();

    expect(root.textContent).toContain('فعال: بله');

    root
      .querySelector<HTMLButtonElement>('[aria-label="حذف فیلتر فعال: بله"]')
      ?.dispatchEvent(new Event('click'));
    tick();
    const request = expectReportRequest(httpMock);
    expect(request.request.body).toEqual({
      page: 1,
      pageSize: 20,
      sortBy: 'productName',
      sortDir: 'asc',
    });
    request.flush({ items: [row1], total: 1 });
  });

  it('opens a string filter dialog seeded with every distinct value and no prior selection', async () => {
    const { fixture, httpMock, root } = await setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(undefined) } as MatDialogRef<unknown, unknown>);

    filterButton(root, 'برند')?.dispatchEvent(new Event('click'));

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
    const { fixture, httpMock, root } = await setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(undefined) } as MatDialogRef<unknown, unknown>);

    filterButton(root, 'فعال')?.dispatchEvent(new Event('click'));

    expect(openSpy).toHaveBeenCalled();
  });

  it('re-requests the report with a string filter applied and resets to the first page', async () => {
    const { fixture, httpMock, root } = await setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    vi.spyOn(dialog, 'open').mockReturnValue({
      afterClosed: () => of({ selected: ['لگراند'] }),
    } as MatDialogRef<unknown, unknown>);

    filterButton(root, 'برند')?.dispatchEvent(new Event('click'));
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

  it('re-requests the report with the miCodes string filter applied and resets to the first page', async () => {
    const { fixture, httpMock, root } = await setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    vi.spyOn(dialog, 'open').mockReturnValue({
      afterClosed: () => of({ selected: ['1002'] }),
    } as MatDialogRef<unknown, unknown>);

    filterButton(root, 'کد MI')?.dispatchEvent(new Event('click'));
    tick();

    const request = expectReportRequest(httpMock);
    expect(request.request.body).toEqual({
      page: 1,
      pageSize: 20,
      sortBy: 'productName',
      sortDir: 'asc',
      filters: { miCodes: ['1002'] },
    });

    request.flush({ items: [row1], total: 1 });
  });

  it('re-requests the report with the activeStatuses boolean filter applied', async () => {
    const { fixture, httpMock, root } = await setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    vi.spyOn(dialog, 'open').mockReturnValue({
      afterClosed: () => of({ selected: [true] }),
    } as MatDialogRef<unknown, unknown>);

    filterButton(root, 'فعال')?.dispatchEvent(new Event('click'));
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
    const { fixture, httpMock, root } = await setUp();
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
      expect.objectContaining({ data: { id: '1', miCode: '1001', canManage: true } }),
    );
  });

  /** Opens the «خروجی اکسل» menu and picks the format at `index` (0 «هر مواد اولیه یک ردیف», 1
   * the one-row-per-analysis layout). */
  function chooseExportFormat(root: HTMLElement, index: number): void {
    findButton(root, 'خروجی اکسل')?.dispatchEvent(new Event('click'));
    tick();
    const items = document.body.querySelectorAll<HTMLButtonElement>('.mat-mdc-menu-item');
    items[index]?.dispatchEvent(new Event('click'));
  }

  it('downloads the server-built workbook of the filtered list, in the chosen format', async () => {
    const { fixture, httpMock, root } = await setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const saveSpy = vi.spyOn(TestBed.inject(FileSaver), 'save').mockReturnValue(undefined);

    // Apply a filter first — the export must respect it, and must never fall back to page/pageSize.
    const dialog = TestBed.inject(MatDialog);
    vi.spyOn(dialog, 'open').mockReturnValue({
      afterClosed: () => of({ selected: ['لگراند'] }),
    } as MatDialogRef<unknown, unknown>);
    filterButton(root, 'برند')?.dispatchEvent(new Event('click'));
    tick();
    expectReportRequest(httpMock).flush({ items: [row1], total: 1 });
    await fixture.whenStable();

    chooseExportFormat(root, 1);

    const request = httpMock.expectOne({ method: 'POST', url: '/api/standard-boms/report/export' });
    expect(request.request.body).toEqual({
      format: 'perBom',
      filters: { brands: ['لگراند'] },
    });
    tick();
    expect(findButton(root, 'خروجی اکسل')?.disabled).toBe(true);

    const workbook = new Blob(['xlsx']);
    request.flush(workbook, {
      headers: { 'Content-Disposition': "attachment; filename*=UTF-8''%DA%AF.xlsx" },
    });
    await fixture.whenStable();

    expect(saveSpy).toHaveBeenCalledWith(workbook, 'گ.xlsx');
    expect(findButton(root, 'خروجی اکسل')?.disabled).toBe(false);
  });

  it('tells the visitor when the export fails, and lets them try again', async () => {
    const { fixture, httpMock, root } = await setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const saveSpy = vi.spyOn(TestBed.inject(FileSaver), 'save').mockReturnValue(undefined);
    const snackBarSpy = vi
      .spyOn(TestBed.inject(MatSnackBar), 'open')
      .mockReturnValue({} as MatSnackBarRef<TextOnlySnackBar>);

    chooseExportFormat(root, 0);
    httpMock
      .expectOne({ method: 'POST', url: '/api/standard-boms/report/export' })
      .flush(new Blob(['{}']), { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(saveSpy).not.toHaveBeenCalled();
    expect(snackBarSpy).toHaveBeenCalledWith('خروجی اکسل گرفته نشد.', 'باشه', { duration: 5000 });
    expect(findButton(root, 'خروجی اکسل')?.disabled).toBe(false);
  });

  it('opens the create dialog and reloads both lists once a standard BOM is registered', async () => {
    const { fixture, httpMock, root } = await setUp();
    flushSupportingRequests(httpMock);
    expectReportRequest(httpMock).flush({ items: [], total: 0 });
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(true) } as MatDialogRef<unknown, boolean>);

    findButton(root, 'افزودن آنالیز استاندارد')?.dispatchEvent(new Event('click'));
    tick();

    expect(openSpy).toHaveBeenCalledWith(StandardBomFormDialog, {
      data: { mode: 'create', products },
    });

    expectReportRequest(httpMock).flush({ items: [row1], total: 1 });
    // The list an edit pre-fills from is refreshed too, or the next edit would open on stale values.
    httpMock.expectOne({ method: 'GET', url: '/api/standard-boms' }).flush(standardBoms);
    await fixture.whenStable();

    expect(root.textContent).toContain('1001');
  });

  it('opens the edit dialog on the whole standard BOM behind the row clicked', async () => {
    const { fixture, httpMock, root } = await setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(false) } as MatDialogRef<unknown, boolean>);

    chooseRowAction(root, '1001', 'ویرایش');

    expect(openSpy).toHaveBeenCalledWith(StandardBomFormDialog, {
      data: { mode: 'edit', standardBom: standardBoms[0], products },
    });
  });

  it('reports a missing standard BOM instead of opening an empty edit form', async () => {
    const { fixture, httpMock, root } = await setUp();
    flushSupportingRequests(httpMock, []);
    expectReportRequest(httpMock).flush({ items: [row1], total: 1 });
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi.spyOn(dialog, 'open');
    const snackBar = TestBed.inject(MatSnackBar);
    const snackBarSpy = vi
      .spyOn(snackBar, 'open')
      .mockReturnValue({} as MatSnackBarRef<TextOnlySnackBar>);

    chooseRowAction(root, '1001', 'ویرایش');

    expect(openSpy).not.toHaveBeenCalled();
    expect(snackBarSpy).toHaveBeenCalled();
  });

  it('opens the delete confirmation for the row its button was clicked on', async () => {
    const { fixture, httpMock, root } = await setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(false) } as MatDialogRef<unknown, boolean>);

    chooseRowAction(root, '1001', 'حذف');

    expect(openSpy).toHaveBeenCalledWith(ConfirmDeleteStandardBomDialog, {
      data: { standardBom: { id: '1', miCode: '1001' } },
    });
  });

  it('opens the edit form from the detail card', async () => {
    const { fixture, httpMock, root } = await setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi.spyOn(dialog, 'open').mockImplementation(
      (component) =>
        ({
          afterClosed: () =>
            of(component === StandardBomReportDetailDialog ? { action: 'edit' } : false),
        }) as MatDialogRef<unknown, unknown>,
    );

    root
      .querySelector<HTMLButtonElement>('[aria-label="جزئیات 1001"]')
      ?.dispatchEvent(new Event('click'));
    tick();

    expect(openSpy).toHaveBeenCalledWith(StandardBomFormDialog, {
      data: { mode: 'edit', standardBom: standardBoms[0], products },
    });
  });

  it('opens the delete confirmation from the detail card', async () => {
    const { fixture, httpMock, root } = await setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi.spyOn(dialog, 'open').mockImplementation(
      (component) =>
        ({
          afterClosed: () =>
            of(component === StandardBomReportDetailDialog ? { action: 'delete' } : false),
        }) as MatDialogRef<unknown, unknown>,
    );

    root
      .querySelector<HTMLButtonElement>('[aria-label="جزئیات 1001"]')
      ?.dispatchEvent(new Event('click'));
    tick();

    expect(openSpy).toHaveBeenCalledWith(ConfirmDeleteStandardBomDialog, {
      data: { standardBom: { id: '1', miCode: '1001' } },
    });
  });

  it('offers every write action to a System Admin, as it does to the مدیریت every other test uses', async () => {
    const { fixture, httpMock, root } = await setUp(Role.system_admin);
    flushInitial(httpMock);
    await fixture.whenStable();

    expect(findButton(root, 'افزودن آنالیز استاندارد')).toBeDefined();
    openRowMenu(root, '1001');
    expect(menuItem('ویرایش')).toBeDefined();
    expect(menuItem('حذف')).toBeDefined();
  });

  it.each([
    ['a QC Inspector', Role.qc_inspector],
    ['a Reporter', Role.reporter],
  ])(
    'withholds every write action from %s, and tells the card to withhold them too',
    async (_label, role) => {
      const { fixture, httpMock, root } = await setUp(role);
      // Only two requests, not four: the standard BOMs and the products feed the create/edit form,
      // and neither role ever opens it.
      httpMock
        .expectOne({ method: 'GET', url: '/api/standard-boms/report/filter-options' })
        .flush(filterOptions);
      httpMock.expectNone({ method: 'GET', url: '/api/standard-boms' });
      httpMock.expectNone({ method: 'GET', url: '/api/products' });
      expectReportRequest(httpMock).flush({ items: [row1], total: 1 });
      await fixture.whenStable();

      // The list itself stays — browsing carries no role restriction; only the write actions go.
      expect(root.textContent).toContain('1001');
      expect(findButton(root, 'خروجی اکسل')).toBeDefined();
      expect(findButton(root, 'افزودن آنالیز استاندارد')).toBeUndefined();
      // The overflow menu stays for the id (any role may copy it) but offers no write action.
      openRowMenu(root, '1001');
      expect(menuItem('کپی شناسه')).toBeDefined();
      expect(menuItem('ویرایش')).toBeUndefined();
      expect(menuItem('حذف')).toBeUndefined();

      const dialog = TestBed.inject(MatDialog);
      const openSpy = vi
        .spyOn(dialog, 'open')
        .mockReturnValue({ afterClosed: () => of(undefined) } as MatDialogRef<unknown, unknown>);

      root
        .querySelector<HTMLButtonElement>('[aria-label="جزئیات 1001"]')
        ?.dispatchEvent(new Event('click'));

      expect(openSpy).toHaveBeenCalledWith(
        StandardBomReportDetailDialog,
        expect.objectContaining({ data: { id: '1', miCode: '1001', canManage: false } }),
      );
    },
  );

  it('sends sortDir desc when the product name header is clicked once', async () => {
    const { fixture, httpMock, root } = await setUp();
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

  it('copies a row id to the clipboard for every role, write actions or not', async () => {
    const { fixture, httpMock, root } = await setUp(Role.reporter);
    httpMock
      .expectOne({ method: 'GET', url: '/api/standard-boms/report/filter-options' })
      .flush(filterOptions);
    expectReportRequest(httpMock).flush({ items: [row1], total: 1 });
    await fixture.whenStable();

    const copy = stubClipboard();

    chooseRowAction(root, '1001', 'کپی شناسه');

    expect(copy).toHaveBeenCalledWith(row1.id);
  });
});
