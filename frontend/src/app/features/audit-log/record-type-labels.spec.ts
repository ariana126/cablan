import { describe, expect, it } from 'vitest';

import { RECORD_TYPE_LABELS } from './record-type-labels';

describe('RECORD_TYPE_LABELS', () => {
  it.each([
    ['User', 'کاربر'],
    ['Product', 'محصول'],
    ['Component', 'جز'],
    ['Material', 'مواد اولیه'],
    ['StandardBom', 'آنالیز استاندارد'],
    ['Bom', 'آنالیز روزانه'],
    ['MaterialImport', 'بارگذاری گروهی'],
  ] as const)("names the '%s' record type in Persian", (recordType, label) => {
    expect(RECORD_TYPE_LABELS[recordType]).toBe(label);
  });
});
