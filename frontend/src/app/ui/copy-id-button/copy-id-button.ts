import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';

import { CopyId } from './copy-id';

export { CopiedSnackBar } from './copied-snack-bar';

/**
 * Puts one record's UUID on the clipboard, without ever rendering it.
 *
 * A UUID is 36 characters of noise that would dominate any row it sat in, and it is wanted only in
 * the rare moment someone has to quote a record — matching a row against `/audit-log`'s
 * «شناسه رکورد» column, or naming it in a support request. So the id is carried by the button and
 * never shown: `matIconButton` is the smallest affordance the design system offers that still keeps
 * a full touch target, which is why this is an icon button rather than a text one or a truncated id
 * someone is invited to click.
 *
 * The copy goes through the CDK's `Clipboard` rather than `navigator.clipboard`: the async API is
 * unavailable outside a secure context, and the CDK's hidden-textarea fallback still works there.
 * A snackbar confirms, because nothing else on the page changes to say the copy happened.
 */
@Component({
  selector: 'app-copy-id-button',
  imports: [MatIcon, MatIconButton, MatTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (short()) {
      <bdi class="copy-id__tag" dir="ltr">{{ shortId() }}</bdi>
    }
    <button
      matIconButton
      class="copy-id__button"
      type="button"
      matTooltip="کپی شناسه"
      [attr.aria-label]="'کپی شناسه ' + entityName()"
      (click)="copy()"
    >
      <!--
        An inline SVG, not the ligature form of mat-icon — this app loads exactly one font
        (Vazirmatn, self-hosted) and no icon font, so a ligature renders as its own literal text.
        Same reasoning, and the same currentColor stroke, as ui/app-shell's menu icon.
      -->
      <mat-icon>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="9" y="9" width="12" height="12" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      </mat-icon>
    </button>
  `,
  styleUrl: './copy-id-button.scss',
})
export class CopyIdButton {
  private readonly copyId = inject(CopyId);

  /** The UUID that lands on the clipboard. Never rendered. */
  readonly entityId = input.required<string>();

  /**
   * What the row is called — the name, the MI code, the order number. It only ever reaches the
   * accessible name, so that a screen reader announces «کپی شناسه میلگرد فولادی» rather than one of
   * a dozen identical «کپی شناسه» buttons.
   */
  readonly entityName = input.required<string>();

  /**
   * Show the first eight characters of the id, Latin and left-to-right, before the button — for the
   * audit log's «شناسه رکورد» column, where the id itself is the subject. The whole id is still what
   * the button copies; it is never rendered.
   */
  readonly short = input(false);

  protected readonly shortId = computed(() => `${this.entityId().slice(0, 8)}…`);

  protected copy(): void {
    this.copyId.copy(this.entityId());
  }
}
