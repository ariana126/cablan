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

  it('registers a new daily BOM, cloning the referenced standard BOM composition, and answers its id', () => {
    let registeredId: string | undefined;
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
      .subscribe((id) => (registeredId = id));

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

    expect(registeredId).toBe('1');
  });

  it('re-samples a rejected daily BOM with only the new weights and description, and answers the new id', () => {
    let resampledId: string | undefined;
    gateway
      .resample('rejected-bom', {
        description: '',
        components: [
          { componentId: 'component-1', materials: [{ materialId: 'material-1', weight: 152 }] },
        ],
      })
      .subscribe((id) => (resampledId = id));

    const request = httpMock.expectOne({
      method: 'POST',
      url: '/api/boms/rejected-bom/resampling',
    });
    expect(request.request.body).toEqual({
      description: '',
      components: [
        { componentId: 'component-1', materials: [{ materialId: 'material-1', weight: 152 }] },
      ],
    });
    request.flush({ id: 'new-bom' }, { status: 201, statusText: 'Created' });

    expect(resampledId).toBe('new-bom');
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

  it('approves a daily BOM as the current user, with no body', () => {
    let completed = false;
    gateway.approve('1').subscribe(() => (completed = true));

    const request = httpMock.expectOne({ method: 'POST', url: '/api/boms/1/approval' });
    expect(request.request.body).toBeNull();
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });

  it('rejects a daily BOM as the current user, sending the reason', () => {
    let completed = false;
    gateway.reject('1', 'وزن مس خارج از محدوده است').subscribe(() => (completed = true));

    const request = httpMock.expectOne({ method: 'POST', url: '/api/boms/1/rejection' });
    expect(request.request.body).toEqual({ reason: 'وزن مس خارج از محدوده است' });
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });

  it("reads each material line's weight difference from the standard BOM", () => {
    let lines: unknown;
    gateway.weightDifferences('1').subscribe((value) => (lines = value));

    httpMock.expectOne({ method: 'GET', url: '/api/boms/1/weight-differences' }).flush({
      lines: [
        {
          componentId: 'component-1',
          componentName: 'مغزی',
          materialId: 'material-1',
          materialName: 'مس',
          actualWeight: 12.5,
          standardWeight: 10,
          difference: 2.5,
        },
      ],
    });

    expect(lines).toEqual([
      {
        componentId: 'component-1',
        componentName: 'مغزی',
        materialId: 'material-1',
        materialName: 'مس',
        actualWeight: 12.5,
        standardWeight: 10,
        difference: 2.5,
      },
    ]);
  });

  it('defaults missing fields on a weight-difference line, and a missing list to none', () => {
    let lines: unknown;
    let none: unknown;
    gateway.weightDifferences('1').subscribe((value) => (lines = value));
    gateway.weightDifferences('2').subscribe((value) => (none = value));

    httpMock.expectOne('/api/boms/1/weight-differences').flush({ lines: [{}] });
    httpMock.expectOne('/api/boms/2/weight-differences').flush({});

    expect(lines).toEqual([
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
    expect(none).toEqual([]);
  });
});
