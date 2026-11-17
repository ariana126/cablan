import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';

import { QcEquipmentPage } from './qc-equipment-page';

const EQUIPMENT = [
  { id: 'e1', name: 'اکسترودر 1', retired: false, assignedActivityCount: 2 },
  { id: 'e3', name: 'دستگاه بدون QC', retired: false, assignedActivityCount: 0 },
  { id: 'e2', name: 'اکسترودر کنار گذاشته', retired: true, assignedActivityCount: 1 },
];

async function loaded(list: object = EQUIPMENT) {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  const fixture = TestBed.createComponent(QcEquipmentPage);
  TestBed.inject(ApplicationRef).tick();
  TestBed.inject(HttpTestingController)
    .expectOne({ method: 'GET', url: '/api/qc-equipment' })
    .flush(list);
  await fixture.whenStable();
  return { fixture, root: fixture.nativeElement as HTMLElement };
}

/** The folder links inside the region named `region`, as name → href. */
function folders(root: HTMLElement, region: string): [string, string | null][] {
  const sheet = Array.from(root.querySelectorAll('section')).find(
    (section) => section.querySelector('h2')?.textContent?.trim() === region,
  );
  return Array.from(sheet?.querySelectorAll('a') ?? []).map((link) => [
    link.querySelector('.folder-card__name')?.textContent?.trim() ?? '',
    link.getAttribute('href'),
  ]);
}

describe('QcEquipmentPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('is headed «پرونده QC تجهیزات»', async () => {
    const { root } = await loaded();

    expect(root.querySelector('h1')?.textContent?.trim()).toBe('پرونده QC تجهیزات');
  });

  it('shelves a folder per equipment in service, each a link to its QC folder', async () => {
    const { root } = await loaded();

    expect(folders(root, 'تجهیزات فعال')).toEqual([
      ['اکسترودر 1', '/qc-equipment/e1'],
      ['دستگاه بدون QC', '/qc-equipment/e3'],
    ]);
  });

  it('says under each folder how many QC activities it holds, in Persian digits', async () => {
    const { root } = await loaded();

    expect(
      Array.from(root.querySelectorAll('.folder-card__detail')).map((line) =>
        line.textContent?.trim(),
      ),
    ).toEqual(expect.arrayContaining(['۲ فعالیت QC', 'بدون فعالیت QC']));
  });

  it('keeps retired equipment’s folders in «تجهیزات کنار گذاشته شده»', async () => {
    const { root } = await loaded();

    const archive = root.querySelector('mat-expansion-panel');
    expect(archive?.textContent).toContain('تجهیزات کنار گذاشته شده');
    expect(archive?.querySelector('a')?.getAttribute('href')).toBe('/qc-equipment/e2');
  });

  it('narrows the shelf by the equipment search', async () => {
    const { fixture, root } = await loaded();

    const search = root.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'بدون';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(folders(root, 'تجهیزات فعال')).toEqual([['دستگاه بدون QC', '/qc-equipment/e3']]);
  });

  it('says so when no equipment is registered', async () => {
    const { root } = await loaded([]);

    expect(root.textContent).toContain('هنوز هیچ تجهیز فعالی ثبت نشده است.');
  });
});
