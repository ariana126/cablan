import { formatPersianNumber } from '../i18n/persian-numerals';
import { DependentsProblem, PROBLEM, toProblemDetails } from './problem-details';

/** The kinds of referencing record the API names, in the order it lists them. */
export type DependentKind =
  'product' | 'standard-bom' | 'daily-bom' | 'resampled-daily-bom' | 'equipment-pm-plan';

/** One entry of a `record-has-dependents` refusal, as the API sends it. */
export interface RecordDependents {
  readonly kind: DependentKind;
  readonly count: number;
  readonly names: readonly string[];
}

/** What the visitor asked for and was refused. */
export type RefusedChange = 'edit' | 'delete';

const VERBS: Readonly<Record<RefusedChange, string>> = { edit: 'ویرایش', delete: 'حذف' };

/** A re-sampling is a fact about the record itself, not a place it is used in, so it is its own
 * clause and carries no count. */
const RESAMPLED_CLAUSE = 'از این آنالیز روزانه نمونه گیری مجدد شده است';

/** How each counted kind reads, given its count already in Persian digits. */
const COUNTED_PHRASES: Readonly<
  Record<Exclude<DependentKind, 'resampled-daily-bom'>, (count: string) => string>
> = {
  product: (count) => `${count} محصول`,
  'standard-bom': (count) => `${count} آنالیز استاندارد`,
  'daily-bom': (count) => `${count} آنالیز روزانه`,
  'equipment-pm-plan': (count) => `برنامه PM ${count} تجهیز`,
};

/**
 * Words a 409 `record-has-dependents` refusal (issue #94) as the Persian sentence every edit and
 * delete surface shows: why it was refused and where the record is used — «امکان حذف این اطلاعات
 * وجود ندارد، زیرا در ۱ محصول («کابل NYY») استفاده شده است.» Answers `undefined` for anything else,
 * so a feature's `server-errors.ts` keeps its own message for the rest.
 *
 * Built from `dependents` only — never the API's English `detail`. Counts are quantities (Persian
 * digits); names are shown as the API sends them, since MI codes and order numbers are identifiers
 * and keep Latin digits. A kind this client does not know yet is skipped rather than guessed at.
 */
export function recordHasDependentsMessage(
  error: unknown,
  change: RefusedChange,
): string | undefined {
  const reason = dependentsReason(error);
  return reason === undefined
    ? undefined
    : `امکان ${VERBS[change]} این اطلاعات وجود ندارد، زیرا ${reason}.`;
}

/**
 * The System Admin's side of the same 409 (issue #110): the confirmation that a correction of a
 * record in use goes everywhere it is used — «این اطلاعات در ۱ محصول («کابل NYY») استفاده شده است. با
 * تایید، این تغییر در همهٔ اطلاعات و سوابق مرتبط هم اعمال می‌شود.» Same words for where, from the same
 * `dependents`; `undefined` for anything else.
 */
export function correctionConfirmationMessage(error: unknown): string | undefined {
  const reason = dependentsReason(error);
  return reason === undefined
    ? undefined
    : `این اطلاعات ${reason}. با تایید، این تغییر در همهٔ اطلاعات و سوابق مرتبط هم اعمال می‌شود.`;
}

/** «در ۱ محصول («کابل NYY») استفاده شده است» — where a `record-has-dependents` refusal says the
 * record is used, or `undefined` when the error is not one. */
function dependentsReason(error: unknown): string | undefined {
  const problem = toProblemDetails(error);
  if (problem?.type !== PROBLEM.recordHasDependents) {
    return undefined;
  }

  const dependents = problem.dependents ?? [];
  const usedIn = dependents.flatMap(countedPhrase);
  const resampled = dependents.some((entry) => entry.kind === 'resampled-daily-bom');

  const clauses = [
    ...(usedIn.length > 0 ? [`در ${usedIn.join(' و ')} استفاده شده است`] : []),
    ...(resampled ? [RESAMPLED_CLAUSE] : []),
  ];
  return clauses.length > 0 ? clauses.join(' و ') : 'در اطلاعات دیگری استفاده شده است';
}

function countedPhrase(entry: DependentsProblem): string[] {
  const phrase = isCountedKind(entry.kind) ? COUNTED_PHRASES[entry.kind] : undefined;
  if (phrase === undefined) {
    return [];
  }
  const names = entry.names ?? [];
  const counted = phrase(formatPersianNumber(entry.count ?? names.length));
  return [names.length > 0 ? `${counted} («${names.join('، ')}»)` : counted];
}

function isCountedKind(kind: string | undefined): kind is keyof typeof COUNTED_PHRASES {
  return kind !== undefined && Object.hasOwn(COUNTED_PHRASES, kind);
}
