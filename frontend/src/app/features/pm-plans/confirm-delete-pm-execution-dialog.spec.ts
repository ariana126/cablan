import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppMaintenanceExecution } from '../../core/maintenance/equipment-gateway';
import { ConfirmDeletePmExecutionDialog } from './confirm-delete-pm-execution-dialog';
import { squeeze } from './testing/pm-plans-queries';

const EXECUTION: AppMaintenanceExecution = {
  id: 'x1',
  planItemId: 'p1',
  activityName: 'تعویض روغن',
  dueDate: '2026-09-23',
  performedAt: '2026-09-23T07:00:00.000Z',
  performedBy: 'مسلمی',
  status: 'on_time',
  notes: '',
  daysLate: null,
  activitySpecialty: 'mechanical',
  operatingHours: null,
};

const URL = '/api/equipment/e1/pm-plan-items/p1/executions/x1';

async function setUp() {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: { equipmentId: 'e1', execution: EXECUTION } },
    ],
  });
  const fixture = TestBed.createComponent(ConfirmDeletePmExecutionDialog);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const button = (text: string) =>
    Array.from(root.querySelectorAll('button')).find(
      (candidate) => squeeze(candidate.textContent) === text,
    );
  return { fixture, root, close, button, httpMock: TestBed.inject(HttpTestingController) };
}

describe('ConfirmDeletePmExecutionDialog', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('names the execution by its activity, due date and performer', async () => {
    const { root } = await setUp();

    expect(squeeze(root.querySelector('h2')?.textContent)).toBe('حذف سابقه انجام');
    const text = squeeze(root.textContent);
    expect(text).toContain('«تعویض روغن»');
    expect(text).toContain('۱۴۰۵/۰۷/۰۱');
    expect(text).toContain('مسلمی');
  });

  it('deletes it on «حذف سابقه» and closes with true', async () => {
    const { fixture, close, button, httpMock } = await setUp();

    button('حذف سابقه')?.click();
    httpMock
      .expectOne({ method: 'DELETE', url: URL })
      .flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(close).toHaveBeenCalledWith(true);
  });

  it('says in the dialog when it is already gone, and stays open', async () => {
    const { fixture, root, close, button, httpMock } = await setUp();

    button('حذف سابقه')?.click();
    httpMock
      .expectOne({ method: 'DELETE', url: URL })
      .flush(
        { type: 'https://my-api-doc.dev/problems/entity-not-found' },
        { status: 404, statusText: 'Not Found' },
      );
    await fixture.whenStable();

    expect(close).not.toHaveBeenCalled();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('دیگر وجود ندارد');
  });

  it('closes with false on «انصراف»', async () => {
    const { close, button } = await setUp();

    button('انصراف')?.click();

    expect(close).toHaveBeenCalledWith(false);
  });
});
