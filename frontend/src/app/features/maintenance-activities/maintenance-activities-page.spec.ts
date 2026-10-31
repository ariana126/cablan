import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MaintenanceActivitiesPage } from './maintenance-activities-page';
import { MaintenanceActivityFormDialog } from './maintenance-activity-form-dialog';

const ACTIVITIES = [
  { id: '1', name: 'بررسی تابلو برق' },
  { id: '2', name: 'تعویض روغن' },
];

function setUp() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  const fixture = TestBed.createComponent(MaintenanceActivitiesPage);
  TestBed.inject(ApplicationRef).tick();
  return {
    fixture,
    httpMock: TestBed.inject(HttpTestingController),
    root: fixture.nativeElement as HTMLElement,
  };
}

async function loaded(list = ACTIVITIES) {
  const context = setUp();
  context.httpMock.expectOne({ method: 'GET', url: '/api/maintenance-activities' }).flush(list);
  await context.fixture.whenStable();
  return context;
}

function stubDialog(result: boolean) {
  return vi
    .spyOn(TestBed.inject(MatDialog), 'open')
    .mockReturnValue({ afterClosed: () => of(result) } as MatDialogRef<unknown, boolean>);
}

describe('MaintenanceActivitiesPage', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('opens with «مدیریت فعالیت های PM» as its heading', async () => {
    const { root } = await loaded();

    expect(root.querySelector('h1')?.textContent?.trim()).toBe('مدیریت فعالیت های PM');
  });

  it('lists each activity by name', async () => {
    const { root } = await loaded();

    expect(
      Array.from(root.querySelectorAll('td.mat-column-name')).map((cell) =>
        cell.textContent?.trim(),
      ),
    ).toEqual(['بررسی تابلو برق', 'تعویض روغن']);
  });

  it('says so when the catalog is empty', async () => {
    const { root } = await loaded([]);

    expect(root.textContent).toContain('هیچ فعالیتی ثبت نشده است.');
  });

  it('opens the add dialog from «افزودن فعالیت» and reloads once one is registered', async () => {
    const { fixture, httpMock, root } = await loaded();
    const open = stubDialog(true);

    Array.from(root.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'افزودن فعالیت')
      ?.click();
    TestBed.inject(ApplicationRef).tick();

    expect(open).toHaveBeenCalledWith(MaintenanceActivityFormDialog, { data: { mode: 'create' } });
    httpMock.expectOne({ method: 'GET', url: '/api/maintenance-activities' }).flush(ACTIVITIES);
    await fixture.whenStable();
  });

  it('opens the edit dialog from the row’s «ویرایش {name}»', async () => {
    const { fixture, root } = await loaded();
    const open = stubDialog(false);

    root.querySelector<HTMLButtonElement>('[aria-label="ویرایش تعویض روغن"]')?.click();
    await fixture.whenStable();

    expect(open).toHaveBeenCalledWith(MaintenanceActivityFormDialog, {
      data: { mode: 'edit', activity: ACTIVITIES[1] },
    });
  });

  it('says access is denied when the API refuses the list', async () => {
    const { fixture, httpMock, root } = setUp();

    httpMock
      .expectOne({ method: 'GET', url: '/api/maintenance-activities' })
      .flush({ title: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();

    expect(root.textContent).toContain('شما دسترسی لازم برای مشاهده این بخش را ندارید.');
    expect(root.textContent).not.toContain('افزودن فعالیت');
  });
});
