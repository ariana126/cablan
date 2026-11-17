import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { QcEquipmentGateway } from './qc-equipment-gateway';

describe('QcEquipmentGateway', () => {
  let gateway: QcEquipmentGateway;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    gateway = TestBed.inject(QcEquipmentGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists every equipment, retired included, with its count of assigned QC activities', () => {
    let equipment: unknown;
    gateway.list().subscribe((value) => (equipment = value));

    httpMock.expectOne({ method: 'GET', url: '/api/qc-equipment' }).flush([
      { id: 'e1', name: 'اکسترودر 1', retired: false, assignedActivityCount: 2 },
      { id: 'e2', name: 'اکسترودر 2', retired: true },
    ]);

    expect(equipment).toEqual([
      { id: 'e1', name: 'اکسترودر 1', retired: false, assignedActivityCount: 2 },
      { id: 'e2', name: 'اکسترودر 2', retired: true, assignedActivityCount: 0 },
    ]);
  });

  it('reads one equipment’s QC folder, a missing last execution as null', () => {
    let folder: unknown;
    gateway.get('e1').subscribe((value) => (folder = value));

    httpMock.expectOne({ method: 'GET', url: '/api/qc-equipment/e1' }).flush({
      id: 'e1',
      name: 'اکسترودر 1',
      retired: false,
      activities: [
        { activityId: 'q1', activityName: 'بازرسی ابعادی', lastPerformedAt: null },
        { activityId: 'q2', activityName: 'بازرسی ظاهری', lastPerformedAt: '2026-09-23T05:00:00Z' },
        { activityId: 'q3', activityName: 'آزمون کشش' },
      ],
    });

    expect(folder).toEqual({
      id: 'e1',
      name: 'اکسترودر 1',
      retired: false,
      activities: [
        { activityId: 'q1', activityName: 'بازرسی ابعادی', lastPerformedAt: null },
        { activityId: 'q2', activityName: 'بازرسی ظاهری', lastPerformedAt: '2026-09-23T05:00:00Z' },
        { activityId: 'q3', activityName: 'آزمون کشش', lastPerformedAt: null },
      ],
    });
  });

  it('assigns an activity to an equipment', () => {
    let completed = false;
    gateway.assign('e1', 'q1').subscribe({ complete: () => (completed = true) });

    const request = httpMock.expectOne({ method: 'POST', url: '/api/qc-equipment/e1/activities' });
    expect(request.request.body).toEqual({ activityId: 'q1' });
    request.flush(null, { status: 201, statusText: 'Created' });

    expect(completed).toBe(true);
  });

  it('removes an activity’s assignment from an equipment', () => {
    let completed = false;
    gateway.unassign('e1', 'q1').subscribe({ complete: () => (completed = true) });

    httpMock
      .expectOne({ method: 'DELETE', url: '/api/qc-equipment/e1/activities/q1' })
      .flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });
});
