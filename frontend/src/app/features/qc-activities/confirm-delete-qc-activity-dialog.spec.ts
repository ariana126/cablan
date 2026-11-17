import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CONFLICT,
  recordHasDependentsBody,
} from '../../core/http/testing/record-has-dependents-problem';
import { ConfirmDeleteQcActivityDialog } from './confirm-delete-qc-activity-dialog';

const DELETE = { method: 'DELETE', url: '/api/qc-activities/q1' };

function setUp() {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MatDialogRef, useValue: { close } },
      {
        provide: MAT_DIALOG_DATA,
        useValue: { activity: { id: 'q1', name: 'بازرسی ابعادی', assignedEquipmentCount: 0 } },
      },
    ],
  });
  const fixture = TestBed.createComponent(ConfirmDeleteQcActivityDialog);
  const root = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    close,
    root,
    httpMock: TestBed.inject(HttpTestingController),
    confirm: () =>
      Array.from(root.querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === 'حذف فعالیت QC')
        ?.click(),
  };
}

describe('ConfirmDeleteQcActivityDialog', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('names the activity it deletes', async () => {
    const { fixture, root } = setUp();
    await fixture.whenStable();

    expect(root.textContent).toContain('فعالیت QC «بازرسی ابعادی» حذف می‌شود.');
  });

  it('deletes the activity and closes with true', async () => {
    const { fixture, close, httpMock, confirm } = setUp();
    await fixture.whenStable();

    confirm();
    httpMock.expectOne(DELETE).flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(close).toHaveBeenCalledWith(true);
  });

  it('says where an activity in use is used, as its alert, and stays open', async () => {
    const { fixture, root, close, httpMock, confirm } = setUp();
    await fixture.whenStable();

    confirm();
    httpMock.expectOne(DELETE).flush(
      recordHasDependentsBody(
        [
          { kind: 'qc-assigned-equipment', count: 2, names: ['اکسترودر 1', 'اکسترودر 2'] },
          { kind: 'qc-activity-execution', count: 1, names: [] },
        ],
        'qc-activity',
      ),
      CONFLICT,
    );
    await fixture.whenStable();

    expect(close).not.toHaveBeenCalled();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'امکان حذف این اطلاعات وجود ندارد، زیرا در ۲ تجهیز («اکسترودر 1، اکسترودر 2») و ۱ سابقه انجام QC استفاده شده است.',
    );
  });
});
