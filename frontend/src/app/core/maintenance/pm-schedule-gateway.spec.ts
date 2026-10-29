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

  it('reads today’s due and overdue work, in the order the API gives it', () => {
    let tasks: unknown;
    gateway.daily().subscribe((value) => (tasks = value));

    httpMock.expectOne({ method: 'GET', url: '/api/pm-schedule/daily' }).flush([
      {
        equipmentId: 'e1',
        equipmentName: 'اکسترودر 1',
        planItemId: 'p1',
        activityId: 'a1',
        activityName: 'تعویض روغن',
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
        dueDate: '',
        status: 'due',
        daysOverdue: 0,
      },
    ]);
  });

  it('reads every occurrence so far, an unperformed one with nobody and no time', () => {
    let occurrences: unknown;
    gateway.overview().subscribe((value) => (occurrences = value));

    httpMock.expectOne({ method: 'GET', url: '/api/pm-schedule/overview' }).flush([
      {
        equipmentId: 'e1',
        equipmentName: 'اکسترودر 1',
        planItemId: 'p1',
        activityName: 'تعویض روغن',
        dueDate: '2026-09-23',
        status: 'on_time',
        performedAt: '2026-09-23T07:00:00.000Z',
        performedBy: 'مسلمی',
      },
      {
        equipmentId: 'e1',
        equipmentName: 'اکسترودر 1',
        planItemId: 'p1',
        activityName: 'تعویض روغن',
        dueDate: '2026-10-23',
        status: 'upcoming',
        performedAt: null,
        performedBy: null,
      },
    ]);

    expect(occurrences).toEqual([
      {
        equipmentId: 'e1',
        equipmentName: 'اکسترودر 1',
        planItemId: 'p1',
        activityName: 'تعویض روغن',
        dueDate: '2026-09-23',
        status: 'on_time',
        performedAt: '2026-09-23T07:00:00.000Z',
        performedBy: 'مسلمی',
      },
      {
        equipmentId: 'e1',
        equipmentName: 'اکسترودر 1',
        planItemId: 'p1',
        activityName: 'تعویض روغن',
        dueDate: '2026-10-23',
        status: 'upcoming',
        performedAt: null,
        performedBy: null,
      },
    ]);
  });
});
