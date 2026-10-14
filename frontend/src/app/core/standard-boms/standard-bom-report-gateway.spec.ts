import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { StandardBomReportGateway } from './standard-bom-report-gateway';

describe('StandardBomReportGateway', () => {
  let gateway: StandardBomReportGateway;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    gateway = TestBed.inject(StandardBomReportGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('report', () => {
    it('requests a page with sortBy and sortDir defaults', () => {
      gateway.report(1, 20).subscribe();

      const request = httpMock.expectOne({ method: 'POST', url: '/api/standard-boms/report' });
      expect(request.request.body).toEqual({
        page: 1,
        pageSize: 20,
        sortBy: 'productName',
        sortDir: 'asc',
      });

      request.flush({ items: [], total: 0 });
    });

    it('maps the response page of rows', () => {
      let page: unknown;
      gateway.report(1, 20).subscribe((value) => (page = value));

      const request = httpMock.expectOne({ method: 'POST', url: '/api/standard-boms/report' });
      request.flush({
        items: [
          {
            id: '1',
            miCode: '1001',
            brand: 'لگراند',
            productName: 'کابل شبکه U/UTP 0.42 LEGRAND',
            active: true,
          },
        ],
        total: 4,
      });

      expect(page).toEqual({
        items: [
          {
            id: '1',
            miCode: '1001',
            brand: 'لگراند',
            productName: 'کابل شبکه U/UTP 0.42 LEGRAND',
            active: true,
          },
        ],
        total: 4,
      });
    });

    it('defaults missing fields on a row and a missing total', () => {
      let page: unknown;
      gateway.report(1, 20).subscribe((value) => (page = value));

      httpMock
        .expectOne({ method: 'POST', url: '/api/standard-boms/report' })
        .flush({ items: [{}] });

      expect(page).toEqual({
        items: [
          {
            id: '',
            miCode: '',
            brand: '',
            productName: '',
            active: false,
          },
        ],
        total: 0,
      });
    });

    it('omits a filter field entirely when it is left undefined — "no filter"', () => {
      gateway.report(1, 20, { brands: undefined, productNames: ['کابل'] }).subscribe();

      const request = httpMock.expectOne({ method: 'POST', url: '/api/standard-boms/report' });
      expect(request.request.body).toEqual({
        page: 1,
        pageSize: 20,
        sortBy: 'productName',
        sortDir: 'asc',
        filters: { productNames: ['کابل'] },
      });

      request.flush({ items: [], total: 0 });
    });

    it('sends an explicit empty array for a field with every value deselected — "match nothing"', () => {
      gateway.report(1, 20, { brands: [] }).subscribe();

      const request = httpMock.expectOne({ method: 'POST', url: '/api/standard-boms/report' });
      expect(request.request.body).toEqual({
        page: 1,
        pageSize: 20,
        sortBy: 'productName',
        sortDir: 'asc',
        filters: { brands: [] },
      });

      request.flush({ items: [], total: 0 });
    });

    it('sends miCodes as a string array', () => {
      gateway.report(1, 20, { miCodes: ['1002'] }).subscribe();

      const request = httpMock.expectOne({ method: 'POST', url: '/api/standard-boms/report' });
      expect(request.request.body).toEqual({
        page: 1,
        pageSize: 20,
        sortBy: 'productName',
        sortDir: 'asc',
        filters: { miCodes: ['1002'] },
      });

      request.flush({ items: [], total: 0 });
    });

    it('sends activeStatuses as a boolean array', () => {
      gateway.report(1, 20, { activeStatuses: [true] }).subscribe();

      const request = httpMock.expectOne({ method: 'POST', url: '/api/standard-boms/report' });
      expect(request.request.body).toEqual({
        page: 1,
        pageSize: 20,
        sortBy: 'productName',
        sortDir: 'asc',
        filters: { activeStatuses: [true] },
      });

      request.flush({ items: [], total: 0 });
    });

    it('forwards an explicit descending sort by product name', () => {
      gateway.report(1, 20, undefined, 'productName', 'desc').subscribe();

      const request = httpMock.expectOne({ method: 'POST', url: '/api/standard-boms/report' });
      expect(request.request.body).toEqual({
        page: 1,
        pageSize: 20,
        sortBy: 'productName',
        sortDir: 'desc',
      });

      request.flush({ items: [], total: 0 });
    });
  });

  describe('export', () => {
    const url = '/api/standard-boms/report/export';
    const xlsx = new Blob(['xlsx'], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    it('asks the API for the workbook in the chosen format, using only the filters', () => {
      gateway.export('perBom', { productNames: ['کابل شبکه U/UTP 0.42 LEGRAND'] }).subscribe();

      const request = httpMock.expectOne({ method: 'POST', url });
      expect(request.request.body).toEqual({
        format: 'perBom',
        filters: { productNames: ['کابل شبکه U/UTP 0.42 LEGRAND'] },
      });
      expect(request.request.responseType).toBe('blob');

      request.flush(xlsx);
    });

    it('sends a miCodes filter through to the export request', () => {
      gateway.export('perMaterial', { miCodes: ['1002'] }).subscribe();

      const request = httpMock.expectOne({ method: 'POST', url });
      expect(request.request.body).toEqual({
        format: 'perMaterial',
        filters: { miCodes: ['1002'] },
      });

      request.flush(xlsx);
    });

    it('sends an empty filters object as-is, rather than omitting the key, when nothing is set', () => {
      gateway.export('perMaterial', {}).subscribe();

      const request = httpMock.expectOne({ method: 'POST', url });
      expect(request.request.body).toEqual({ format: 'perMaterial', filters: {} });

      request.flush(xlsx);
    });

    it('hands back the workbook under the file name the API gave it', () => {
      let file: unknown;
      gateway.export('perMaterial', {}).subscribe((value) => (file = value));

      httpMock.expectOne({ method: 'POST', url }).flush(xlsx, {
        headers: {
          'Content-Disposition': "attachment; filename*=UTF-8''%DA%AF%D8%B2%D8%A7%D8%B1%D8%B4.xlsx",
        },
      });

      expect(file).toEqual({ blob: xlsx, fileName: 'گزارش.xlsx' });
    });

    it('falls back to the known file name when the API names none', () => {
      let file: unknown;
      gateway.export('perMaterial', {}).subscribe((value) => (file = value));

      httpMock.expectOne({ method: 'POST', url }).flush(xlsx);

      expect(file).toEqual({ blob: xlsx, fileName: 'گزارش-آنالیز-های-استاندارد.xlsx' });
    });
  });

  describe('filterOptions', () => {
    it('fetches every distinct filterable value', () => {
      let options: unknown;
      gateway.filterOptions().subscribe((value) => (options = value));

      httpMock.expectOne({ method: 'GET', url: '/api/standard-boms/report/filter-options' }).flush({
        brands: ['لگراند', 'نگزنس'],
        activeStatuses: [true, false],
        productNames: ['کابل شبکه U/UTP 0.42 LEGRAND'],
        componentNames: ['مغزی', 'روکش'],
        miCodes: ['1001', '1002'],
      });

      expect(options).toEqual({
        brands: ['لگراند', 'نگزنس'],
        activeStatuses: [true, false],
        productNames: ['کابل شبکه U/UTP 0.42 LEGRAND'],
        componentNames: ['مغزی', 'روکش'],
        miCodes: ['1001', '1002'],
      });
    });

    it('defaults every field to an empty array when the response carries none', () => {
      let options: unknown;
      gateway.filterOptions().subscribe((value) => (options = value));

      httpMock
        .expectOne({ method: 'GET', url: '/api/standard-boms/report/filter-options' })
        .flush({});

      expect(options).toEqual({
        brands: [],
        activeStatuses: [],
        productNames: [],
        componentNames: [],
        miCodes: [],
      });
    });
  });

  describe('getDetail', () => {
    it("fetches a single standard BOM's full detail by MI code", () => {
      let detail: unknown;
      gateway.getDetail('1001').subscribe((value) => (detail = value));

      const request = httpMock.expectOne({
        method: 'GET',
        url: '/api/standard-boms/report/detail/1001',
      });
      request.flush({
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
      });

      expect(detail).toEqual({
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
      });
    });

    it('defaults missing fields, including an empty composition', () => {
      let detail: unknown;
      gateway.getDetail('1001').subscribe((value) => (detail = value));

      httpMock.expectOne({ method: 'GET', url: '/api/standard-boms/report/detail/1001' }).flush({});

      expect(detail).toEqual({
        id: '',
        miCode: '',
        brand: '',
        productName: '',
        standardLength: 0,
        active: false,
        description: '',
        components: [],
        totalWeight: 0,
      });
    });

    it('encodes the MI code in the URL path', () => {
      gateway.getDetail('1001/ABC').subscribe();

      const request = httpMock.expectOne({
        method: 'GET',
        url: '/api/standard-boms/report/detail/1001%2FABC',
      });
      request.flush({ items: [] });
    });
  });
});
