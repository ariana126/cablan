import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { form } from '@angular/forms/signals';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { provideJalaliDateAdapter } from '../../core/material/jalali-date-adapter';
import { JalaliDatetimeField } from './jalali-datetime-field';

@Component({
  imports: [JalaliDatetimeField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-jalali-datetime-field
      [field]="testForm.at"
      [unparseable]="testForm.atUnparseable"
      dateLabel="از تاریخ ثبت"
      timeLabel="از ساعت"
      boundName="آغاز بازه"
    />
  `,
})
class HostComponent {
  readonly model = signal<{ at: Date | null; atUnparseable: boolean }>({
    at: null,
    atUnparseable: false,
  });
  readonly testForm = form(this.model);
}

/** The two inputs the component renders, in DOM order: the calendar's, then the clock's. */
const inputsOf = (fixture: ComponentFixture<HostComponent>): HTMLInputElement[] =>
  Array.from(fixture.nativeElement.querySelectorAll('input'));

const typeInto = async (
  fixture: ComponentFixture<HostComponent>,
  input: HTMLInputElement,
  text: string,
): Promise<void> => {
  input.value = text;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('blur'));
  await fixture.whenStable();
};

describe('JalaliDatetimeField', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideJalaliDateAdapter()],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
  });

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

  it('reads a Jalali date typed into the calendar field', async () => {
    const [dateInput] = inputsOf(fixture);

    await typeInto(fixture, dateInput, '1403/04/01');

    expect(fixture.componentInstance.model().at).toEqual(new Date(2024, 5, 21, 0, 0, 0, 0));
  });

  it('lets the clock move the time without disturbing the date the calendar set', async () => {
    const [dateInput, timeInput] = inputsOf(fixture);

    await typeInto(fixture, dateInput, '1403/04/01');
    await typeInto(fixture, timeInput, '08:30');

    expect(fixture.componentInstance.model().at).toEqual(new Date(2024, 5, 21, 8, 30, 0, 0));
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

  it('reports text it could not read as a date, rather than quietly clearing the bound', async () => {
    const [dateInput] = inputsOf(fixture);

    await typeInto(fixture, dateInput, 'not a date');

    // Material writes `null` for text it cannot parse and raises its error through NG_VALIDATORS,
    // which signal forms does not read — so without this flag the filter would apply with the bound
    // silently missing. See core/date/date-range-form.ts.
    expect(fixture.componentInstance.model().at).toBeNull();
    expect(fixture.componentInstance.model().atUnparseable).toBe(true);
  });

  it('withdraws that report once the text parses again', async () => {
    const [dateInput] = inputsOf(fixture);

    await typeInto(fixture, dateInput, 'not a date');
    await typeInto(fixture, dateInput, '1403/04/01');

    expect(fixture.componentInstance.model().atUnparseable).toBe(false);
  });

  it('treats an emptied field as no bound at all, not as unreadable text', async () => {
    const [dateInput] = inputsOf(fixture);

    await typeInto(fixture, dateInput, 'not a date');
    await typeInto(fixture, dateInput, '');

    expect(fixture.componentInstance.model().atUnparseable).toBe(false);
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
    // would match the input and a button both — the acceptance suite locates fields by label.
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
