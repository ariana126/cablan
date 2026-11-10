import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConfirmDeletePmExecutionsDialog } from './confirm-delete-pm-executions-dialog';
import { squeeze } from './testing/pm-plans-queries';

const ITEM = {
  id: 'p1',
  activityId: 'a1',
  activityName: 'تعویض روغن',
  activitySpecialty: 'mechanical' as const,
  intervalDays: 7,
  firstDueDate: '2026-09-23',
  nextDueDate: '2026-10-23',
};

const execution = (id: string, planItemId: string) => ({
  id,
  planItemId,
  activityName: 'تعویض روغن',
  dueDate: '2026-09-23',
  performedAt: '2026-09-23T07:00:00.000Z',
  performedBy: 'مسلمی',
  status: 'on_time',
});

/** Two of this row's, and one of an earlier (deactivated) row of the same activity. */
// A missed due date of the same row (issue #114) is in the history but is no execution to delete.
const MISSED = {
  kind: 'missed',
  id: null,
  planItemId: 'p1',
  activityName: 'تعویض روغن',
  dueDate: '2026-08-01',
  performedAt: null,
  performedBy: null,
  status: 'missed',
};
const HISTORY = [execution('x1', 'p1'), execution('x2', 'p0'), execution('x3', 'p1'), MISSED];

const URL = '/api/equipment/e1/pm-plan-items/p1/executions';

function setUp() {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: { equipmentId: 'e1', item: ITEM } },
    ],
  });
  const fixture = TestBed.createComponent(ConfirmDeletePmExecutionsDialog);
  const httpMock = TestBed.inject(HttpTestingController);
  // A tick, not `whenStable()`: the history is being read until a spec flushes it.
  TestBed.inject(ApplicationRef).tick();
  const root = fixture.nativeElement as HTMLElement;
  const button = (text: string) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (candidate) => squeeze(candidate.textContent) === text,
    );
  const historyArrives = async () => {
    httpMock
      .expectOne({ method: 'GET', url: '/api/equipment/e1/maintenance-history' })
      .flush(HISTORY);
    await fixture.whenStable();
  };
  return { fixture, root, close, button, httpMock, historyArrives };
}

describe('ConfirmDeletePmExecutionsDialog', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('names the row and counts its executions only', async () => {
    const { root, historyArrives } = setUp();
    await historyArrives();

    expect(squeeze(root.querySelector('h2')?.textContent)).toBe('حذف همه سوابق');
    const text = squeeze(root.textContent);
    expect(text).toContain('«تعویض روغن» (هر ۷ روز)');
    expect(text).toContain('۲ سابقهٔ انجام');
  });

  it('cannot be confirmed until it has counted them', async () => {
    const { button, historyArrives } = setUp();

    expect(button('حذف همه سوابق')?.disabled).toBe(true);
    await historyArrives();
    expect(button('حذف همه سوابق')?.disabled).toBe(false);
  });

  it('deletes them on «حذف همه سوابق» and closes with true', async () => {
    const { fixture, close, button, httpMock, historyArrives } = setUp();
    await historyArrives();

    button('حذف همه سوابق')?.click();
    httpMock
      .expectOne({ method: 'DELETE', url: URL })
      .flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(close).toHaveBeenCalledWith(true);
  });

  it('shows a refusal in the dialog and stays open', async () => {
    const { fixture, root, close, button, httpMock, historyArrives } = setUp();
    await historyArrives();

    button('حذف همه سوابق')?.click();
    httpMock.expectOne({ method: 'DELETE', url: URL }).flush(null, {
      status: 403,
      statusText: 'Forbidden',
    });
    await fixture.whenStable();

    expect(close).not.toHaveBeenCalled();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'شما اجازهٔ انجام این عملیات را ندارید.',
    );
  });
});
