import { BreakpointObserver } from '@angular/cdk/layout';
import { CdkAccordionItem } from '@angular/cdk/accordion';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatListItem, MatListItemMeta, MatNavList } from '@angular/material/list';
import { MatSidenav, MatSidenavContainer, MatSidenavContent } from '@angular/material/sidenav';
import { MatToolbar } from '@angular/material/toolbar';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map } from 'rxjs';

import { AuthGateway } from '../../core/identity/auth-gateway';
import { CurrentUserStore } from '../../core/identity/current-user-store';
import {
  containsPath,
  NavigationCategory,
  NavigationEntry,
  navigationFor,
} from '../../core/identity/navigation';
import { SessionStore } from '../../core/identity/session-store';

/** Below this the drawer floats over the page instead of holding a column of its own. */
const WIDE = '(min-width: 60rem)';

/**
 * The app bar and navigation drawer wrapped around every page.
 *
 * The drawer renders `navigation.ts`'s tree: three categories, one nested inside another, and eight
 * pages under them. That depth is why this is a drawer rather than a bar or a rail — neither has
 * room for a second level, and Material Design caps a bar at about five destinations anyway.
 * `mat-sidenav` and `mat-nav-list` are what the design system points at for the job.
 *
 * **Each category is a disclosure, not a tree item.** The button carries `aria-expanded` and
 * `aria-controls`, and the CDK's `cdkAccordionItem` holds the open/closed state — the same
 * building block `mat-expansion-panel` is made of, without the panel chrome that would turn a menu
 * into a stack of cards. `mat-tree` was the other candidate and is the wrong one here: its nodes
 * are focusable `treeitem`s, and a link inside one is a nested interactive control axe rejects. The
 * WAI-ARIA disclosure-navigation pattern is the one built for a menu of links.
 *
 * The categories holding the current page open themselves, so the visitor lands with "you are
 * here" in view. Home is not in the tree; the brand in the toolbar links there.
 *
 * The chrome renders only for a signed-in visitor. `/login` and the not-found page go through this
 * component too, and a drawer there would offer a menu of pages that would only bounce them back.
 *
 * Direction is not configured here. The document is `dir="rtl"`, Material reads that through the
 * CDK's `Directionality`, and the drawer anchors itself accordingly — setting `position` per
 * component would fight it.
 */
