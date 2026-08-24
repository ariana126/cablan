import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MaterialsGateway } from './materials-gateway';

describe('MaterialsGateway', () => {
  let gateway: MaterialsGateway;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    gateway = TestBed.inject(MaterialsGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('lists every registered material', () => {
    let materials: unknown;
    gateway.list().subscribe((value) => (materials = value));

    httpMock.expectOne({ method: 'GET', url: '/api/materials' }).flush([
      { id: '1', name: 'میلگرد فولادی' },
      { id: '2', name: 'ورق آلومینیوم' },
    ]);

    expect(materials).toEqual([
      { id: '1', name: 'میلگرد فولادی' },
      { id: '2', name: 'ورق آلومینیوم' },
    ]);
  });

  it('registers a new material', () => {
    let completed = false;
    gateway.register({ name: 'میلگرد فولادی' }).subscribe(() => (completed = true));

    const request = httpMock.expectOne({ method: 'POST', url: '/api/materials' });
    expect(request.request.body).toEqual({ name: 'میلگرد فولادی' });
    request.flush({ id: '1' }, { status: 201, statusText: 'Created' });

    expect(completed).toBe(true);
  });

  it('renames an existing material', () => {
    let completed = false;
    gateway.update('1', { name: 'نام جدید' }).subscribe(() => (completed = true));

    const request = httpMock.expectOne({ method: 'PATCH', url: '/api/materials/1' });
    expect(request.request.body).toEqual({ name: 'نام جدید' });
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });

  it('deletes a material', () => {
    let completed = false;
    gateway.delete('1').subscribe(() => (completed = true));

    httpMock
      .expectOne({ method: 'DELETE', url: '/api/materials/1' })
      .flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });
});
