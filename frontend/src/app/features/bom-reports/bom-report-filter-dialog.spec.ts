import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';

import { BomReportFilterDialog, BomReportFilterDialogData } from './bom-report-filter-dialog';

function setUp(data: BomReportFilterDialogData) {
  const close = vi.fn();

  TestBed.configureTestingModule({
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close } },
    ],
  });

  const fixture = TestBed.createComponent(BomReportFilterDialog);
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

describe('BomReportFilterDialog', () => {
  it('starts with every value checked when nothing is filtered yet', () => {
    const { root } = setUp({
      fieldLabel: 'برند',
      allValues: ['لگراند', 'نگزنس'],
      selectedValues: undefined,
    });

    expect(checkboxNamed(root, 'لگراند').checked).toBe(true);
    expect(checkboxNamed(root, 'نگزنس').checked).toBe(true);
    expect(checkboxNamed(root, 'انتخاب همه').checked).toBe(true);
  });

  it('starts with only the previously selected values checked', () => {
    const { root } = setUp({
      fieldLabel: 'برند',
      allValues: ['لگراند', 'نگزنس'],
      selectedValues: ['لگراند'],
    });

    expect(checkboxNamed(root, 'لگراند').checked).toBe(true);
    expect(checkboxNamed(root, 'نگزنس').checked).toBe(false);
    expect(checkboxNamed(root, 'انتخاب همه').checked).toBe(false);
  });

  it('closes with undefined selection when every value is (still) checked on apply — "no filter"', () => {
    const { root, close } = setUp({
      fieldLabel: 'برند',
      allValues: ['لگراند', 'نگزنس'],
      selectedValues: undefined,
    });

    clickButton(root, 'اعمال فیلتر');

    expect(close).toHaveBeenCalledWith({ selected: undefined });
  });

  it('closes with the remaining values when one is unchecked', () => {
    const { root, close } = setUp({
      fieldLabel: 'برند',
      allValues: ['لگراند', 'نگزنس'],
      selectedValues: undefined,
    });

    checkboxNamed(root, 'نگزنس').dispatchEvent(new Event('click'));
    clickButton(root, 'اعمال فیلتر');

    expect(close).toHaveBeenCalledWith({ selected: ['لگراند'] });
  });

  it('closes with an explicit empty array when every value is deselected — "match nothing"', () => {
    const { root, close } = setUp({
      fieldLabel: 'برند',
      allValues: ['لگراند', 'نگزنس'],
      selectedValues: undefined,
    });

    checkboxNamed(root, 'انتخاب همه').dispatchEvent(new Event('click'));
    clickButton(root, 'اعمال فیلتر');

    expect(close).toHaveBeenCalledWith({ selected: [] });
  });

  it('re-checking "select all" after some values were deselected clears the filter again', () => {
    const { root, close } = setUp({
      fieldLabel: 'برند',
      allValues: ['لگراند', 'نگزنس'],
      selectedValues: ['لگراند'],
    });

    checkboxNamed(root, 'انتخاب همه').dispatchEvent(new Event('click'));
    clickButton(root, 'اعمال فیلتر');

    expect(close).toHaveBeenCalledWith({ selected: undefined });
  });

  it('closes with a falsy (non-applied) result on cancel', () => {
    const { root, close } = setUp({
      fieldLabel: 'برند',
      allValues: ['لگراند', 'نگزنس'],
      selectedValues: undefined,
    });

    clickButton(root, 'انصراف');

    expect(close).toHaveBeenCalledWith('');
  });
});
