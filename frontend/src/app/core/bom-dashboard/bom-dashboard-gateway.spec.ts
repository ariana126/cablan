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
          },
        ],
      });

      expect(result).toEqual({
        items: [
          {
            productId: 'p1',
            productName: 'کابل شبکه U/UTP 0.42 LEGRAND',
            dailyBomCount: 4,
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
  });

  describe('dailyBoms', () => {
    it('requests a product daily-BOM list with no range key at all when none is given', () => {
      gateway.dailyBoms('p1').subscribe();

      const request = httpMock.expectOne({
        method: 'POST',
        url: '/api/boms/dashboard/p1/daily-boms',
      });
      expect(request.request.body).toEqual({});

      request.flush({ items: [] });
    });

    it('sends a range and maps the analysis rows with their per-line composition', () => {
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
            id: '1',
            orderNumber: 'ORD-5001',
            registeredAt: '2026-06-22T04:00:00.000Z',
            description: 'بررسی کیفیت اولیه',
            score: 3,
            lines: [
              { componentName: 'مغزی', materialName: 'مسی', actualWeight: 3, standardWeight: 2 },
              {
                componentName: 'روکش',
                materialName: 'آلومینیوم',
                actualWeight: 6,
                standardWeight: 4,
              },
            ],
          },
        ],
      });

      expect(result).toEqual({
        items: [
          {
            id: '1',
            orderNumber: 'ORD-5001',
            registeredAt: '2026-06-22T04:00:00.000Z',
            description: 'بررسی کیفیت اولیه',
            score: 3,
            lines: [
              {
                componentName: 'مغزی',
                materialName: 'مسی',
                actualWeight: 3,
                standardWeight: 2,
                description: '',
              },
              {
                componentName: 'روکش',
                materialName: 'آلومینیوم',
                actualWeight: 6,
                standardWeight: 4,
                description: '',
              },
            ],
          },
        ],
      });
    });

    it('defaults missing fields, including an empty composition and a missing description', () => {
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
            description: '',
            score: 0,
            lines: [],
          },
        ],
      });
    });

    it('defaults the BOM-level description when the API omits it', () => {
      let result: unknown;
      gateway.dailyBoms('p1').subscribe((value) => (result = value));

      httpMock.expectOne({ method: 'POST', url: '/api/boms/dashboard/p1/daily-boms' }).flush({
        items: [
          {
            id: '1',
            orderNumber: 'ORD-5001',
            registeredAt: '2026-06-22T04:00:00.000Z',
            score: 0,
            lines: [],
          },
        ],
      });

      expect(result).toEqual({
        items: [
          {
            id: '1',
            orderNumber: 'ORD-5001',
            registeredAt: '2026-06-22T04:00:00.000Z',
            description: '',
            score: 0,
            lines: [],
          },
        ],
      });
    });
  });
});
