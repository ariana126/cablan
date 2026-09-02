import { BreakpointObserver } from '@angular/cdk/layout';
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
import { MatListItem, MatNavList } from '@angular/material/list';
import { MatSidenav, MatSidenavContainer, MatSidenavContent } from '@angular/material/sidenav';
import { MatToolbar } from '@angular/material/toolbar';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { map } from 'rxjs';

import { AuthGateway } from '../../core/identity/auth-gateway';
import { CurrentUserStore } from '../../core/identity/current-user-store';
import { destinationsFor } from '../../core/identity/navigation';
import { SessionStore } from '../../core/identity/session-store';

/** Below this the drawer floats over the page instead of holding a column of its own. */
const WIDE = '(min-width: 60rem)';

/**
 * The app bar and navigation drawer wrapped around every page.
 *
 * Nine destinations is why this is a drawer rather than a bar: Material Design caps a horizontal
 * navigation bar at about five and a rail at about seven, and these labels alone run past the width
 * of a toolbar. `mat-sidenav` and `mat-nav-list` are what the design system points at for the job.
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
    MatButton,
    MatIcon,
    MatIconButton,
    MatListItem,
    MatNavList,
    MatSidenav,
    MatSidenavContainer,
    MatSidenavContent,
    MatToolbar,
    RouterLink,
    RouterLinkActive,
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
        <span class="brand">کابلان</span>
        <span class="spacer"></span>
        <button matButton type="button" (click)="logout()">خروج از سیستم</button>
      </mat-toolbar>
    }

    <mat-sidenav-container [class.chromeless]="!isAuthenticated()">
      @if (isAuthenticated()) {
        <mat-sidenav id="app-drawer" [mode]="drawerMode()" [opened]="drawerOpen()">
          <nav aria-label="بخش های سامانه">
            <mat-nav-list>
              @for (destination of destinations(); track destination.path) {
                <a
                  mat-list-item
                  [routerLink]="'/' + destination.path"
                  routerLinkActive
                  #active="routerLinkActive"
                  [routerLinkActiveOptions]="{ exact: destination.path === '' }"
                  [activated]="active.isActive"
                  [attr.aria-current]="active.isActive ? 'page' : null"
                  (click)="closeDrawerWhenFloating()"
                >
                  {{ destination.label }}
                </a>
              }
            </mat-nav-list>
          </nav>
        </mat-sidenav>
      }

      <mat-sidenav-content>
        <ng-content />
      </mat-sidenav-content>
    </mat-sidenav-container>
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

  protected readonly destinations = computed(() => destinationsFor(this.currentUser.role()));

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
