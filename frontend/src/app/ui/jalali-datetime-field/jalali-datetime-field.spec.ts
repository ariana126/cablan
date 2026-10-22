import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { form } from '@angular/forms/signals';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatDatepickerToggleHarness } from '@angular/material/datepicker/testing';
import {
  MatTimepickerHarness,
  MatTimepickerToggleHarness,
} from '@angular/material/timepicker/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { provideJalaliDateAdapter } from '../../core/material/jalali-date-adapter';
import { JalaliDatetimeField } from './jalali-datetime-field';

@Component({
  imports: [JalaliDatetimeField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-jalali-datetime-field
      [field]="testForm.at"
      dateLabel="از تاریخ ثبت"
      timeLabel="از ساعت"
      boundName="آغاز بازه"
    />
  `,
})
class HostComponent {
  readonly model = signal<{ at: Date | null }>({ at: null });
  readonly testForm = form(this.model);
}

/** The two inputs the component renders, in DOM order: the calendar's, then the clock's. */
const inputsOf = (fixture: ComponentFixture<HostComponent>): HTMLInputElement[] =>
  Array.from(fixture.nativeElement.querySelectorAll('input'));

const todayAt = (hours: number, minutes: number): Date => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes, 0, 0);
};

const press = async (
  fixture: ComponentFixture<HostComponent>,
  input: HTMLInputElement,
  key: string,
): Promise<void> => {
  input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  await fixture.whenStable();
};

describe('JalaliDatetimeField', () => {
  let fixture: ComponentFixture<HostComponent>;
  let loader: HarnessLoader;

  // jsdom lays nothing out, so it has no `scrollIntoView` — and the clock's panel scrolls its selected
  // slot into view as it opens.
  const originalScrollIntoView = Element.prototype.scrollIntoView;

  afterEach(() => {
    Element.prototype.scrollIntoView = originalScrollIntoView;
  });

  beforeEach(async () => {
    Element.prototype.scrollIntoView = vi.fn();

    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideJalaliDateAdapter()],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    loader = TestbedHarnessEnvironment.documentRootLoader(fixture);
    await fixture.whenStable();
  });

  /** Picks today's cell in the calendar the toggle opens — today, because that is the month the
   * calendar opens on, so no navigation is needed. */
  const pickTodayFromCalendar = async (): Promise<void> => {
    const toggle = await loader.getHarness(MatDatepickerToggleHarness);
    await toggle.openCalendar();
    const calendar = await toggle.getCalendar();
    await calendar!.selectCell({ today: true });
    await fixture.whenStable();
  };

  const isCalendarOpen = async (): Promise<boolean> =>
    (await loader.getHarness(MatDatepickerToggleHarness)).isCalendarOpen();

  it('labels the calendar and the clock separately, so each is addressable by its own label', () => {
    const labels = Array.from(fixture.nativeElement.querySelectorAll('mat-label')).map((label) =>
      (label as HTMLElement).textContent?.trim(),
    );

    expect(labels).toEqual(['از تاریخ ثبت', 'از ساعت']);
  });

  it('offers a calendar toggle and a clock toggle, not a bare text box', () => {
    expect(fixture.nativeElement.querySelector('mat-datepicker-toggle')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('mat-timepicker-toggle')).not.toBeNull();
  });

  it('takes no typing: the date and the time input are both read-only', () => {
    const [dateInput, timeInput] = inputsOf(fixture);

    expect(dateInput.readOnly).toBe(true);
    expect(timeInput.readOnly).toBe(true);
  });

  it('stays an enabled field — read-only, not disabled', () => {
    const [dateInput, timeInput] = inputsOf(fixture);

    expect(dateInput.disabled).toBe(false);
    expect(timeInput.disabled).toBe(false);
  });

  it('sets the date picked from the calendar, at midnight', async () => {
    await pickTodayFromCalendar();

    expect(fixture.componentInstance.model().at).toEqual(todayAt(0, 0));
  });

  it('opens the calendar when the date input itself is clicked', async () => {
    const [dateInput] = inputsOf(fixture);

    dateInput.click();
    await fixture.whenStable();

    expect(await isCalendarOpen()).toBe(true);
  });

  it('opens the calendar from the keyboard on the date input, as the clock does on its own', async () => {
    const [dateInput] = inputsOf(fixture);

    await press(fixture, dateInput, 'ArrowDown');

    expect(await isCalendarOpen()).toBe(true);
  });

  it('opens the clock when the time input itself is clicked', async () => {
    const [, timeInput] = inputsOf(fixture);

    timeInput.click();
    await fixture.whenStable();

    const toggle = await loader.getHarness(MatTimepickerToggleHarness);
    expect(await toggle.isTimepickerOpen()).toBe(true);
  });

  it('lets the clock move the time without disturbing the date the calendar set', async () => {
    await pickTodayFromCalendar();

    const toggle = await loader.getHarness(MatTimepickerToggleHarness);
    await toggle.openTimepicker();
    const timepicker = await loader.getHarness(MatTimepickerHarness);
    const options = await timepicker.getOptions();
    // The clock offers a slot every 15 minutes from midnight, so the 35th is 08:30.
    await options[34].click();
    await fixture.whenStable();

    expect(fixture.componentInstance.model().at).toEqual(todayAt(8, 30));
  });

  it('clears the bound on Delete or Backspace — with no typing, that is the way back to none', async () => {
    const [dateInput, timeInput] = inputsOf(fixture);

    await pickTodayFromCalendar();
    await press(fixture, dateInput, 'Delete');
    expect(fixture.componentInstance.model().at).toBeNull();

    await pickTodayFromCalendar();
    await press(fixture, timeInput, 'Backspace');
    expect(fixture.componentInstance.model().at).toBeNull();
  });

  it('stamps the current instant when «اکنون» is pressed', async () => {
    const before = Date.now();

    const now: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.jalali-datetime-field__now',
    );
    now.click();
    await fixture.whenStable();

    const stamped = fixture.componentInstance.model().at;
    expect(stamped).toBeInstanceOf(Date);
    expect(stamped!.getTime()).toBeGreaterThanOrEqual(before);
    expect(stamped!.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('names each control after its bound, without repeating a field label', () => {
    const now: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.jalali-datetime-field__now',
    );
    const calendarToggle: HTMLElement = fixture.nativeElement.querySelector(
      'mat-datepicker-toggle button',
    );
    const clockToggle: HTMLElement = fixture.nativeElement.querySelector(
      'mat-timepicker-toggle button',
    );

    // None of the three may contain a field's own label, or a locator asking for that label by text
    // would match the input and a button both — fields are found by label.
    for (const control of [now, calendarToggle, clockToggle]) {
      expect(control.getAttribute('aria-label')).not.toContain('از تاریخ ثبت');
      expect(control.getAttribute('aria-label')).not.toContain('از ساعت');
    }

    expect(calendarToggle.getAttribute('aria-label')).toBe('باز کردن تقویم آغاز بازه');
    expect(clockToggle.getAttribute('aria-label')).toBe('انتخاب ساعت آغاز بازه');
  });

  it('names the «اکنون» shortcut after the bound it fills, so a range’s two are distinguishable', () => {
    const now: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.jalali-datetime-field__now',
    );

    expect(now.getAttribute('aria-label')).toBe('اکنون برای آغاز بازه');
  });
});
