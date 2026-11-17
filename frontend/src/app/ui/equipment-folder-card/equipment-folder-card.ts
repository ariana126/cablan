import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { Icon } from '../icon/icon';

let nextCardId = 0;

/**
 * One equipment's folder on a shelf — `/pm-plans`' technical folders (issue #92) and `/qc-equipment`'s
 * QC folders (issue #119): a real link to the folder's own page (`link`), drawn as a binder's folder
 * — a tab on its top edge, a folder tile, the name, and a line under it.
 *
 * **Its accessible name is the equipment's name alone.** The line under it («۲ فعالیت فعال», «بدون
 * برنامه PM», «کنار گذاشته شده») is `aria-hidden` and reaches a screen reader as the link's
 * description (`aria-describedby`) instead, so the folder is found by exactly the name a visitor
 * knows it by. Every glyph is `aria-hidden` too.
 *
 * Material has no card that is itself a link: `mat-card` is a container, not a control, and a
 * `mat-card` wrapped in an `<a>` would nest the frame inside the focus ring's target awkwardly. So
 * this is a plain `<a>` styled from the design system's tokens — a container's frame, the tile of an
 * icon tile, the global focus ring.
 */
@Component({
  selector: 'app-equipment-folder-card',
  imports: [Icon, MatIcon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      class="folder-card"
      [class.folder-card--retired]="retired()"
      [routerLink]="link()"
      [attr.aria-describedby]="detailId"
    >
      <span class="folder-card__tab" aria-hidden="true"></span>
      <span class="folder-card__body">
        <span class="folder-card__tile">
          <mat-icon appIcon="folder" />
        </span>
        <span class="folder-card__text">
          <span class="folder-card__name">{{ name() }}</span>
          <span class="folder-card__detail" aria-hidden="true" [id]="detailId">{{ detail() }}</span>
        </span>
        <mat-icon class="folder-card__open" appIcon="next" />
      </span>
    </a>
  `,
  styleUrl: './equipment-folder-card.scss',
})
export class EquipmentFolderCard {
  /** The folder's page, as `routerLink` takes it: `['/pm-plans', id]`. */
  readonly link = input.required<readonly string[]>();
  /** The equipment's name — and the link's whole accessible name. */
  readonly name = input.required<string>();
  /** The line under the name, already worded; the link's description. */
  readonly detail = input.required<string>();
  /** A retired equipment's folder, in the archive: the neutral tone instead of the positive one. */
  readonly retired = input(false);

  protected readonly detailId = `equipment-folder-card-detail-${nextCardId++}`;
}
