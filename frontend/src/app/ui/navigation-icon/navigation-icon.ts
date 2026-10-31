import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

import { NavigationEntry } from '../../core/identity/navigation';
import { Icon, IconName } from '../icon/icon';

/** Categories by `id`. A new category in `navigation.ts` needs a line here. */
const CATEGORY_ICONS: Readonly<Record<string, IconName>> = {
  'quality-control': 'quality-control',
  reports: 'bar-chart',
  technical: 'wrench',
  'master-data': 'database',
  'system-administration': 'shield',
};

/** Pages by route `path`. A new page in `navigation.ts` needs a line here. */
const PAGE_ICONS: Readonly<Record<string, IconName>> = {
  boms: 'scale',
  'standard-boms': 'verified',
  'boms/dashboard': 'dashboard',
  'pm-plans': 'calendar-days',
  'pm-schedule/daily': 'checklist',
  'pm-schedule/overview': 'pie-chart',
  products: 'package',
  components: 'layers',
  materials: 'flask',
  equipment: 'cog',
  'maintenance-activities': 'hammer',
  'audit-log': 'activity',
  users: 'users',
};

/** What an entry the tables above do not know gets: a plain document. */
const FALLBACK: IconName = 'document';

/**
 * The icon for a navigation entry — a category or a page. One table, so the drawer and the home
 * page's cards always show the same glyph for the same place. `navigation-icon.spec.ts` fails when
 * an entry of `NAVIGATION` falls through to the fallback.
 */
export function navigationIconFor(entry: NavigationEntry): IconName {
  const icon = entry.kind === 'page' ? PAGE_ICONS[entry.path] : CATEGORY_ICONS[entry.id];
  return icon ?? FALLBACK;
}

/**
 * A navigation entry's line icon, shared by the drawer (as a list item's `matListItemIcon`) and the
 * home page's card tiles. Decoration: the label beside it carries the meaning.
 */
@Component({
  selector: 'app-navigation-icon',
  imports: [Icon, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'navigation-icon' },
  template: `<mat-icon [appIcon]="icon()" />`,
})
export class NavigationIcon {
  readonly entry = input.required<NavigationEntry>();

  protected readonly icon = computed(() => navigationIconFor(this.entry()));
}
