import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { CurrentUserStore } from '../../core/identity/current-user-store';
import { Shortcut, ShortcutGroup, shortcutsFor } from '../../core/identity/navigation';
import { Icon, IconName } from '../../ui/icon/icon';
import { categoryIconFor, pageIconFor } from '../../ui/navigation-icon/navigation-icon';
import { PageHeader } from '../../ui/page-header/page-header';

/**
 * The landing page: the signed-in role's frequent tasks as direct shortcuts (issue #79), grouped
 * under the menu's top-level categories, in menu order.
 *
 * Everything comes from `shortcutsFor` in `navigation.ts` — the same table that decides what the
 * drawer offers and what the routes render — so a shortcut can never point at a page the role cannot
 * open. Every other page the role may reach stays in the drawer.
 *
 * **The markup is a contract** shared with the acceptance suite: one `<section>` per group, named
 * (`aria-labelledby`) by an `h2` holding exactly the category label, and inside it only the
 * shortcuts' links, each named exactly by its label — the icons are `aria-hidden`.
 */
@Component({
  selector: 'app-home-page',
  imports: [Icon, MatIcon, PageHeader, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page--home stack">
      <app-page-header [heading]="greeting()" description="کارهای پرتکرار شما، یک کلیک دورتر." />

      <div class="groups">
        @for (group of groups(); track group.id) {
          <section class="group" [attr.aria-labelledby]="headingId(group)">
            <header class="group__head">
              <span class="group__tile" aria-hidden="true">
                <mat-icon [appIcon]="groupIcon(group)" />
              </span>
              <h2 class="group__title" [id]="headingId(group)">{{ group.label }}</h2>
            </header>
            <ul class="shortcuts">
              @for (shortcut of group.shortcuts; track shortcut.label) {
                <li>
                  <a
                    class="shortcut"
                    [class.shortcut--creates]="shortcut.creates"
                    [routerLink]="'/' + shortcut.path"
                    [queryParams]="shortcut.queryParams"
                  >
                    <mat-icon
                      class="shortcut__icon"
                      aria-hidden="true"
                      [appIcon]="icon(shortcut)"
                    />
                    <span class="shortcut__label">{{ shortcut.label }}</span>
                    <!-- Forward is leftward in Persian; the document is RTL-only, so it is drawn so. -->
                    <svg
                      class="shortcut__chevron"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M15 6l-6 6 6 6" />
                    </svg>
                  </a>
                </li>
              }
            </ul>
          </section>
        }
      </div>
    </div>
  `,
  styleUrl: './home-page.scss',
})
export class HomePage {
  private readonly currentUser = inject(CurrentUserStore);

  protected readonly greeting = computed(() => {
    const name = this.currentUser.user()?.name;
    return name ? `خوش آمدید، ${name}` : 'خوش آمدید';
  });

  protected readonly groups = computed(() => shortcutsFor(this.currentUser.role()));

  protected headingId(group: ShortcutGroup): string {
    return `home-group-${group.id}`;
  }

  /** The same glyph the drawer shows for the category. */
  protected groupIcon(group: ShortcutGroup): IconName {
    return categoryIconFor(group.id);
  }

  /** A shortcut that starts a record reads as «add»; any other shows its page's drawer glyph. */
  protected icon(shortcut: Shortcut): IconName {
    return shortcut.creates ? 'add' : pageIconFor(shortcut.path);
  }
}
