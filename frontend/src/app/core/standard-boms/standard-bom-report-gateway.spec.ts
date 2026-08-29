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

  describe('filterOptions', () => {
    it('fetches every distinct filterable value', () => {
      let options: unknown;
      gateway.filterOptions().subscribe((value) => (options = value));

      httpMock.expectOne({ method: 'GET', url: '/api/standard-boms/report/filter-options' }).flush({
        brands: ['لگراند', 'نگزنس'],
        activeStatuses: [true, false],
        productNames: ['کابل شبکه U/UTP 0.42 LEGRAND'],
        componentNames: ['مغزی', 'روکش'],
      });

      expect(options).toEqual({
        brands: ['لگراند', 'نگزنس'],
        activeStatuses: [true, false],
        productNames: ['کابل شبکه U/UTP 0.42 LEGRAND'],
        componentNames: ['مغزی', 'روکش'],
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
