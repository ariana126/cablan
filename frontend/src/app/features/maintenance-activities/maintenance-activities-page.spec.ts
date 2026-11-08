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
  { id: '1', name: 'بررسی تابلو برق', specialty: 'electrical' },
  { id: '2', name: 'تعویض روغن', specialty: 'mechanical' },
  { id: '3', name: 'روانکاری', specialty: null },
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

async function chooseSpecialty(
  fixture: { whenStable(): Promise<unknown> },
  root: HTMLElement,
  text: string,
) {
  const field = Array.from(root.querySelectorAll('mat-form-field')).find(
    (candidate) => candidate.querySelector('mat-label')?.textContent?.trim() === 'تخصص',
  );
  field?.querySelector<HTMLElement>('.mat-mdc-select-trigger')?.click();
  await fixture.whenStable();
  const options = Array.from(document.body.querySelectorAll<HTMLElement>('mat-option'));
  options.find((option) => option.textContent?.trim() === text)?.click();
  await fixture.whenStable();
  return options.map((option) => option.textContent?.trim());
}

const names = (root: HTMLElement) =>
  Array.from(root.querySelectorAll('td.mat-column-name')).map((cell) => cell.textContent?.trim());

function typeSearch(root: HTMLElement, text: string) {
  const input = root.querySelector<HTMLInputElement>('input[type="search"]')!;
  input.value = text;
  input.dispatchEvent(new Event('input'));
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
    ).toEqual(['بررسی تابلو برق', 'تعویض روغن', 'روانکاری']);
  });

  it('shows each activity’s specialty in a «تخصص» column, «تخصص تعیین نشده» when it has none', async () => {
    const { root } = await loaded();

    expect(
      Array.from(root.querySelectorAll('th')).map((cell) => cell.textContent?.trim()),
    ).toContain('تخصص');
    expect(
      Array.from(root.querySelectorAll('td.mat-column-specialty')).map((cell) =>
        cell.textContent?.trim(),
      ),
    ).toEqual(['برق', 'مکانیک', 'تخصص تعیین نشده']);
  });

  describe('the «تخصص» filter', () => {
    it('offers همه, برق and مکانیک, همه first and chosen', async () => {
      const { fixture, root } = await loaded();

      expect(await chooseSpecialty(fixture, root, 'همه')).toEqual(['همه', 'برق', 'مکانیک']);
      expect(names(root)).toEqual(['بررسی تابلو برق', 'تعویض روغن', 'روانکاری']);
    });

    it('sits in the sheet’s bar beside the search, its chips above the table', async () => {
      const { fixture, root } = await loaded();
      await chooseSpecialty(fixture, root, 'برق');

      const bar = root.querySelector('.data-sheet__bar')!;
      expect(bar.querySelector('input[type="search"]')).not.toBeNull();
      expect(bar.querySelector('mat-select')).not.toBeNull();
      expect(root.querySelector('.data-sheet__body [aria-label="فیلترهای فعال"]')).toBeNull();
    });

    it('narrows the list to one specialty', async () => {
      const { fixture, root } = await loaded();

      await chooseSpecialty(fixture, root, 'مکانیک');

      expect(names(root)).toEqual(['تعویض روغن']);
    });

    it('combines with the name search', async () => {
      const { fixture, root } = await loaded([
        ...ACTIVITIES,
        { id: '4', name: 'تعویض فیلتر', specialty: 'electrical' },
      ]);

      await chooseSpecialty(fixture, root, 'برق');
      typeSearch(root, 'تعویض');
      await fixture.whenStable();

      expect(names(root)).toEqual(['تعویض فیلتر']);
    });

    it('shows the active filters as removable chips and clears them all at once', async () => {
      const { fixture, root } = await loaded();

      await chooseSpecialty(fixture, root, 'برق');
      typeSearch(root, 'تابلو');
      await fixture.whenStable();
      const strip = root.querySelector('[role="group"][aria-label="فیلترهای فعال"]');
      expect(strip?.textContent?.replace(/\s+/g, ' ')).toContain('تخصص: برق');
      expect(strip?.textContent?.replace(/\s+/g, ' ')).toContain('جستجو: تابلو');

      Array.from(strip?.querySelectorAll('button') ?? [])
        .find((button) => button.textContent?.trim() === 'پاک کردن همه')
        ?.click();
      await fixture.whenStable();

      expect(names(root)).toEqual(['بررسی تابلو برق', 'تعویض روغن', 'روانکاری']);
      expect(root.querySelector('[aria-label="فیلترهای فعال"]')).toBeNull();
    });

    it('lifts one filter from its chip', async () => {
      const { fixture, root } = await loaded();

      await chooseSpecialty(fixture, root, 'برق');
      root.querySelector<HTMLButtonElement>('[aria-label="حذف فیلتر تخصص: برق"]')?.click();
      await fixture.whenStable();

      expect(names(root)).toEqual(['بررسی تابلو برق', 'تعویض روغن', 'روانکاری']);
    });

    it('offers clearing the filters when nothing matches them', async () => {
      const { fixture, root } = await loaded();

      await chooseSpecialty(fixture, root, 'برق');
      typeSearch(root, 'روغن');
      await fixture.whenStable();

      expect(root.textContent).toContain('فعالیتی با این فیلترها یافت نشد.');
      Array.from(root.querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === 'پاک کردن فیلترها')
        ?.click();
      await fixture.whenStable();
      expect(names(root)).toHaveLength(3);
    });
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
