import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
import { AppDailyPmTask } from '../../core/maintenance/pm-schedule-gateway';
import { RecordExecutionDialog } from './record-execution-dialog';

interface Submittable {
  onSubmit(): Promise<unknown>;
}

const TASK: AppDailyPmTask = {
  equipmentId: 'e1',
  equipmentName: 'اکسترودر 1',
  planItemId: 'p1',
  activityId: 'a1',
  activityName: 'تعویض روغن',
  dueDate: '2026-10-07',
  status: 'due',
  daysOverdue: 0,
};

const URL = '/api/equipment/e1/pm-plan-items/p1/executions';

function setUp() {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: { task: TASK } },
    ],
  });
  const fixture = TestBed.createComponent(RecordExecutionDialog);
  return {
    fixture,
    close,
    httpMock: TestBed.inject(HttpTestingController),
    root: fixture.nativeElement as HTMLElement,
    submit: () => (fixture.componentInstance as unknown as Submittable).onSubmit(),
  };
}

function notes(root: HTMLElement): HTMLTextAreaElement | null {
  const label = Array.from(root.querySelectorAll('label')).find(
    (element) => element.textContent?.trim() === 'توضیحات',
  );
  const id = label?.getAttribute('for');
  return id ? root.querySelector(`#${id}`) : null;
}

describe('RecordExecutionDialog', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('names the task and its due date', async () => {
    const { fixture, root } = setUp();
    await fixture.whenStable();

    expect(root.querySelector('h2')?.textContent?.trim()).toBe('ثبت انجام تعویض روغن');
    expect(root.textContent).toContain('اکسترودر 1');
    expect(root.textContent).toContain('۱۴۰۵/۰۷/۱۵');
  });

  it('offers optional notes in a textarea and submits with «ثبت انجام»', async () => {
    const { fixture, root } = setUp();
    await fixture.whenStable();

    expect(notes(root)?.tagName).toBe('TEXTAREA');
    expect(notes(root)?.required).toBe(false);
    expect(
      Array.from(root.querySelectorAll('button[type="submit"]')).map((button) =>
        button.textContent?.trim(),
      ),
    ).toEqual(['ثبت انجام']);
  });

  it('records the execution with its notes and closes', async () => {
    const { fixture, root, close, httpMock, submit } = setUp();
    await fixture.whenStable();

    const field = notes(root)!;
    field.value = 'فیلتر روغن هم تعویض شد';
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    const submitted = submit();
    const request = httpMock.expectOne({ method: 'POST', url: URL });
    expect(request.request.body).toEqual({ notes: 'فیلتر روغن هم تعویض شد' });
    request.flush({ id: 'x1', dueDate: '2026-10-07' }, { status: 201, statusText: 'Created' });
    await submitted;

    expect(close).toHaveBeenCalledWith(true);
  });

  it('records the execution without notes', async () => {
    const { fixture, close, httpMock, submit } = setUp();
    await fixture.whenStable();

    const submitted = submit();
    const request = httpMock.expectOne({ method: 'POST', url: URL });
    expect(request.request.body).toEqual({});
    request.flush({ id: 'x1', dueDate: '2026-10-07' }, { status: 201, statusText: 'Created' });
    await submitted;

    expect(close).toHaveBeenCalledWith(true);
  });

  it('stays open with an alert when the item has left the plan meanwhile', async () => {
    const { fixture, root, close, httpMock, submit } = setUp();
    await fixture.whenStable();

    const submitted = submit();
    httpMock
      .expectOne({ method: 'POST', url: URL })
      .flush(
        { type: PROBLEM.pmPlanItemRemoved, title: 'PM Plan Item Removed', status: 409 },
        { status: 409, statusText: 'Conflict' },
      );
    await submitted;
    await fixture.whenStable();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'این فعالیت از برنامهٔ تجهیز حذف شده است.',
    );
    expect(close).not.toHaveBeenCalled();
  });
});
