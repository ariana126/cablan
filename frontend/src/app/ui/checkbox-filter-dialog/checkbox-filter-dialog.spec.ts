import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';

import { CheckboxFilterDialog, CheckboxFilterDialogData } from './checkbox-filter-dialog';

function setUp(data: CheckboxFilterDialogData) {
  const close = vi.fn();

  TestBed.configureTestingModule({
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close } },
    ],
  });

  const fixture = TestBed.createComponent(CheckboxFilterDialog);
  TestBed.inject(ApplicationRef).tick();

  return { fixture, close, root: fixture.nativeElement as HTMLElement };
}

/** Options whose label is the value itself, as most columns' are. */
function plain(...values: string[]) {
  return values.map((value) => ({ value, label: value }));
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

function typeInSearch(root: HTMLElement, query: string): void {
  const input = root.querySelector('input[type="search"]') as HTMLInputElement;
  input.value = query;
  input.dispatchEvent(new Event('input'));
  TestBed.inject(ApplicationRef).tick();
}

describe('CheckboxFilterDialog', () => {
  it('titles itself after the column and says how many values are chosen', () => {
    const { root } = setUp({
      fieldLabel: 'برند',
      options: plain('لگراند', 'نگزنس'),
      selectedValues: ['لگراند'],
    });

    expect(root.querySelector('h2')?.textContent?.trim()).toBe('فیلتر برند');
    expect(root.textContent).toContain('۱ از ۲ انتخاب شده');
  });

  it('says nothing is chosen once every value is unchecked', () => {
    const { root } = setUp({ fieldLabel: 'برند', options: plain('لگراند'), selectedValues: [] });

    expect(root.textContent).toContain('هیچ مقداری انتخاب نشده');
  });

  it('lifts the filter outright with «پاک کردن», whatever was chosen', () => {
    const { close, root } = setUp({
      fieldLabel: 'برند',
      options: plain('لگراند', 'نگزنس'),
      selectedValues: ['لگراند'],
    });

    clickButton(root, 'پاک کردن');

    expect(close).toHaveBeenCalledWith({ selected: undefined });
  });

  it('starts with every value checked when nothing is filtered yet', () => {
    const { root } = setUp({
      fieldLabel: 'برند',
      options: plain('لگراند', 'نگزنس'),
      selectedValues: undefined,
    });

    expect(checkboxNamed(root, 'لگراند').checked).toBe(true);
    expect(checkboxNamed(root, 'نگزنس').checked).toBe(true);
    expect(checkboxNamed(root, 'انتخاب همه').checked).toBe(true);
  });

  it('starts with only the previously selected values checked', () => {
    const { root } = setUp({
      fieldLabel: 'برند',
      options: plain('لگراند', 'نگزنس'),
      selectedValues: ['لگراند'],
    });

    expect(checkboxNamed(root, 'لگراند').checked).toBe(true);
    expect(checkboxNamed(root, 'نگزنس').checked).toBe(false);
    expect(checkboxNamed(root, 'انتخاب همه').checked).toBe(false);
  });

  it('closes with undefined selection when every value is (still) checked on apply — "no filter"', () => {
    const { root, close } = setUp({
      fieldLabel: 'برند',
      options: plain('لگراند', 'نگزنس'),
      selectedValues: undefined,
    });

    clickButton(root, 'اعمال');

    expect(close).toHaveBeenCalledWith({ selected: undefined });
  });

  it('closes with the remaining values when one is unchecked', () => {
    const { root, close } = setUp({
      fieldLabel: 'برند',
      options: plain('لگراند', 'نگزنس'),
      selectedValues: undefined,
    });

    checkboxNamed(root, 'نگزنس').dispatchEvent(new Event('click'));
    clickButton(root, 'اعمال');

    expect(close).toHaveBeenCalledWith({ selected: ['لگراند'] });
  });

  it('closes with an explicit empty array when every value is deselected — "match nothing"', () => {
    const { root, close } = setUp({
      fieldLabel: 'برند',
      options: plain('لگراند', 'نگزنس'),
      selectedValues: undefined,
    });

    checkboxNamed(root, 'انتخاب همه').dispatchEvent(new Event('click'));
    clickButton(root, 'اعمال');

    expect(close).toHaveBeenCalledWith({ selected: [] });
  });

  it('re-checking "select all" after some values were deselected clears the filter again', () => {
    const { root, close } = setUp({
      fieldLabel: 'برند',
      options: plain('لگراند', 'نگزنس'),
      selectedValues: ['لگراند'],
    });

    checkboxNamed(root, 'انتخاب همه').dispatchEvent(new Event('click'));
    clickButton(root, 'اعمال');

    expect(close).toHaveBeenCalledWith({ selected: undefined });
  });

  it('closes with a falsy (non-applied) result on cancel', () => {
    const { root, close } = setUp({
      fieldLabel: 'برند',
      options: plain('لگراند', 'نگزنس'),
      selectedValues: undefined,
    });

    clickButton(root, 'انصراف');

    expect(close).toHaveBeenCalledWith('');
  });

  it('narrows the list by search and keeps filtered-out selections on apply', () => {
    const { root, close } = setUp({
      fieldLabel: 'برند',
      options: plain('لگراند', 'نگزنس', 'ایبیان'),
      selectedValues: undefined,
    });

    typeInSearch(root, 'لگر');
    const visible = Array.from(root.querySelectorAll('mat-checkbox')).map((c) =>
      c.textContent?.trim(),
    );
    expect(visible).toEqual(['انتخاب همه نتایج جستجو', 'لگراند']);

    checkboxNamed(root, 'لگراند').click();
    typeInSearch(root, '');
    expect(checkboxNamed(root, 'نگزنس').checked).toBe(true);
    clickButton(root, 'اعمال');

    expect(close).toHaveBeenCalledWith({ selected: ['نگزنس', 'ایبیان'] });
  });

  it('shows each value by its label but hands back the value itself', () => {
    const { root, close } = setUp({
      fieldLabel: 'وضعیت تایید',
      options: [
        { value: 'approved', label: 'تایید شده' },
        { value: 'unapproved', label: 'تایید نشده' },
      ],
      selectedValues: undefined,
    });

    checkboxNamed(root, 'تایید نشده').dispatchEvent(new Event('click'));
    clickButton(root, 'اعمال');

    expect(close).toHaveBeenCalledWith({ selected: ['approved'] });
  });
});
