import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  afterNextRender,
  computed,
  inject,
  input,
  viewChildren,
} from '@angular/core';
import { FieldTree, FormField } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import {
  MatDatepicker,
  MatDatepickerInput,
  MatDatepickerToggle,
} from '@angular/material/datepicker';
import { MatError, MatFormField, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import {
  MatTimepicker,
  MatTimepickerInput,
  MatTimepickerToggle,
} from '@angular/material/timepicker';
import { MatIcon } from '@angular/material/icon';

import { Icon } from '../icon/icon';

/**
 * One Jalali date-and-time value, set only through a calendar, a clock and an «اکنون» shortcut —
 * never typed. Both inputs are `readonly` (issue #52): an operator picks `1403/04/01 08:30` rather
 * than recalling its format, and a value that can only be picked can never be unreadable, so
 * nothing downstream has to cope with text that failed to parse.
 *
 * `readonly`, not `disabled`: the field stays focusable, labelled, announced and submitted like any
 * other, and looks like one. Without typing, the inputs themselves become the pickers' triggers — a
 * click on either opens its panel (the timepicker does that on its own; the datepicker is told to
 * here), ↓ or Alt+↓ opens it from the keyboard, and Delete or Backspace clears the bound, since there
 * is no text left to erase. Opening on *focus* is deliberately not done: the datepicker returns focus
 * to its input when it closes, which would reopen it at once, and tabbing through a filter bar would
 * pop a panel over every field it crossed.
 *
 * **Why two `mat-form-field`s and not one.** `input[matDatepicker]` and `input[matTimepicker]` each
 * provide `NG_VALUE_ACCESSOR`, so they cannot share a single `<input>` — the second one silently
 * loses. Material's own `timepicker-datepicker-integration` example is two fields bound to one
 * value, and that is what this component packages: the datepicker writes the whole date (at
 * midnight, since `MatMonthView` builds its selection with `createDate(y, m, d)`), and the
 * timepicker's `_assignUserSelection` calls `setTime` on whatever date is already there, so it only
 * ever moves the time portion. Bound to the same `FieldTree`, the two compose into one instant.
 *
 * The calendar is Jalali because of the app-wide `DateAdapter` in `app.config.ts`, not because of
 * anything here; this component would render a Gregorian calendar unchanged if that provider went
 * away.
 *
 * Both labels (the one label, with `[withTime]="false"`) are required and must be distinct on a
 * page. Fields are found by
 * their visible `<label>` text and `make lint-accessibility` fails without one
 * (`../../../../CLAUDE.md`), so "از تاریخ" / "از ساعت" and "تا تاریخ" / "تا ساعت" are four
 * separately addressable controls rather than two ambiguous pairs.
 */
@Component({
  selector: 'app-jalali-datetime-field',
  imports: [
    FormField,
    Icon,
    MatButton,
    MatDatepicker,
    MatDatepickerInput,
    MatDatepickerToggle,
    MatError,
    MatFormField,
    MatIcon,
    MatInput,
    MatLabel,
    MatSuffix,
    MatTimepicker,
    MatTimepickerInput,
    MatTimepickerToggle,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="jalali-datetime-field">
      <mat-form-field appearance="outline" class="jalali-datetime-field__date">
        <mat-label>{{ dateLabel() }}</mat-label>
        <input
          matInput
          class="jalali-datetime-field__date-input"
          [matDatepicker]="datepicker"
          [formField]="field()"
          autocomplete="off"
          (click)="datepicker.open()"
          (keydown)="onDateKeydown($event, datepicker)"
        />
        <mat-datepicker-toggle
          matIconSuffix
          [for]="datepicker"
          [aria-label]="openCalendarLabel()"
        />
        <mat-datepicker #datepicker />
        @if (state().touched() && state().errors().length) {
          <mat-error>{{ state().errors()[0].message }}</mat-error>
        }
      </mat-form-field>

      @if (withTime()) {
        <mat-form-field appearance="outline" class="jalali-datetime-field__time">
          <mat-label>{{ timeLabel() }}</mat-label>
          <input
            matInput
            [matTimepicker]="timepicker"
            [formField]="field()"
            autocomplete="off"
            (keydown)="onTimeKeydown($event)"
          />
          <mat-timepicker-toggle matIconSuffix [for]="timepicker" [aria-label]="openClockLabel()" />
          <mat-timepicker #timepicker interval="15m" />
        </mat-form-field>

        <button
          matButton
          type="button"
          class="button--small jalali-datetime-field__now"
          [attr.aria-label]="nowLabel()"
          (click)="setToNow()"
        >
          <mat-icon appIcon="clock" />
          اکنون
        </button>
      }
    </div>
  `,
  styleUrl: './jalali-datetime-field.scss',
})
export class JalaliDatetimeField {
  readonly field = input.required<FieldTree<Date | null>>();

  readonly dateLabel = input.required<string>();
  /** Required whenever `withTime` is on — the clock must have a label of its own. */
  readonly timeLabel = input('');

  /**
   * `false` makes it a calendar day alone — a PM plan's due date — with no clock and no «اکنون»
   * (whose "now" is an instant, not a day). The value is still a `Date`, at the picked day's local
   * midnight.
   */
  readonly withTime = input(true);

  /**
   * What this bound is called in the accessible names of its three buttons — "آغاز بازه", say.
   *
   * It is a separate word from the two field labels on purpose. Naming the calendar toggle
   * `باز کردن تقویم ${dateLabel()}` would make its accessible name *contain* the date field's label,
   * and a locator asking for "از تاریخ ثبت" would then match the input and the button both. The
   * fields are found by their visible label, so an accessible name that is a superstring of a
   * field's label makes the lookup ambiguous.
   */
  readonly boundName = input.required<string>();

  protected readonly state = computed(() => this.field()());

  private readonly inputs = viewChildren(MatInput);

  /** Both toggles and the shortcut sit beside a sibling pair carrying the same three controls, so
   * each accessible name says which bound it belongs to. Without that, a page offers two buttons
   * called "اکنون" and two called "باز کردن تقویم" — `MatDatepickerIntl`'s default name is the same
   * for every toggle in the app — which tells a screen-reader user nothing about which of the two
   * ends of the range they are on. */
  protected readonly openCalendarLabel = computed(() => `باز کردن تقویم ${this.boundName()}`);
  protected readonly openClockLabel = computed(() => `انتخاب ساعت ${this.boundName()}`);
  protected readonly nowLabel = computed(() => `اکنون برای ${this.boundName()}`);

  constructor() {
    const changeDetector = inject(ChangeDetectorRef);

    // `readonly` cannot be written in the template: `[formField]` claims the attribute (NG8022) and
    // on its first pass pushes the field's own `readonly()` state — `false` — into MatInput's
    // `readonly` input. Making the *field* readonly instead is not an option, because signal forms
    // then skips its validation and stops tracking touched/dirty, losing the range-order error.
    // Signal forms only writes that input again when the field's readonly state changes, which
    // nothing here does, so setting it once after the first render makes it stick.
    afterNextRender(() => {
      for (const matInput of this.inputs()) {
        matInput.readonly = true;
      }
      changeDetector.markForCheck();
    });
  }

  /** ↓ / Alt+↓ open the calendar — Material's own Alt+↓ is skipped on a `readonly` input, and the
   * timepicker already opens on ↓, so the two halves answer the same key. Enter is left alone so it
   * still submits the filter form. */
  protected onDateKeydown(event: KeyboardEvent, datepicker: MatDatepicker<Date>): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      datepicker.open();
      return;
    }
    this.clearOnErase(event);
  }

  protected onTimeKeydown(event: KeyboardEvent): void {
    this.clearOnErase(event);
  }

  protected setToNow(): void {
    this.assign(new Date());
  }

  private clearOnErase(event: KeyboardEvent): void {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      this.assign(null);
    }
  }

  private assign(value: Date | null): void {
    const state = this.state();
    state.value.set(value);
    state.markAsDirty();
    state.markAsTouched();
  }
}
