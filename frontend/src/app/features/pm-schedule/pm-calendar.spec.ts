import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { JalaliMonth } from '../../core/date/jalali-month';
import { AppPmOccurrence } from '../../core/maintenance/pm-schedule-gateway';
import { PmCalendar } from './pm-calendar';

const ABAN_1405 = JalaliMonth.of(1405, 8);
/** 1405/08/10. */
const TODAY = new Date(2026, 10, 1, 10, 0);

const occurrence = (overrides: Partial<AppPmOccurrence> = {}): AppPmOccurrence => ({
  equipmentId: 'e1',
  equipmentName: 'اکسترودر 1',
  equipmentRetired: false,
  planItemId: 'p1',
  activityId: 'a1',
  activityName: 'تعویض روغن',
  dueDate: '2026-10-25',
  calendarDate: '2026-10-25',
  status: 'upcoming',
  performedAt: null,
  performedById: null,
  performedBy: null,
  daysLate: null,
  notes: null,
  ...overrides,
});

interface Inputs {
  occurrences?: AppPmOccurrence[];
  loading?: boolean;
  failure?: 'forbidden' | 'error' | null;
}

async function render({ occurrences = [], loading = false, failure = null }: Inputs = {}) {
  const fixture = TestBed.createComponent(PmCalendar);
  fixture.componentRef.setInput('month', ABAN_1405);
  fixture.componentRef.setInput('today', TODAY);
  fixture.componentRef.setInput('occurrences', occurrences);
  fixture.componentRef.setInput('loading', loading);
  fixture.componentRef.setInput('failure', failure);
  await fixture.whenStable();
  return { fixture, root: fixture.nativeElement as HTMLElement };
}

const text = (element: Element | null | undefined): string =>
  element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const buttonNamed = (scope: ParentNode, name: string): HTMLButtonElement => {
  const button = Array.from(scope.querySelectorAll<HTMLButtonElement>('button')).find(
    (candidate) => text(candidate) === name,
  );
  if (!button) {
    throw new Error(`no button «${name}»`);
  }
  return button;
};

const day = (root: HTMLElement, label: string) =>
  root.querySelector<HTMLElement>(`[role="group"][aria-label="${label}"]`)!;

const openDialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]');

