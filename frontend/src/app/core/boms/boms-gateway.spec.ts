import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { BomsGateway } from './boms-gateway';

describe('BomsGateway', () => {
  let gateway: BomsGateway;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    gateway = TestBed.inject(BomsGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('lists every registered daily BOM, components and materials included', () => {
    let boms: unknown;
    gateway.list().subscribe((value) => (boms = value));

    httpMock.expectOne({ method: 'GET', url: '/api/boms' }).flush([
      {
        id: '1',
        standardBomId: 'standard-bom-1',
        orderNumber: 'SO-1234',
        trackingNumber: 'TN-5678',
        description: 'برای سفارش امروز',
        components: [
          {
            id: '2',
            name: 'پیچ شش‌گوش',
            materials: [{ id: '3', name: 'میلگرد فولادی', weight: 150 }],
          },
        ],
      },
    ]);

    expect(boms).toEqual([
      {
        id: '1',
        standardBomId: 'standard-bom-1',
        orderNumber: 'SO-1234',
        trackingNumber: 'TN-5678',
        description: 'برای سفارش امروز',
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
    let boms: unknown;
    gateway.list().subscribe((value) => (boms = value));

    httpMock.expectOne({ method: 'GET', url: '/api/boms' }).flush([{}]);

    expect(boms).toEqual([
      {
        id: '',
        standardBomId: '',
        orderNumber: '',
        trackingNumber: '',
        description: '',
        components: [],
      },
    ]);
  });

  it('registers a new daily BOM, cloning the referenced standard BOM composition', () => {
    let completed = false;
    gateway
      .register({
        standardBomMiCode: '0001',
        orderNumber: 'SO-1234',
        trackingNumber: 'TN-5678',
        description: '',
        components: [
          { componentId: 'component-1', materials: [{ materialId: 'material-1', weight: 150 }] },
        ],
      })
      .subscribe(() => (completed = true));

    const request = httpMock.expectOne({ method: 'POST', url: '/api/boms' });
    expect(request.request.body).toEqual({
      standardBomMiCode: '0001',
      orderNumber: 'SO-1234',
      trackingNumber: 'TN-5678',
      description: '',
      components: [
        { componentId: 'component-1', materials: [{ materialId: 'material-1', weight: 150 }] },
      ],
    });
    request.flush({ id: '1' }, { status: 201, statusText: 'Created' });

    expect(completed).toBe(true);
  });

  it('edits an existing daily BOM, replacing its composition wholesale', () => {
    let completed = false;
    gateway
      .update('1', {
        standardBomMiCode: '0001',
        orderNumber: 'SO-9999',
        trackingNumber: 'TN-0000',
        description: '',
        components: [
          { componentId: 'component-1', materials: [{ materialId: 'material-1', weight: 200 }] },
        ],
      })
      .subscribe(() => (completed = true));

    const request = httpMock.expectOne({ method: 'PATCH', url: '/api/boms/1' });
    expect(request.request.body).toEqual({
      standardBomMiCode: '0001',
      orderNumber: 'SO-9999',
      trackingNumber: 'TN-0000',
      description: '',
      components: [
        { componentId: 'component-1', materials: [{ materialId: 'material-1', weight: 200 }] },
      ],
    });
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });

  it('deletes a daily BOM', () => {
    let completed = false;
    gateway.delete('1').subscribe(() => (completed = true));

    httpMock
      .expectOne({ method: 'DELETE', url: '/api/boms/1' })
      .flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });
});
