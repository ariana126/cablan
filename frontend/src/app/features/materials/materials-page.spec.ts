import { Clipboard } from '@angular/cdk/clipboard';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
import { ConfirmDeleteMaterialDialog } from './confirm-delete-material-dialog';
import { MaterialFormDialog } from './material-form-dialog';
import { MaterialImportDialog } from './material-import-dialog';
import { MaterialsPage } from './materials-page';

const materials = [
  { id: '1', name: 'میلگرد فولادی', code: 'RM-001' },
  { id: '2', name: 'ورق آلومینیوم', code: 'AL-77' },
];

/**
 * Creates the page and forces one synchronous tick so the resource's initial request is actually
 * dispatched — `whenStable()` cannot be used for this part, because the very request it would be
 * waiting on is what is left deliberately unflushed until the test gets to assert on it.
 */
function setUp() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });

  const fixture = TestBed.createComponent(MaterialsPage);
  TestBed.inject(ApplicationRef).tick();

  return {
    fixture,
    httpMock: TestBed.inject(HttpTestingController),
    root: fixture.nativeElement as HTMLElement,
  };
}

function setValue(element: Element | null, value: string): void {
  const input = element as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function findByLabel(root: HTMLElement, label: string): HTMLInputElement | null {
  const labels = Array.from(root.querySelectorAll('label'));
  const match = labels.find((element) => element.textContent?.trim().startsWith(label));
  const forAttr = match?.getAttribute('for');
  return forAttr ? root.querySelector(`#${forAttr}`) : null;
}

/** The material names the table currently shows, in row order. */
function rowNames(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll('td.mat-column-name')).map(
    (cell) => cell.textContent?.trim() ?? '',
  );
}

/** Forces the tick a follow-up fetch (a retry, or a dialog-triggered reload) needs to dispatch. */
function tick(): void {
  TestBed.inject(ApplicationRef).tick();
}

/** Opens a row's «عملیات بیشتر» menu — where copying the id and deleting live. */
function openRowMenu(root: HTMLElement, name: string): void {
  root
    .querySelector<HTMLButtonElement>(`[aria-label="عملیات بیشتر برای ${name}"]`)
    ?.dispatchEvent(new Event('click'));
  tick();
}

function menuItem(text: string): HTMLElement | undefined {
  return Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
    (item) => item.textContent?.trim() === text,
  );
}

function chooseRowAction(root: HTMLElement, name: string, action: string): void {
  openRowMenu(root, name);
  menuItem(action)?.dispatchEvent(new Event('click'));
}

/**
 * `Clipboard.copy` reaches for `document.execCommand`, which jsdom does not implement, and the
 * snackbar that confirms the copy would attach a real overlay. Both are stubbed so the assertion is
 * about what the row asked to copy.
 */
function stubClipboard() {
  vi.spyOn(TestBed.inject(MatSnackBar), 'open').mockReturnValue(
    {} as MatSnackBarRef<TextOnlySnackBar>,
  );
  vi.spyOn(TestBed.inject(MatSnackBar), 'openFromComponent').mockReturnValue(
    {} as MatSnackBarRef<unknown>,
  );

  return vi.spyOn(TestBed.inject(Clipboard), 'copy').mockReturnValue(true);
}

