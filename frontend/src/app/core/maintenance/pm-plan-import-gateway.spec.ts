import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AppPmPlanImport, PmPlanImportGateway } from './pm-plan-import-gateway';

const REPORT = {
  sheetName: 'pm',
  counts: { toCreate: 1, alreadyExisting: 1, conflicts: 1, errors: 1 },
  errors: [
    {
      sheet: 'pm',
      cell: 'D1',
      row: 1,
      column: 'D',
      value: 'روغن کاری',
      reason: 'activity-not-found',
      message: 'فعالیت تعریف نشده است',
    },
  ],
  toCreate: [
    {
      cell: 'C3',
      equipmentId: 'e1',
      equipmentName: 'کمپرسور هوا',
      activityId: 'a1',
      activityName: 'تعویض روغن',
      intervalDays: 30,
      firstDueDate: '2026-11-21',
    },
  ],
  alreadyExisting: [
    {
      cell: 'D3',
      equipmentId: 'e1',
      equipmentName: 'کمپرسور هوا',
      activityId: 'a2',
      activityName: 'بررسی تابلو برق',
      intervalDays: 7,
      firstDueDate: '2026-11-21',
    },
  ],
  conflicts: [
    {
      cell: 'C4',
      equipmentId: 'e2',
      equipmentName: 'اکسترودر 1',
      activityId: 'a1',
      activityName: 'تعویض روغن',
      intervalDays: 30,
      firstDueDate: '2026-11-21',
      existingIntervalDays: 15,
      existingFirstDueDate: '2026-09-23',
      differences: ['intervalDays', 'firstDueDate'],
    },
  ],
};

describe('PmPlanImportGateway', () => {
  let gateway: PmPlanImportGateway;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    gateway = TestBed.inject(PmPlanImportGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('checks the chosen file, sent as the multipart field "file"', () => {
    gateway.preview(new File(['xlsx'], 'pm.xlsx')).subscribe();

    const request = httpMock.expectOne({ method: 'POST', url: '/api/pm-plan-imports/preview' });
    const file = (request.request.body as FormData).get('file') as File;
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('pm.xlsx');
    request.flush(REPORT);
  });

  it('answers the check as the server reported it', () => {
    let report: AppPmPlanImport | undefined;
    gateway.preview(new File(['xlsx'], 'pm.xlsx')).subscribe((value) => (report = value));

    httpMock.expectOne({ method: 'POST', url: '/api/pm-plan-imports/preview' }).flush(REPORT);

    expect(report).toEqual(REPORT);
  });

  it('reads a missing list as empty', () => {
    let report: AppPmPlanImport | undefined;
    gateway.preview(new File(['xlsx'], 'pm.xlsx')).subscribe((value) => (report = value));

    httpMock
      .expectOne({ method: 'POST', url: '/api/pm-plan-imports/preview' })
      .flush({ sheetName: 'pm', counts: REPORT.counts });

    expect(report).toMatchObject({ errors: [], toCreate: [], alreadyExisting: [], conflicts: [] });
  });

  it('imports by sending the same file again, and answers what was added', () => {
    const file = new File(['xlsx'], 'pm.xlsx');
    let report: AppPmPlanImport | undefined;
    gateway.import(file).subscribe((value) => (report = value));

    const request = httpMock.expectOne({ method: 'POST', url: '/api/pm-plan-imports' });
    expect((request.request.body as FormData).get('file')).toBe(file);
    request.flush(REPORT, { status: 201, statusText: 'Created' });

    expect(report?.toCreate).toEqual(REPORT.toCreate);
  });
});
