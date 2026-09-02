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

    expect(intl.getRangeLabel(0, 20, 87)).toBe('۱ تا ۲۰ از ۸۷');
    expect(intl.getRangeLabel(4, 20, 87)).toBe('۸۱ تا ۸۷ از ۸۷');
  });

  it('never groups a position — these are places in a list, not quantities', () => {
    const intl = new PersianPaginatorIntl();

    // "۱٬۰۰۱ تا ۱٬۰۲۰ از ۵٬۰۰۰" reads as arithmetic rather than as a position in a report.
    expect(intl.getRangeLabel(50, 20, 5000)).toBe('۱۰۰۱ تا ۱۰۲۰ از ۵۰۰۰');
  });

  it('renders a zero range when there is nothing to show', () => {
    const intl = new PersianPaginatorIntl();

    expect(intl.getRangeLabel(0, 20, 0)).toBe('۰ از ۰');
  });
});
