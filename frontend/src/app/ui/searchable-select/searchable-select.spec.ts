import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form, required } from '@angular/forms/signals';
import { MatAutocompleteHarness } from '@angular/material/autocomplete/testing';
import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { beforeEach, describe, expect, it } from 'vitest';

import { SearchableSelect, SearchableSelectOption } from './searchable-select';

const OPTIONS: readonly SearchableSelectOption[] = [
  { value: 'p1', label: 'کابل برق' },
  { value: 'p2', label: 'کابل شبکه' },
  { value: 'p3', label: 'سیم مسی' },
];

@Component({
  imports: [SearchableSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-searchable-select
      label="محصول"
      [field]="testForm.productId"
      [options]="options()"
      (selected)="picked.push($event)"
    />
  `,
})
class HostComponent {
  readonly options = signal(OPTIONS);
  readonly model = signal({ productId: '' });
  readonly testForm = form(this.model, (path) => {
    required(path.productId, { message: 'محصول را انتخاب کنید.' });
  });
  readonly picked: string[] = [];
  readonly select = viewChild.required(SearchableSelect);
}

describe('SearchableSelect', () => {
  let fixture: ComponentFixture<HostComponent>;
  let loader: HarnessLoader;

  const textBox = (): HTMLInputElement => fixture.nativeElement.querySelector('input');

  /** Tab is what closes the panel when a visitor leaves the box from the keyboard. */
  const leaveWithTab = (): void => {
    textBox().dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', keyCode: 9 }));
  };

  const autocomplete = (): Promise<MatAutocompleteHarness> =>
    loader.getHarness(MatAutocompleteHarness);

  const optionTexts = async (): Promise<string[]> =>
    Promise.all((await (await autocomplete()).getOptions()).map((option) => option.getText()));

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    loader = TestbedHarnessEnvironment.loader(fixture);
    await fixture.whenStable();
  });

  it('is found by its visible label text', () => {
    const label = fixture.nativeElement.querySelector('label') as HTMLLabelElement;

    expect(label.textContent?.trim()).toBe('محصول');
    expect(fixture.nativeElement.querySelector(`#${label.getAttribute('for')}`)).toBe(textBox());
  });

  it('offers every option before anything is typed', async () => {
    await (await autocomplete()).focus();

    expect(await optionTexts()).toEqual(['کابل برق', 'کابل شبکه', 'سیم مسی']);
  });

  it('narrows the options to those containing the typed text', async () => {
    const box = await autocomplete();
    await box.enterText('شبکه');

    expect(await optionTexts()).toEqual(['کابل شبکه']);
  });

  it('matches regardless of Arabic letter variants and case', async () => {
    const box = await autocomplete();
    await box.enterText('كابل');

    expect(await optionTexts()).toEqual(['کابل برق', 'کابل شبکه']);
  });

  it('says so when nothing matches', async () => {
    const box = await autocomplete();
    await box.enterText('یافت‌نشدنی');

    expect(await optionTexts()).toEqual(['موردی یافت نشد']);
  });

  it('writes the option value, not its label, to the field and announces it', async () => {
    const box = await autocomplete();
    await box.enterText('سیم');
    await box.selectOption({ text: 'سیم مسی' });
    await fixture.whenStable();

    expect(fixture.componentInstance.model().productId).toBe('p3');
    expect(fixture.componentInstance.picked).toEqual(['p3']);
    expect(textBox().value).toBe('سیم مسی');
  });

  it('shows the label of a value the field already holds', async () => {
    fixture.componentInstance.model.set({ productId: 'p2' });
    await fixture.whenStable();

    expect(textBox().value).toBe('کابل شبکه');
  });

  it('does not treat half-typed text as a selection, and restores the label on leaving', async () => {
    fixture.componentInstance.model.set({ productId: 'p2' });
    await fixture.whenStable();

    const box = await autocomplete();
    await box.clear();
    await box.enterText('xyz');
    leaveWithTab();
    await box.blur();
    await fixture.whenStable();

    expect(fixture.componentInstance.model().productId).toBe('p2');
    expect(textBox().value).toBe('کابل شبکه');
  });

  it('clears the selection when the box is emptied and left', async () => {
    fixture.componentInstance.model.set({ productId: 'p2' });
    await fixture.whenStable();

    const box = await autocomplete();
    await box.clear();
    leaveWithTab();
    await box.blur();
    await fixture.whenStable();

    expect(fixture.componentInstance.model().productId).toBe('');
    expect(fixture.componentInstance.picked).toEqual(['']);
  });

  it("shows the field's error once touched and nothing is chosen", async () => {
    expect(fixture.nativeElement.querySelector('mat-error')).toBeNull();

    const box = await autocomplete();
    await box.focus();
    await box.blur();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('mat-error')?.textContent).toContain(
      'محصول را انتخاب کنید.',
    );
  });

  it('moves focus into its text box on focus()', () => {
    fixture.componentInstance.select().focus();

    expect(document.activeElement).toBe(textBox());
  });
});
