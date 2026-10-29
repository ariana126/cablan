import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MaterialImportGateway } from './material-import-gateway';

describe('MaterialImportGateway', () => {
  let gateway: MaterialImportGateway;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    gateway = TestBed.inject(MaterialImportGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('uploads the chosen file as the multipart field "file"', () => {
    const file = new File(['xlsx bytes'], 'Book1.xlsx');
    gateway.preview(file).subscribe();

    const request = httpMock.expectOne({ method: 'POST', url: '/api/materials/import-preview' });
    const body = request.request.body as FormData;
    expect(body.get('file')).toBeInstanceOf(File);
    expect((body.get('file') as File).name).toBe('Book1.xlsx');
    request.flush({ changes: [] });
  });

  it('reads the change list in server order, a missing previous value as an empty string', () => {
    let changes: unknown;
    gateway.preview(new File([''], 'Book1.xlsx')).subscribe((value) => (changes = value));

    httpMock.expectOne({ method: 'POST', url: '/api/materials/import-preview' }).flush({
      changes: [
        {
          row: 3,
          kind: 'register',
          name: 'آلومینیوم',
          code: 'A-1',
          materialId: null,
          previousName: null,
          previousCode: null,
          errors: [],
        },
        {
          row: 4,
          kind: 'changeCode',
          name: 'مسی',
          code: 'B-1',
          materialId: 'm-1',
          previousName: 'مسی',
          previousCode: 'M-101',
          errors: ['code-taken'],
        },
      ],
    });

    expect(changes).toEqual([
      {
        row: 3,
        kind: 'register',
        name: 'آلومینیوم',
        code: 'A-1',
        previousName: '',
        previousCode: '',
        errors: [],
      },
      {
        row: 4,
        kind: 'changeCode',
        name: 'مسی',
        code: 'B-1',
        previousName: 'مسی',
        previousCode: 'M-101',
        errors: ['code-taken'],
      },
    ]);
  });

  it('confirms the kept rows and answers with the import id', () => {
    let id: unknown;
    gateway
      .confirm([{ row: 3, name: 'آلومینیوم', code: 'A-1' }])
      .subscribe((value) => (id = value));

    const request = httpMock.expectOne({ method: 'POST', url: '/api/materials/imports' });
    expect(request.request.body).toEqual({ rows: [{ row: 3, name: 'آلومینیوم', code: 'A-1' }] });
    request.flush({ id: 'import-1' }, { status: 201, statusText: 'Created' });

    expect(id).toBe('import-1');
  });

  it('reverts an import', () => {
    let completed = false;
    gateway.revert('import-1').subscribe(() => (completed = true));

    httpMock
      .expectOne({ method: 'POST', url: '/api/materials/imports/import-1/reversion' })
      .flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });
});
