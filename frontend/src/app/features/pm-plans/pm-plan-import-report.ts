import { AppPmPlanImportDifference } from '../../core/maintenance/pm-plan-import-gateway';
import { formatPersianNumber } from '../../core/i18n/persian-numerals';

/** The check's headline: how many plan rows confirming would add — «۲ برنامه قابل ثبت است». */
export const addableLine = (count: number): string =>
  `${formatPersianNumber(count)} برنامه قابل ثبت است`;

/** The import's headline: how many plan rows it added — «۲ برنامه ثبت شد.». */
export const addedLine = (count: number): string => `${formatPersianNumber(count)} برنامه ثبت شد.`;

const DIFFERENCE_LABELS: Readonly<Record<AppPmPlanImportDifference, string>> = {
  intervalDays: 'دوره',
  firstDueDate: 'اولین موعد',
};

/** The order the «اختلاف» cell names them in, whatever order they came in. */
const DIFFERENCE_ORDER: readonly AppPmPlanImportDifference[] = ['intervalDays', 'firstDueDate'];

/** A conflict's «اختلاف» cell: «دوره», «اولین موعد» or «دوره و اولین موعد». */
export const differenceLabel = (differences: readonly AppPmPlanImportDifference[]): string =>
  DIFFERENCE_ORDER.filter((difference) => differences.includes(difference))
    .map((difference) => DIFFERENCE_LABELS[difference])
    .join(' و ');

/** An error's «مقدار» cell: the file's own text, verbatim — or «—» for an empty cell. */
export const cellValue = (value: string): string => (value.trim() === '' ? '—' : value);
