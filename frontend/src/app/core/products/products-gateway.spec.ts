import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProductsGateway } from './products-gateway';

describe('ProductsGateway', () => {
  let gateway: ProductsGateway;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    gateway = TestBed.inject(ProductsGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('lists every registered product, components and materials included', () => {
    let products: unknown;
    gateway.list().subscribe((value) => (products = value));

    httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush([
      {
        id: '1',
        name: 'ویجت',
        components: [
          {
            id: '2',
            name: 'پیچ شش‌گوش',
            materials: [{ id: '3', name: 'میلگرد فولادی' }],
          },
        ],
      },
    ]);

    expect(products).toEqual([
      {
        id: '1',
        name: 'ویجت',
        components: [
          {
            id: '2',
            name: 'پیچ شش‌گوش',
            materials: [{ id: '3', name: 'میلگرد فولادی' }],
          },
        ],
      },
    ]);
  });

  it('defaults missing fields on a list item, mirroring the flat gateways', () => {
    let products: unknown;
    gateway.list().subscribe((value) => (products = value));

    httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush([{}]);

    expect(products).toEqual([{ id: '', name: '', components: [] }]);
  });

  it('registers a new product with its components and materials', () => {
    let completed = false;
    gateway
      .register({
        name: 'ویجت',
        components: [{ name: 'پیچ شش‌گوش', materials: [{ name: 'میلگرد فولادی' }] }],
      })
      .subscribe(() => (completed = true));

    const request = httpMock.expectOne({ method: 'POST', url: '/api/products' });
    expect(request.request.body).toEqual({
      name: 'ویجت',
      components: [{ name: 'پیچ شش‌گوش', materials: [{ name: 'میلگرد فولادی' }] }],
    });
    request.flush({ id: '1' }, { status: 201, statusText: 'Created' });

    expect(completed).toBe(true);
  });

  it('edits an existing product, replacing its composition wholesale', () => {
    let completed = false;
    gateway
      .update('1', {
        name: 'ویجت جدید',
        components: [{ name: 'مهرهٔ فلزی', materials: [{ name: 'فولاد ضدزنگ' }] }],
      })
      .subscribe(() => (completed = true));

    const request = httpMock.expectOne({ method: 'PATCH', url: '/api/products/1' });
    expect(request.request.body).toEqual({
      name: 'ویجت جدید',
      components: [{ name: 'مهرهٔ فلزی', materials: [{ name: 'فولاد ضدزنگ' }] }],
    });
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });

  it('deletes a product', () => {
    let completed = false;
    gateway.delete('1').subscribe(() => (completed = true));

    httpMock
      .expectOne({ method: 'DELETE', url: '/api/products/1' })
      .flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });
});
