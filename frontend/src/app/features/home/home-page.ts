import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatCard, MatCardContent, MatCardTitle } from '@angular/material/card';
import { RouterLink } from '@angular/router';

import { CurrentUserStore } from '../../core/identity/current-user-store';
import { destinationsFor } from '../../core/identity/navigation';

/**
 * The landing page: every section this user may reach, as one card each.
 *
 * It reads the same `DESTINATIONS` table the drawer and the route guard read, so a role that
 * cannot open a page never sees a card for it either.
 */
@Component({
  selector: 'app-home-page',
  imports: [MatCard, MatCardContent, MatCardTitle, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack">
      <div class="stack--tight">
        <h1>{{ greeting() }}</h1>
        <p class="prose">از کجا شروع می کنید؟</p>
      </div>

      <ul class="sections">
        @for (section of sections(); track section.path) {
          <li>
            <mat-card appearance="outlined">
              <mat-card-content>
                <!-- The whole card is not the link: a card is not an interactive element, and
                     making one would mean inventing a focusable role Material does not ship. The
                     heading's own anchor is the target, and it carries the accessible name. -->
                <mat-card-title>
                  <a [routerLink]="'/' + section.path">{{ section.label }}</a>
                </mat-card-title>
              </mat-card-content>
            </mat-card>
          </li>
        }
      </ul>
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

  /** Home itself is dropped — a card pointing at the page you are on is noise. */
  protected readonly sections = computed(() =>
    destinationsFor(this.currentUser.role()).filter((destination) => destination.path !== ''),
  );
}
