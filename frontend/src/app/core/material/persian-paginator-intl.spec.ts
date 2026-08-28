import { describe, expect, it } from 'vitest';

import { PersianPaginatorIntl } from './persian-paginator-intl';

describe('PersianPaginatorIntl', () => {
  it('translates every static label to Persian', () => {
    const intl = new PersianPaginatorIntl();

    expect(intl.itemsPerPageLabel).toBe('تعداد در هر صفحه:');
    expect(intl.nextPageLabel).toBe('صفحه بعد');
    expect(intl.previousPageLabel).toBe('صفحه قبل');
    expect(intl.firstPageLabel).toBe('صفحه اول');
    expect(intl.lastPageLabel).toBe('صفحه آخر');
  });

  it('renders the current range against the total count', () => {
    const intl = new PersianPaginatorIntl();

    // Latin digits, matching how every other numeric field in this app renders (order numbers, MI
    // codes, weights) — only the `not-found-page`'s decorative "۴۰۴" uses Persian numerals, and this
    // is a data count, not a hero display.
    expect(intl.getRangeLabel(0, 20, 87)).toBe('1 تا 20 از 87');
    expect(intl.getRangeLabel(4, 20, 87)).toBe('81 تا 87 از 87');
  });

  it('renders a zero range when there is nothing to show', () => {
    const intl = new PersianPaginatorIntl();

    expect(intl.getRangeLabel(0, 20, 0)).toBe('0 از 0');
  });
});
