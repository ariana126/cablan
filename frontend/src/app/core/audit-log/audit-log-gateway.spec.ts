import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AuditLogGateway } from './audit-log-gateway';

describe('AuditLogGateway', () => {
  let gateway: AuditLogGateway;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    gateway = TestBed.inject(AuditLogGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('list', () => {
    it('requests a page with no filter field at all when none are given', () => {
      gateway.list(1, 20).subscribe();

      const request = httpMock.expectOne({ method: 'POST', url: '/api/audit-log' });
      expect(request.request.body).toEqual({ page: 1, pageSize: 20 });

      request.flush({ items: [], total: 0 });
    });

    it('omits a filter field entirely when it is left undefined', () => {
      gateway.list(1, 20, { actorName: undefined, recordId: 'r-1' }).subscribe();

      const request = httpMock.expectOne({ method: 'POST', url: '/api/audit-log' });
      expect(Object.prototype.hasOwnProperty.call(request.request.body, 'actorName')).toBe(false);
      expect(request.request.body).toEqual({ page: 1, pageSize: 20, recordId: 'r-1' });

      request.flush({ items: [], total: 0 });
    });

    it('sends every filter field and maps the response page of entries', () => {
      let page: unknown;
      gateway
        .list(2, 10, {
          actorName: 'مصطفی',
          recordId: '66666666-6666-6666-6666-666666666666',
          from: '2026-06-21T00:00:00.000Z',
          to: '2026-06-26T00:00:00.000Z',
        })
        .subscribe((value) => (page = value));

      const request = httpMock.expectOne({ method: 'POST', url: '/api/audit-log' });
      expect(request.request.body).toEqual({
        page: 2,
        pageSize: 10,
        actorName: 'مصطفی',
        recordId: '66666666-6666-6666-6666-666666666666',
        from: '2026-06-21T00:00:00.000Z',
        to: '2026-06-26T00:00:00.000Z',
      });

      request.flush({
        items: [
          {
            id: '1',
            occurredAt: '2026-06-22T09:45:00.000Z',
            actorName: 'مصطفی',
            recordType: 'StandardBom',
            recordId: '66666666-6666-6666-6666-666666666666',
            action: 'Edited',
          },
        ],
        total: 7,
      });

      expect(page).toEqual({
        items: [
          {
            id: '1',
            occurredAt: '2026-06-22T09:45:00.000Z',
            actorName: 'مصطفی',
            recordType: 'StandardBom',
            recordId: '66666666-6666-6666-6666-666666666666',
            action: 'Edited',
          },
        ],
        total: 7,
      });
    });

    it('defaults missing fields on an entry and a missing total', () => {
      let page: unknown;
      gateway.list(1, 20).subscribe((value) => (page = value));

      httpMock.expectOne({ method: 'POST', url: '/api/audit-log' }).flush({ items: [{}] });

      expect(page).toEqual({
        items: [
          {
            id: '',
            occurredAt: '',
            actorName: '',
            recordType: 'User',
            recordId: '',
            action: 'Registered',
          },
        ],
        total: 0,
      });
    });
  });

  describe('changes', () => {
    it("fetches a single entry's field-level changes", () => {
      let changes: unknown;
      gateway.changes('1').subscribe((value) => (changes = value));

      httpMock.expectOne({ method: 'GET', url: '/api/audit-log/1/changes' }).flush({
        changes: [
          { field: 'standardLength', previousValue: '305', newValue: '310' },
          { field: 'brand', previousValue: 'Legrand', newValue: 'Nexans' },
        ],
      });

      expect(changes).toEqual([
        { field: 'standardLength', previousValue: '305', newValue: '310' },
        { field: 'brand', previousValue: 'Legrand', newValue: 'Nexans' },
      ]);
    });

    it('returns an empty array when the entry carries no changes (Registered/Deleted)', () => {
      let changes: unknown;
      gateway.changes('1').subscribe((value) => (changes = value));

      httpMock.expectOne({ method: 'GET', url: '/api/audit-log/1/changes' }).flush({});

      expect(changes).toEqual([]);
    });

    it('defaults missing fields on a change entry', () => {
      let changes: unknown;
      gateway.changes('1').subscribe((value) => (changes = value));

      httpMock
        .expectOne({ method: 'GET', url: '/api/audit-log/1/changes' })
        .flush({ changes: [{}] });

      expect(changes).toEqual([{ field: '', previousValue: '', newValue: '' }]);
    });
  });
});
