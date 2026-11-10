import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
import { ConfirmDeleteEquipmentDialog } from './confirm-delete-equipment-dialog';

const RETIRED = { id: '2', name: 'اکسترودر 2', retired: true, activePlanItemCount: 1 };

const DETAIL = {
  id: '2',
  name: 'اکسترودر 2',
  retired: true,
  planItems: [
    {
      id: 'p1',
      activityId: 'a1',
      activityName: 'تعویض روغن',
      intervalDays: 30,
      firstDueDate: '2026-09-23',
      nextDueDate: '2026-10-23',
    },
  ],
  inactivePlanItems: [
    {
      id: 'p0',
      activityId: 'a2',
      activityName: 'بررسی تابلو برق',
      intervalDays: 7,
      firstDueDate: '2026-09-01',
      deactivatedAt: '2026-09-20T08:00:00.000Z',
    },
  ],
};

const HISTORY = [{ id: 'x1' }, { id: 'x2' }, { id: 'x3' }].map((execution) => ({
  ...execution,
  planItemId: 'p1',
  activityName: 'تعویض روغن',
  dueDate: '2026-09-23',
  performedAt: '2026-09-23T07:00:00.000Z',
  performedBy: 'مسلمی',
  status: 'on_time',
}));
// A missed due date (issue #114) is in the history but is no execution that goes with the equipment.
const HISTORY_WITH_MISSED = [
  ...HISTORY,
  {
    kind: 'missed',
    id: null,
    planItemId: 'p1',
    activityName: 'تعویض روغن',
    dueDate: '2026-08-01',
    performedAt: null,
    performedBy: null,
    status: 'missed',
  },
];

const squeeze = (text: string | null | undefined) => text?.replace(/\s+/g, ' ').trim() ?? '';

async function setUp() {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: { equipment: RETIRED } },
    ],
  });
  const fixture = TestBed.createComponent(ConfirmDeleteEquipmentDialog);
  const httpMock = TestBed.inject(HttpTestingController);
  const root = fixture.nativeElement as HTMLElement;
  // A tick, not `whenStable()`: what goes is being read until a spec flushes it.
  TestBed.inject(ApplicationRef).tick();
  const button = (text: string) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (candidate) => squeeze(candidate.textContent) === text,
    );
  const whatGoesArrives = async () => {
    httpMock.expectOne({ method: 'GET', url: '/api/equipment/2' }).flush(DETAIL);
    httpMock
      .expectOne({ method: 'GET', url: '/api/equipment/2/maintenance-history' })
      .flush(HISTORY_WITH_MISSED);
    await fixture.whenStable();
  };
  return { fixture, httpMock, root, close, button, whatGoesArrives };
}

describe('ConfirmDeleteEquipmentDialog', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('is titled «حذف تجهیز»', async () => {
    const { root, whatGoesArrives } = await setUp();
    await whatGoesArrives();

    expect(squeeze(root.querySelector('h2')?.textContent)).toBe('حذف تجهیز');
  });

  it('lists what goes with the equipment: every plan row and the count of its executions', async () => {
    const { root, whatGoesArrives } = await setUp();
    await whatGoesArrives();

    const text = squeeze(root.textContent);
    expect(text).toContain('«اکسترودر 2»');
    expect(text).toContain('۲ ردیف برنامه PM («تعویض روغن»، «بررسی تابلو برق»)');
    expect(text).toContain('۳ سابقهٔ انجام');
  });

  it('cannot be confirmed until it knows what goes', async () => {
    const { button, whatGoesArrives } = await setUp();

    expect(button('حذف تجهیز')?.disabled).toBe(true);
    await whatGoesArrives();
    expect(button('حذف تجهیز')?.disabled).toBe(false);
  });

  it('deletes the equipment on «حذف تجهیز» and closes with true', async () => {
    const { fixture, httpMock, close, button, whatGoesArrives } = await setUp();
    await whatGoesArrives();

    button('حذف تجهیز')?.click();
    httpMock
      .expectOne({ method: 'DELETE', url: '/api/equipment/2' })
      .flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(close).toHaveBeenCalledWith(true);
  });

  it('says in the dialog that only retired equipment is deleted, and stays open', async () => {
    const { fixture, httpMock, root, close, button, whatGoesArrives } = await setUp();
    await whatGoesArrives();

    button('حذف تجهیز')?.click();
    httpMock
      .expectOne({ method: 'DELETE', url: '/api/equipment/2' })
      .flush({ type: PROBLEM.equipmentNotRetired }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();

    expect(close).not.toHaveBeenCalled();
    expect(squeeze(root.querySelector('[role="alert"]')?.textContent)).toBe(
      'فقط تجهیز کنار گذاشته شده قابل حذف است.',
    );
  });

  it('closes with false on «انصراف», deleting nothing', async () => {
    const { close, button, whatGoesArrives } = await setUp();
    await whatGoesArrives();

    button('انصراف')?.click();

    expect(close).toHaveBeenCalledWith(false);
  });
});
