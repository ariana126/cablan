import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { QcActivitiesGateway } from './qc-activities-gateway';

describe('QcActivitiesGateway', () => {
  let gateway: QcActivitiesGateway;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    gateway = TestBed.inject(QcActivitiesGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists the QC catalog with how many equipment each activity is assigned to', () => {
    let activities: unknown;
    gateway.list().subscribe((value) => (activities = value));

    httpMock
      .expectOne({ method: 'GET', url: '/api/qc-activities' })
      .flush([{ id: 'q1', name: 'بازرسی ابعادی', assignedEquipmentCount: 2 }, { id: 'q2' }]);

    expect(activities).toEqual([
      { id: 'q1', name: 'بازرسی ابعادی', assignedEquipmentCount: 2 },
      { id: 'q2', name: '', assignedEquipmentCount: 0 },
    ]);
  });

  it('defines an activity by its name and answers its new id', () => {
    let id: string | undefined;
    gateway.define('بازرسی ابعادی').subscribe((value) => (id = value));

    const request = httpMock.expectOne({ method: 'POST', url: '/api/qc-activities' });
    expect(request.request.body).toEqual({ name: 'بازرسی ابعادی' });
    request.flush({ id: 'q1' }, { status: 201, statusText: 'Created' });

    expect(id).toBe('q1');
  });

  it('renames an activity without the correction flag by default', () => {
    gateway.rename('q1', 'بازرسی ابعاد').subscribe();

    const request = httpMock.expectOne({ method: 'PATCH', url: '/api/qc-activities/q1' });
    expect(request.request.body).toEqual({ name: 'بازرسی ابعاد' });
    request.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('sends the System Admin’s correction with applyToRelatedRecords', () => {
    gateway.rename('q1', 'بازرسی ابعاد', true).subscribe();

    const request = httpMock.expectOne({ method: 'PATCH', url: '/api/qc-activities/q1' });
    expect(request.request.body).toEqual({ name: 'بازرسی ابعاد', applyToRelatedRecords: true });
    request.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('deletes an activity', () => {
    let completed = false;
    gateway.delete('q1').subscribe({ complete: () => (completed = true) });

    httpMock
      .expectOne({ method: 'DELETE', url: '/api/qc-activities/q1' })
      .flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });
});
