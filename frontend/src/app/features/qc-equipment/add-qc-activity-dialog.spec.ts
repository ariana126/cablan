import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatAutocompleteHarness } from '@angular/material/autocomplete/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
import { AddQcActivityDialog } from './add-qc-activity-dialog';

const ASSIGN = { method: 'POST', url: '/api/qc-equipment/e1/activities' };
const CATALOG = [
  { id: 'q1', name: 'آزمون کشش', assignedEquipmentCount: 0 },
  { id: 'q2', name: 'بازرسی ابعادی', assignedEquipmentCount: 1 },
  { id: 'q3', name: 'بازرسی ظاهری', assignedEquipmentCount: 0 },
];

async function setUp(catalog: object = CATALOG) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MatDialogRef, useValue: { close } },
      {
        provide: MAT_DIALOG_DATA,
        useValue: { equipment: { id: 'e1', name: 'اکسترودر 1' }, assignedActivityIds: ['q2'] },
      },
    ],
  });
  const fixture = TestBed.createComponent(AddQcActivityDialog);
  TestBed.inject(ApplicationRef).tick();
  const httpMock = TestBed.inject(HttpTestingController);
  httpMock.expectOne({ method: 'GET', url: '/api/qc-activities' }).flush(catalog);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const loader = TestbedHarnessEnvironment.loader(fixture);
  return {
    fixture,
    close,
    httpMock,
    root,
    async offered(): Promise<string[]> {
      const picker = await loader.getHarness(MatAutocompleteHarness);
      await picker.focus();
      return Promise.all((await picker.getOptions()).map((option) => option.getText()));
    },
    async choose(name: string): Promise<void> {
      const picker = await loader.getHarness(MatAutocompleteHarness);
      await picker.enterText(name);
      await picker.selectOption({ text: name });
    },
    submit(): void {
      Array.from(root.querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === 'افزودن')
        ?.click();
    },
  };
}

describe('AddQcActivityDialog', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('names the equipment and offers only the catalog’s activities not assigned to it', async () => {
    const { root, offered } = await setUp();

    expect(root.querySelector('h2')?.textContent?.trim()).toBe('افزودن فعالیت QC');
    expect(root.textContent).toContain('اکسترودر 1');
    expect(await offered()).toEqual(['آزمون کشش', 'بازرسی ظاهری']);
  });

  it('assigns the chosen activity and closes with true', async () => {
    const { fixture, close, httpMock, choose, submit } = await setUp();

    await choose('بازرسی ظاهری');
    submit();
    const request = httpMock.expectOne(ASSIGN);
    expect(request.request.body).toEqual({ activityId: 'q3' });
    request.flush(null, { status: 201, statusText: 'Created' });
    await fixture.whenStable();

    expect(close).toHaveBeenCalledWith(true);
  });

  it('asks for an activity before sending anything', async () => {
    const { fixture, root, close, submit } = await setUp();

    submit();
    await fixture.whenStable();

    expect(root.querySelector('mat-error')?.textContent?.trim()).toBe('فعالیت QC را انتخاب کنید.');
    expect(close).not.toHaveBeenCalled();
  });

  it('shows the API’s own words when the equipment was retired meanwhile, and stays open', async () => {
    const { fixture, root, close, httpMock, choose, submit } = await setUp();

    await choose('آزمون کشش');
    submit();
    httpMock.expectOne(ASSIGN).flush(
      {
        type: PROBLEM.equipmentRetired,
        status: 409,
        detail: '"اکسترودر 1" کنار گذاشته شده است.',
      },
      { status: 409, statusText: 'Conflict' },
    );
    await fixture.whenStable();

    expect(close).not.toHaveBeenCalled();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      '"اکسترودر 1" کنار گذاشته شده است.',
    );
  });

  it('says an activity assigned meanwhile is assigned already', async () => {
    const { fixture, root, httpMock, choose, submit } = await setUp();

    await choose('آزمون کشش');
    submit();
    httpMock
      .expectOne(ASSIGN)
      .flush(
        { type: PROBLEM.qcActivityAlreadyAssigned, status: 409 },
        { status: 409, statusText: 'Conflict' },
      );
    await fixture.whenStable();

    expect(root.textContent).toContain('این فعالیت QC قبلاً به این تجهیز تخصیص داده شده است.');
  });

  it('says so when every activity of the catalog is assigned already', async () => {
    const { root } = await setUp([CATALOG[1]]);

    expect(root.textContent).toContain('همهٔ فعالیت‌های QC به این تجهیز تخصیص داده شده است.');
  });
});
