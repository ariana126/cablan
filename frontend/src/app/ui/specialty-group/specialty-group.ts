import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

import { ActivitySpecialty, specialtyLabel } from '../../core/i18n/specialty-labels';
import { Icon, IconName } from '../icon/icon';

let nextGroupId = 0;

/**
 * One specialty's share of a PM list (issue #108) — «برق», «مکانیک», or «تخصص تعیین نشده» for an
 * activity registered before specialties existed — around the content projected into it (a table).
 *
 * A `<section>` named by its own heading, which holds exactly the specialty's word (the icon is
 * `aria-hidden`), so a screen reader can jump between groups and the acceptance suite can find one
 * by name. `level` is the heading's rank where the group is nested: 3 directly under a data sheet's
 * `h2`, 4 under an equipment's `h3`.
 */
@Component({
  selector: 'app-specialty-group',
  imports: [Icon, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="specialty-group" [attr.aria-labelledby]="headingId">
      <div class="specialty-group__head">
        <mat-icon class="specialty-group__icon" [appIcon]="icon()" />
        @if (level() === 4) {
          <h4 class="specialty-group__title" [id]="headingId">{{ label() }}</h4>
        } @else {
          <h3 class="specialty-group__title" [id]="headingId">{{ label() }}</h3>
        }
      </div>
      <ng-content />
    </section>
  `,
  styleUrl: './specialty-group.scss',
})
export class SpecialtyGroup {
  /** `null` for activities that have none yet. */
  readonly specialty = input.required<ActivitySpecialty | null>();
  readonly level = input<3 | 4>(3);

  protected readonly headingId = `specialty-group-heading-${nextGroupId++}`;
  protected readonly label = computed(() => specialtyLabel(this.specialty()));
  protected readonly icon = computed<IconName>(() => {
    switch (this.specialty()) {
      case 'electrical':
        return 'bolt';
      case 'mechanical':
        return 'cog';
      default:
        return 'block';
    }
  });
}
