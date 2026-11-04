import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PmPlansGateway } from './pm-plans-gateway';

describe('PmPlansGateway', () => {
  let gateway: PmPlansGateway;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    gateway = TestBed.inject(PmPlansGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // The UI offers days only; operating hours exist in the contract but the API refuses them.
  it('adds an activity to a plan with an interval in days', () => {
    let completed = false;
    gateway
      .addItem('e1', { activityId: 'a1', intervalDays: 30, firstDueDate: '2026-09-23' })
      .subscribe(() => (completed = true));

    const request = httpMock.expectOne({ method: 'POST', url: '/api/equipment/e1/pm-plan-items' });
    expect(request.request.body).toEqual({
      activityId: 'a1',
      intervalValue: 30,
      intervalUnit: 'days',
      firstDueDate: '2026-09-23',
    });
    request.flush({ id: 'p1' }, { status: 201, statusText: 'Created' });

    expect(completed).toBe(true);
  });

  it('changes a plan item’s interval', () => {
    let completed = false;
    gateway.changeInterval('e1', 'p1', 15).subscribe(() => (completed = true));

    const request = httpMock.expectOne({
      method: 'PATCH',
      url: '/api/equipment/e1/pm-plan-items/p1',
    });
    expect(request.request.body).toEqual({ intervalDays: 15 });
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });

  // Issue #110 — the System Admin's deletions.
  it('deletes one recorded execution of a plan item', () => {
    let completed = false;
    gateway.deleteExecution('e1', 'p1', 'x1').subscribe(() => (completed = true));

    httpMock
      .expectOne({ method: 'DELETE', url: '/api/equipment/e1/pm-plan-items/p1/executions/x1' })
      .flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });

  it('deletes every recorded execution of a plan item', () => {
    let completed = false;
    gateway.deleteExecutions('e1', 'p1').subscribe(() => (completed = true));

    httpMock
      .expectOne({ method: 'DELETE', url: '/api/equipment/e1/pm-plan-items/p1/executions' })
      .flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });

  it('deletes a deactivated plan item', () => {
    let completed = false;
    gateway.deleteItem('e1', 'p1').subscribe(() => (completed = true));

    httpMock
      .expectOne({ method: 'DELETE', url: '/api/equipment/e1/pm-plan-items/p1' })
      .flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });

  it('deactivates a plan item, with no body', () => {
    let completed = false;
    gateway.deactivateItem('e1', 'p1').subscribe(() => (completed = true));

    const request = httpMock.expectOne({
      method: 'POST',
      url: '/api/equipment/e1/pm-plan-items/p1/deactivation',
    });
    expect(request.request.body).toBeNull();
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });

  it('records an execution with its notes', () => {
    let completed = false;
    gateway
      .recordExecution('e1', 'p1', { notes: 'فیلتر هم عوض شد', operatingHours: null })
      .subscribe(() => (completed = true));

    const request = httpMock.expectOne({
      method: 'POST',
      url: '/api/equipment/e1/pm-plan-items/p1/executions',
    });
    expect(request.request.body).toEqual({ notes: 'فیلتر هم عوض شد' });
    request.flush({ id: 'x1', dueDate: '2026-09-23' }, { status: 201, statusText: 'Created' });

    expect(completed).toBe(true);
  });

  it('records the operating hours the performer gave', () => {
    gateway.recordExecution('e1', 'p1', { notes: '', operatingHours: 1250.5 }).subscribe();

    const request = httpMock.expectOne({
      method: 'POST',
      url: '/api/equipment/e1/pm-plan-items/p1/executions',
    });
    expect(request.request.body).toEqual({ operatingHours: 1250.5 });
    request.flush({ id: 'x1', dueDate: '2026-09-23' }, { status: 201, statusText: 'Created' });
  });

  it('sends zero operating hours, which is a reading, not an absence', () => {
    gateway.recordExecution('e1', 'p1', { notes: '', operatingHours: 0 }).subscribe();

    const request = httpMock.expectOne({
      method: 'POST',
      url: '/api/equipment/e1/pm-plan-items/p1/executions',
    });
    expect(request.request.body).toEqual({ operatingHours: 0 });
    request.flush({ id: 'x1', dueDate: '2026-09-23' }, { status: 201, statusText: 'Created' });
  });

  it('leaves blank notes and absent operating hours off the recording altogether', () => {
    gateway.recordExecution('e1', 'p1', { notes: '   ', operatingHours: null }).subscribe();

    const request = httpMock.expectOne({
      method: 'POST',
      url: '/api/equipment/e1/pm-plan-items/p1/executions',
    });
    expect(request.request.body).toEqual({});
    request.flush({ id: 'x1', dueDate: '2026-09-23' }, { status: 201, statusText: 'Created' });
  });
});