describe('MaterialsPage', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('shows a loading indicator before the list arrives', () => {
    const { httpMock, root } = setUp();

    expect(root.querySelector('mat-progress-bar')).not.toBeNull();

    httpMock.expectOne({ method: 'GET', url: '/api/materials' }).flush([]);
  });

  it('renders every material', async () => {
    const { fixture, httpMock, root } = setUp();

    httpMock.expectOne({ method: 'GET', url: '/api/materials' }).flush(materials);
    await fixture.whenStable();

    expect(root.textContent).toContain('میلگرد فولادی');
    expect(root.textContent).toContain('ورق آلومینیوم');
  });

  it('shows the code column first, then the name', async () => {
    const { fixture, httpMock, root } = setUp();

    httpMock.expectOne({ method: 'GET', url: '/api/materials' }).flush(materials);
    await fixture.whenStable();

    const headers = Array.from(root.querySelectorAll('th')).map((th) => th.textContent?.trim());
    expect(headers.slice(0, 2)).toEqual(['کد', 'نام']);
    const firstRowCells = Array.from(
      root.querySelectorAll('tr.mat-mdc-row')[0].querySelectorAll('td'),
    );
    expect(firstRowCells.slice(0, 2).map((cell) => cell.textContent?.trim())).toEqual([
      'RM-001',
      'میلگرد فولادی',
    ]);
  });

  it('narrows the list to materials whose name matches the search', async () => {
    const { fixture, httpMock, root } = setUp();
    httpMock.expectOne({ method: 'GET', url: '/api/materials' }).flush(materials);
    await fixture.whenStable();

    setValue(findByLabel(root, 'جستجوی نام یا کد'), 'ورق');
    await fixture.whenStable();

    expect(rowNames(root)).toEqual(['ورق آلومینیوم']);
  });

  it('narrows the list to materials whose code matches the search, ignoring case', async () => {
    const { fixture, httpMock, root } = setUp();
    httpMock.expectOne({ method: 'GET', url: '/api/materials' }).flush(materials);
    await fixture.whenStable();

    setValue(findByLabel(root, 'جستجوی نام یا کد'), 'rm-001');
    await fixture.whenStable();

    expect(rowNames(root)).toEqual(['میلگرد فولادی']);
  });

  it('says so when no material matches the search, and shows every row once it is cleared', async () => {
    const { fixture, httpMock, root } = setUp();
    httpMock.expectOne({ method: 'GET', url: '/api/materials' }).flush(materials);
    await fixture.whenStable();

    const search = findByLabel(root, 'جستجوی نام یا کد');
    setValue(search, 'یافت‌نشدنی');
    await fixture.whenStable();

    expect(root.querySelector('table')).toBeNull();
    const statuses = Array.from(root.querySelectorAll('[role="status"]')).map(
      (status) => status.textContent ?? '',
    );
    expect(statuses.some((text) => text.includes('ماده‌ای با این نام یا کد یافت نشد.'))).toBe(true);

    setValue(search, '');
    await fixture.whenStable();

    expect(rowNames(root)).toEqual(['میلگرد فولادی', 'ورق آلومینیوم']);
  });

  it('shows an empty-state message when nothing is registered', async () => {
    const { fixture, httpMock, root } = setUp();

    httpMock.expectOne({ method: 'GET', url: '/api/materials' }).flush([]);
    await fixture.whenStable();

    expect(root.textContent).toContain('هیچ مادهٔ اولیه‌ای ثبت نشده است');
  });

  it('shows an access-denied message, not a generic error, on a 403', async () => {
    const { fixture, httpMock, root } = setUp();

    httpMock
      .expectOne({ method: 'GET', url: '/api/materials' })
      .flush({ title: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();

    const alert = root.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('دسترسی');
    expect(root.querySelector('table')).toBeNull();
  });

  it('shows a generic error with a retry action for anything else', async () => {
    const { fixture, httpMock, root } = setUp();

    httpMock
      .expectOne({ method: 'GET', url: '/api/materials' })
      .flush(null, { status: 500, statusText: 'Internal Server Error' });
    await fixture.whenStable();

    const retry = Array.from(root.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('تلاش دوباره'),
    );
    expect(retry).toBeDefined();

    retry?.dispatchEvent(new Event('click'));
    tick();
    httpMock.expectOne({ method: 'GET', url: '/api/materials' }).flush(materials);
    await fixture.whenStable();

    expect(root.textContent).toContain('میلگرد فولادی');
  });

  it('opens the create dialog and reloads the list once a material is registered', async () => {
    const { fixture, httpMock, root } = setUp();
    httpMock.expectOne({ method: 'GET', url: '/api/materials' }).flush([]);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(true) } as MatDialogRef<unknown, boolean>);

    const addButton = Array.from(root.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('افزودن مواد اولیه'),
    );
    addButton?.dispatchEvent(new Event('click'));
    tick();

    expect(openSpy).toHaveBeenCalledWith(MaterialFormDialog, { data: { mode: 'create' } });

    httpMock.expectOne({ method: 'GET', url: '/api/materials' }).flush(materials);
    await fixture.whenStable();

    expect(root.textContent).toContain('میلگرد فولادی');
  });

  it('opens the edit dialog for the row it was clicked on', async () => {
    const { fixture, httpMock, root } = setUp();
    httpMock.expectOne({ method: 'GET', url: '/api/materials' }).flush(materials);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(false) } as MatDialogRef<unknown, boolean>);

    const editButton = root.querySelector<HTMLButtonElement>('[aria-label="ویرایش میلگرد فولادی"]');
    editButton?.dispatchEvent(new Event('click'));

    expect(openSpy).toHaveBeenCalledWith(MaterialFormDialog, {
      data: { mode: 'edit', material: materials[0] },
    });
  });

  it('opens the delete dialog for the row it was clicked on', async () => {
    const { fixture, httpMock, root } = setUp();
    httpMock.expectOne({ method: 'GET', url: '/api/materials' }).flush(materials);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(false) } as MatDialogRef<unknown, boolean>);

    chooseRowAction(root, 'میلگرد فولادی', 'حذف');

    expect(openSpy).toHaveBeenCalledWith(ConfirmDeleteMaterialDialog, {
      data: { material: materials[0] },
    });
  });

  it('copies a row id to the clipboard, naming the row it came from', async () => {
    const { fixture, httpMock, root } = setUp();
    httpMock.expectOne({ method: 'GET', url: '/api/materials' }).flush(materials);
    await fixture.whenStable();

    const copy = stubClipboard();

    chooseRowAction(root, 'ورق آلومینیوم', 'کپی شناسه');

    expect(copy).toHaveBeenCalledWith(materials[1].id);
  });

  describe('importing from the accounting Excel', () => {
    function importButton(root: HTMLElement): HTMLButtonElement | undefined {
      return Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => button.textContent?.trim() === 'بارگذاری از اکسل',
      );
    }

    function fileInput(root: HTMLElement): HTMLInputElement {
      return root.querySelector<HTMLInputElement>('input[type="file"]')!;
    }

    /** Picks a file in the hidden input, as the browser's file chooser does. */
    function chooseFile(root: HTMLElement, file: File): void {
      const input = fileInput(root);
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      input.dispatchEvent(new Event('change'));
    }

    async function loadedPage() {
      const page = setUp();
      page.httpMock.expectOne({ method: 'GET', url: '/api/materials' }).flush(materials);
      await page.fixture.whenStable();
      return page;
    }

    it('offers the import beside the register action', async () => {
      const { root } = await loadedPage();

      expect(importButton(root)).toBeDefined();
    });

    it('withholds the import from a role the list refused', async () => {
      const { fixture, httpMock, root } = setUp();
      httpMock
        .expectOne({ method: 'GET', url: '/api/materials' })
        .flush(null, { status: 403, statusText: 'Forbidden' });
      await fixture.whenStable();

      expect(importButton(root)).toBeUndefined();
    });

    it('accepts only an .xlsx file, through an input the visitor never sees', async () => {
      const { root } = await loadedPage();

      expect(fileInput(root).accept).toBe('.xlsx');
      expect(fileInput(root).hidden).toBe(true);
    });

    it('opens the browser’s file chooser from the button', async () => {
      const { root } = await loadedPage();
      const click = vi.spyOn(fileInput(root), 'click');

      importButton(root)?.click();

      expect(click).toHaveBeenCalled();
    });

    it('uploads the chosen file and opens the change list with what the server found', async () => {
      const { fixture, httpMock, root } = await loadedPage();
      const openSpy = vi
        .spyOn(TestBed.inject(MatDialog), 'open')
        .mockReturnValue({ afterClosed: () => of(false) } as MatDialogRef<unknown, boolean>);

      chooseFile(root, new File(['xlsx'], 'Book1.xlsx'));
      const change = {
        row: 3,
        kind: 'register',
        name: 'آلومینیوم',
        code: 'A-1',
        materialId: null,
        previousName: null,
        previousCode: null,
        errors: [],
      };
      httpMock
        .expectOne({ method: 'POST', url: '/api/materials/import-preview' })
        .flush({ changes: [change] });
      await fixture.whenStable();

      expect(openSpy).toHaveBeenCalledWith(MaterialImportDialog, {
        // The button is disabled while the file is read, which drops its focus; closing the
        // dialog must still hand focus back to it.
        restoreFocus: importButton(root),
        // A review table: lifts Material's 560px dialog cap (`_overrides.scss`).
        panelClass: 'dialog--wide',
        data: {
          changes: [
            {
              row: 3,
              kind: 'register',
              name: 'آلومینیوم',
              code: 'A-1',
              previousName: '',
              previousCode: '',
              errors: [],
            },
          ],
        },
      });
    });

    it('reloads the list once the change list has been applied', async () => {
      const { fixture, httpMock, root } = await loadedPage();
      vi.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({
        afterClosed: () => of(true),
      } as MatDialogRef<unknown, boolean>);

      chooseFile(root, new File(['xlsx'], 'Book1.xlsx'));
      httpMock
        .expectOne({ method: 'POST', url: '/api/materials/import-preview' })
        .flush({ changes: [] });
      tick();

      httpMock.expectOne({ method: 'GET', url: '/api/materials' }).flush(materials);
      await fixture.whenStable();
    });

    it('says the file could not be read, without opening the change list', async () => {
      const { fixture, httpMock, root } = await loadedPage();
      const openSpy = vi.spyOn(TestBed.inject(MatDialog), 'open');

      chooseFile(root, new File(['not a spreadsheet'], 'notes.xlsx'));
      httpMock
        .expectOne({ method: 'POST', url: '/api/materials/import-preview' })
        .flush(
          { type: PROBLEM.materialImportFileUnreadable, status: 400 },
          { status: 400, statusText: 'Bad Request' },
        );
      await fixture.whenStable();

      expect(openSpy).not.toHaveBeenCalled();
      expect(root.querySelector('[role="alert"]')?.textContent).toContain('فایل اکسل خوانده نشد.');
    });

    it('lets the same file be chosen again after an attempt', async () => {
      const { fixture, httpMock, root } = await loadedPage();
      vi.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({
        afterClosed: () => of(false),
      } as MatDialogRef<unknown, boolean>);
      fileInput(root).value = '';
      const reset = vi.spyOn(fileInput(root), 'value', 'set');

      chooseFile(root, new File(['xlsx'], 'Book1.xlsx'));
      httpMock
        .expectOne({ method: 'POST', url: '/api/materials/import-preview' })
        .flush({ changes: [] });
      await fixture.whenStable();

      expect(reset).toHaveBeenCalledWith('');
    });
  });
});
