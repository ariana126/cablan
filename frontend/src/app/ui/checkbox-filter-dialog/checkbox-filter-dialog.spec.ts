import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';

import { CheckboxFilterDialog, CheckboxFilterDialogData } from './checkbox-filter-dialog';

function setUp<V>(data: CheckboxFilterDialogData<V>) {
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
  const label = Array.from(root.querySelectorAll('mat-checkbox')).find(
    (element) => element.textContent?.replace(/\s+/g, ' ').trim() === name,
  );
  const input = label?.querySelector('input[type="checkbox"]');
  if (!input) {
    throw new Error(`No checkbox found for "${name}"`);
  }
  return input as HTMLInputElement;
}

function tick(root: HTMLElement, name: string): void {
  checkboxNamed(root, name).click();
  TestBed.inject(ApplicationRef).tick();
}

function clickButton(root: HTMLElement, text: string): void {
  const button = Array.from(root.querySelectorAll('button')).find(
    (element) => element.textContent?.trim() === text,
  );
  if (!button) {
    throw new Error(`No button "${text}"`);
  }
  button.dispatchEvent(new Event('click'));
}

function searchBox(root: HTMLElement): HTMLInputElement {
  return root.querySelector('input[type="search"]') as HTMLInputElement;
}

function typeInSearch(root: HTMLElement, query: string): void {
  searchBox(root).value = query;
  searchBox(root).dispatchEvent(new Event('input'));
  TestBed.inject(ApplicationRef).tick();
}

function pressEnter(root: HTMLElement): void {
  searchBox(root).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  TestBed.inject(ApplicationRef).tick();
}

describe('CheckboxFilterDialog', () => {
  it('titles itself after the column', () => {
    const { root } = setUp({
      fieldLabel: 'برند',
      options: plain('لگراند', 'نگزنس'),
      selectedValues: ['لگراند'],
    });

    expect(root.querySelector('h2')?.textContent?.trim()).toBe('فیلتر برند');
  });

  it('opens an unfiltered field with nothing ticked, saying there is no restriction', () => {
    const { root } = setUp({
      fieldLabel: 'برند',
      options: plain('لگراند', 'نگزنس'),
      selectedValues: undefined,
    });

    expect(checkboxNamed(root, 'لگراند').checked).toBe(false);
    expect(checkboxNamed(root, 'نگزنس').checked).toBe(false);
    expect(root.textContent).toContain('بدون محدودیت — همه مقادیر');
  });

  it('opens with the values already chosen ticked, and says how many', () => {
    const { root } = setUp({
      fieldLabel: 'وضعیت تایید',
      options: [
        { value: 'pending', label: 'در انتظار تایید' },
        { value: 'approved', label: 'تایید' },
      ],
      selectedValues: ['pending'],
    });

    expect(checkboxNamed(root, 'در انتظار تایید').checked).toBe(true);
    expect(checkboxNamed(root, 'تایید').checked).toBe(false);
    expect(root.textContent).toContain('۱ مقدار انتخاب‌شده');
  });

  it('applies exactly the one value ticked on an unfiltered field', () => {
    const { root, close } = setUp({
      fieldLabel: 'برند',
      options: plain('لگراند', 'نگزنس', 'ایبیان'),
      selectedValues: undefined,
    });

    tick(root, 'نگزنس');
    clickButton(root, 'اعمال');

    expect(close).toHaveBeenCalledWith({ selected: ['نگزنس'] });
  });

  it('lifts the filter when applied with nothing ticked', () => {
    const { root, close } = setUp({
      fieldLabel: 'برند',
      options: plain('لگراند', 'نگزنس'),
      selectedValues: undefined,
    });

    clickButton(root, 'اعمال');

    expect(close).toHaveBeenCalledWith({ selected: undefined });
  });

  it('reads every value ticked as no filter', () => {
    const { root, close } = setUp({
      fieldLabel: 'برند',
      options: plain('لگراند', 'نگزنس'),
      selectedValues: ['لگراند'],
    });

    tick(root, 'نگزنس');
    clickButton(root, 'اعمال');

    expect(close).toHaveBeenCalledWith({ selected: undefined });
  });

  it('keeps a selection the visitor emptied on purpose as "match nothing"', () => {
    const { root, close } = setUp({
      fieldLabel: 'برند',
      options: plain('لگراند', 'نگزنس'),
      selectedValues: undefined,
    });

    tick(root, 'انتخاب همه');
    tick(root, 'انتخاب همه');
    clickButton(root, 'اعمال');

    expect(close).toHaveBeenCalledWith({ selected: [] });
  });

  it('applies values chosen across separate searches, in the options’ order', () => {
    const { root, close } = setUp({
      fieldLabel: 'شماره سفارش',
      options: plain('ORD-5258', 'ORD-5259', 'ORD-1001'),
      selectedValues: undefined,
    });

    typeInSearch(root, '۱۰۰۱');
    pressEnter(root);
    typeInSearch(root, '۵۲۵۸');
    pressEnter(root);
    pressEnter(root);

    expect(close).toHaveBeenCalledWith({ selected: ['ORD-5258', 'ORD-1001'] });
  });

  it('lifts the filter outright with «حذف محدودیت», whatever was chosen', () => {
    const { close, root } = setUp({
      fieldLabel: 'برند',
      options: plain('لگراند', 'نگزنس'),
      selectedValues: ['لگراند'],
    });

    clickButton(root, 'حذف محدودیت');

    expect(close).toHaveBeenCalledWith({ selected: undefined });
  });

  it('closes with a falsy (non-applied) result on «انصراف»', () => {
    const { root, close } = setUp({
      fieldLabel: 'برند',
      options: plain('لگراند', 'نگزنس'),
      selectedValues: undefined,
    });

    clickButton(root, 'انصراف');

    expect(close).toHaveBeenCalledWith('');
  });

  it('shows each value by its label but hands back the value itself, of any type', () => {
    const { root, close } = setUp<boolean>({
      fieldLabel: 'فعال',
      options: [
        { value: true, label: 'بله' },
        { value: false, label: 'خیر' },
      ],
      selectedValues: undefined,
    });

    tick(root, 'خیر');
    clickButton(root, 'اعمال');

    expect(close).toHaveBeenCalledWith({ selected: [false] });
  });
});
