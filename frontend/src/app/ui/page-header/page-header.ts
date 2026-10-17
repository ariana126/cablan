import { ChangeDetectionStrategy, Component, ElementRef, input, viewChild } from '@angular/core';

/**
 * How every page opens: the page title as the one `<h1>`, a one-line description under it, and the
 * page's actions at the end. Secondary actions come first and the one filled action last, in the
 * projected `[pageHeaderActions]` slot, so the primary action sits where the eye ends.
 *
 * The description is optional on purpose: it says what the page is for, in words someone wrote for
 * that page. A page with no such sentence renders none rather than a placeholder.
 */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-header">
      <div class="stack stack--hair">
        <h1 #title class="page-header__title" tabindex="-1">{{ heading() }}</h1>
        @if (description(); as text) {
          <p class="page-header__description">{{ text }}</p>
        }
      </div>
      <div class="page-header__actions">
        <ng-content select="[pageHeaderActions]" />
      </div>
    </header>
  `,
  styleUrl: './page-header.scss',
})
export class PageHeader {
  readonly heading = input.required<string>();
  readonly description = input<string>();

  private readonly title = viewChild.required<ElementRef<HTMLElement>>('title');

  /**
   * Moves focus to the heading. A page that swaps its content in place (the home page drilling into
   * a category) gives a screen reader no other sign anything changed — the URL moved but the route
   * did not — so landing focus on the new heading is that sign.
   */
  focus(): void {
    this.title().nativeElement.focus();
  }
}
