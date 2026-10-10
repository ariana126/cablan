import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';

import { AuditLogFilterDialog, AuditLogFilterDialogData } from './audit-log-filter-dialog';

const OPTIONS = [
  { value: 'Registered', label: 'ثبت' },
  { value: 'Edited', label: 'ویرایش' },
  { value: 'Deleted', label: 'حذف' },
];

function setUp(data: AuditLogFilterDialogData) {
  const close = vi.fn();

  TestBed.configureTestingModule({
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close } },
    ],
  });

  const fixture = TestBed.createComponent(AuditLogFilterDialog);
  TestBed.inject(ApplicationRef).tick();

  return { close, root: fixture.nativeElement as HTMLElement };
}

function checkboxNamed(root: HTMLElement, name: string): HTMLInputElement {
  const label = Array.from(root.querySelectorAll('mat-checkbox')).find(
    (element) => element.textContent?.trim() === name,
  );
  const input = label?.querySelector('input[type="checkbox"]');
  if (!input) {
    throw new Error(`No checkbox found for "${name}"`);
  }
  return input as HTMLInputElement;
}

function clickButton(root: HTMLElement, text: string): void {
  Array.from(root.querySelectorAll('button'))
    .find((element) => element.textContent?.trim() === text)
    ?.dispatchEvent(new Event('click'));
}

describe('AuditLogFilterDialog', () => {
  it('shows each option by its Persian label, all checked when nothing is filtered yet', () => {
    const { root } = setUp({
      fieldLabel: 'نوع رویداد',
      options: OPTIONS,
      selectedValues: undefined,
    });

    expect(root.querySelector('h2')?.textContent).toContain('نوع رویداد');
    for (const name of ['ثبت', 'ویرایش', 'حذف', 'انتخاب همه']) {
      expect(checkboxNamed(root, name).checked).toBe(true);
    }
  });

  it('reflects an earlier selection', () => {
    const { root } = setUp({
      fieldLabel: 'نوع رویداد',
      options: OPTIONS,
      selectedValues: ['Edited'],
    });

    expect(checkboxNamed(root, 'ویرایش').checked).toBe(true);
    expect(checkboxNamed(root, 'ثبت').checked).toBe(false);
  });

  it('closes with the backend values of the checked options', () => {
    const { close, root } = setUp({
      fieldLabel: 'نوع رویداد',
      options: OPTIONS,
      selectedValues: undefined,
    });

    checkboxNamed(root, 'ثبت').click();
    clickButton(root, 'اعمال فیلتر');

    expect(close).toHaveBeenCalledWith({ selected: ['Edited', 'Deleted'] });
  });

  it('closes with an absent selection when every option ends up checked', () => {
    const { close, root } = setUp({
      fieldLabel: 'نوع رویداد',
      options: OPTIONS,
      selectedValues: ['Edited'],
    });

    checkboxNamed(root, 'انتخاب همه').click();
    clickButton(root, 'اعمال فیلتر');

    expect(close).toHaveBeenCalledWith({ selected: undefined });
  });

  it('closes with an empty selection when nothing is checked', () => {
    const { close, root } = setUp({
      fieldLabel: 'نوع رویداد',
      options: OPTIONS,
      selectedValues: undefined,
    });

    checkboxNamed(root, 'انتخاب همه').click();
    clickButton(root, 'اعمال فیلتر');

    expect(close).toHaveBeenCalledWith({ selected: [] });
  });
});
