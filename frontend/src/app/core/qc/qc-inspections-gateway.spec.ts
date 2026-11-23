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

  it('submits the ticked activities with one tracking number and answers each one’s outcome', () => {
    let results: unknown;
    gateway
      .recordTogether('e1', {
        submissionId: 's-1',
        trackingNumber: 'TR-100',
        activities: [
          { activityId: 'q1', notes: 'خراش جزئی' },
          { activityId: 'q2', notes: '' },
        ],
      })
      .subscribe((value) => (results = value));

    const request = httpMock.expectOne({ method: 'POST', url: '/api/qc-equipment/e1/executions' });
    expect(request.request.body).toEqual({
      submissionId: 's-1',
      trackingNumber: 'TR-100',
      activities: [{ activityId: 'q1', notes: 'خراش جزئی' }, { activityId: 'q2' }],
    });
    request.flush({
      results: [
        {
          activityId: 'q1',
          activityName: 'بازرسی ابعادی',
          outcome: 'recorded',
          executionId: 'x1',
          problemType: null,
        },
        {
          activityId: 'q2',
          activityName: 'بازرسی ظاهری',
          outcome: 'refused',
          executionId: null,
          problemType: 'qc-activity-not-assigned',
        },
      ],
    });

    expect(results).toEqual([
      {
        activityId: 'q1',
        activityName: 'بازرسی ابعادی',
        outcome: 'recorded',
        executionId: 'x1',
        problemType: null,
      },
      {
        activityId: 'q2',
        activityName: 'بازرسی ظاهری',
        outcome: 'refused',
        executionId: null,
        problemType: 'qc-activity-not-assigned',
      },
    ]);
  });

  it('leaves blank notes out of an activity', () => {
    gateway
      .recordTogether('e1', {
        submissionId: 's-1',
        trackingNumber: 'TR-100',
        activities: [{ activityId: 'q1', notes: '   ' }],
      })
      .subscribe();

    const request = httpMock.expectOne({ method: 'POST', url: '/api/qc-equipment/e1/executions' });
    expect(request.request.body.activities).toEqual([{ activityId: 'q1' }]);
    request.flush({ results: [] });
  });

  it('reads a refused activity that no longer exists as one without a name', () => {
    let results: unknown;
    gateway
      .recordTogether('e1', {
        submissionId: 's-1',
        trackingNumber: 'TR-100',
        activities: [{ activityId: 'q9', notes: '' }],
      })
      .subscribe((value) => (results = value));

    httpMock.expectOne({ method: 'POST', url: '/api/qc-equipment/e1/executions' }).flush({
      results: [
        {
          activityId: 'q9',
          activityName: null,
          outcome: 'refused',
          executionId: null,
          problemType: 'qc-activity-not-found',
        },
      ],
    });

    expect(results).toEqual([
      {
        activityId: 'q9',
        activityName: null,
        outcome: 'refused',
        executionId: null,
        problemType: 'qc-activity-not-found',
      },
    ]);
  });
});
