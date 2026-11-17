import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { QcInspectionsGateway } from './qc-inspections-gateway';

describe('QcInspectionsGateway', () => {
  let gateway: QcInspectionsGateway;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    gateway = TestBed.inject(QcInspectionsGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists the in-service equipment with assigned activities and their last executions', () => {
    let equipment: unknown;
    gateway.list().subscribe((value) => (equipment = value));

    httpMock.expectOne({ method: 'GET', url: '/api/qc-inspections' }).flush([
      {
        id: 'e1',
        name: 'اکسترودر 1',
        retired: false,
        activities: [{ activityId: 'q1', activityName: 'بازرسی ابعادی', lastPerformedAt: null }],
      },
    ]);

    expect(equipment).toEqual([
      {
        id: 'e1',
        name: 'اکسترودر 1',
        retired: false,
        activities: [{ activityId: 'q1', activityName: 'بازرسی ابعادی', lastPerformedAt: null }],
      },
    ]);
  });

  it('reads the inspection view of one scanned equipment', () => {
    let equipment: unknown;
    gateway.get('e1').subscribe((value) => (equipment = value));

    httpMock
      .expectOne({ method: 'GET', url: '/api/qc-inspections/e1' })
      .flush({ id: 'e1', name: 'اکسترودر 1', retired: true, activities: [] });

    expect(equipment).toEqual({ id: 'e1', name: 'اکسترودر 1', retired: true, activities: [] });
  });

  it('records an execution with its tracking number and notes', () => {
    let completed = false;
    gateway
      .record('e1', 'q1', { trackingNumber: 'TR-100', notes: 'خراش جزئی' })
      .subscribe({ complete: () => (completed = true) });

    const request = httpMock.expectOne({
      method: 'POST',
      url: '/api/qc-equipment/e1/activities/q1/executions',
    });
    expect(request.request.body).toEqual({ trackingNumber: 'TR-100', notes: 'خراش جزئی' });
    request.flush({ id: 'x1' }, { status: 201, statusText: 'Created' });

    expect(completed).toBe(true);
  });

  it('leaves blank notes out of the record', () => {
    gateway.record('e1', 'q1', { trackingNumber: 'TR-100', notes: '   ' }).subscribe();

    const request = httpMock.expectOne({
      method: 'POST',
      url: '/api/qc-equipment/e1/activities/q1/executions',
    });
    expect(request.request.body).toEqual({ trackingNumber: 'TR-100' });
    request.flush({ id: 'x1' }, { status: 201, statusText: 'Created' });
  });
});
