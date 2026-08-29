import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';

import {
  StandardBomFilterOption,
  StandardBomReportFilterDialog,
  StandardBomReportFilterDialogData,
} from './standard-bom-report-filter-dialog';

function setUp<V extends string | boolean>(data: StandardBomReportFilterDialogData<V>) {
  const close = vi.fn();

  TestBed.configureTestingModule({
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close } },
    ],
  });

  const fixture = TestBed.createComponent(StandardBomReportFilterDialog<V>);
  TestBed.inject(ApplicationRef).tick();

  return { fixture, close, root: fixture.nativeElement as HTMLElement };
}

function checkboxNamed(root: HTMLElement, name: string): HTMLInputElement {
  const label = Array.from(root.querySelectorAll('mat-checkbox')).find((element) =>
    element.textContent?.trim().includes(name),
  );
  const input = label?.querySelector('input[type="checkbox"]');
  if (!input) {
    throw new Error(`No checkbox found for "${name}"`);
  }
  return input as HTMLInputElement;
}

function clickButton(root: HTMLElement, text: string): void {
  const button = Array.from(root.querySelectorAll('button')).find(
    (element) => element.textContent?.trim() === text,
  );
  button?.dispatchEvent(new Event('click'));
}

const stringOptions: readonly StandardBomFilterOption<string>[] = [
  { value: 'لگراند', label: 'لگراند' },
  { value: 'نگزنس', label: 'نگزنس' },
];

const booleanOptions: readonly StandardBomFilterOption<boolean>[] = [
  { value: true, label: 'بله' },
  { value: false, label: 'خیر' },
];

describe('StandardBomReportFilterDialog', () => {
  describe('string fields (برند, نام محصول, نام جز)', () => {
    it('starts with every value checked when nothing is filtered yet', () => {
      const { root } = setUp({
        fieldLabel: 'برند',
        options: stringOptions,
        selectedValues: undefined,
      });

      expect(checkboxNamed(root, 'لگراند').checked).toBe(true);
      expect(checkboxNamed(root, 'نگزنس').checked).toBe(true);
      expect(checkboxNamed(root, 'انتخاب همه').checked).toBe(true);
    });

    it('starts with only the previously selected values checked', () => {
      const { root } = setUp({
        fieldLabel: 'برند',
        options: stringOptions,
        selectedValues: ['لگراند'],
      });

      expect(checkboxNamed(root, 'لگراند').checked).toBe(true);
      expect(checkboxNamed(root, 'نگزنس').checked).toBe(false);
      expect(checkboxNamed(root, 'انتخاب همه').checked).toBe(false);
    });

    it('closes with undefined selection when every value is (still) checked on apply — "no filter"', () => {
      const { root, close } = setUp({
        fieldLabel: 'برند',
        options: stringOptions,
        selectedValues: undefined,
      });

      clickButton(root, 'اعمال فیلتر');

      expect(close).toHaveBeenCalledWith({ selected: undefined });
    });

    it('closes with the remaining values when one is unchecked', () => {
      const { root, close } = setUp({
        fieldLabel: 'برند',
        options: stringOptions,
        selectedValues: undefined,
      });

      checkboxNamed(root, 'نگزنس').dispatchEvent(new Event('click'));
      clickButton(root, 'اعمال فیلتر');

      expect(close).toHaveBeenCalledWith({ selected: ['لگراند'] });
    });

    it('closes with an explicit empty array when every value is deselected — "match nothing"', () => {
      const { root, close } = setUp({
        fieldLabel: 'برند',
        options: stringOptions,
        selectedValues: undefined,
      });

      checkboxNamed(root, 'انتخاب همه').dispatchEvent(new Event('click'));
      clickButton(root, 'اعمال فیلتر');

      expect(close).toHaveBeenCalledWith({ selected: [] });
    });
  });

  describe('boolean field (فعال)', () => {
    it('renders بله/خیر for true/false', () => {
      const { root } = setUp({
        fieldLabel: 'فعال',
        options: booleanOptions,
        selectedValues: undefined,
      });

      expect(checkboxNamed(root, 'بله').checked).toBe(true);
      expect(checkboxNamed(root, 'خیر').checked).toBe(true);
    });

    it('preserves the boolean type when closing with one value selected', () => {
      const { root, close } = setUp({
        fieldLabel: 'فعال',
        options: booleanOptions,
        selectedValues: undefined,
      });

      checkboxNamed(root, 'خیر').dispatchEvent(new Event('click'));
      clickButton(root, 'اعمال فیلتر');

      expect(close).toHaveBeenCalledWith({ selected: [true] });
    });

    it('closes with the previously selected boolean values when apply is clicked unchanged', () => {
      const { root, close } = setUp({
        fieldLabel: 'فعال',
        options: booleanOptions,
        selectedValues: [true],
      });

      clickButton(root, 'اعمال فیلتر');

      expect(close).toHaveBeenCalledWith({ selected: [true] });
    });

    it('closes with an empty array when both values are deselected', () => {
      const { root, close } = setUp({
        fieldLabel: 'فعال',
        options: booleanOptions,
        selectedValues: undefined,
      });

      checkboxNamed(root, 'انتخاب همه').dispatchEvent(new Event('click'));
      clickButton(root, 'اعمال فیلتر');

      expect(close).toHaveBeenCalledWith({ selected: [] });
    });
  });

  it('closes with a falsy (non-applied) result on cancel', () => {
    const { root, close } = setUp({
      fieldLabel: 'برند',
      options: stringOptions,
      selectedValues: undefined,
    });

    clickButton(root, 'انصراف');

    expect(close).toHaveBeenCalledWith('');
  });
});
