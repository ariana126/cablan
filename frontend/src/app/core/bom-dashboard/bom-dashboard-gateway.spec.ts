import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { BomDashboardGateway } from './bom-dashboard-gateway';

describe('BomDashboardGateway', () => {
  let gateway: BomDashboardGateway;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    gateway = TestBed.inject(BomDashboardGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('products', () => {
    it('requests the product list with no range key at all when none is given', () => {
      gateway.products().subscribe();

      const request = httpMock.expectOne({ method: 'POST', url: '/api/boms/dashboard' });
      expect(request.request.body).toEqual({});
      expect(Object.prototype.hasOwnProperty.call(request.request.body, 'from')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(request.request.body, 'to')).toBe(false);

      request.flush({ items: [] });
    });

    it('sends the from-only range, omitting the to field entirely', () => {
      gateway.products({ from: '2026-06-21T00:00:00.000Z' }).subscribe();

      const request = httpMock.expectOne({ method: 'POST', url: '/api/boms/dashboard' });
      expect(request.request.body).toEqual({ from: '2026-06-21T00:00:00.000Z' });
      expect(Object.prototype.hasOwnProperty.call(request.request.body, 'to')).toBe(false);

      request.flush({ items: [] });
    });

    it('sends a full range and maps the response items', () => {
      let result: unknown;
      gateway
        .products({
          from: '2026-06-21T00:00:00.000Z',
          to: '2026-06-26T00:00:00.000Z',
        })
        .subscribe((value) => (result = value));

      const request = httpMock.expectOne({ method: 'POST', url: '/api/boms/dashboard' });
      expect(request.request.body).toEqual({
        from: '2026-06-21T00:00:00.000Z',
        to: '2026-06-26T00:00:00.000Z',
      });

      request.flush({
        items: [
          {
            productId: 'p1',
            productName: 'کابل شبکه U/UTP 0.42 LEGRAND',
            dailyBomCount: 4,
            lastRegisteredAt: '2026-06-22T04:00:00.000Z',
          },
        ],
      });

      expect(result).toEqual({
        items: [
          {
            productId: 'p1',
            productName: 'کابل شبکه U/UTP 0.42 LEGRAND',
            dailyBomCount: 4,
            lastRegisteredAt: '2026-06-22T04:00:00.000Z',
          },
        ],
      });
    });

    it('defaults every field on a row and an empty list when the response carries none', () => {
      let result: unknown;
      gateway.products().subscribe((value) => (result = value));

      httpMock.expectOne({ method: 'POST', url: '/api/boms/dashboard' }).flush({});

      expect(result).toEqual({ items: [] });
    });

    it('sends the approval filters alongside the range, an empty list kept as "match nothing"', () => {
      gateway
        .products({
          from: '2026-06-21T00:00:00.000Z',
          approvalStatuses: ['unapproved'],
          approvers: [],
        })
        .subscribe();

      const request = httpMock.expectOne({ method: 'POST', url: '/api/boms/dashboard' });
      expect(request.request.body).toEqual({
        from: '2026-06-21T00:00:00.000Z',
        approvalStatuses: ['unapproved'],
        approvers: [],
      });

      request.flush({ items: [] });
    });

    it('omits an approval filter left undefined', () => {
      gateway.products({ approvers: ['مصطفی', ''] }).subscribe();

      const request = httpMock.expectOne({ method: 'POST', url: '/api/boms/dashboard' });
      expect(request.request.body).toEqual({ approvers: ['مصطفی', ''] });
      expect(Object.prototype.hasOwnProperty.call(request.request.body, 'approvalStatuses')).toBe(
        false,
      );

      request.flush({ items: [] });
    });
  });

  describe('dailyBoms', () => {
    it("sends the approval filters on a product's daily-BOM list", () => {
      gateway.dailyBoms('p1', { approvalStatuses: ['approved'], approvers: ['مصطفی'] }).subscribe();

      const request = httpMock.expectOne({
        method: 'POST',
        url: '/api/boms/dashboard/p1/daily-boms',
      });
      expect(request.request.body).toEqual({
        approvalStatuses: ['approved'],
        approvers: ['مصطفی'],
      });

      request.flush({ items: [] });
    });

    it('requests a product daily-BOM list with no range key at all when none is given', () => {
      gateway.dailyBoms('p1').subscribe();

      const request = httpMock.expectOne({
        method: 'POST',
        url: '/api/boms/dashboard/p1/daily-boms',
      });
      expect(request.request.body).toEqual({});

      request.flush({ items: [] });
    });

    it('sends a range and maps each daily BOM by order number, with its approval, line ids and each line against its standard', () => {
      let result: unknown;
      gateway
        .dailyBoms('p1', {
          from: '2026-06-21T00:00:00.000Z',
          to: '2026-06-26T00:00:00.000Z',
        })
        .subscribe((value) => (result = value));

      const request = httpMock.expectOne({
        method: 'POST',
        url: '/api/boms/dashboard/p1/daily-boms',
      });
      expect(request.request.body).toEqual({
        from: '2026-06-21T00:00:00.000Z',
        to: '2026-06-26T00:00:00.000Z',
      });

      request.flush({
        items: [
          {
            id: 'bom-1',
            orderNumber: 'ORD-5001',
            trackingNumber: 'TRK-6001',
            registeredAt: '2026-06-22T04:00:00.000Z',
            registeredBy: 'نیکروش',
            description: 'بررسی کیفیت اولیه',
            standardBomMiCode: '1001',
            approvalStatus: 'approved',
            approvedBy: 'مصطفی',
            score: 3.5,
            lines: [
              {
                componentId: 'c1',
                componentName: 'مغزی',
                materialId: 'm1',
                materialName: 'مسی',
                actualWeight: 3,
                standardWeight: 2,
                difference: 1,
              },
            ],
          },
        ],
      });

      expect(result).toEqual({
        items: [
          {
            id: 'bom-1',
            orderNumber: 'ORD-5001',
            registeredAt: '2026-06-22T04:00:00.000Z',
            registeredBy: 'نیکروش',
            description: 'بررسی کیفیت اولیه',
            standardBomMiCode: '1001',
            approvalStatus: 'approved',
            approvedBy: 'مصطفی',
            lines: [
              {
                componentId: 'c1',
                componentName: 'مغزی',
                materialId: 'm1',
                materialName: 'مسی',
                actualWeight: 3,
                standardWeight: 2,
                difference: 1,
              },
            ],
          },
        ],
      });
    });

    it('defaults missing fields: an unapproved BOM with no approver, an empty composition', () => {
      let result: unknown;
      gateway.dailyBoms('p1').subscribe((value) => (result = value));

      httpMock
        .expectOne({ method: 'POST', url: '/api/boms/dashboard/p1/daily-boms' })
        .flush({ items: [{}] });

      expect(result).toEqual({
        items: [
          {
            id: '',
            orderNumber: '',
            registeredAt: '',
            registeredBy: '',
            description: '',
            standardBomMiCode: '',
            approvalStatus: 'unapproved',
            approvedBy: null,
            lines: [],
          },
        ],
      });
    });

    it('defaults a line missing its ids, names and weights', () => {
      let result: { items: { lines: unknown[] }[] } | undefined;
      gateway.dailyBoms('p1').subscribe((value) => (result = value));

      httpMock
        .expectOne({ method: 'POST', url: '/api/boms/dashboard/p1/daily-boms' })
        .flush({ items: [{ lines: [{}] }] });

      expect(result?.items[0]?.lines).toEqual([
        {
          componentId: '',
          componentName: '',
          materialId: '',
          materialName: '',
          actualWeight: 0,
          standardWeight: 0,
          difference: 0,
        },
      ]);
    });
  });
});
