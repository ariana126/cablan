import { Role } from '@framework/domain';

import { EditReasonRequired } from '../exceptions/edit-reason-required.exception';
import { BomEditContext } from './bom-edit-context.vo';
import { BomEditRecord } from './bom-edit-record.vo';
import { BomEditSource } from './bom-edit-source';
import { BomEditor } from './bom-editor.vo';

const AT = new Date('2024-09-05T06:30:00.000Z');
const CHANGES = ['شماره ردیابی از TN-1 به TN-2 تغییر کرد'];

const REASON = 'خطای ترازو';

function context(
  role: Role,
  source: BomEditSource,
  reason: string | undefined,
): BomEditContext {
  return BomEditContext.of(
    'نیکروش',
    BomEditor.withRole(role),
    source,
    reason,
    AT,
  );
}

// What `act` throws — `toThrow()` cannot take an exception class whose
// constructor is private.
function errorThrownBy(act: () => void): unknown {
  try {
    act();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('BomEditContext', () => {
  it.each([[Role.Management], [Role.SystemAdmin]])(
    'an edit from the dashboard by a %p reviewer is a review edit',
    (role) => {
      expect(
        context(role, BomEditSource.Dashboard, REASON).isReviewEdit(),
      ).toBe(true);
    },
  );

  it.each([[Role.Management], [Role.SystemAdmin], [Role.QcInspector]])(
    'an edit from the daily BOMs page by a %p user is a correction',
    (role) => {
      expect(
        context(role, BomEditSource.DailyBoms, REASON).isReviewEdit(),
      ).toBe(false);
    },
  );

  it('an edit from the dashboard by a non-reviewer is a correction, not refused', () => {
    expect(
      context(Role.QcInspector, BomEditSource.Dashboard, REASON).isReviewEdit(),
    ).toBe(false);
  });

  it('records the edit’s changes as made by the editor, at the edit’s time, for its reason', () => {
    const sut = context(Role.QcInspector, BomEditSource.DailyBoms, REASON);

    expect(sut.recordOf(CHANGES)).toEqual(
      BomEditRecord.of('نیکروش', AT, REASON, CHANGES),
    );
  });

  it('records the reason trimmed, with Persian and Arabic-Indic digits as English ones', () => {
    const sut = context(
      Role.QcInspector,
      BomEditSource.DailyBoms,
      '  وزن ۱۲ و ٣ اشتباه بود ',
    );

    expect(sut.recordOf(CHANGES).reason()).toBe('وزن 12 و 3 اشتباه بود');
  });

  it.each([[undefined], [''], [' '.repeat(3)]])(
    'an edit with no reason (%p) cannot be recorded',
    (reason) => {
      const sut = context(Role.QcInspector, BomEditSource.DailyBoms, reason);

      expect(errorThrownBy(() => sut.recordOf(CHANGES))).toBeInstanceOf(
        EditReasonRequired,
      );
    },
  );
});
