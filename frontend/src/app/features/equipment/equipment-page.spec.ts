import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConfirmRetireEquipmentDialog } from './confirm-retire-equipment-dialog';
import { EquipmentFormDialog } from './equipment-form-dialog';
import { EquipmentPage } from './equipment-page';

const EQUIPMENT = [
  { id: '1', name: 'اکسترودر 1', retired: false, activePlanItemCount: 0 },
  { id: '2', name: 'اکسترودر 2', retired: true, activePlanItemCount: 0 },
];

function setUp() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  const fixture = TestBed.createComponent(EquipmentPage);
  TestBed.inject(ApplicationRef).tick();
  return {
    fixture,
    httpMock: TestBed.inject(HttpTestingController),
    root: fixture.nativeElement as HTMLElement,
  };
}

async function loaded(list = EQUIPMENT) {
  const context = setUp();
  context.httpMock.expectOne({ method: 'GET', url: '/api/equipment' }).flush(list);
  await context.fixture.whenStable();
  return context;
}

function stubDialog(result: boolean) {
  return vi
    .spyOn(TestBed.inject(MatDialog), 'open')
    .mockReturnValue({ afterClosed: () => of(result) } as MatDialogRef<unknown, boolean>);
}

function byLabel(root: HTMLElement, label: string): HTMLButtonElement | null {
  return root.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
}

function cellsOfRow(root: HTMLElement, index: number): string[] {
  return Array.from(root.querySelectorAll('tr.mat-mdc-row')[index].querySelectorAll('td')).map(
    (cell) => cell.textContent?.trim() ?? '',
  );
}

describe('EquipmentPage', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('opens with «مدیریت تجهیزات / دستگاه» as its heading', async () => {
    const { root } = await loaded();

    expect(root.querySelector('h1')?.textContent?.trim()).toBe('مدیریت تجهیزات / دستگاه');
  });

  it('shows a progress bar until the list arrives', () => {
    const { httpMock, root } = setUp();

    expect(root.querySelector('mat-progress-bar')).not.toBeNull();

    httpMock.expectOne({ method: 'GET', url: '/api/equipment' }).flush([]);
  });

  it('lists each piece of equipment by name, a retired one marked as such', async () => {
    const { root } = await loaded();

    expect(cellsOfRow(root, 0).slice(0, 2)).toEqual(['اکسترودر 1', 'فعال']);
    expect(cellsOfRow(root, 1).slice(0, 2)).toEqual(['اکسترودر 2', 'کنار گذاشته شده']);
  });

  it('says so when nothing is registered yet', async () => {
    const { root } = await loaded([]);

    expect(root.textContent).toContain('هیچ تجهیزی ثبت نشده است.');
  });

  it('opens the add dialog from «افزودن تجهیز» and reloads once one is registered', async () => {
    const { fixture, httpMock, root } = await loaded();
    const open = stubDialog(true);

    Array.from(root.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'افزودن تجهیز')
      ?.click();
    TestBed.inject(ApplicationRef).tick();

    expect(open).toHaveBeenCalledWith(EquipmentFormDialog, { data: { mode: 'create' } });
    httpMock.expectOne({ method: 'GET', url: '/api/equipment' }).flush(EQUIPMENT);
    await fixture.whenStable();
  });

  it('opens the edit dialog from the row’s «ویرایش {name}»', async () => {
    const { fixture, root } = await loaded();
    const open = stubDialog(false);

    byLabel(root, 'ویرایش اکسترودر 1')?.click();
    await fixture.whenStable();

    expect(open).toHaveBeenCalledWith(EquipmentFormDialog, {
      data: { mode: 'edit', equipment: EQUIPMENT[0] },
    });
  });

  it('offers retiring in the row’s actions menu, behind a confirmation', async () => {
    const { fixture, httpMock, root } = await loaded();
    const open = stubDialog(true);

    const trigger = byLabel(root, 'عملیات بیشتر برای اکسترودر 1');
    trigger?.click();
    await fixture.whenStable();
    Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'))
      .find((item) => item.textContent?.trim() === 'کنار گذاشتن')
      ?.click();
    TestBed.inject(ApplicationRef).tick();

    // The menu item that opened it is gone once the menu closes, so focus is handed back to the
    // row's menu trigger rather than lost to <body>.
    expect(open).toHaveBeenCalledWith(ConfirmRetireEquipmentDialog, {
      data: { equipment: EQUIPMENT[0] },
      restoreFocus: trigger,
    });
    httpMock.expectOne({ method: 'GET', url: '/api/equipment' }).flush(EQUIPMENT);
    await fixture.whenStable();
  });

  // A retired piece of equipment can be neither renamed nor retired again.
  it('offers no actions on retired equipment', async () => {
    const { root } = await loaded();

    expect(byLabel(root, 'ویرایش اکسترودر 2')).toBeNull();
    expect(byLabel(root, 'عملیات بیشتر برای اکسترودر 2')).toBeNull();
  });

  it('says access is denied when the API refuses the list', async () => {
    const { fixture, httpMock, root } = setUp();

    httpMock
      .expectOne({ method: 'GET', url: '/api/equipment' })
      .flush({ title: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();

    expect(root.textContent).toContain('شما دسترسی لازم برای مشاهده این بخش را ندارید.');
    expect(root.textContent).not.toContain('افزودن تجهیز');
  });
});
