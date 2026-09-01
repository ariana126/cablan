import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuditLogChangesDialog, AuditLogChangesDialogData } from './audit-log-changes-dialog';

function setUp(data: AuditLogChangesDialogData) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close: vi.fn() } },
    ],
  });

  const fixture = TestBed.createComponent(AuditLogChangesDialog);
  TestBed.inject(ApplicationRef).tick();

  return {
    fixture,
    httpMock: TestBed.inject(HttpTestingController),
    root: fixture.nativeElement as HTMLElement,
  };
}

const data: AuditLogChangesDialogData = {
  id: '1',
  actorName: 'مصطفی',
  recordTypeLabel: 'آنالیز استاندارد',
  occurredAt: '2026-06-22T09:45:00.000Z',
};

describe('AuditLogChangesDialog', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('shows a loading indicator before the changes arrive', () => {
    const { httpMock } = setUp(data);

    httpMock.expectOne({ method: 'GET', url: '/api/audit-log/1/changes' }).flush({ changes: [] });
  });

  it('shows a loading indicator element while the request is in flight', () => {
    const { httpMock, root } = setUp(data);

    expect(root.querySelector('mat-progress-bar')).not.toBeNull();

    httpMock.expectOne({ method: 'GET', url: '/api/audit-log/1/changes' }).flush({ changes: [] });
  });

  it('renders every changed field with its Persian label and both values', async () => {
    const { fixture, httpMock, root } = setUp(data);

    httpMock.expectOne({ method: 'GET', url: '/api/audit-log/1/changes' }).flush({
      changes: [
        { field: 'standardLength', previousValue: '305', newValue: '310' },
        { field: 'brand', previousValue: 'Legrand', newValue: 'Nexans' },
      ],
    });
    await fixture.whenStable();

    const table = root.querySelector('table');
    const rows = Array.from(table?.querySelectorAll('tbody tr') ?? []).map((row) =>
      Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim()),
    );

    expect(rows).toEqual([
      ['متراژ استاندارد', '305', '310'],
      ['برند', 'Legrand', 'Nexans'],
    ]);
  });

  it('falls back to the raw field key when it has no Persian translation', async () => {
    const { fixture, httpMock, root } = setUp(data);

    httpMock
      .expectOne({ method: 'GET', url: '/api/audit-log/1/changes' })
      .flush({ changes: [{ field: 'someFutureField', previousValue: 'a', newValue: 'b' }] });
    await fixture.whenStable();

    expect(root.textContent).toContain('someFutureField');
  });

  it('shows an empty-state message and no table when there are no field changes', async () => {
    const { fixture, httpMock, root } = setUp(data);

    httpMock.expectOne({ method: 'GET', url: '/api/audit-log/1/changes' }).flush({ changes: [] });
    await fixture.whenStable();

    expect(root.textContent).toContain('بدون تغییر فیلد');
    expect(root.querySelector('table')).toBeNull();
  });

  it('shows the actor name and record type in the dialog title', async () => {
    const { fixture, httpMock, root } = setUp(data);

    httpMock.expectOne({ method: 'GET', url: '/api/audit-log/1/changes' }).flush({ changes: [] });
    await fixture.whenStable();

    expect(root.textContent).toContain('آنالیز استاندارد');
    expect(root.textContent).toContain('مصطفی');
  });

  it('shows a generic error and a retry button when the changes fail to load', async () => {
    const { fixture, httpMock, root } = setUp(data);

    httpMock
      .expectOne({ method: 'GET', url: '/api/audit-log/1/changes' })
      .flush({ title: 'Internal Server Error' }, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    const alert = root.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('بارگذاری نشد');
  });
});
