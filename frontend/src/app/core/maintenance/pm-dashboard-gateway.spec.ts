import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AppPmDashboard, PmDashboardGateway } from './pm-dashboard-gateway';

describe('PmDashboardGateway', () => {
  let gateway: PmDashboardGateway;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    gateway = TestBed.inject(PmDashboardGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('asks for the chosen period and leaves the equipment off for «همه تجهیزات»', () => {
    gateway.dashboard({ periodDays: 7, equipmentId: null }).subscribe();

    const request = httpMock.expectOne((candidate) => candidate.url === '/api/pm-dashboard');
    expect(request.request.params.get('periodDays')).toBe('7');
    expect(request.request.params.has('equipmentId')).toBe(false);
    request.flush({});
  });

  it('scopes the dashboard to one piece of equipment', () => {
    gateway.dashboard({ periodDays: 30, equipmentId: 'e1' }).subscribe();

    const request = httpMock.expectOne((candidate) => candidate.url === '/api/pm-dashboard');
    expect(request.request.params.get('periodDays')).toBe('30');
    expect(request.request.params.get('equipmentId')).toBe('e1');
    request.flush({});
  });

  it('maps the answer with every field present', () => {
    let dashboard: AppPmDashboard | undefined;
    gateway.dashboard({ periodDays: 30, equipmentId: null }).subscribe((value) => {
      dashboard = value;
    });

    httpMock
      .expectOne((candidate) => candidate.url === '/api/pm-dashboard')
      .flush({
        today: '2026-10-02',
        generatedAt: '2026-10-02T06:30:00.000Z',
        periodDays: 30,
        periodFrom: '2026-09-03',
        periodTo: '2026-10-02',
        current: { dueToday: 1, overdue: 2 },
        missedCount: 4,
        performance: { considered: 10, onTime: 7, late: 2, notDone: 1, adherencePercent: 70 },
        trend: { daily: [{ from: '2026-10-01', to: '2026-10-01', considered: 1 }] },
        coverage: { activeEquipment: 2, equipmentWithoutPlan: [{ id: 'e2' }] },
        mostOverdueEquipment: [{ equipmentId: 'e1', equipmentName: 'اکسترودر 1' }],
        upcoming: [{ equipmentId: 'e1', dueDate: '2026-10-05' }],
        occurrences: [{ equipmentId: 'e1', status: 'overdue', daysOverdue: 3 }],
      });

    expect(dashboard).toEqual({
      today: '2026-10-02',
      generatedAt: '2026-10-02T06:30:00.000Z',
      periodDays: 30,
      periodFrom: '2026-09-03',
      periodTo: '2026-10-02',
      current: { dueToday: 1, overdue: 2, doneToday: 0 },
      missedCount: 4,
      performance: {
        considered: 10,
        onTime: 7,
        late: 2,
        notDone: 1,
        adherencePercent: 70,
        completionPercent: null,
        averageDaysLate: null,
      },
      trend: {
        daily: [
          {
            from: '2026-10-01',
            to: '2026-10-01',
            considered: 1,
            onTime: 0,
            late: 0,
            adherencePercent: null,
            completionPercent: null,
          },
        ],
        weekly: [],
      },
      coverage: {
        activeEquipment: 2,
        withPlan: 0,
        withoutPlan: 0,
        coveragePercent: null,
        equipmentWithoutPlan: [{ id: 'e2', name: '' }],
      },
      mostOverdueEquipment: [
        { equipmentId: 'e1', equipmentName: 'اکسترودر 1', overdueCount: 0, totalDaysOverdue: 0 },
      ],
      upcoming: [
        {
          equipmentId: 'e1',
          equipmentName: '',
          planItemId: '',
          activityName: '',
          dueDate: '2026-10-05',
        },
      ],
      occurrences: [
        {
          equipmentId: 'e1',
          equipmentName: '',
          equipmentRetired: false,
          planItemId: '',
          activityId: '',
          activityName: '',
          dueDate: '',
          status: 'overdue',
          daysOverdue: 3,
          daysLate: null,
          missedOn: null,
          performedAt: null,
          performedByName: null,
          notes: null,
          doneToday: false,
          recordable: false,
        },
      ],
    });
  });
});
