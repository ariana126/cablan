import { describe, expect, it } from 'vitest';

import { AppBomDashboardDailyBom } from '../../core/bom-dashboard/bom-dashboard-gateway';
import {
  approvalStatusOptions,
  approverOptions,
  filterDailyBoms,
  NO_APPROVER_VALUE,
} from './daily-bom-filters';

function dailyBom(orderNumber: string, approvedBy: string | null): AppBomDashboardDailyBom {
  return {
    id: orderNumber,
    orderNumber,
    registeredAt: '',
    registeredBy: '',
    description: '',
    standardBomMiCode: '1001',
    approvalStatus: approvedBy === null ? 'unapproved' : 'approved',
    approvedBy,
    lines: [],
  };
}

const approvedByMostafa = dailyBom('ORD-5001', 'مصطفی');
const unapproved = dailyBom('ORD-5002', null);
const approvedByYashar = dailyBom('ORD-5003', 'یاشار');
const all = [approvedByMostafa, unapproved, approvedByYashar];

const orderNumbers = (boms: AppBomDashboardDailyBom[]) => boms.map((bom) => bom.orderNumber);

describe('filterDailyBoms', () => {
  it('keeps every daily BOM, in order, while no filter is set', () => {
    expect(orderNumbers(filterDailyBoms(all, {}))).toEqual(['ORD-5001', 'ORD-5002', 'ORD-5003']);
  });

  it('keeps only the daily BOMs whose status was chosen', () => {
    expect(orderNumbers(filterDailyBoms(all, { approvalStatuses: ['approved'] }))).toEqual([
      'ORD-5001',
      'ORD-5003',
    ]);
    expect(orderNumbers(filterDailyBoms(all, { approvalStatuses: ['unapproved'] }))).toEqual([
      'ORD-5002',
    ]);
  });

  it('keeps only the chosen approvers, which leaves out the unapproved unless «no approver» is chosen', () => {
    expect(orderNumbers(filterDailyBoms(all, { approvers: ['مصطفی'] }))).toEqual(['ORD-5001']);
    expect(orderNumbers(filterDailyBoms(all, { approvers: ['مصطفی', NO_APPROVER_VALUE] }))).toEqual(
      ['ORD-5001', 'ORD-5002'],
    );
  });

  it('matches nothing when a filter has every value unchecked', () => {
    expect(filterDailyBoms(all, { approvalStatuses: [] })).toEqual([]);
  });

  it('combines the two filters', () => {
    expect(
      orderNumbers(filterDailyBoms(all, { approvalStatuses: ['approved'], approvers: ['یاشار'] })),
    ).toEqual(['ORD-5003']);
  });
});

describe('approvalStatusOptions', () => {
  it('offers the statuses the list holds, in words, approved first', () => {
    expect(approvalStatusOptions([unapproved, approvedByMostafa])).toEqual([
      { value: 'approved', label: 'تایید شده' },
      { value: 'unapproved', label: 'تایید نشده' },
    ]);
  });

  it('offers only a status some daily BOM has', () => {
    expect(approvalStatusOptions([unapproved])).toEqual([
      { value: 'unapproved', label: 'تایید نشده' },
    ]);
  });
});

describe('approverOptions', () => {
  it('offers each approver once, then «بدون تایید کننده» for the unapproved, as Excel offers blanks', () => {
    expect(
      approverOptions([approvedByYashar, unapproved, approvedByMostafa, approvedByMostafa]),
    ).toEqual([
      { value: 'مصطفی', label: 'مصطفی' },
      { value: 'یاشار', label: 'یاشار' },
      { value: NO_APPROVER_VALUE, label: 'بدون تایید کننده' },
    ]);
  });

  it('offers no blank when every daily BOM has an approver', () => {
    expect(approverOptions([approvedByMostafa])).toEqual([{ value: 'مصطفی', label: 'مصطفی' }]);
  });
});