@Component({
  selector: 'app-shell',
  imports: [
    CdkAccordionItem,
    MatButton,
    MatIcon,
    MatIconButton,
    MatListItem,
    MatListItemMeta,
    MatNavList,
    MatSidenav,
    MatSidenavContainer,
    MatSidenavContent,
    MatToolbar,
    RouterLink,
    RouterLinkActive,
    NgTemplateOutlet,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isAuthenticated()) {
      <mat-toolbar>
        <button
          matIconButton
          type="button"
          [attr.aria-expanded]="drawerOpen()"
          aria-controls="app-drawer"
          [attr.aria-label]="drawerOpen() ? 'بستن منو' : 'گشودن منو'"
          (click)="toggleDrawer()"
        >
          <!--
            An inline SVG, not the ligature form of mat-icon. The ligature needs an icon font, and
            this app deliberately loads exactly one font (Vazirmatn, self-hosted), so the ligature
            would render as the literal word "menu" — it did, before this. mat-icon still wraps the
            SVG, for its sizing and its aria-hidden, and currentColor keeps the strokes on the
            toolbar's own colour in both schemes.
          -->
          <mat-icon>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </mat-icon>
        </button>
        <!-- Home's way in, now that the drawer holds only the tree. The visible word leads the
             accessible name, so a voice user who says what they see still hits it. -->
        <a class="brand" routerLink="/" aria-label="کابلان، صفحهٔ اصلی">کابلان</a>
        <span class="spacer"></span>
        <button matButton type="button" (click)="logout()">خروج از سیستم</button>
      </mat-toolbar>
    }

    <mat-sidenav-container [class.chromeless]="!isAuthenticated()">
      @if (isAuthenticated()) {
        <mat-sidenav id="app-drawer" [mode]="drawerMode()" [opened]="drawerOpen()">
          <nav aria-label="بخش های سامانه">
            <mat-nav-list>
              <ng-container
                [ngTemplateOutlet]="level"
                [ngTemplateOutletContext]="{ $implicit: navigation() }"
              />
            </mat-nav-list>
          </nav>
        </mat-sidenav>
      }

      <mat-sidenav-content>
        <ng-content />
      </mat-sidenav-content>
    </mat-sidenav-container>

    <!-- One level of the tree; a category renders its children by calling this again. -->
    <ng-template #level let-entries>
      @for (entry of asEntries(entries); track entry.label) {
        @if (entry.kind === 'page') {
          <a
            mat-list-item
            [routerLink]="'/' + entry.path"
            routerLinkActive
            #active="routerLinkActive"
            [routerLinkActiveOptions]="exactPath"
            [activated]="active.isActive"
            [attr.aria-current]="active.isActive ? 'page' : null"
            (click)="closeDrawerWhenFloating()"
          >
            {{ entry.label }}
          </a>
        } @else {
          <div cdkAccordionItem #item="cdkAccordionItem" [expanded]="holdsCurrentPage(entry)">
            <button
              mat-list-item
              class="category"
              type="button"
              [attr.aria-expanded]="item.expanded"
              [attr.aria-controls]="'nav-' + entry.id"
              (click)="item.toggle()"
            >
              <span class="category__label">{{ entry.label }}</span>
              <!-- A vertical chevron: up/down reads the same in both directions, so it needs no
                   mirroring. Inline SVG for the same one-font reason as the menu icon above. -->
              <mat-icon matListItemMeta class="chevron" [class.chevron--open]="item.expanded">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </mat-icon>
            </button>
            <!-- Always in the DOM, so aria-controls always names something; the hidden attribute takes a closed
                 group out of the accessibility tree and the tab order alike. -->
            <div class="group" [id]="'nav-' + entry.id" [hidden]="!item.expanded">
              <ng-container
                [ngTemplateOutlet]="level"
                [ngTemplateOutletContext]="{ $implicit: entry.children }"
              />
            </div>
          </div>
        }
      }
    </ng-template>
  `,
  styleUrl: './app-shell.scss',
})
export class AppShell {
  private readonly session = inject(SessionStore);
  private readonly currentUser = inject(CurrentUserStore);
  private readonly authGateway = inject(AuthGateway);
  private readonly router = inject(Router);
  private readonly breakpoints = inject(BreakpointObserver);

  protected readonly isAuthenticated = this.session.isAuthenticated;

  protected readonly navigation = computed(() => navigationFor(this.currentUser.role()));

  /**
   * Exact, query ignored: `/boms` is a prefix of `/boms/dashboard`, and with the router's default
   * subset matching both links would claim to be the current page.
   */
  protected readonly exactPath = {
    paths: 'exact',
    queryParams: 'ignored',
    fragment: 'ignored',
    matrixParams: 'ignored',
  } as const;

  /** The current route path, without the leading slash — the form `navigation.ts` keys pages by. */
  private readonly currentPath = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.pathOf(this.router.url)),
    ),
    { initialValue: this.pathOf(this.router.url) },
  );

  private readonly isWide = toSignal(
    this.breakpoints.observe(WIDE).pipe(map((state) => state.matches)),
    { initialValue: this.breakpoints.isMatched(WIDE) },
  );

  protected readonly drawerMode = computed(() => (this.isWide() ? 'side' : 'over'));

  /**
   * Pinned open on a wide viewport, shut on a narrow one — and `linkedSignal` rather than
   * `computed` so the toggle can override it, while a change of viewport still resets it to the
   * default for that width.
   */
  protected readonly drawerOpen = linkedSignal(() => this.isWide());

  constructor() {
    // The route table already resolves the current user before it renders a page, but the shell
    // outlives any one route and must not depend on which one ran first. `load()` fetches once and
    // caches, so calling it here costs nothing when the route got there first.
    effect(() => {
      if (this.isAuthenticated()) {
        void this.currentUser.load();
      }
    });
  }

  /** A category opens itself when the visitor is standing on one of its pages. */
  protected holdsCurrentPage(category: NavigationCategory): boolean {
    return containsPath(category, this.currentPath());
  }

  /** Narrows the untyped `ng-template` context back to what it always is. */
  protected asEntries(entries: unknown): readonly NavigationEntry[] {
    return entries as readonly NavigationEntry[];
  }

  private pathOf(url: string): string {
    return (
      this.router
        .parseUrl(url)
        .root.children['primary']?.segments.map((segment) => segment.path)
        .join('/') ?? ''
    );
  }

  protected toggleDrawer(): void {
    this.drawerOpen.update((open) => !open);
  }

  /** A floating drawer covers the page it just navigated, so it gets out of the way. */
  protected closeDrawerWhenFloating(): void {
    if (!this.isWide()) {
      this.drawerOpen.set(false);
    }
  }

  protected logout(): void {
    this.authGateway.logout();
    void this.router.navigateByUrl('/login');
  }
}
