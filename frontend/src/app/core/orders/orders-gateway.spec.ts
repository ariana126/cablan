import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AppOrder, OrdersGateway } from './orders-gateway';

const ORDER = {
  id: 'o1',
  orderNumber: 'ORD-5001',
  miCodes: [
    { standardBomId: 's1', miCode: '1001', productId: 'p1', productName: 'کابل 2.5' },
    { standardBomId: 's2', miCode: '1002', productId: 'p1', productName: 'کابل 2.5' },
  ],
  dailyBomCount: 2,
};

describe('OrdersGateway', () => {
  let gateway: OrdersGateway;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    gateway = TestBed.inject(OrdersGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('lists every order with its MI codes, in the order the API sends them', () => {
    let orders: AppOrder[] | undefined;
    gateway.list().subscribe((value) => (orders = value));

    httpMock.expectOne({ method: 'GET', url: '/api/orders' }).flush({ items: [ORDER] });

    expect(orders).toEqual([ORDER]);
  });

  it('fills what the response leaves out, never null', () => {
    let orders: AppOrder[] | undefined;
    gateway.list().subscribe((value) => (orders = value));

    httpMock.expectOne({ method: 'GET', url: '/api/orders' }).flush({ items: [{ id: 'o1' }] });

    expect(orders).toEqual([{ id: 'o1', orderNumber: '', miCodes: [], dailyBomCount: 0 }]);
  });

  it('finds an order by its number, typed in Persian digits and with spaces around it', () => {
    let order: AppOrder | null | undefined;
    gateway.findByNumber(' ORD-۵۰۰۱ ').subscribe((value) => (order = value));

    httpMock.expectOne({ method: 'GET', url: '/api/orders/by-number/ORD-5001' }).flush(ORDER);

    expect(order).toEqual(ORDER);
  });

  it('keeps a number with a slash in one path segment', () => {
    gateway.findByNumber('A/1').subscribe();

    httpMock.expectOne({ method: 'GET', url: '/api/orders/by-number/A%2F1' }).flush(ORDER);
  });

  it('answers null for a number no order has', () => {
    let order: AppOrder | null | undefined;
    gateway.findByNumber('ORD-6001').subscribe((value) => (order = value));

    httpMock
      .expectOne({ method: 'GET', url: '/api/orders/by-number/ORD-6001' })
      .flush(
        { type: 'https://my-api-doc.dev/problems/entity-not-found', status: 404 },
        { status: 404, statusText: 'Not Found' },
      );

    expect(order).toBeNull();
  });

  it('passes any other failure of the lookup on', () => {
    let failed = false;
    gateway.findByNumber('ORD-5001').subscribe({ error: () => (failed = true) });

    httpMock
      .expectOne({ method: 'GET', url: '/api/orders/by-number/ORD-5001' })
      .flush(null, { status: 500, statusText: 'Server Error' });

    expect(failed).toBe(true);
  });

  it('defines an order', () => {
    let completed = false;
    gateway
      .define({ orderNumber: 'ORD-5001', miCodes: ['1001', '1002'] })
      .subscribe(() => (completed = true));

    const request = httpMock.expectOne({ method: 'POST', url: '/api/orders' });
    expect(request.request.body).toEqual({ orderNumber: 'ORD-5001', miCodes: ['1001', '1002'] });
    request.flush({ id: 'o1' }, { status: 201, statusText: 'Created' });

    expect(completed).toBe(true);
  });

  it('adds an MI code to an order', () => {
    let completed = false;
    gateway.addMiCode('o1', '1002').subscribe(() => (completed = true));

    const request = httpMock.expectOne({ method: 'POST', url: '/api/orders/o1/mi-codes' });
    expect(request.request.body).toEqual({ miCode: '1002' });
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });

  it('edits an order', () => {
    let completed = false;
    gateway
      .update('o1', { orderNumber: 'ORD-5010', miCodes: ['1001'], applyToRelatedRecords: true })
      .subscribe(() => (completed = true));

    const request = httpMock.expectOne({ method: 'PATCH', url: '/api/orders/o1' });
    expect(request.request.body).toEqual({
      orderNumber: 'ORD-5010',
      miCodes: ['1001'],
      applyToRelatedRecords: true,
    });
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });

  it('deletes an order', () => {
    let completed = false;
    gateway.delete('o1').subscribe(() => (completed = true));

    httpMock
      .expectOne({ method: 'DELETE', url: '/api/orders/o1' })
      .flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });
});
