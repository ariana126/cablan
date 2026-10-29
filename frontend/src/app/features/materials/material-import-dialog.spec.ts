import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
import { AppMaterialImportChange } from '../../core/materials/material-import-gateway';
import { MaterialImportDialog, MaterialImportDialogData } from './material-import-dialog';

const register: AppMaterialImportChange = {
  row: 3,
  kind: 'register',
  name: 'آلومینیوم',
  code: 'A-1',
  previousName: '',
  previousCode: '',
  errors: [],
};

const codeTaken: AppMaterialImportChange = {
  row: 4,
  kind: 'changeCode',
  name: 'مسی',
  code: 'B-1',
  previousName: 'مسی',
  previousCode: 'M-101',
  errors: ['code-taken'],
};

const rename: AppMaterialImportChange = {
  row: 5,
  kind: 'rename',
  name: 'برنج زرد',
  code: 'B-1',
  previousName: 'برنج',
  previousCode: 'B-1',
  errors: [],
};

async function setUp(changes: AppMaterialImportChange[]) {
  const close = vi.fn();
  const data: MaterialImportDialogData = { changes };
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close } },
    ],
  });

  const fixture = TestBed.createComponent(MaterialImportDialog);
  // Focus needs the dialog in the document, as it is when Material opens it.
  document.body.appendChild(fixture.nativeElement);
  await fixture.whenStable();

  return {
    fixture,
    close,
    httpMock: TestBed.inject(HttpTestingController),
    root: fixture.nativeElement as HTMLElement,
  };
}

const read = (element: Element): string => element.textContent?.replace(/\s+/g, ' ').trim() ?? '';

function headers(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll('table thead th')).map(read);
}

/** Each body row's cells, as read on screen — the remove button's cell included. */
function rows(root: HTMLElement): string[][] {
  return Array.from(root.querySelectorAll('table tbody tr')).map((row) =>
    Array.from(row.querySelectorAll('td')).map(read),
  );
}

function button(root: HTMLElement, name: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
    (candidate) => (candidate.getAttribute('aria-label') ?? read(candidate)) === name,
  );
}

describe('MaterialImportDialog', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    document.body.innerHTML = '';
  });

  it('is titled after the change list it shows', async () => {
    const { root } = await setUp([register]);

    expect(read(root.querySelector('h2')!)).toBe('لیست تغییرات بارگذاری از اکسل');
  });

  it('heads its one table with the row, the change and its errors', async () => {
    const { root } = await setUp([register]);

    expect(root.querySelectorAll('table')).toHaveLength(1);
    expect(headers(root).slice(0, 3)).toEqual(['ردیف', 'تغییر', 'خطا']);
  });

  it('shows one row per change in server order, each with its row number, sentence and errors', async () => {
    const { root } = await setUp([register, codeTaken, rename]);

    expect(rows(root).map((cells) => cells.slice(0, 3))).toEqual([
      ['3', 'ثبت مواد اولیه جدید "آلومینیوم" با کد "A-1"', ''],
      [
        '4',
        'تغییر کد "مسی" از "M-101" به "B-1"',
        'کد مواد اولیه تکراری است و متعلق به مواد اولیه دیگری است',
      ],
      ['5', 'تغییر نام کد "B-1" از "برنج" به "برنج زرد"', ''],
    ]);
  });

  it('lists every error of a row', async () => {
    const { root } = await setUp([
      { ...register, errors: ['duplicate-name-in-file', 'duplicate-code-in-file'] },
    ]);

    const items = Array.from(root.querySelectorAll('table tbody tr td li')).map(read);
    expect(items).toEqual([
      'اسم مواد اولیه در اکسل تکراری است',
      'کد مواد اولیه در اکسل تکراری است',
    ]);
  });

  it('carries no alert until a confirmation is refused, so row errors are not announced as one', async () => {
    const { root } = await setUp([codeTaken]);

    expect(root.querySelector('[role="alert"]')).toBeNull();
  });

  it('removes a row from the list when its remove button is pressed', async () => {
    const { fixture, root } = await setUp([register, codeTaken]);

    button(root, 'حذف ردیف 3')?.click();
    await fixture.whenStable();

    expect(rows(root).map((cells) => cells[0])).toEqual(['4']);
  });

  it('moves focus to the next row’s remove button once a row is removed', async () => {
    const { fixture, root } = await setUp([register, codeTaken]);

    button(root, 'حذف ردیف 3')?.click();
    await fixture.whenStable();

    expect(document.activeElement).toBe(button(root, 'حذف ردیف 4'));
  });

  it('says there is no change, and offers nothing to confirm, when the list is empty', async () => {
    const { root } = await setUp([]);

    expect(rows(root)).toEqual([]);
    expect(read(root)).toContain('تغییری وجود ندارد');
    expect(button(root, 'تایید')?.disabled).toBe(true);
  });

  it('says there is no change once every row has been removed', async () => {
    const { fixture, root } = await setUp([register]);

    button(root, 'حذف ردیف 3')?.click();
    await fixture.whenStable();

    expect(read(root)).toContain('تغییری وجود ندارد');
    expect(document.activeElement).toBe(button(root, 'انصراف'));
  });

  it('confirms only the rows the visitor kept, then closes reporting the import applied', async () => {
    const { fixture, close, httpMock, root } = await setUp([register, codeTaken, rename]);

    button(root, 'حذف ردیف 4')?.click();
    await fixture.whenStable();
    button(root, 'تایید')?.click();

    const request = httpMock.expectOne({ method: 'POST', url: '/api/materials/imports' });
    expect(request.request.body).toEqual({
      rows: [
        { row: 3, name: 'آلومینیوم', code: 'A-1' },
        { row: 5, name: 'برنج زرد', code: 'B-1' },
      ],
    });
    request.flush({ id: 'import-1' }, { status: 201, statusText: 'Created' });
    await fixture.whenStable();

    expect(close).toHaveBeenCalledWith(true);
  });

  it('stays open on invalid rows, marks them with the server’s errors and says why', async () => {
    const { fixture, close, httpMock, root } = await setUp([register, codeTaken]);

    button(root, 'تایید')?.click();
    httpMock.expectOne({ method: 'POST', url: '/api/materials/imports' }).flush(
      {
        type: PROBLEM.materialImportHasInvalidRows,
        status: 400,
        rows: [{ row: 3, name: 'آلومینیوم', code: 'A-1', errors: ['code-taken'] }],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await fixture.whenStable();

    expect(close).not.toHaveBeenCalled();
    expect(rows(root).map((cells) => cells[2])).toEqual([
      'کد مواد اولیه تکراری است و متعلق به مواد اولیه دیگری است',
      '',
    ]);
    expect(read(root.querySelector('[role="alert"]')!)).toBe(
      'تغییرات اعمال نشد، چون برخی ردیف‌ها خطا دارند. ردیف‌های خطادار را حذف کنید و دوباره تایید کنید.',
    );
  });

  it('shows an access-denied alert when the role changed mid-session', async () => {
    const { fixture, close, httpMock, root } = await setUp([register]);

    button(root, 'تایید')?.click();
    httpMock
      .expectOne({ method: 'POST', url: '/api/materials/imports' })
      .flush(null, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();

    expect(close).not.toHaveBeenCalled();
    expect(read(root.querySelector('[role="alert"]')!)).toBe(
      'شما اجازهٔ انجام این عملیات را ندارید.',
    );
  });

  it('closes without applying anything on «انصراف»', async () => {
    const { close, root } = await setUp([register]);

    button(root, 'انصراف')?.click();

    expect(close).toHaveBeenCalledWith(false);
  });
});
