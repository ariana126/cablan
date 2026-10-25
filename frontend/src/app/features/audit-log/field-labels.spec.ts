import { describe, expect, it } from 'vitest';

import { fieldLabel, fieldValue } from './field-labels';

describe('fieldLabel', () => {
  it('translates a known technical field key to its Persian label', () => {
    expect(fieldLabel('standardLength')).toBe('متراژ استاندارد');
  });

  it("translates a material's code key", () => {
    expect(fieldLabel('code')).toBe('کد');
  });

  it("translates the product's name key with the BOM pages' own column label", () => {
    expect(fieldLabel('productName')).toBe('نام محصول');
  });

  it("translates a daily BOM's registeredBy key with the BOM page's own column label", () => {
    expect(fieldLabel('registeredBy')).toBe('کنترلگر');
  });

  it('translates a composition line key with the word the app uses for a component', () => {
    expect(fieldLabel('component')).toBe('جز');
  });

  it.each([
    ['approvalStatus', 'وضعیت تایید'],
    ['reviewedBy', 'تایید/رد کننده'],
    ['managementNote', 'توضیحات مدیریت'],
    // The reviewer's key before it was renamed — older entries still carry it.
    ['approvedBy', 'تایید/رد کننده'],
  ])(
    "translates a daily BOM's review key '%s' with the dashboard's own column label",
    (field, label) => {
      expect(fieldLabel(field)).toBe(label);
    },
  );

  it("names a daily BOM's material-weight line by its component and material", () => {
    expect(fieldLabel('materialWeight:مغزی:مسی')).toBe('وزن جز مغزی مواد اولیه مسی');
  });

  it('keeps a colon inside a material name rather than splitting on it', () => {
    expect(fieldLabel('materialWeight:روکش:PVC:A')).toBe('وزن جز روکش مواد اولیه PVC:A');
  });

  it('falls back to the raw key for a field it has no translation for', () => {
    expect(fieldLabel('someFutureField')).toBe('someFutureField');
  });
});

describe('fieldValue', () => {
  it.each([
    ['system_admin', 'مدیر سیستم'],
    ['management', 'مدیریت'],
    ['qc_inspector', 'بازرس کنترل کیفیت'],
    ['reporter', 'گزارشگیر'],
  ])("translates the role value '%s' with the users page's own role label", (value, label) => {
    expect(fieldValue('role', value)).toBe(label);
  });

  it.each([
    ['true', 'بله'],
    ['false', 'خیر'],
  ])("translates the active value '%s' with the standard BOMs page's own label", (value, label) => {
    expect(fieldValue('active', value)).toBe(label);
  });

  it('falls back to the raw value for a role it has no translation for', () => {
    expect(fieldValue('role', 'auditor')).toBe('auditor');
  });

  it('leaves the value of a field with no value vocabulary untouched', () => {
    expect(fieldValue('brand', 'true')).toBe('true');
  });

  it('shows an empty side as the empty placeholder, whatever the field', () => {
    expect(fieldValue('role', '')).toBe('—');
    expect(fieldValue('active', '')).toBe('—');
    expect(fieldValue('brand', '')).toBe('—');
  });

  it.each([
    ['pending', 'در انتظار تایید'],
    ['approved', 'تایید'],
    ['rejected', 'عدم تایید'],
    // Pending's stored value before it was renamed — older entries still carry it.
    ['unapproved', 'در انتظار تایید'],
  ])("translates the approval status '%s' in words", (value, label) => {
    expect(fieldValue('approvalStatus', value)).toBe(label);
  });

  it.each(['reviewedBy', 'approvedBy'])('shows the reviewer (%s) by name', (field) => {
    expect(fieldValue(field, 'مصطفی')).toBe('مصطفی');
  });

  it.each(['reviewedBy', 'approvedBy', 'managementNote'])(
    'shows a missing %s as a plain hyphen, the way every review column shows it',
    (field) => {
      expect(fieldValue(field, '')).toBe('-');
    },
  );

  it('shows a management note as written', () => {
    expect(fieldValue('managementNote', 'وزن مس خارج از محدوده است')).toBe(
      'وزن مس خارج از محدوده است',
    );
  });
});
