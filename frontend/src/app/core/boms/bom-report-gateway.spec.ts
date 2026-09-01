import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { BomReportGateway } from './bom-report-gateway';

describe('BomReportGateway', () => {
  let gateway: BomReportGateway;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    gateway = TestBed.inject(BomReportGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('report', () => {
    it('requests a page with no filters key at all when none are given', () => {
      gateway.report(1, 20).subscribe();

      const request = httpMock.expectOne({ method: 'POST', url: '/api/boms/report' });
      expect(request.request.body).toEqual({ page: 1, pageSize: 20 });
      expect(Object.prototype.hasOwnProperty.call(request.request.body, 'filters')).toBe(false);

      request.flush({ items: [], total: 0 });
    });

    it('omits a field from filters entirely when it is left undefined — "no filter"', () => {
      gateway.report(1, 20, { brands: undefined, productNames: ['کابل'] }).subscribe();

      const request = httpMock.expectOne({ method: 'POST', url: '/api/boms/report' });
      expect(Object.prototype.hasOwnProperty.call(request.request.body.filters, 'brands')).toBe(
        false,
      );
      expect(request.request.body.filters).toEqual({ productNames: ['کابل'] });

      request.flush({ items: [], total: 0 });
    });

    it('sends an explicit empty array for a field with every value deselected — "match nothing"', () => {
      gateway.report(1, 20, { brands: [] }).subscribe();

      const request = httpMock.expectOne({ method: 'POST', url: '/api/boms/report' });
      expect(request.request.body.filters).toEqual({ brands: [] });

      request.flush({ items: [], total: 0 });
    });

    it('sends the registered-at range and maps the response page of rows', () => {
      let page: unknown;
      gateway
        .report(2, 10, {
          registeredAtFrom: '2026-06-21T00:00:00.000Z',
          registeredAtTo: '2026-06-26T00:00:00.000Z',
        })
        .subscribe((value) => (page = value));

      const request = httpMock.expectOne({ method: 'POST', url: '/api/boms/report' });
      expect(request.request.body).toEqual({
        page: 2,
        pageSize: 10,
        filters: {
          registeredAtFrom: '2026-06-21T00:00:00.000Z',
          registeredAtTo: '2026-06-26T00:00:00.000Z',
        },
      });

      request.flush({
        items: [
          {
            id: '1',
            orderNumber: 'ORD-2001',
            trackingNumber: 'TRK-3001',
            registeredAt: '2026-06-22T04:00:00.000Z',
            registeredBy: 'نیکروش',
            standardBomMiCode: '1001',
            brand: 'لگراند',
            productName: 'کابل شبکه U/UTP 0.42 LEGRAND',
          },
        ],
        total: 4,
      });

      expect(page).toEqual({
        items: [
          {
            id: '1',
            orderNumber: 'ORD-2001',
            trackingNumber: 'TRK-3001',
            registeredAt: '2026-06-22T04:00:00.000Z',
            registeredBy: 'نیکروش',
            standardBomMiCode: '1001',
            brand: 'لگراند',
            productName: 'کابل شبکه U/UTP 0.42 LEGRAND',
          },
        ],
        total: 4,
      });
    });

    it('defaults missing fields on a row and a missing total', () => {
      let page: unknown;
      gateway.report(1, 20).subscribe((value) => (page = value));

      httpMock.expectOne({ method: 'POST', url: '/api/boms/report' }).flush({ items: [{}] });

      expect(page).toEqual({
        items: [
          {
            id: '',
            orderNumber: '',
            trackingNumber: '',
            registeredAt: '',
            registeredBy: '',
            standardBomMiCode: '',
            brand: '',
            productName: '',
          },
        ],
        total: 0,
      });
    });
  });

  describe('export', () => {
    it('requests every matching daily BOM, unpaginated, using only the given filters', () => {
      let items: unknown;
      gateway.export({ standardBomMiCodes: ['1002'] }).subscribe((value) => (items = value));

      const request = httpMock.expectOne({ method: 'POST', url: '/api/boms/report/export' });
      expect(request.request.body).toEqual({ filters: { standardBomMiCodes: ['1002'] } });

      request.flush({
        items: [
          {
            orderNumber: 'ORD-2002',
            trackingNumber: 'TRK-3002',
            registeredAt: '2026-06-25T10:30:00.000Z',
            registeredBy: 'مصطفی',
            standardBomMiCode: '1002',
            brand: 'لگراند',
            standardLength: 500,
            productName: 'کابل شبکه U/UTP 0.42 LEGRAND',
            components: [{ name: 'روکش', materials: [{ name: 'آلومینیوم', weight: 12 }] }],
          },
        ],
      });

      expect(items).toEqual([
        {
          orderNumber: 'ORD-2002',
          trackingNumber: 'TRK-3002',
          registeredAt: '2026-06-25T10:30:00.000Z',
          registeredBy: 'مصطفی',
          standardBomMiCode: '1002',
          brand: 'لگراند',
          standardLength: 500,
          productName: 'کابل شبکه U/UTP 0.42 LEGRAND',
          description: null,
          components: [{ name: 'روکش', materials: [{ name: 'آلومینیوم', weight: 12 }] }],
        },
      ]);
    });

    it('sends an empty filters object as-is, rather than omitting the key, when nothing is set', () => {
      gateway.export({}).subscribe();

      const request = httpMock.expectOne({ method: 'POST', url: '/api/boms/report/export' });
      expect(request.request.body).toEqual({ filters: {} });

      request.flush({ items: [] });
    });

    it('defaults missing item fields, an absent description becoming null rather than empty text', () => {
      let items: unknown;
      gateway.export({}).subscribe((value) => (items = value));

      httpMock.expectOne({ method: 'POST', url: '/api/boms/report/export' }).flush({ items: [{}] });

      expect(items).toEqual([
        {
          orderNumber: '',
          trackingNumber: '',
          registeredAt: '',
          registeredBy: '',
          standardBomMiCode: '',
          brand: '',
          standardLength: 0,
          productName: '',
          description: null,
          components: [],
        },
      ]);
    });
  });

  describe('filterOptions', () => {
    it('fetches every distinct filterable value', () => {
      let options: unknown;
      gateway.filterOptions().subscribe((value) => (options = value));

      httpMock.expectOne({ method: 'GET', url: '/api/boms/report/filter-options' }).flush({
        brands: ['لگراند', 'نگزنس'],
        componentNames: ['مغزی', 'روکش'],
        standardBomMiCodes: ['1001', '1002'],
        productNames: ['کابل شبکه U/UTP 0.42 LEGRAND'],
        registeredByUsers: ['نیکروش', 'مصطفی'],
      });

      expect(options).toEqual({
        brands: ['لگراند', 'نگزنس'],
        componentNames: ['مغزی', 'روکش'],
        standardBomMiCodes: ['1001', '1002'],
        productNames: ['کابل شبکه U/UTP 0.42 LEGRAND'],
        registeredByUsers: ['نیکروش', 'مصطفی'],
      });
    });

    it('defaults every field to an empty array when the response carries none', () => {
      let options: unknown;
      gateway.filterOptions().subscribe((value) => (options = value));

      httpMock.expectOne({ method: 'GET', url: '/api/boms/report/filter-options' }).flush({});

      expect(options).toEqual({
        brands: [],
        componentNames: [],
        standardBomMiCodes: [],
        productNames: [],
        registeredByUsers: [],
      });
    });
  });

  describe('get', () => {
    it("fetches a single daily BOM's full detail, composition and total weight included", () => {
      let detail: unknown;
      gateway.get('1').subscribe((value) => (detail = value));

      httpMock.expectOne({ method: 'GET', url: '/api/boms/1' }).flush({
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
        ],
        totalWeight: 15,
      });

      expect(detail).toEqual({
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
        ],
        totalWeight: 15,
      });
    });

    it('defaults missing fields, including an empty composition', () => {
      let detail: unknown;
      gateway.get('1').subscribe((value) => (detail = value));

      httpMock.expectOne({ method: 'GET', url: '/api/boms/1' }).flush({});

      expect(detail).toEqual({
        id: '',
        standardBomId: '',
        standardBomMiCode: '',
        brand: '',
        productName: '',
        standardLength: 0,
        orderNumber: '',
        trackingNumber: '',
        registeredBy: '',
        registeredAt: '',
        description: '',
        components: [],
        totalWeight: 0,
      });
    });
  });
});
