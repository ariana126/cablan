import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Role } from '../../api/model';
import { PROBLEM } from '../../core/http/problem-details';
import { signInAs } from '../../core/identity/testing/sign-in-as';
import { provideJalaliDateAdapter } from '../../core/material/jalali-date-adapter';
import { QcEquipmentFolderPage } from './qc-equipment-folder-page';

const FOLDER = {
  id: 'e1',
  name: 'اکسترودر 1',
  retired: false,
  activities: [{ activityId: 'q1', activityName: 'بازرسی ابعادی', lastPerformedAt: null }],
};

const isHistory = (request: { url: string }) => request.url === '/api/qc-executions';

async function open(answer: { body: object; status?: number }, role = Role.management) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      provideJalaliDateAdapter(),
    ],
  });
  const httpMock = TestBed.inject(HttpTestingController);
  await signInAs(role, httpMock);
  const fixture = TestBed.createComponent(QcEquipmentFolderPage);
  fixture.componentRef.setInput('equipmentId', 'e1');
  TestBed.inject(ApplicationRef).tick();
  httpMock
    .expectOne({ method: 'GET', url: '/api/qc-equipment/e1' })
    .flush(answer.body, { status: answer.status ?? 200, statusText: 'Answer' });
  // The records section asks for its own data next; stability waits until a test flushes it.
  TestBed.inject(ApplicationRef).tick();
  return { fixture, httpMock, root: fixture.nativeElement as HTMLElement };
}

function flushHistory(httpMock: HttpTestingController) {
  TestBed.inject(ApplicationRef).tick();
  httpMock
    .expectOne({ method: 'GET', url: '/api/qc-executions/filter-options' })
    .flush({ equipment: [], activities: [], performers: [] });
  const history = httpMock.expectOne(isHistory);
  expect(history.request.params.get('equipmentId')).toBe('e1');
  history.flush({ executions: [], counts: [] });
}

describe('QcEquipmentFolderPage', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('is headed by the equipment’s name, with the way back to the shelf', async () => {
    const { fixture, root, httpMock } = await open({ body: FOLDER });
    flushHistory(httpMock);
    await fixture.whenStable();

    expect(root.querySelector('h1')?.textContent?.trim()).toBe('اکسترودر 1');
    expect(root.querySelector('a[href="/qc-equipment"]')?.textContent?.trim()).toBe(
      'بازگشت به پرونده‌ها',
    );
    expect(root.querySelector('[role="status"]')?.textContent?.trim()).toBe('فعال');
  });

  it('holds two sections: the assigned activities, then the records of that equipment', async () => {
    const { fixture, root, httpMock } = await open({ body: FOLDER });
    flushHistory(httpMock);
    await fixture.whenStable();

    expect(
      Array.from(root.querySelectorAll('section > .data-sheet__bar h2, section h2')).map((title) =>
        title.textContent?.trim(),
      ),
    ).toEqual(['فعالیت‌های QC تجهیز', 'سوابق انجام فعالیت‌ها']);
  });

  it('keeps the folder, and the records’ filters, when a re-read fails — the error over it', async () => {
    const { fixture, root, httpMock } = await open({ body: FOLDER });
    flushHistory(httpMock);
    await fixture.whenStable();
    const reloadable = fixture.componentInstance as unknown as {
      equipmentResource: { reload(): void };
    };

    reloadable.equipmentResource.reload();
    TestBed.inject(ApplicationRef).tick();
    httpMock
      .expectOne({ method: 'GET', url: '/api/qc-equipment/e1' })
      .flush({ title: 'Server error' }, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(root.querySelector('h1')?.textContent?.trim()).toBe('اکسترودر 1');
    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'پرونده QC تجهیز بارگذاری نشد.',
    );
    expect(
      Array.from(root.querySelectorAll('section h2')).map((title) => title.textContent?.trim()),
    ).toEqual(['فعالیت‌های QC تجهیز', 'سوابق انجام فعالیت‌ها']);
  });

  it('says an unknown equipment’s folder was not found, with no section', async () => {
    const { fixture, root } = await open({
      body: { type: PROBLEM.equipmentNotFound, status: 404 },
      status: 404,
    });
    await fixture.whenStable();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain('این پرونده پیدا نشد.');
    expect(root.querySelector('section')).toBeNull();
  });
});
