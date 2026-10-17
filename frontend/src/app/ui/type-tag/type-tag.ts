import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * A plain tag naming a record's type («محصول», «جز»). Deliberately not a status: no icon, a square
 * corner (`extra-small`, where a status badge is a pill), and a neutral tone, so a column of types
 * and a column of statuses never look alike.
 */
@Component({
  selector: 'app-type-tag',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="type-tag">{{ label() }}</span>`,
  styleUrl: './type-tag.scss',
})
export class TypeTag {
  readonly label = input.required<string>();
}
