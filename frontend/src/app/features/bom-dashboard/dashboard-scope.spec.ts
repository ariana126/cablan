import { describe, expect, it } from 'vitest';

import { formatJalaliDateTime } from '../../core/date/jalali-datetime';
import { dashboardScope, reviewFeedback } from './dashboard-scope';

const NOTHING = {
  range: {},
  approvalFilters: {},
  statusesChosen: false,
  numberSearch: { orderNumber: '', trackingNumber: '' },
};

describe('dashboardScope', () => {
  it('says every date and status is shown when nothing narrows the dashboard', () => {
    expect(dashboardScope(NOTHING)).toEqual([
      { label: 'بازهٔ زمانی', value: 'همهٔ تاریخ‌ها' },
      { label: 'وضعیت تایید', value: 'همه' },
    ]);
  });

  it('calls out the untouched default as the default', () => {
    expect(
      dashboardScope({ ...NOTHING, approvalFilters: { approvalStatuses: ['pending'] } }),
    ).toEqual([
      { label: 'بازهٔ زمانی', value: 'همهٔ تاریخ‌ها' },
      { label: 'وضعیت تایید', value: 'فقط در انتظار تایید (پیش‌فرض)' },
    ]);
  });

  it('names statuses the visitor chose, the range, reviewers and number searches', () => {
    const from = '2026-11-01T00:00:00.000Z';
    const to = '2026-11-08T00:00:00.000Z';

    expect(
      dashboardScope({
        range: { from, to },
        approvalFilters: { approvalStatuses: ['approved', 'rejected'], reviewers: ['مصطفی', ''] },
        statusesChosen: true,
        numberSearch: { orderNumber: ' ORD-5 ', trackingNumber: '' },
      }),
    ).toEqual([
      {
        label: 'بازهٔ زمانی',
        value: `از ${formatJalaliDateTime(new Date(from))} تا ${formatJalaliDateTime(new Date(to))}`,
      },
      { label: 'وضعیت تایید', value: 'تایید، عدم تایید' },
      { label: 'تایید/رد کننده', value: 'مصطفی، بدون تایید/رد کننده' },
      { label: 'شماره سفارش', value: 'شامل «ORD-5»' },
    ]);
  });

  it('states a filter that matches nothing', () => {
    expect(
      dashboardScope({
        ...NOTHING,
        approvalFilters: { approvalStatuses: [] },
        statusesChosen: true,
      })[1],
    ).toEqual({ label: 'وضعیت تایید', value: 'هیچ‌کدام' });
  });
});

describe('reviewFeedback', () => {
  const bom = { orderNumber: 'ORD-1', trackingNumber: 'TRK-1' };

  it('names the analysis and its new status', () => {
    expect(reviewFeedback({ ...bom, kind: 'approved' }, {})).toBe(
      'آنالیز سفارش ORD-1 (شماره ردیابی TRK-1) تایید شد.',
    );
    expect(reviewFeedback({ ...bom, kind: 'rejected' }, {})).toBe(
      'آنالیز سفارش ORD-1 (شماره ردیابی TRK-1) عدم تایید شد.',
    );
  });

  it('says a weight correction leaves the analysis awaiting review', () => {
    expect(reviewFeedback({ ...bom, kind: 'weight-edited' }, {})).toBe(
      'وزن آنالیز سفارش ORD-1 (شماره ردیابی TRK-1) ذخیره شد؛ وضعیت آن «در انتظار تایید» است.',
    );
  });

  it('says when the new status takes the analysis out of the filtered list', () => {
    expect(reviewFeedback({ ...bom, kind: 'approved' }, { approvalStatuses: ['pending'] })).toBe(
      'آنالیز سفارش ORD-1 (شماره ردیابی TRK-1) تایید شد. با فیلتر فعلی «وضعیت تایید» دیگر در فهرست نیست.',
    );
  });

  it('says nothing about leaving when the filter still lets it through', () => {
    expect(
      reviewFeedback({ ...bom, kind: 'weight-edited' }, { approvalStatuses: ['pending'] }),
    ).not.toContain('دیگر در فهرست نیست');
  });

  it('confirms a description edit without naming a status', () => {
    expect(reviewFeedback({ ...bom, kind: 'description-edited' }, {})).toBe(
      'توضیحات آنالیز سفارش ORD-1 (شماره ردیابی TRK-1) ذخیره شد.',
    );
  });
});
