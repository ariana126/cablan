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

/** Each change row's three cells, as read on screen. */
function changeRows(root: HTMLElement): (string | undefined)[][] {
  return Array.from(root.querySelectorAll('tr.mat-mdc-row')).map((row) =>
    Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim()),
  );
}

const data: AuditLogChangesDialogData = {
  id: '1',
  actorName: 'مصطفی',
  recordTypeLabel: 'آنالیز استاندارد',
  action: 'Edited',
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

  it('renders an empty side of a change as the empty placeholder, not a blank cell', async () => {
    const { fixture, httpMock, root } = setUp({ ...data, action: 'Registered' });

    httpMock.expectOne({ method: 'GET', url: '/api/audit-log/1/changes' }).flush({
      changes: [
        { field: 'miCode', previousValue: '', newValue: 'MI-1' },
        { field: 'component', previousValue: '', newValue: 'Core: Copper (12.5 گرم)، PVC (3 گرم)' },
        { field: 'component', previousValue: '', newValue: 'Sheath: PVC (8 گرم)' },
      ],
    });
    await fixture.whenStable();

    const rows = Array.from(root.querySelectorAll('tbody tr')).map((row) =>
      Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim()),
    );

    expect(rows).toEqual([
      ['کد MI', '—', 'MI-1'],
      ['جز', '—', 'Core: Copper (12.5 گرم)، PVC (3 گرم)'],
      ['جز', '—', 'Sheath: PVC (8 گرم)'],
    ]);
  });

  it("translates a user's role and a standard BOM's active flag into their Persian labels", async () => {
    const { fixture, httpMock, root } = setUp(data);

    httpMock.expectOne({ method: 'GET', url: '/api/audit-log/1/changes' }).flush({
      changes: [
        { field: 'role', previousValue: 'reporter', newValue: 'qc_inspector' },
        { field: 'active', previousValue: 'true', newValue: 'false' },
      ],
    });
    await fixture.whenStable();

    const rows = Array.from(root.querySelectorAll('tbody tr')).map((row) =>
      Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim()),
    );

    expect(rows).toEqual([
      ['نقش', 'گزارشگیر', 'بازرس کنترل کیفیت'],
      ['فعال', 'بله', 'خیر'],
    ]);
  });

  it.each([
    ['Registered', 'ثبت‌شده توسط مصطفی'],
    ['Edited', 'ویرایش‌شده توسط مصطفی'],
    ['Deleted', 'حذف‌شده توسط مصطفی'],
    ['Approved', 'تاییدشده توسط مصطفی'],
    ['Rejected', 'عدم تایید شده توسط مصطفی'],
    ['ReturnedToPending', 'بازگشته به در انتظار تایید توسط مصطفی'],
    ['ApprovalRevoked', 'تایید لغوشده توسط مصطفی'],
  ] as const)('names a %s entry by what the actor did', async (action, subtitle) => {
    const { fixture, httpMock, root } = setUp({ ...data, action });

    httpMock.expectOne({ method: 'GET', url: '/api/audit-log/1/changes' }).flush({ changes: [] });
    await fixture.whenStable();

    expect(root.querySelector('.dialog-head__subtitle')?.textContent).toContain(subtitle);
  });

  it("shows a rejection's lines in words, a missing reviewer and note as a hyphen", async () => {
    const { fixture, httpMock, root } = setUp({ ...data, action: 'Rejected' });

    httpMock.expectOne({ method: 'GET', url: '/api/audit-log/1/changes' }).flush({
      changes: [
        { field: 'approvalStatus', previousValue: 'pending', newValue: 'rejected' },
        { field: 'reviewedBy', previousValue: '', newValue: 'مصطفی' },
        { field: 'managementNote', previousValue: '', newValue: 'وزن مس خارج از محدوده است' },
      ],
    });
    await fixture.whenStable();

    expect(changeRows(root)).toEqual([
      ['وضعیت تایید', 'در انتظار تایید', 'عدم تایید'],
      ['تایید/رد کننده', '-', 'مصطفی'],
      ['توضیحات مدیریت', '-', 'وزن مس خارج از محدوده است'],
    ]);
  });

  it("shows an older approval's lines in today's words", async () => {
    const { fixture, httpMock, root } = setUp({ ...data, action: 'Approved' });

    httpMock.expectOne({ method: 'GET', url: '/api/audit-log/1/changes' }).flush({
      changes: [
        { field: 'approvalStatus', previousValue: 'unapproved', newValue: 'approved' },
        { field: 'approvedBy', previousValue: '', newValue: 'مصطفی' },
      ],
    });
    await fixture.whenStable();

    expect(changeRows(root)).toEqual([
      ['وضعیت تایید', 'در انتظار تایید', 'تایید'],
      ['تایید/رد کننده', '-', 'مصطفی'],
    ]);
  });

  it("names an edit's material-weight line by its component and material", async () => {
    const { fixture, httpMock, root } = setUp(data);

    httpMock.expectOne({ method: 'GET', url: '/api/audit-log/1/changes' }).flush({
      changes: [{ field: 'materialWeight:مغزی:مسی', previousValue: '3', newValue: '2' }],
    });
    await fixture.whenStable();

    expect(changeRows(root)).toEqual([['وزن جز مغزی مواد اولیه مسی', '3', '2']]);
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

  it('names the record the entry concerns above the changes, when the entry has a subject', async () => {
    const { fixture, httpMock, root } = setUp({ ...data, action: 'Approved' });

    httpMock.expectOne({ method: 'GET', url: '/api/audit-log/1/changes' }).flush({
      changes: [{ field: 'approvalStatus', previousValue: 'unapproved', newValue: 'approved' }],
      subject: { field: 'trackingNumber', value: 'TRK-3005' },
    });
    await fixture.whenStable();

    const subject = root.querySelector('dl');
    expect(subject?.querySelector('dt')?.textContent?.trim()).toBe('شماره ردیابی');
    expect(subject?.querySelector('dd')?.textContent?.trim()).toBe('TRK-3005');
    const table = root.querySelector('table');
    expect(
      subject !== null &&
        table !== null &&
        subject.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('renders no subject when the entry has none', async () => {
    const { fixture, httpMock, root } = setUp(data);

    httpMock.expectOne({ method: 'GET', url: '/api/audit-log/1/changes' }).flush({
      changes: [{ field: 'standardLength', previousValue: '305', newValue: '310' }],
      subject: null,
    });
    await fixture.whenStable();

    expect(root.querySelector('dl')).toBeNull();
    expect(root.querySelector('table')).not.toBeNull();
  });
});
