import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { StandardBomsGateway } from './standard-boms-gateway';

describe('StandardBomsGateway', () => {
  let gateway: StandardBomsGateway;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    gateway = TestBed.inject(StandardBomsGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('lists every registered standard BOM, components and materials included', () => {
    let standardBoms: unknown;
    gateway.list().subscribe((value) => (standardBoms = value));

    httpMock.expectOne({ method: 'GET', url: '/api/standard-boms' }).flush([
      {
        id: '1',
        miCode: '1234',
        brand: 'Legrand',
        standardLength: 305,
        active: true,
        description: 'برای کابل شبکه',
        productId: 'product-1',
        components: [
          {
            id: '2',
            name: 'پیچ شش‌گوش',
            materials: [{ id: '3', name: 'میلگرد فولادی', weight: 150 }],
          },
        ],
      },
    ]);

    expect(standardBoms).toEqual([
      {
        id: '1',
        miCode: '1234',
        brand: 'Legrand',
        standardLength: 305,
        active: true,
        description: 'برای کابل شبکه',
        productId: 'product-1',
        components: [
          {
            id: '2',
            name: 'پیچ شش‌گوش',
            materials: [{ id: '3', name: 'میلگرد فولادی', weight: 150 }],
          },
        ],
      },
    ]);
  });

  it('defaults missing fields on a list item', () => {
    let standardBoms: unknown;
    gateway.list().subscribe((value) => (standardBoms = value));

    httpMock.expectOne({ method: 'GET', url: '/api/standard-boms' }).flush([{}]);

    expect(standardBoms).toEqual([
      {
        id: '',
        miCode: '',
        brand: '',
        standardLength: 0,
        active: false,
        description: '',
        productId: '',
        components: [],
      },
    ]);
  });

  it('registers a new standard BOM, cloning the chosen product composition', () => {
    let completed = false;
    gateway
      .register({
        productId: 'product-1',
        miCode: '1234',
        brand: 'Legrand',
        standardLength: 305,
        active: true,
        components: [
          { componentId: 'component-1', materials: [{ materialId: 'material-1', weight: 150 }] },
        ],
      })
      .subscribe(() => (completed = true));

    const request = httpMock.expectOne({ method: 'POST', url: '/api/standard-boms' });
    expect(request.request.body).toEqual({
      productId: 'product-1',
      miCode: '1234',
      brand: 'Legrand',
      standardLength: 305,
      active: true,
      components: [
        { componentId: 'component-1', materials: [{ materialId: 'material-1', weight: 150 }] },
      ],
    });
    request.flush({ id: '1' }, { status: 201, statusText: 'Created' });

    expect(completed).toBe(true);
  });

  it('edits an existing standard BOM, replacing its composition wholesale', () => {
    let completed = false;
    gateway
      .update('1', {
        miCode: '5678',
        brand: 'Schneider',
        standardLength: 500,
        active: false,
        components: [
          { componentId: 'component-1', materials: [{ materialId: 'material-1', weight: 200 }] },
        ],
      })
      .subscribe(() => (completed = true));

    const request = httpMock.expectOne({ method: 'PATCH', url: '/api/standard-boms/1' });
    expect(request.request.body).toEqual({
      miCode: '5678',
      brand: 'Schneider',
      standardLength: 500,
      active: false,
      components: [
        { componentId: 'component-1', materials: [{ materialId: 'material-1', weight: 200 }] },
      ],
    });
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });

  it('deletes a standard BOM', () => {
    let completed = false;
    gateway.delete('1').subscribe(() => (completed = true));

    httpMock
      .expectOne({ method: 'DELETE', url: '/api/standard-boms/1' })
      .flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });
});
