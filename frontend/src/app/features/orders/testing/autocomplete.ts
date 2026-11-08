import { ComponentFixture } from '@angular/core/testing';

/** The `mat-form-field` whose `mat-label` reads exactly `label`. */
export function fieldLabelled(root: HTMLElement, label: string): HTMLElement {
  const field = Array.from(root.querySelectorAll('mat-form-field')).find(
    (candidate) => candidate.querySelector('mat-label')?.textContent?.trim() === label,
  );
  if (!field) {
    throw new Error(`No field labelled «${label}»`);
  }
  return field as HTMLElement;
}

/** The text of every option the open autocomplete panel shows. */
export function shownOptions(): string[] {
  return Array.from(document.body.querySelectorAll('mat-option')).map(
    (option) => option.textContent?.trim() ?? '',
  );
}

/** Focuses the combobox and types `text` into it, as a visitor would; the panel opens. */
export async function typeInto(
  fixture: ComponentFixture<unknown>,
  input: HTMLInputElement,
  text: string,
): Promise<void> {
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input'));
  await fixture.whenStable();
}

/** Types `miCode` into the combobox, then clicks the option holding it. */
export async function pickMiCode(
  fixture: ComponentFixture<unknown>,
  input: HTMLInputElement,
  miCode: string,
): Promise<void> {
  await typeInto(fixture, input, miCode);
  const option = Array.from(document.body.querySelectorAll<HTMLElement>('mat-option')).find(
    (candidate) => candidate.textContent?.trim().startsWith(miCode),
  );
  if (!option) {
    throw new Error(`No option for «${miCode}»; shown: ${shownOptions().join(' | ')}`);
  }
  option.click();
  await fixture.whenStable();
}
