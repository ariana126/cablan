import { BomEditRecord } from './bom-edit-record.vo';
import { PendingReviewEdits } from './pending-review-edits.vo';

// 1403/06/15 10:00 and 11:30 in Tehran (UTC+03:30).
const AT_TEN = new Date('2024-09-05T06:30:00.000Z');
const AT_HALF_PAST_ELEVEN = new Date('2024-09-05T08:00:00.000Z');

const FIRST_EDIT = BomEditRecord.of('مصطفی', AT_TEN, 'خطای ترازو', [
  'وزن جز مغزی مواد اولیه مسی از 3 به 2 تغییر کرد',
]);
const SECOND_EDIT = BomEditRecord.of('یاشار', AT_HALF_PAST_ELEVEN, 'اصلاح', [
  'شماره سفارش از ORD-1 به ORD-2 تغییر کرد',
  'وزن جز مغزی مواد اولیه مسی از 2 به 1 تغییر کرد',
]);

describe('PendingReviewEdits', () => {
  it('no review edits make no management note', () => {
    const sut = PendingReviewEdits.none();

    expect(sut.asManagementNote()).toBeNull();
  });

  it('a review edit is noted as its heading, then its change lines', () => {
    const sut = PendingReviewEdits.none();

    const note = sut.withEdit(FIRST_EDIT).asManagementNote();

    expect(note).toBe(
      [
        'کاربر مصطفی در 1403/06/15 ساعت 10:00 به علت خطای ترازو تغییرات زیر را انجام داد',
        'وزن جز مغزی مواد اولیه مسی از 3 به 2 تغییر کرد',
      ].join('\n'),
    );
  });

  it('each review edit is noted as its own block, in the order they were made, never merged', () => {
    const sut = PendingReviewEdits.none().withEdit(FIRST_EDIT);

    const note = sut.withEdit(SECOND_EDIT).asManagementNote();

    expect(note).toBe(
      [
        'کاربر مصطفی در 1403/06/15 ساعت 10:00 به علت خطای ترازو تغییرات زیر را انجام داد',
        'وزن جز مغزی مواد اولیه مسی از 3 به 2 تغییر کرد',
        'کاربر یاشار در 1403/06/15 ساعت 11:30 به علت اصلاح تغییرات زیر را انجام داد',
        'شماره سفارش از ORD-1 به ORD-2 تغییر کرد',
        'وزن جز مغزی مواد اولیه مسی از 2 به 1 تغییر کرد',
      ].join('\n'),
    );
  });

  it('restored review edits read back as they were stored', () => {
    const sut = PendingReviewEdits.restore([FIRST_EDIT, SECOND_EDIT]);

    expect(sut.edits()).toEqual([FIRST_EDIT, SECOND_EDIT]);
  });
});
