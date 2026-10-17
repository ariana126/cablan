import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  viewChild,
} from '@angular/core';
import { MatCard, MatCardContent } from '@angular/material/card';
import { RouterLink } from '@angular/router';

import { CurrentUserStore } from '../../core/identity/current-user-store';
import { categoryTrail, navigationFor } from '../../core/identity/navigation';
import { CategoryIcon } from '../../ui/category-icon/category-icon';
import { PageHeader } from '../../ui/page-header/page-header';
import { TypeTag } from '../../ui/type-tag/type-tag';

/**
 * The landing page: the same tree the drawer shows, one level at a time.
 *
 * It starts at the top-level categories. Selecting a category shows what is inside it; selecting a
 * page opens it. It reads `navigation.ts` exactly as the drawer and the route guard do, so a role
 * that cannot open a page never sees a card for it — nor for a category with nothing it can open.
 *
 * **The level on show lives in the URL** (`/?category=reports`), not in component state, so every
 * step is a real link: the browser's back button walks back up, a level can be bookmarked, and
 * nothing here needs a click handler. An unknown or withheld id falls back to the top level, so the
 * two look identical.
 */
@Component({
  selector: 'app-home-page',
  imports: [CategoryIcon, MatCard, MatCardContent, PageHeader, RouterLink, TypeTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page--home stack">
      <app-page-header [heading]="greeting()" description="از کجا شروع می کنید؟" />

      @if (current(); as here) {
        <div class="stack--tight">
          <!-- The way back up: every level above this one, as a link to it. -->
          <nav class="trail" aria-label="مسیر">
            <ol>
              <li><a routerLink="/">همهٔ بخش ها</a></li>
              @for (crumb of ancestors(); track crumb.id) {
                <li>
                  <a routerLink="/" [queryParams]="{ category: crumb.id }">{{ crumb.label }}</a>
                </li>
              }
            </ol>
          </nav>
          <h2 #levelHeading tabindex="-1">{{ here.label }}</h2>
        </div>
      }

      <ul class="entries">
        @for (entry of entries(); track entry.label) {
          <li>
            <mat-card appearance="outlined" class="nav-card">
              <mat-card-content class="nav-card__content">
                <div class="nav-card__head">
                  <span class="nav-card__tile">
                    <app-category-icon [id]="entry.kind === 'category' ? entry.id : 'page'" />
                  </span>
                  <!-- The whole card is not the link: a card is not an interactive element, and
                       making one would mean inventing a focusable role Material does not ship. The
                       title's own anchor is the target, stretched over the card, and it carries the
                       accessible name. -->
                  @if (entry.kind === 'page') {
                    <a class="nav-card__link" [routerLink]="'/' + entry.path">{{ entry.label }}</a>
                  } @else {
                    <a
                      class="nav-card__link"
                      routerLink="/"
                      [queryParams]="{ category: entry.id }"
                      >{{ entry.label }}</a
                    >
                  }
                  <!-- Forward is leftward in Persian; the document is RTL-only, so it is drawn so. -->
                  <svg
                    class="nav-card__chevron"
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
                </div>
                @if (entry.kind === 'category') {
                  @if (entry.description; as purpose) {
                    <p class="nav-card__description">{{ purpose }}</p>
                  }
                  <!-- What is inside, as labels: the card is the one target, not each tag. -->
                  <div class="nav-card__foot">
                    @for (child of entry.children; track child.label) {
                      <app-type-tag [label]="child.label" />
                    }
                  </div>
                }
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
  private readonly injector = inject(Injector);

  /** The category on show, from `?category=`; absent at the top level. */
  readonly category = input<string>();

  private readonly header = viewChild.required(PageHeader);
  private readonly levelHeading = viewChild<ElementRef<HTMLElement>>('levelHeading');

  protected readonly greeting = computed(() => {
    const name = this.currentUser.user()?.name;
    return name ? `خوش آمدید، ${name}` : 'خوش آمدید';
  });

  private readonly tree = computed(() => navigationFor(this.currentUser.role()));

  private readonly trail = computed(() => {
    const id = this.category();
    return id ? categoryTrail(this.tree(), id) : [];
  });

  protected readonly current = computed(() => this.trail().at(-1));

  /** The categories above the one on show — the breadcrumb's links. */
  protected readonly ancestors = computed(() => this.trail().slice(0, -1));

  protected readonly entries = computed(() => this.current()?.children ?? this.tree());

  /** Compared by id, so a fresh tree with the same level on show is not a move. */
  private readonly currentId = computed(() => this.current()?.id ?? null);

  constructor() {
    // Swapping the cards in place gives a screen reader no sign anything happened — the URL changed
    // but the route did not, so the shell's title announcement stays silent. Landing focus on the
    // new level's heading is that sign. Never on arrival, though: that would steal focus from the
    // skip link and the drawer on every page load.
    let arrived = false;
    effect(() => {
      this.currentId();
      if (!arrived) {
        arrived = true;
        return;
      }
      afterNextRender(() => (this.levelHeading()?.nativeElement ?? this.header()).focus(), {
        injector: this.injector,
      });
    });
  }
}
