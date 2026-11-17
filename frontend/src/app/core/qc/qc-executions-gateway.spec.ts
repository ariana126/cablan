import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { QcExecutionsGateway } from './qc-executions-gateway';

describe('QcExecutionsGateway', () => {
  let gateway: QcExecutionsGateway;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    gateway = TestBed.inject(QcExecutionsGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('reads every record with no filter at all, and maps records and counts in full', () => {
    let history: unknown;
    gateway.history({}).subscribe((value) => (history = value));

    const request = httpMock.expectOne(
      (candidate) => candidate.method === 'GET' && candidate.url === '/api/qc-executions',
    );
    expect(request.request.params.keys()).toEqual([]);
    request.flush({
      executions: [
        {
          id: 'x2',
          equipmentId: 'e1',
          equipmentName: 'اکسترودر 1',
          activityId: 'q1',
          activityName: 'بازرسی ابعادی',
          performedById: 'u1',
          performedByName: 'نیکروش',
          performedAt: '2026-09-24T08:50:00.000Z',
          trackingNumber: 'TR-101',
          notes: null,
          previousPerformedAt: '2026-09-23T05:30:00.000Z',
          intervalMinutes: 1640,
        },
        { id: 'x1' },
      ],
      counts: [
        {
          equipmentId: 'e1',
          equipmentName: 'اکسترودر 1',
          activityId: 'q1',
          activityName: 'بازرسی ابعادی',
          count: 2,
        },
      ],
    });

    expect(history).toEqual({
      executions: [
        {
          id: 'x2',
          equipmentId: 'e1',
          equipmentName: 'اکسترودر 1',
          activityId: 'q1',
          activityName: 'بازرسی ابعادی',
          performedById: 'u1',
          performedByName: 'نیکروش',
          performedAt: '2026-09-24T08:50:00.000Z',
          trackingNumber: 'TR-101',
          notes: null,
          previousPerformedAt: '2026-09-23T05:30:00.000Z',
          intervalMinutes: 1640,
        },
        {
          id: 'x1',
          equipmentId: '',
          equipmentName: '',
          activityId: '',
          activityName: '',
          performedById: '',
          performedByName: '',
          performedAt: '',
          trackingNumber: '',
          notes: null,
          previousPerformedAt: null,
          intervalMinutes: null,
        },
      ],
      counts: [
        {
          equipmentId: 'e1',
          equipmentName: 'اکسترودر 1',
          activityId: 'q1',
          activityName: 'بازرسی ابعادی',
          count: 2,
        },
      ],
    });
  });

  it('sends each filter that is set, the tracking number trimmed, and leaves blank ones off', () => {
    gateway
      .history({
        from: '2026-09-22T20:30:00.000Z',
        to: '2026-09-23T20:29:59.999Z',
        equipmentId: 'e1',
        activityId: '',
        performedById: 'u1',
        trackingNumber: '  TR-10 ',
      })
      .subscribe();

    const request = httpMock.expectOne((candidate) => candidate.url === '/api/qc-executions');
    const params = request.request.params;
    expect(params.get('from')).toBe('2026-09-22T20:30:00.000Z');
    expect(params.get('to')).toBe('2026-09-23T20:29:59.999Z');
    expect(params.get('equipmentId')).toBe('e1');
    expect(params.has('activityId')).toBe(false);
    expect(params.get('performedById')).toBe('u1');
    expect(params.get('trackingNumber')).toBe('TR-10');
    request.flush({ executions: [], counts: [] });
  });

  it('leaves a whitespace-only tracking number off', () => {
    gateway.history({ trackingNumber: '   ' }).subscribe();

    const request = httpMock.expectOne((candidate) => candidate.url === '/api/qc-executions');
    expect(request.request.params.has('trackingNumber')).toBe(false);
    request.flush({ executions: [], counts: [] });
  });

  it('reads the filter options', () => {
    let options: unknown;
    gateway.filterOptions().subscribe((value) => (options = value));

    httpMock.expectOne({ method: 'GET', url: '/api/qc-executions/filter-options' }).flush({
      equipment: [{ id: 'e1', name: 'اکسترودر 1', retired: true }],
      activities: [{ id: 'q1', name: 'بازرسی ابعادی' }],
    });

    expect(options).toEqual({
      equipment: [{ id: 'e1', name: 'اکسترودر 1', retired: true }],
      activities: [{ id: 'q1', name: 'بازرسی ابعادی' }],
      performers: [],
    });
  });

  it('deletes a record', () => {
    let completed = false;
    gateway.delete('x1').subscribe({ complete: () => (completed = true) });

    httpMock
      .expectOne({ method: 'DELETE', url: '/api/qc-executions/x1' })
      .flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });
});
