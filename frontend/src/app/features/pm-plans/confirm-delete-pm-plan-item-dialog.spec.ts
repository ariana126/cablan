import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
import { AppInactivePmPlanItem } from '../../core/maintenance/equipment-gateway';
import { ConfirmDeletePmPlanItemDialog } from './confirm-delete-pm-plan-item-dialog';
import { squeeze } from './testing/pm-plans-queries';

const ITEM: AppInactivePmPlanItem = {
  id: 'p0',
  activityId: 'a1',
  activityName: 'تعویض روغن',
  activitySpecialty: 'mechanical',
  intervalDays: 30,
  firstDueDate: '2026-09-23',
  deactivatedAt: '2026-10-02T06:30:00.000Z',
};

const URL = '/api/equipment/e1/pm-plan-items/p0';

async function setUp() {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: { equipmentId: 'e1', item: ITEM } },
    ],
  });
  const fixture = TestBed.createComponent(ConfirmDeletePmPlanItemDialog);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const button = (text: string) =>
    Array.from(root.querySelectorAll('button')).find(
      (candidate) => squeeze(candidate.textContent) === text,
    );
  return { fixture, root, close, button, httpMock: TestBed.inject(HttpTestingController) };
}

describe('ConfirmDeletePmPlanItemDialog', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('says the row and all its executions go', async () => {
    const { root } = await setUp();

    expect(squeeze(root.querySelector('h2')?.textContent)).toBe('حذف ردیف غیرفعال برنامه');
    const text = squeeze(root.textContent);
    expect(text).toContain('«تعویض روغن» (هر ۳۰ روز)');
    expect(text).toContain('همهٔ سوابق انجام آن');
  });

  it('deletes it on «حذف ردیف» and closes with true', async () => {
    const { fixture, close, button, httpMock } = await setUp();

    button('حذف ردیف')?.click();
    httpMock
      .expectOne({ method: 'DELETE', url: URL })
      .flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(close).toHaveBeenCalledWith(true);
  });

  it('says an active row must be deactivated first, and stays open', async () => {
    const { fixture, root, close, button, httpMock } = await setUp();

    button('حذف ردیف')?.click();
    httpMock
      .expectOne({ method: 'DELETE', url: URL })
      .flush({ type: PROBLEM.pmPlanItemActive }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();

    expect(close).not.toHaveBeenCalled();
    expect(squeeze(root.querySelector('[role="alert"]')?.textContent)).toBe(
      'برای حذف ردیف فعال، ابتدا آن را غیرفعال کنید.',
    );
  });

  it('closes with false on «انصراف»', async () => {
    const { close, button } = await setUp();

    button('انصراف')?.click();

    expect(close).toHaveBeenCalledWith(false);
  });
});
