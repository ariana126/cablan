import { effect, inject, Injectable, untracked } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { catchError, of } from 'rxjs';

import { Role } from '../../api/model';
import { CurrentUserStore } from '../../core/identity/current-user-store';
import { SessionStore } from '../../core/identity/session-store';
import {
  AppUnassignedActivity,
  MaintenanceActivitiesGateway,
} from '../../core/maintenance/maintenance-activities-gateway';
import type {
  SpecialtyAssignmentDialog,
  SpecialtyAssignmentDialogData,
} from './specialty-assignment-dialog';

/**
 * Brings up «تعیین تخصص فعالیت های قبلی» for a System Admin while any activity still has no
 * specialty (issue #108): once per sign-in — after signing in, and on loading the app with a session
 * already open — whatever page that lands on. It asks `GET …/unassigned-specialties` and opens the
 * dialog only when the list is not empty, so once every activity has one it never shows again; no
 * "done" flag is kept anywhere. Every other role is never asked (the API refuses them anyway).
 *
 * `App` injects it so it runs from start-up; it reads the signed-in user the guard already loaded.
 *
 * Once the assignment succeeds, the page behind it is opened afresh (a detour through home that the
 * address bar never shows), so whatever list it shows reads the new specialties rather than
 * «تخصص تعیین نشده». Putting it off («بعداً») leaves the page as it is.
 *
 * The dialog itself is `import()`ed only when there is something to assign: this class starts with
 * the app, so a static import would put the dialog, its radio groups and signal forms into the
 * initial bundle of every visitor (the production build's 1 MB budget). Keep only `import type`
 * from `./specialty-assignment-dialog` here.
 */
@Injectable({ providedIn: 'root' })
export class SpecialtyAssignmentPrompt {
  private readonly users = inject(CurrentUserStore);
  private readonly session = inject(SessionStore);
  private readonly gateway = inject(MaintenanceActivitiesGateway);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  /** The session token already asked for, so a re-read of the same user asks nothing. */
  private askedFor = '';

  constructor() {
    effect(() => {
      const user = this.users.user();
      untracked(() => {
        const token = this.session.accessToken();
        if (user?.role !== Role.system_admin || token === '' || token === this.askedFor) {
          return;
        }
        this.askedFor = token;
        this.ask();
      });
    });
  }

  /** Re-creates the routed page, so its resources read again; the URL stays as it was. */
  private async reopenCurrentPage(): Promise<void> {
    const url = this.router.url;
    await this.router.navigateByUrl('/', { skipLocationChange: true });
    await this.router.navigateByUrl(url);
  }

  private ask(): void {
    this.gateway
      .unassignedSpecialties()
      // A list that cannot be read is no reason to interrupt: the next sign-in asks again.
      .pipe(catchError(() => of([] as AppUnassignedActivity[])))
      .subscribe((activities) => {
        if (activities.length > 0) {
          void this.openAssignment(activities);
        }
      });
  }

  private async openAssignment(activities: AppUnassignedActivity[]): Promise<void> {
    const { SpecialtyAssignmentDialog: dialog } = await import('./specialty-assignment-dialog');
    this.dialog
      .open<SpecialtyAssignmentDialog, SpecialtyAssignmentDialogData, boolean>(dialog, {
        data: { activities },
        disableClose: true,
      })
      .afterClosed()
      .subscribe((assigned) => {
        if (assigned === true) {
          void this.reopenCurrentPage();
        }
      });
  }
}
