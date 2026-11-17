import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
import { ConfirmDeleteQcExecutionDialog } from './confirm-delete-qc-execution-dialog';
import { EXECUTION } from './testing/qc-execution';

const DELETE = { method: 'DELETE', url: '/api/qc-executions/x2' };

function setUp() {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: { execution: EXECUTION } },
    ],
  });
  const fixture = TestBed.createComponent(ConfirmDeleteQcExecutionDialog);
  const root = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    close,
    root,
    httpMock: TestBed.inject(HttpTestingController),
    confirm: () =>
      Array.from(root.querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === 'حذف سابقه')
        ?.click(),
  };
}

describe('ConfirmDeleteQcExecutionDialog', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('names the record it deletes: activity, equipment and when', async () => {
    const { fixture, root } = setUp();
    await fixture.whenStable();

    expect(root.textContent).toContain(
      'سابقه انجام «بازرسی ابعادی» روی «اکسترودر 1» در ۱۴۰۵/۰۷/۰۲ ۱۲:۲۰ حذف می‌شود.',
    );
  });

  it('deletes the record and closes with true', async () => {
    const { fixture, close, httpMock, confirm } = setUp();
    await fixture.whenStable();

    confirm();
    httpMock.expectOne(DELETE).flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(close).toHaveBeenCalledWith(true);
  });

  it('says a record deleted meanwhile is gone, as its alert', async () => {
    const { fixture, root, close, httpMock, confirm } = setUp();
    await fixture.whenStable();

    confirm();
    httpMock
      .expectOne(DELETE)
      .flush(
        { type: PROBLEM.qcExecutionNotFound, status: 404 },
        { status: 404, statusText: 'Not Found' },
      );
    await fixture.whenStable();

    expect(close).not.toHaveBeenCalled();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'این سابقه دیگر وجود ندارد.',
    );
  });
});
