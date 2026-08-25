import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ComponentsGateway } from './components-gateway';

describe('ComponentsGateway', () => {
  let gateway: ComponentsGateway;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    gateway = TestBed.inject(ComponentsGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('lists every registered component', () => {
    let components: unknown;
    gateway.list().subscribe((value) => (components = value));

    httpMock.expectOne({ method: 'GET', url: '/api/components' }).flush([
      { id: '1', name: 'پیچ شش‌گوش' },
      { id: '2', name: 'مهرهٔ فلزی' },
    ]);

    expect(components).toEqual([
      { id: '1', name: 'پیچ شش‌گوش' },
      { id: '2', name: 'مهرهٔ فلزی' },
    ]);
  });

  it('registers a new component', () => {
    let completed = false;
    gateway.register({ name: 'پیچ شش‌گوش' }).subscribe(() => (completed = true));

    const request = httpMock.expectOne({ method: 'POST', url: '/api/components' });
    expect(request.request.body).toEqual({ name: 'پیچ شش‌گوش' });
    request.flush({ id: '1' }, { status: 201, statusText: 'Created' });

    expect(completed).toBe(true);
  });

  it('renames an existing component', () => {
    let completed = false;
    gateway.update('1', { name: 'نام جدید' }).subscribe(() => (completed = true));

    const request = httpMock.expectOne({ method: 'PATCH', url: '/api/components/1' });
    expect(request.request.body).toEqual({ name: 'نام جدید' });
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });

  it('deletes a component', () => {
    let completed = false;
    gateway.delete('1').subscribe(() => (completed = true));

    httpMock
      .expectOne({ method: 'DELETE', url: '/api/components/1' })
      .flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });
});
