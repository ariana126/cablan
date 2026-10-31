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
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatListItem, MatListItemIcon, MatNavList } from '@angular/material/list';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatSidenav, MatSidenavContainer, MatSidenavContent } from '@angular/material/sidenav';
import { MatToolbar } from '@angular/material/toolbar';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map } from 'rxjs';

import { AuthGateway } from '../../core/identity/auth-gateway';
import { CurrentUserStore } from '../../core/identity/current-user-store';
import {
  breadcrumbFor,
  containsPath,
  NavigationCategory,
  NavigationEntry,
  navigationFor,
} from '../../core/identity/navigation';
import { ROLE_LABELS } from '../../core/i18n/role-labels';
import { SessionStore } from '../../core/identity/session-store';
import { NavigationIcon } from '../navigation-icon/navigation-icon';

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
    MatIcon,
    MatIconButton,
    MatListItem,
    MatListItemIcon,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatNavList,
    MatSidenav,
    MatSidenavContainer,
    MatSidenavContent,
    MatToolbar,
    NavigationIcon,
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
        @if (breadcrumb().length > 0) {
          <span class="brand-rule" aria-hidden="true"></span>
          <nav class="crumbs" aria-label="مسیر">
            <ol>
              @for (crumb of breadcrumb(); track $index; let last = $last) {
                <li>
                  @if (last) {
                    <span aria-current="page" class="crumbs__current">{{ crumb.label }}</span>
                  } @else {
                    <a
                      class="crumbs__link"
                      routerLink="/"
                      [queryParams]="crumb.category ? { category: crumb.category } : null"
                      >{{ crumb.label }}</a
                    >
                    <!-- Forward in Persian is leftward; the document is RTL-only, so the glyph is
                         drawn pointing that way. -->
                    <svg
                      class="crumbs__chevron"
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
                  }
                </li>
              }
            </ol>
          </nav>
        }
        <span class="spacer"></span>
        <button
          class="user"
          type="button"
          [matMenuTriggerFor]="accountMenu"
          [attr.aria-label]="'حساب کاربری: ' + userName() + '، ' + roleLabel()"
        >
          <span class="avatar" aria-hidden="true">{{ initials() }}</span>
          <span class="user__text">
            <span class="user__name">{{ userName() }}</span>
            <span class="user__role">{{ roleLabel() }}</span>
          </span>
          <svg
            class="user__chevron"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        <mat-menu #accountMenu="matMenu">
          <button mat-menu-item type="button" (click)="logout()">
            <mat-icon>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
            </mat-icon>
            <span>خروج از سیستم</span>
          </button>
        </mat-menu>
      </mat-toolbar>
    }

    <mat-sidenav-container
      [class.chromeless]="!isAuthenticated()"
      [class.shell--floating]="drawerMode() === 'over'"
    >
      @if (isAuthenticated()) {
        <mat-sidenav
          id="app-drawer"
          [class.drawer--over]="drawerMode() === 'over'"
          [mode]="drawerMode()"
          [opened]="drawerOpen()"
          (closedStart)="drawerOpen.set(false)"
        >
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
            <!-- A page always sits inside a group: its icon goes in the label row, not the slot. -->
            <span class="entry__row">
              <app-navigation-icon class="entry__icon" [entry]="entry" />
              <span class="entry__label">{{ entry.label }}</span>
            </span>
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
              @if (isTopLevel(entry)) {
                <app-navigation-icon matListItemIcon [entry]="entry" />
              }
              <span class="category__row">
                <span class="entry__row">
                  @if (!isTopLevel(entry)) {
                    <app-navigation-icon class="entry__icon" [entry]="entry" />
                  }
                  <span class="category__label">{{ entry.label }}</span>
                </span>
                <!-- A vertical chevron: up/down reads the same in both directions, so it needs no
                     mirroring. Inline SVG for the same one-font reason as the menu icon above. -->
                <mat-icon class="chevron" [class.chevron--open]="item.expanded">
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
              </span>
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

  protected readonly userName = computed(() => this.currentUser.user()?.name ?? '');

  protected readonly roleLabel = computed(() => {
    const role = this.currentUser.role();
    return role === null ? '' : ROLE_LABELS[role];
  });

  /** The first letters of the first two words of the name, joined by a zero-width non-joiner. */
  protected readonly initials = computed(() =>
    this.userName()
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => Array.from(word)[0] ?? '')
      .join('\u200c'),
  );

  /**
   * The one way back up, on every page that has one: home, then down the tree to the current page —
   * or, on home, to the level on show. Each category links to its level on the home page.
   */
  protected readonly breadcrumb = computed(() =>
    breadcrumbFor(this.navigation(), this.currentPath(), this.currentCategory()),
  );

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

  /**
   * The current URL, query included: moving between home's levels changes only `?category=`, and
   * that is still a navigation the breadcrumb has to follow.
   */
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.parseUrl(this.router.url)),
    ),
    { initialValue: this.router.parseUrl(this.router.url) },
  );

  /** The current route path, without the leading slash — the form `navigation.ts` keys pages by. */
  private readonly currentPath = computed(
    () =>
      this.currentUrl()
        .root.children['primary']?.segments.map((segment) => segment.path)
        .join('/') ?? '',
  );

  /** The level of home on show, from `?category=`; meaningless on any other page. */
  private readonly currentCategory = computed(() =>
    this.currentUrl().queryParamMap.get('category'),
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

  /**
   * A top-level category's icon takes the list item's icon slot; a nested entry's sits in its label
   * row instead, where the indented group still has room for the label beside it.
   */
  protected isTopLevel(category: NavigationCategory): boolean {
    return this.navigation().includes(category);
  }

  /** Narrows the untyped `ng-template` context back to what it always is. */
  protected asEntries(entries: unknown): readonly NavigationEntry[] {
    return entries as readonly NavigationEntry[];
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
