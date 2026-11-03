import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PmScheduleGateway } from './pm-schedule-gateway';

describe('PmScheduleGateway', () => {
  let gateway: PmScheduleGateway;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    gateway = TestBed.inject(PmScheduleGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('reads today’s due and overdue work with each activity’s specialty, in the order the API gives it', () => {
    let tasks: unknown;
    gateway.daily().subscribe((value) => (tasks = value));

    httpMock.expectOne({ method: 'GET', url: '/api/pm-schedule/daily' }).flush([
      {
        equipmentId: 'e1',
        equipmentName: 'اکسترودر 1',
        planItemId: 'p1',
        activityId: 'a1',
        activityName: 'تعویض روغن',
        activitySpecialty: 'mechanical',
        dueDate: '2026-10-07',
        status: 'due',
        daysOverdue: 0,
      },
      { equipmentId: 'e1', planItemId: 'p2' },
    ]);

    expect(tasks).toEqual([
      {
        equipmentId: 'e1',
        equipmentName: 'اکسترودر 1',
        planItemId: 'p1',
        activityId: 'a1',
        activityName: 'تعویض روغن',
        activitySpecialty: 'mechanical',
        dueDate: '2026-10-07',
        status: 'due',
        daysOverdue: 0,
      },
      {
        equipmentId: 'e1',
        equipmentName: '',
        planItemId: 'p2',
        activityId: '',
        activityName: '',
        activitySpecialty: null,
        dueDate: '',
        status: 'due',
        daysOverdue: 0,
      },
    ]);
  });

  const ROW = {
    equipmentId: 'e1',
    equipmentName: 'اکسترودر 1',
    equipmentRetired: false,
    planItemId: 'p1',
    activityId: 'a1',
    activityName: 'تعویض روغن',
    activitySpecialty: 'electrical',
    dueDate: '2026-10-23',
    calendarDate: '2026-10-25',
    status: 'late',
    performedAt: '2026-10-25T07:00:00.000Z',
    performedById: 'u1',
    performedBy: 'مسلمی',
    daysLate: 2,
    notes: 'فیلتر هم تعویض شد',
  };

  const RANGE = { from: '2026-10-23', to: '2026-11-21' };

  it('reads the occurrences due in a range, asking for the range alone when nothing is filtered', () => {
    let occurrences: unknown;
    gateway
      .overview({
        ...RANGE,
        equipmentId: null,
        activityId: null,
        status: null,
        performedById: null,
        specialty: null,
      })
      .subscribe((value) => (occurrences = value));

    const request = httpMock.expectOne(
      (req) => req.method === 'GET' && req.url === '/api/pm-schedule/overview',
    );
    expect(request.request.params.keys().sort()).toEqual(['from', 'to']);
    expect(request.request.params.get('from')).toBe('2026-10-23');
    expect(request.request.params.get('to')).toBe('2026-11-21');
    request.flush([ROW]);

    expect(occurrences).toEqual([ROW]);
  });

  it('sends every chosen filter as a query parameter', () => {
    gateway
      .calendar({
        ...RANGE,
        equipmentId: 'e1',
        activityId: 'a1',
        status: 'late',
        performedById: 'u1',
        specialty: 'electrical',
      })
      .subscribe();

    const request = httpMock.expectOne(
      (req) => req.method === 'GET' && req.url === '/api/pm-schedule/calendar',
    );
    expect(
      Object.fromEntries(
        request.request.params.keys().map((key) => [key, request.request.params.get(key)]),
      ),
    ).toEqual({
      ...RANGE,
      equipmentId: 'e1',
      activityId: 'a1',
      status: 'late',
      performedById: 'u1',
      specialty: 'electrical',
    });
    request.flush([]);
  });

  it('reads an unperformed occurrence with nobody, no time, no delay, no notes and no specialty', () => {
    let occurrences: unknown;
    gateway
      .calendar({
        ...RANGE,
        equipmentId: null,
        activityId: null,
        status: null,
        performedById: null,
        specialty: null,
      })
      .subscribe((value) => (occurrences = value));

    httpMock
      .expectOne((req) => req.url === '/api/pm-schedule/calendar')
      .flush([{ equipmentId: 'e1', planItemId: 'p1', dueDate: '2026-11-22', status: 'upcoming' }]);

    expect(occurrences).toEqual([
      {
        equipmentId: 'e1',
        equipmentName: '',
        equipmentRetired: false,
        planItemId: 'p1',
        activityId: '',
        activityName: '',
        activitySpecialty: null,
        dueDate: '2026-11-22',
        calendarDate: '2026-11-22',
        status: 'upcoming',
        performedAt: null,
        performedById: null,
        performedBy: null,
        daysLate: null,
        notes: null,
      },
    ]);
  });

  it('reads the filters’ choices: equipment with whether it is retired, activities and performers', () => {
    let options: unknown;
    gateway.filterOptions().subscribe((value) => (options = value));

    httpMock.expectOne({ method: 'GET', url: '/api/pm-schedule/filter-options' }).flush({
      equipment: [{ id: 'e1', name: 'اکسترودر 1', retired: true }, { id: 'e2' }],
      activities: [{ id: 'a1', name: 'تعویض روغن' }],
    });

    expect(options).toEqual({
      equipment: [
        { id: 'e1', name: 'اکسترودر 1', retired: true },
        { id: 'e2', name: '', retired: false },
      ],
      activities: [{ id: 'a1', name: 'تعویض روغن' }],
      performers: [],
    });
  });
});
