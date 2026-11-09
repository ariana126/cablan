import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { MatCheckbox, MatCheckboxChange } from '@angular/material/checkbox';
import { MatDivider } from '@angular/material/divider';
import { MatFormField, MatLabel, MatPrefix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';

import { formatPersianNumber } from '../../core/i18n/persian-numerals';
import { matchesSearch } from '../../core/i18n/search-normalizer';
import { PersianNumberPipe } from '../persian-number/persian-number-pipe';

/** One row of the list: the value the caller keeps, and the words the visitor reads. */
export interface CheckboxFilterOption<V> {
  readonly value: V;
  readonly label: string;
  /** How many rows carry this value; shown after the label when given. */
  readonly count?: number;
}

/**
 * What the list holds: `undefined` while the field is **unrestricted** (nothing ticked, every value
 * counts), otherwise the values chosen. An empty set is a selection the visitor emptied on purpose
 * — it matches nothing, which the reports' «فیلتر بدون هیچ مقدار انتخاب شده» rule needs.
 */
export type CheckboxFilterSelection<V> = ReadonlySet<V> | undefined;

export const SEVERAL_MATCHES_MESSAGE = 'چند نتیجه یافت شد؛ مورد موردنظر را انتخاب کنید';

/**
 * The value list of a multi-select filter (issue #113): a search box, the chips of the current
 * selection («انتخاب‌های فعلی»), a group checkbox and one checkbox per option.
 *
 * - **An unrestricted field shows nothing ticked**; ticking a value starts a selection of exactly
 *   that value — never "everything but the ones unticked".
 * - **The search only decides which rows are shown.** Selections survive it, and every selected
 *   value — hidden by the search or not — is a removable chip.
 * - **The group checkbox names its scope** — «انتخاب همه», or «انتخاب همه N نتیجه جستجو» while
 *   searching — and acts on the visible matches only.
 * - **Enter in the search box**: one match is added and the search cleared for the next one;
 *   several are not guessed between (a polite live message says so); none changes nothing; an empty
 *   search emits `submitted`, so the host can apply.
 *
 * Matching is `matchesSearch`: case, digit scripts and Arabic/Persian letter variants alike.
 * Presentational and generic over the value type — the host decides what a selection means.
 */
@Component({
  selector: 'app-checkbox-filter-list',
  imports: [
    FormField,
    MatCheckbox,
    MatDivider,
    MatFormField,
    MatIcon,
    MatInput,
    MatLabel,
    MatPrefix,
    PersianNumberPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="checkbox-filter-list stack--tight">
      <div class="checkbox-filter-list__top stack--hair">
        <mat-form-field
          class="checkbox-filter-list__search"
          appearance="outline"
          subscriptSizing="dynamic"
        >
          <mat-label>{{ searchLabel() }}</mat-label>
          <mat-icon matIconPrefix>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="11" cy="11" r="6" />
              <path d="M20 20l-4.5-4.5" />
            </svg>
          </mat-icon>
          <input
            matInput
            type="search"
            autocomplete="off"
            [formField]="searchForm.query"
            (keydown.enter)="onEnter($event)"
            (input)="message.set('')"
          />
        </mat-form-field>

        <p class="checkbox-filter-list__summary">{{ summary() }}</p>
        <p class="checkbox-filter-list__message" aria-live="polite">{{ message() }}</p>
      </div>

      @if (chosenOptions().length > 0) {
        <div class="checkbox-filter-list__chosen" role="group" aria-label="انتخاب‌های فعلی">
          <span class="checkbox-filter-list__chosen-title" aria-hidden="true">انتخاب‌های فعلی</span>
          @for (option of chosenOptions(); track option.value) {
            <span class="checkbox-filter-list__chip">
              <span class="checkbox-filter-list__chip-text">{{ option.label }}</span>
              <button
                type="button"
                class="checkbox-filter-list__chip-remove"
                [attr.aria-label]="'حذف «' + option.label + '» از انتخاب‌ها'"
                (click)="remove(option.value)"
              >
                <mat-icon class="checkbox-filter-list__chip-remove-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </mat-icon>
              </button>
            </span>
          }
        </div>
      }

      @if (visibleOptions().length > 0) {
        <mat-checkbox
          [checked]="allVisibleSelected()"
          [indeterminate]="someVisibleSelected() && !allVisibleSelected()"
          (change)="onToggleAllVisible($event)"
        >
          {{ groupLabel() }}
        </mat-checkbox>

        <mat-divider />

        @for (option of visibleOptions(); track option.value) {
          <mat-checkbox
            [checked]="isSelected(option.value)"
            (change)="onToggle(option.value, $event)"
          >
            {{ option.label }}
            @if (option.count !== undefined) {
              <span class="checkbox-filter-list__count">{{ option.count | persianNumber }}</span>
            }
          </mat-checkbox>
        }
      } @else {
        <div class="checkbox-filter-list__empty" role="status">
          <span class="checkbox-filter-list__empty-tile">
            <mat-icon>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="11" cy="11" r="6" />
                <path d="M20 20l-4.5-4.5" />
              </svg>
            </mat-icon>
          </span>
          <p class="checkbox-filter-list__empty-text">موردی یافت نشد</p>
        </div>
      }
    </div>
  `,
  styleUrl: './checkbox-filter-list.scss',
})
export class CheckboxFilterList<V> {
  readonly options = input.required<readonly CheckboxFilterOption<V>[]>();
  readonly selected = model.required<CheckboxFilterSelection<V>>();
  /** The search box's accessible name — the name a person or assistive technology finds it by. */
  readonly searchLabel = input('جستجو در مقادیر');
  /** Enter in an empty search box: the visitor is done, the host may apply. */
  readonly submitted = output<void>();

  private readonly searchModel = signal({ query: '' });
  protected readonly searchForm = form(this.searchModel);

  protected readonly message = signal('');

  protected readonly searching = computed(() => this.searchModel().query.trim() !== '');

  protected readonly visibleOptions = computed(() => {
    const query = this.searchModel().query;
    return this.options().filter((option) => matchesSearch(option.label, query));
  });

  /** The selected options in the list's own order — the chips. */
  protected readonly chosenOptions = computed(() => {
    const selected = this.selected();
    return selected === undefined
      ? []
      : this.options().filter((option) => selected.has(option.value));
  });

  protected readonly groupLabel = computed(() =>
    this.searching()
      ? `انتخاب همه ${formatPersianNumber(this.visibleOptions().length)} نتیجه جستجو`
      : 'انتخاب همه',
  );

  /** The three states the dialog names: searching, a selection (empty or not), or none. */
  protected readonly summary = computed(() => {
    if (this.searching()) {
      return `${formatPersianNumber(this.visibleOptions().length)} نتیجه جستجو`;
    }
    const selected = this.selected();
    if (selected === undefined) {
      return 'بدون محدودیت — همه مقادیر';
    }
    return selected.size === 0
      ? 'هیچ مقداری انتخاب نشده — فهرست خالی می‌شود'
      : `${formatPersianNumber(selected.size)} مقدار انتخاب‌شده`;
  });

  protected readonly allVisibleSelected = computed(() => {
    const visible = this.visibleOptions();
    return visible.length > 0 && visible.every((option) => this.isSelected(option.value));
  });

  protected readonly someVisibleSelected = computed(() =>
    this.visibleOptions().some((option) => this.isSelected(option.value)),
  );

  protected isSelected(value: V): boolean {
    return this.selected()?.has(value) ?? false;
  }

  protected onToggleAllVisible(event: MatCheckboxChange): void {
    this.change(
      this.visibleOptions().map((option) => option.value),
      event.checked,
    );
  }

  protected onToggle(value: V, event: MatCheckboxChange): void {
    this.change([value], event.checked);
  }

  protected remove(value: V): void {
    this.change([value], false);
  }

  protected onEnter(event: Event): void {
    event.preventDefault();
    if (!this.searching()) {
      this.submitted.emit();
      return;
    }
    const matches = this.visibleOptions();
    if (matches.length === 1) {
      this.change([matches[0].value], true);
      this.searchModel.set({ query: '' });
      this.message.set('');
    } else if (matches.length > 1) {
      this.message.set(SEVERAL_MATCHES_MESSAGE);
    }
  }

  private change(values: readonly V[], add: boolean): void {
    const next = new Set(this.selected() ?? []);
    for (const value of values) {
      if (add) {
        next.add(value);
      } else {
        next.delete(value);
      }
    }
    this.selected.set(next);
  }
}
