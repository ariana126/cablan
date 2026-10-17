import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { MatCheckbox, MatCheckboxChange } from '@angular/material/checkbox';
import { MatDivider } from '@angular/material/divider';
import { MatFormField, MatLabel, MatPrefix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';

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
 * The Excel-style value list of a column filter: a search box, a "select all" and one checkbox per
 * option. Typing narrows the rows to those whose label contains the text (case-, digit- and
 * Persian/Arabic-letter-insensitive, see `normalizeForSearch`).
 *
 * **Selection survives the search.** `selected` is the whole truth and the search only decides which
 * rows are *shown*: values filtered out of view keep their state, and "select all" while a search is
 * active acts on the visible matches only, as Excel's does ("انتخاب همه نتایج جستجو").
 *
 * Presentational and generic over the value type — it owns no dialog, no Apply button and no
 * "nothing filtered" convention; the host decides what a selection means. Bind with
 * `[options]="…" [(selected)]="…"`.
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
        <input matInput type="search" autocomplete="off" [formField]="searchForm.query" />
      </mat-form-field>

      @if (visibleOptions().length > 0) {
        <mat-checkbox
          [checked]="allVisibleSelected()"
          [indeterminate]="someVisibleSelected() && !allVisibleSelected()"
          (change)="onToggleAllVisible($event)"
        >
          {{ searching() ? 'انتخاب همه نتایج جستجو' : 'انتخاب همه' }}
        </mat-checkbox>

        <mat-divider />

        @for (option of visibleOptions(); track option.value) {
          <mat-checkbox
            [checked]="selected().has(option.value)"
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
  readonly selected = model.required<ReadonlySet<V>>();
  /** The search box's accessible name — the locator the acceptance suite finds it by. */
  readonly searchLabel = input('جستجو در مقادیر');

  private readonly searchModel = signal({ query: '' });
  protected readonly searchForm = form(this.searchModel);

  protected readonly searching = computed(() => this.searchModel().query.trim() !== '');

  protected readonly visibleOptions = computed(() => {
    const query = this.searchModel().query;
    return this.options().filter((option) => matchesSearch(option.label, query));
  });

  protected readonly allVisibleSelected = computed(() => {
    const selected = this.selected();
    const visible = this.visibleOptions();
    return visible.length > 0 && visible.every((option) => selected.has(option.value));
  });

  protected readonly someVisibleSelected = computed(() => {
    const selected = this.selected();
    return this.visibleOptions().some((option) => selected.has(option.value));
  });

  protected onToggleAllVisible(event: MatCheckboxChange): void {
    const next = new Set(this.selected());
    for (const option of this.visibleOptions()) {
      if (event.checked) {
        next.add(option.value);
      } else {
        next.delete(option.value);
      }
    }
    this.selected.set(next);
  }

  protected onToggle(value: V, event: MatCheckboxChange): void {
    const next = new Set(this.selected());
    if (event.checked) {
      next.add(value);
    } else {
      next.delete(value);
    }
    this.selected.set(next);
  }
}
