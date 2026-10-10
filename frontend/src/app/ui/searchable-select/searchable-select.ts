import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FieldTree } from '@angular/forms/signals';
import {
  MatAutocomplete,
  MatAutocompleteSelectedEvent,
  MatAutocompleteTrigger,
} from '@angular/material/autocomplete';
import { MatOption } from '@angular/material/core';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';

import { matchesSearch } from '../../core/i18n/search-normalizer';

/**
 * One pickable row: the value the form keeps, and the words the visitor reads and searches.
 * `hint` is a secondary identifier (a material's code, say) — shown beside the label in the list
 * and searched along with it, so the visitor can see why a row matched, but never written into the
 * box: once picked, the box shows the label alone.
 */
export interface SearchableSelectOption {
  readonly value: string;
  readonly label: string;
  readonly hint?: string;
}

/**
 * A single-value picker over a list of related resources that the visitor can search — a
 * `mat-select` that scales past a handful of rows. Built on `mat-autocomplete`, the Material
 * component for a typeahead (a `mat-select` has no search box of its own).
 *
 * **What the form holds is the option's `value`, never the typed text.** Typing only narrows the
 * list (case-, digit- and Persian/Arabic-letter-insensitive, see `normalizeForSearch`); the bound
 * `field` changes only when an option is picked, so half-typed text is never mistaken for a
 * selection and a `required()` rule still means "pick one". Leaving the box with text that matches
 * nothing puts the previous selection's label back; emptying the box and leaving clears it.
 *
 * An option's optional `hint` is matched too, so a row can be found by a secondary identifier.
 *
 * Bind it like any signal-forms field: `<app-searchable-select [field]="form.productId" label="…"
 * [options]="…" />`. It renders its own `mat-form-field`, `mat-label` and the field's first error
 * once the field is touched, so the acceptance suite finds it by its label text like any input.
 * `selected` fires after the field is written, for hosts that derive other state from the choice.
 */
@Component({
  selector: 'app-searchable-select',
  imports: [
    MatAutocomplete,
    MatAutocompleteTrigger,
    MatError,
    MatFormField,
    MatInput,
    MatLabel,
    MatOption,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-form-field appearance="outline">
      <mat-label>{{ label() }}</mat-label>
      <input
        #textInput
        matInput
        type="text"
        autocomplete="off"
        [placeholder]="placeholder()"
        [matAutocomplete]="auto"
        [value]="text()"
        (input)="onInput($event)"
        (blur)="onBlur()"
      />
      <mat-autocomplete
        #auto="matAutocomplete"
        [displayWith]="displayWith"
        (optionSelected)="onSelected($event)"
        (closed)="settle()"
      >
        @for (option of visibleOptions(); track option.value) {
          <mat-option [value]="option.value">
            {{ option.label }}
            @if (option.hint) {
              <bdi class="option-hint">{{ option.hint }}</bdi>
            }
          </mat-option>
        } @empty {
          <mat-option disabled>موردی یافت نشد</mat-option>
        }
      </mat-autocomplete>
      @if (state().touched() && state().errors().length) {
        <mat-error>{{ state().errors()[0].message }}</mat-error>
      }
    </mat-form-field>
  `,
  styleUrl: './searchable-select.scss',
})
export class SearchableSelect {
  readonly field = input.required<FieldTree<string>>();
  readonly label = input.required<string>();
  readonly options = input.required<readonly SearchableSelectOption[]>();
  readonly placeholder = input('جستجو و انتخاب');

  /** The newly chosen value, `''` when the selection was cleared. */
  readonly selected = output<string>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly textInput = viewChild.required<ElementRef<HTMLInputElement>>('textInput');
  private readonly trigger = viewChild.required(MatAutocompleteTrigger);

  protected readonly state = computed(() => this.field()());

  /** What the box shows: the selection's label, or whatever the visitor is typing. */
  protected readonly text = signal('');
  /** What narrows the list — empty until the visitor types, so reopening shows every option. */
  private readonly filter = signal('');

  private readonly selectedLabel = computed(() => this.labelOf(this.state().value()));

  protected readonly visibleOptions = computed(() => {
    const query = this.filter();
    return this.options().filter(
      (option) =>
        matchesSearch(option.label, query) ||
        (option.hint !== undefined && matchesSearch(option.hint, query)),
    );
  });

  private readonly matInput = viewChild.required(MatInput);

  protected readonly displayWith = (value: string | null): string => this.labelOf(value ?? '');

  constructor() {
    // The text box has no `NgControl`, so Material would never flag it invalid on its own; this
    // hands it the field's verdict, which is what turns the outline red and reveals `mat-error`.
    effect(() => {
      const invalid = this.state().touched() && this.state().errors().length > 0;
      const control = this.matInput();
      untracked(() => {
        if (control.errorState !== invalid) {
          control.errorState = invalid;
          control.stateChanges.next();
        }
      });
    });

    // Initial value (edit mode), a later programmatic write, or options arriving after the value.
    effect(() => {
      const label = this.selectedLabel();
      untracked(() => {
        this.text.set(label);
        this.filter.set('');
      });
    });
  }

  /** Moves focus into the text box — the picker's own public API, as `MatSelect.focus()` was. */
  focus(): void {
    this.textInput().nativeElement.focus();
  }

  protected onInput(event: Event): void {
    const typed = (event.target as HTMLInputElement).value;
    this.text.set(typed);
    this.filter.set(typed);
  }

  protected onSelected(event: MatAutocompleteSelectedEvent): void {
    this.commit(event.option.value as string);
  }

  protected onBlur(): void {
    if (!this.host.nativeElement.isConnected) {
      return;
    }
    this.state().markAsTouched();
    // A blur caused by clicking an option arrives with the panel still open; `closed` settles then.
    if (!this.trigger().panelOpen) {
      this.settle();
    }
  }

  /** The box stops being edited: an emptied box clears the choice, anything else snaps back. */
  protected settle(): void {
    // Removing a row detaches its DOM and then tears the autocomplete down, which closes its panel;
    // by then the row's field no longer exists in the form and reading it would throw.
    if (!this.host.nativeElement.isConnected) {
      return;
    }
    if (this.text().trim() === '' && this.state().value() !== '') {
      this.commit('');
      return;
    }
    this.text.set(this.selectedLabel());
    this.filter.set('');
  }

  private commit(value: string): void {
    const state = this.state();
    state.value.set(value);
    state.markAsDirty();
    state.markAsTouched();
    this.text.set(this.labelOf(value));
    this.filter.set('');
    this.selected.emit(value);
  }

  private labelOf(value: string): string {
    if (value === '') {
      return '';
    }
    return this.options().find((option) => option.value === value)?.label ?? value;
  }
}