describe('PmCalendar', () => {
  afterEach(() => {
    document.body.querySelectorAll('.cdk-overlay-container').forEach((overlay) => overlay.remove());
    vi.restoreAllMocks();
  });

  it('is one region named «تقویم PM», titled by the month it shows', async () => {
    const { root } = await render();

    const region = root.querySelector('section');
    expect(region?.getAttribute('aria-label')).toBe('تقویم PM');
    expect(region?.querySelectorAll('h2')).toHaveLength(1);
    expect(text(region?.querySelector('h2'))).toBe('آبان ۱۴۰۵');
  });

  it('labels every day of the month with its Jalali date, and no padding day', async () => {
    const { root } = await render();

    const labels = Array.from(root.querySelectorAll('[role="group"][aria-label]')).map((group) =>
      group.getAttribute('aria-label'),
    );
    expect(labels).toHaveLength(30);
    expect(labels[0]).toBe('۱۴۰۵/۰۸/۰۱');
    expect(labels[29]).toBe('۱۴۰۵/۰۸/۳۰');
    // Six days of مهر before 1405/08/01, a Friday; six of آذر after 1405/08/30, a Saturday.
    expect(root.querySelectorAll('.pm-calendar__day--outside')).toHaveLength(12);
    expect(
      Array.from(root.querySelectorAll('.pm-calendar__day--outside')).every(
        (cell) => !cell.hasAttribute('role') && !cell.hasAttribute('aria-label'),
      ),
    ).toBe(true);
  });

  it('starts its week on Saturday', async () => {
    const { root } = await render();

    expect(text(root.querySelector('.pm-calendar__weekday'))).toBe('شنبه');
  });

  it('marks today', async () => {
    const { root } = await render();

    expect(day(root, '۱۴۰۵/۰۸/۱۰').getAttribute('aria-current')).toBe('date');
    expect(root.querySelectorAll('[aria-current="date"]')).toHaveLength(1);
  });

  it('steps a month back and forth, and returns to today’s month', async () => {
    const { fixture, root } = await render();

    buttonNamed(root, 'ماه بعد').click();
    await fixture.whenStable();
    expect(fixture.componentInstance.month().equals(JalaliMonth.of(1405, 9))).toBe(true);
    expect(text(root.querySelector('h2'))).toBe('آذر ۱۴۰۵');

    buttonNamed(root, 'ماه قبل').click();
    buttonNamed(root, 'ماه قبل').click();
    await fixture.whenStable();
    expect(fixture.componentInstance.month().equals(JalaliMonth.of(1405, 7))).toBe(true);

    buttonNamed(root, 'امروز').click();
    await fixture.whenStable();
    expect(fixture.componentInstance.month().equals(ABAN_1405)).toBe(true);
  });

  it('shows an occurrence on its calendar day as equipment · activity and its status word', async () => {
    const { root } = await render({
      occurrences: [
        occurrence({ calendarDate: '2026-10-27', dueDate: '2026-10-25', status: 'late' }),
      ],
    });

    const chips = day(root, '۱۴۰۵/۰۸/۰۵').querySelectorAll('button');
    expect(Array.from(chips).map(text)).toEqual(['اکسترودر 1 · تعویض روغن با تاخیر']);
    expect(chips[0].classList).toContain('pm-chip--late');
    expect(day(root, '۱۴۰۵/۰۸/۰۳').querySelectorAll('button')).toHaveLength(0);
  });

  it('shows three of a busy day’s occurrences, then how many more', async () => {
    const busy = Array.from({ length: 5 }, (_, index) =>
      occurrence({ planItemId: `p${index}`, activityName: `فعالیت ${index}` }),
    );
    const { root } = await render({ occurrences: busy });

    const buttons = Array.from(day(root, '۱۴۰۵/۰۸/۰۳').querySelectorAll('button')).map(text);
    expect(buttons).toEqual([
      'اکسترودر 1 · فعالیت 0 آینده',
      'اکسترودر 1 · فعالیت 1 آینده',
      'اکسترودر 1 · فعالیت 2 آینده',
      '+۲ مورد دیگر',
    ]);
  });

  it('opens an occurrence’s details from its chip', async () => {
    const { fixture, root } = await render({
      occurrences: [occurrence({ notes: 'فیلتر هم تعویض شد' })],
    });

    day(root, '۱۴۰۵/۰۸/۰۳').querySelector('button')!.click();
    await fixture.whenStable();

    const dialog = openDialog();
    expect(dialog?.querySelectorAll('dl dt')).toHaveLength(8);
    expect(text(dialog)).toContain('فیلتر هم تعویض شد');
  });

  it('lists a busy day in full in a dialog, each entry opening its details in its place', async () => {
    const busy = Array.from({ length: 4 }, (_, index) =>
      occurrence({ planItemId: `p${index}`, activityName: `فعالیت ${index}` }),
    );
    const { fixture, root } = await render({ occurrences: busy });

    buttonNamed(day(root, '۱۴۰۵/۰۸/۰۳'), '+۱ مورد دیگر').click();
    await fixture.whenStable();

    const list = openDialog()!;
    expect(Array.from(list.querySelectorAll('li button')).map(text)).toEqual([
      'اکسترودر 1 · فعالیت 0 آینده',
      'اکسترودر 1 · فعالیت 1 آینده',
      'اکسترودر 1 · فعالیت 2 آینده',
      'اکسترودر 1 · فعالیت 3 آینده',
    ]);

    list.querySelectorAll<HTMLButtonElement>('li button')[3].click();
    // The list closes (after its exit animation) before the details open.
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(document.body.querySelector('[role="dialog"] dl')).not.toBeNull();
    });

    const dialogs = document.body.querySelectorAll('[role="dialog"]');
    expect(dialogs).toHaveLength(1);
    expect(text(dialogs[0].querySelector('dl'))).toContain('فعالیت 3');
  });

  it('says so when the month holds nothing, once loaded', async () => {
    expect(text((await render({ loading: true })).root)).not.toContain('یافت نشد');
    expect(text((await render()).root)).toContain('هیچ موعدی در این ماه یافت نشد.');
  });

  it('shows a progress bar while the month loads', async () => {
    const { root } = await render({ loading: true });

    expect(root.querySelector('[role="progressbar"]')).not.toBeNull();
  });

  it('offers a retry when the month fails to load', async () => {
    const { fixture, root } = await render({ failure: 'error' });
    const retry = vi.fn();
    fixture.componentInstance.retry.subscribe(retry);

    expect(text(root)).toContain('برنامه PM بارگذاری نشد.');
    buttonNamed(root, 'تلاش دوباره').click();
    expect(retry).toHaveBeenCalled();
  });
});
