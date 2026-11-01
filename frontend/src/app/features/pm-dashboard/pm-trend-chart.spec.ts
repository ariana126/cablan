import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { AppPmDashboardTrendPoint } from '../../core/maintenance/pm-dashboard-gateway';
import { PmTrendChart } from './pm-trend-chart';

const point = (
  from: string,
  to: string,
  adherencePercent: number | null,
  completionPercent: number | null,
): AppPmDashboardTrendPoint => ({
  from,
  to,
  considered: adherencePercent === null ? 0 : 4,
  onTime: 2,
  late: 1,
  adherencePercent,
  completionPercent,
});

const DAILY = [
  point('2026-09-30', '2026-09-30', 50, 100),
  point('2026-10-01', '2026-10-01', null, null),
];
const WEEKLY = [point('2026-09-25', '2026-10-01', 70, 90)];

async function render() {
  const fixture = TestBed.createComponent(PmTrendChart);
  fixture.componentRef.setInput('daily', DAILY);
  fixture.componentRef.setInput('weekly', WEEKLY);
  const chosen: AppPmDashboardTrendPoint[] = [];
  fixture.componentInstance.pointChosen.subscribe((value) => chosen.push(value));
  TestBed.inject(ApplicationRef).tick();
  await fixture.whenStable();
  return { fixture, root: fixture.nativeElement as HTMLElement, chosen };
}

const text = (element: Element | null): string =>
  element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const tableRows = (root: HTMLElement): string[][] =>
  Array.from(root.querySelectorAll('tbody tr')).map((row) =>
    Array.from(row.querySelectorAll('td')).map(text),
  );

function toggle(root: HTMLElement, name: string): HTMLButtonElement {
  const found = Array.from(
    root.querySelectorAll<HTMLButtonElement>('mat-button-toggle button'),
  ).find((candidate) => text(candidate) === name);
  if (!found) {
    throw new Error(`no toggle «${name}»`);
  }
  return found;
}

describe('PmTrendChart', () => {
  it('offers «روزانه» and «هفتگی», weekly first chosen', async () => {
    const { root } = await render();

    expect(toggle(root, 'هفتگی').getAttribute('aria-checked')).toBe('true');
    expect(toggle(root, 'روزانه').getAttribute('aria-checked')).toBe('false');
  });

  it('states every point as text: its range, how many were due and both percentages', async () => {
    const { root } = await render();

    expect(tableRows(root).map((row) => row.slice(0, 4))).toEqual([
      ['۱۴۰۵/۰۷/۰۳ تا ۱۴۰۵/۰۷/۰۹', '۴', '۷۰٪', '۹۰٪'],
    ]);
  });

  it('switches to one point a day', async () => {
    const { fixture, root } = await render();

    toggle(root, 'روزانه').click();
    await fixture.whenStable();

    expect(tableRows(root).map((row) => row.slice(0, 4))).toEqual([
      ['۱۴۰۵/۰۷/۰۸', '۴', '۵۰٪', '۱۰۰٪'],
      ['۱۴۰۵/۰۷/۰۹', '۰', 'داده کافی وجود ندارد', 'داده کافی وجود ندارد'],
    ]);
  });

  it('draws one hit area per point, each with a tooltip of its figures', async () => {
    const { root } = await render();

    const hits = root.querySelectorAll('.trend-chart__hit');
    expect(hits).toHaveLength(1);
    expect(hits[0].getAttribute('aria-hidden')).toBeNull();
    expect(root.querySelector('.trend-chart__plot')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('chooses a point from its hit area and says what it holds', async () => {
    const { fixture, root, chosen } = await render();

    root.querySelector<HTMLButtonElement>('.trend-chart__hit')!.click();
    await fixture.whenStable();

    expect(chosen).toEqual([WEEKLY[0]]);
    expect(text(root.querySelector('.trend-chart__selection'))).toBe(
      '۱۴۰۵/۰۷/۰۳ تا ۱۴۰۵/۰۷/۰۹: پایبندی ۷۰٪، تکمیل ۹۰٪ از ۴ موعد',
    );
  });

  it('chooses a point from its row in the table', async () => {
    const { root, chosen } = await render();

    root
      .querySelector<HTMLButtonElement>(
        'button[aria-label="نمایش موعدهای ۱۴۰۵/۰۷/۰۳ تا ۱۴۰۵/۰۷/۰۹"]',
      )!
      .click();

    expect(chosen).toEqual([WEEKLY[0]]);
  });
});
