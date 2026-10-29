import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MaintenanceActivitiesGateway } from './maintenance-activities-gateway';

describe('MaintenanceActivitiesGateway', () => {
  let gateway: MaintenanceActivitiesGateway;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    gateway = TestBed.inject(MaintenanceActivitiesGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('lists every activity in the catalog', () => {
    let activities: unknown;
    gateway.list().subscribe((value) => (activities = value));

    httpMock
      .expectOne({ method: 'GET', url: '/api/maintenance-activities' })
      .flush([{ id: '1', name: 'تعویض روغن' }, { id: '2' }]);

    expect(activities).toEqual([
      { id: '1', name: 'تعویض روغن' },
      { id: '2', name: '' },
    ]);
  });

  it('registers an activity by name', () => {
    let completed = false;
    gateway.register('تعویض روغن').subscribe(() => (completed = true));

    const request = httpMock.expectOne({ method: 'POST', url: '/api/maintenance-activities' });
    expect(request.request.body).toEqual({ name: 'تعویض روغن' });
    request.flush({ id: '1' }, { status: 201, statusText: 'Created' });

    expect(completed).toBe(true);
  });

  it('renames an activity', () => {
    let completed = false;
    gateway.rename('1', 'تعویض روغن موتور').subscribe(() => (completed = true));

    const request = httpMock.expectOne({ method: 'PATCH', url: '/api/maintenance-activities/1' });
    expect(request.request.body).toEqual({ name: 'تعویض روغن موتور' });
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });
});
