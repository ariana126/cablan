import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { EquipmentGateway } from './equipment-gateway';

describe('EquipmentGateway', () => {
  let gateway: EquipmentGateway;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    gateway = TestBed.inject(EquipmentGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('lists every piece of equipment, retired ones included', () => {
    let equipment: unknown;
    gateway.list().subscribe((value) => (equipment = value));

    httpMock.expectOne({ method: 'GET', url: '/api/equipment' }).flush([
      { id: '1', name: 'اکسترودر 1', retired: false },
      { id: '2', name: 'اکسترودر 2', retired: true },
    ]);

    expect(equipment).toEqual([
      { id: '1', name: 'اکسترودر 1', retired: false },
      { id: '2', name: 'اکسترودر 2', retired: true },
    ]);
  });

  it('reads fields the response leaves out as empty, never undefined', () => {
    let equipment: unknown;
    gateway.list().subscribe((value) => (equipment = value));

    httpMock.expectOne({ method: 'GET', url: '/api/equipment' }).flush([{ id: '1' }]);

    expect(equipment).toEqual([{ id: '1', name: '', retired: false }]);
  });

  it('reads one piece of equipment with its active plan items', () => {
    let detail: unknown;
    gateway.get('1').subscribe((value) => (detail = value));

    httpMock.expectOne({ method: 'GET', url: '/api/equipment/1' }).flush({
      id: '1',
      name: 'اکسترودر 1',
      retired: false,
      planItems: [
        {
          id: 'p1',
          activityId: 'a1',
          activityName: 'تعویض روغن',
          intervalDays: 30,
          firstDueDate: '2026-09-23',
          nextDueDate: '2026-10-23',
        },
        { id: 'p2' },
      ],
    });

    expect(detail).toEqual({
      id: '1',
      name: 'اکسترودر 1',
      retired: false,
      planItems: [
        {
          id: 'p1',
          activityId: 'a1',
          activityName: 'تعویض روغن',
          intervalDays: 30,
          firstDueDate: '2026-09-23',
          nextDueDate: '2026-10-23',
        },
        {
          id: 'p2',
          activityId: '',
          activityName: '',
          intervalDays: 0,
          firstDueDate: '',
          nextDueDate: '',
        },
      ],
    });
  });

  it('registers equipment by name', () => {
    let completed = false;
    gateway.register('اکسترودر 1').subscribe(() => (completed = true));

    const request = httpMock.expectOne({ method: 'POST', url: '/api/equipment' });
    expect(request.request.body).toEqual({ name: 'اکسترودر 1' });
    request.flush({ id: '1' }, { status: 201, statusText: 'Created' });

    expect(completed).toBe(true);
  });

  it('renames equipment', () => {
    let completed = false;
    gateway.rename('1', 'اکسترودر اصلی').subscribe(() => (completed = true));

    const request = httpMock.expectOne({ method: 'PATCH', url: '/api/equipment/1' });
    expect(request.request.body).toEqual({ name: 'اکسترودر اصلی' });
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });

  it('retires equipment', () => {
    let completed = false;
    gateway.retire('1').subscribe(() => (completed = true));

    httpMock
      .expectOne({ method: 'POST', url: '/api/equipment/1/retirement' })
      .flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });

  it('reads the maintenance history, a missing note as an empty one and a missing delay as none', () => {
    let history: unknown;
    gateway.maintenanceHistory('1').subscribe((value) => (history = value));

    httpMock.expectOne({ method: 'GET', url: '/api/equipment/1/maintenance-history' }).flush([
      {
        id: 'e2',
        activityName: 'تعویض روغن',
        dueDate: '2026-10-23',
        performedAt: '2026-10-25T07:00:00.000Z',
        performedBy: 'مسلمی',
        status: 'late',
        notes: null,
        daysLate: 2,
      },
      {
        id: 'e1',
        activityName: 'تعویض روغن',
        dueDate: '2026-09-23',
        performedAt: '2026-09-23T07:00:00.000Z',
        performedBy: 'مسلمی',
        status: 'on_time',
        notes: 'فیلتر هم عوض شد',
      },
    ]);

    expect(history).toEqual([
      {
        id: 'e2',
        activityName: 'تعویض روغن',
        dueDate: '2026-10-23',
        performedAt: '2026-10-25T07:00:00.000Z',
        performedBy: 'مسلمی',
        status: 'late',
        notes: '',
        daysLate: 2,
      },
      {
        id: 'e1',
        activityName: 'تعویض روغن',
        dueDate: '2026-09-23',
        performedAt: '2026-09-23T07:00:00.000Z',
        performedBy: 'مسلمی',
        status: 'on_time',
        notes: 'فیلتر هم عوض شد',
        daysLate: null,
      },
    ]);
  });
});
