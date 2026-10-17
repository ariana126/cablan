import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { MatFormField, MatLabel, MatPrefix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';

/**
 * The search field that sits in a data sheet's bar (`[sheetSearch]`): compact, outlined, a search
 * icon at the start, no submit button — it filters as you type. It only supplies the text; the page
 * filters its rows with `matchesSearch` from `core/i18n/search-normalizer`, which folds case, digit
 * script and the Persian/Arabic letter forms, so «۱۲۳» finds «123» and «كابل» finds «کابل».
 */
@Component({
  selector: 'app-table-search',
  imports: [MatFormField, MatIcon, MatInput, MatLabel, MatPrefix],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-form-field class="table-search" appearance="outline" subscriptSizing="dynamic">
      <mat-label>{{ label() }}</mat-label>
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
        [value]="value()"
        (input)="value.set($any($event.target).value)"
      />
    </mat-form-field>
  `,
  styleUrl: './table-search.scss',
})
export class TableSearch {
  /** The visible label, which is also the field's accessible name. */
  readonly label = input.required<string>();
  readonly value = model('');
}
