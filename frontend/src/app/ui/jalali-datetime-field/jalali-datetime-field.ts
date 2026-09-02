import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  signal,
  untracked,
  viewChild,
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

/**
 * One Jalali date-and-time value, offered as a calendar, a clock and an «اکنون» shortcut rather
 * than as a bare text box for the operator to type `1403/04/01 08:30` into from memory.
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
 * Both labels are required and must be distinct on a page. The acceptance suite locates fields by
 * their visible `<label>` text and `make lint-accessibility` fails without one
 * (`../../../../CLAUDE.md`), so "از تاریخ" / "از ساعت" and "تا تاریخ" / "تا ساعت" are four
 * separately addressable controls rather than two ambiguous pairs.
 */
@Component({
  selector: 'app-jalali-datetime-field',
  imports: [
    FormField,
    MatButton,
    MatDatepicker,
    MatDatepickerInput,
    MatDatepickerToggle,
    MatError,
    MatFormField,
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
          #dateInput
          matInput
          [matDatepicker]="datepicker"
          [formField]="field()"
          autocomplete="off"
          (input)="captureTypedText()"
          (blur)="captureTypedText()"
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

      <mat-form-field appearance="outline" class="jalali-datetime-field__time">
        <mat-label>{{ timeLabel() }}</mat-label>
        <input
          #timeInput
          matInput
          [matTimepicker]="timepicker"
          [formField]="field()"
          autocomplete="off"
          (input)="captureTypedText()"
          (blur)="captureTypedText()"
        />
        <mat-timepicker-toggle matIconSuffix [for]="timepicker" [aria-label]="openClockLabel()" />
        <mat-timepicker #timepicker interval="15m" />
      </mat-form-field>

      <button
        matButton
        type="button"
        class="jalali-datetime-field__now"
        [attr.aria-label]="nowLabel()"
        (click)="setToNow()"
      >
        اکنون
      </button>
    </div>
  `,
  styleUrl: './jalali-datetime-field.scss',
})
export class JalaliDatetimeField {
  readonly field = input.required<FieldTree<Date | null>>();

  /**
   * Where this control reports that what was typed is not a date.
   *
   * It has to be a sibling field rather than an error raised here, because Material's own
   * `matDatepickerParse` error never reaches signal forms — see
   * `core/date/date-range-form.ts` for the full reasoning. The schema turns this flag back into the
   * `<mat-error>` rendered above and into the invalidity that stops `submit()`.
   */
  readonly unparseable = input.required<FieldTree<boolean>>();

  readonly dateLabel = input.required<string>();
  readonly timeLabel = input.required<string>();

  /**
   * What this bound is called in the accessible names of its three buttons — "آغاز بازه", say.
   *
   * It is a separate word from the two field labels on purpose. Naming the calendar toggle
   * `باز کردن تقویم ${dateLabel()}` would make its accessible name *contain* the date field's label,
   * and a locator asking for "از تاریخ ثبت" would then match the input and the button both. The
   * acceptance suite locates fields by their visible label (`../../../../CLAUDE.md`), so an
   * accessible name that is a superstring of a field's label is an ambiguous locator waiting to
   * happen.
   */
  readonly boundName = input.required<string>();

  private readonly dateInput = viewChild.required<ElementRef<HTMLInputElement>>('dateInput');
  private readonly timeInput = viewChild.required<ElementRef<HTMLInputElement>>('timeInput');

  private readonly typedText = signal('');

  protected readonly state = computed(() => this.field()());

  /** Both toggles and the shortcut sit beside a sibling pair carrying the same three controls, so
   * each accessible name says which bound it belongs to. Without that, a page offers two buttons
   * called "اکنون" and two called "باز کردن تقویم" — `MatDatepickerIntl`'s default name is the same
   * for every toggle in the app — which tells a screen-reader user nothing about which of the two
   * ends of the range they are on. */
  protected readonly openCalendarLabel = computed(() => `باز کردن تقویم ${this.boundName()}`);
  protected readonly openClockLabel = computed(() => `انتخاب ساعت ${this.boundName()}`);
  protected readonly nowLabel = computed(() => `اکنون برای ${this.boundName()}`);

  constructor() {
    // Text in either box with nothing in the model means Material refused to parse it. Deciding
    // this in an effect rather than in the `(input)` handler is deliberate: the handler runs
    // alongside Material's own listener on the same element, so the model may not have been written
    // yet when it fires, while an effect runs once everything has settled.
    effect(() => {
      const unparseable = this.typedText() !== '' && this.state().value() === null;
      const flag = this.unparseable()();

      untracked(() => {
        if (flag.value() !== unparseable) {
          flag.value.set(unparseable);
        }
      });
    });
  }

  protected captureTypedText(): void {
    this.typedText.set(
      `${this.dateInput().nativeElement.value.trim()}${this.timeInput().nativeElement.value.trim()}`,
    );
  }

  protected setToNow(): void {
    const state = this.state();
    state.value.set(new Date());
    state.markAsDirty();
    state.markAsTouched();
    this.captureTypedText();
  }
}
