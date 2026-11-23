import {
  afterNextRender,
  Directive,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  Signal,
  untracked,
} from '@angular/core';

/** What the directive reads of a signal form: `form()` with its submitting and validity state. */
export type RevealableForm = () => {
  readonly submitting: Signal<boolean>;
  readonly invalid: Signal<boolean>;
};

/**
 * Everything that says a submission went wrong, in the order a form shows it: the form-level banner
 * (`app-error-banner`'s `role="alert"`, at the top of the content), a field's `mat-error`, or a
 * control that marks itself invalid.
 */
const ERROR_SELECTOR = '[role="alert"], mat-error, [aria-invalid="true"]';

/** What a field's error points the visitor at: the control itself. */
const CONTROL_SELECTOR =
  'input:not([type="hidden"]), textarea, select, mat-select, [role="combobox"], [role="radio"]';

/**
 * Makes a failed submission impossible to miss (issue #131). A long dialog form is often submitted
 * from its footer, scrolled far below the banner at the top of its content and the fields above —
 * and a refusal there used to change nothing the visitor could see.
 *
 * Put it on a dialog's `<form>` with the signal form it submits: `[appRevealFormErrors]="itemForm"`.
 * After every `submit` event it waits for the submission to settle (`submitting()` false — at once
 * for a form refused as invalid, after the API's answer otherwise) and, if the form is then invalid,
 * brings the **first** error in the form into view and focuses it:
 *
 * - the form-level banner, a `role="alert"`, is focused itself — so a screen reader reads it even
 *   when the same message was already there from the previous attempt;
 * - a field's error focuses that field's control, whose accessible description carries the reason
 *   (`mat-error`), and scrolls the whole field, reason included, into view.
 *
 * Nothing about the form changes — what the visitor typed stays — and an accepted submission is left
 * alone. One mechanism for every dialog form rather than one per dialog.
 */
@Directive({
  selector: 'form[appRevealFormErrors]',
  host: { '(submit)': 'onSubmit()' },
})
export class RevealFormErrors {
  readonly form = input.required<RevealableForm>({ alias: 'appRevealFormErrors' });

  private readonly host = inject<ElementRef<HTMLFormElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  /** A submission whose outcome is still to be looked at. */
  private readonly awaitingOutcome = signal(false);

  constructor() {
    effect(() => {
      if (!this.awaitingOutcome()) {
        return;
      }
      const state = this.form()();
      if (state.submitting()) {
        return;
      }
      const refused = state.invalid();
      untracked(() => this.awaitingOutcome.set(false));
      if (refused) {
        // After the render that draws the errors the submission just produced.
        afterNextRender(() => revealFirstError(this.host), { injector: this.injector });
      }
    });
  }

  protected onSubmit(): void {
    this.awaitingOutcome.set(true);
  }
}

/** Scrolls the first error inside `container` into view and focuses what it is about. */
export function revealFirstError(container: HTMLElement): void {
  const error = container.querySelector<HTMLElement>(ERROR_SELECTOR);
  if (error === null) {
    return;
  }

  if (error.getAttribute('role') === 'alert') {
    bringIntoView(error);
    if (!error.hasAttribute('tabindex')) {
      error.setAttribute('tabindex', '-1');
    }
    error.focus({ preventScroll: true });
    return;
  }

  const field = error.closest<HTMLElement>('mat-form-field') ?? error;
  const control = error.matches(CONTROL_SELECTOR)
    ? error
    : field.querySelector<HTMLElement>(CONTROL_SELECTOR);
  bringIntoView(field);
  (control ?? error).focus({ preventScroll: true });
}

/** `block: 'nearest'`: scroll no further than it takes; jsdom has no `scrollIntoView` at all. */
function bringIntoView(element: HTMLElement): void {
  if (typeof element.scrollIntoView === 'function') {
    element.scrollIntoView({ block: 'nearest' });
  }
}
