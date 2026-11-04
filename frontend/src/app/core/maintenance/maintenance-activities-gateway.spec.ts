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

  it('lists every activity in the catalog, with its specialty or none', () => {
    let activities: unknown;
    gateway.list().subscribe((value) => (activities = value));

    httpMock.expectOne({ method: 'GET', url: '/api/maintenance-activities' }).flush([
      { id: '1', name: 'تعویض روغن', specialty: 'mechanical' },
      { id: '2', specialty: null },
    ]);

    expect(activities).toEqual([
      { id: '1', name: 'تعویض روغن', specialty: 'mechanical' },
      { id: '2', name: '', specialty: null },
    ]);
  });

  it('registers an activity with its name and specialty', () => {
    let completed = false;
    gateway
      .register({ name: 'تعویض روغن', specialty: 'mechanical' })
      .subscribe(() => (completed = true));

    const request = httpMock.expectOne({ method: 'POST', url: '/api/maintenance-activities' });
    expect(request.request.body).toEqual({ name: 'تعویض روغن', specialty: 'mechanical' });
    request.flush({ id: '1' }, { status: 201, statusText: 'Created' });

    expect(completed).toBe(true);
  });

  it('edits an activity: its name and specialty together', () => {
    let completed = false;
    gateway
      .edit('1', { name: 'تعویض روغن موتور', specialty: 'electrical' })
      .subscribe(() => (completed = true));

    const request = httpMock.expectOne({ method: 'PATCH', url: '/api/maintenance-activities/1' });
    expect(request.request.body).toEqual({ name: 'تعویض روغن موتور', specialty: 'electrical' });
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });

  it('edits an activity with the correction of its name applied to every related record when asked', () => {
    gateway.edit('1', { name: 'تعویض روغن موتور', specialty: 'electrical' }, true).subscribe();

    const request = httpMock.expectOne({ method: 'PATCH', url: '/api/maintenance-activities/1' });
    expect(request.request.body).toEqual({
      name: 'تعویض روغن موتور',
      specialty: 'electrical',
      applyToRelatedRecords: true,
    });
    request.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('lists the activities that still have no specialty', () => {
    let activities: unknown;
    gateway.unassignedSpecialties().subscribe((value) => (activities = value));

    httpMock
      .expectOne({ method: 'GET', url: '/api/maintenance-activities/unassigned-specialties' })
      .flush([{ id: '1', name: 'روانکاری' }, { id: '2' }]);

    expect(activities).toEqual([
      { id: '1', name: 'روانکاری' },
      { id: '2', name: '' },
    ]);
  });

  it('assigns every missing specialty in one request', () => {
    let completed = false;
    gateway
      .assignSpecialties([
        { activityId: '1', specialty: 'electrical' },
        { activityId: '2', specialty: 'mechanical' },
      ])
      .subscribe(() => (completed = true));

    const request = httpMock.expectOne({
      method: 'POST',
      url: '/api/maintenance-activities/specialty-assignment',
    });
    expect(request.request.body).toEqual({
      assignments: [
        { activityId: '1', specialty: 'electrical' },
        { activityId: '2', specialty: 'mechanical' },
      ],
    });
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });
});
