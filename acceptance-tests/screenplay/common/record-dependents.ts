import {
  AnswersQuestions,
  d,
  Expectation,
  Question,
  QuestionAdapter,
  Task,
  UsesAbilities,
  Wait,
} from '@serenity-js/core';
import {
  and,
  contain,
  containAtLeastOneItemThat,
  Ensure,
  equals,
  includes,
  property,
} from '@serenity-js/assertions';
import { LastResponse } from '@serenity-js/rest';
import { Text } from '@serenity-js/web';
import { OpenDialog } from '../ui/dialog-alert';
import { EnsureProblemDetail } from './problem-detail';
import { withLatinDigits } from './persian-digits';
import { lastRefusalDoor } from './refusal-door-context';

/**
 * Issue #94's one rule, as this suite observes it: a record that another record directly
 * references can be neither edited nor deleted, and the refusal says where it is used. Over HTTP
 * that is a 409 `record-has-dependents` problem whose `dependents` lists each kind of referencing
 * record with a count and names; in the browser it is a Persian sentence built from the same list
 * in the dialog's alert.
 */

export type DependentKind =
  | 'product'
  | 'standard-bom'
  | 'daily-bom'
  | 'resampled-daily-bom'
  | 'equipment-pm-plan'
  /** Issue #101: a standard BOM whose MI code an order holds; named by order number. ASSUMPTION:
   * the dialog's alert words it «… در ۱ سفارش («ORD-5001») …», like the other kinds. */
  | 'order';

export interface Dependents {
  kind: DependentKind;
  count: number;
  names: string[];
}

interface RecordHasDependentsProblem {
  recordType: string;
  dependents: Dependents[];
}

/** What a step says the visitor was told: the kind, and — where the Gherkin states them — the
 * count and one name. */
export interface ExpectedDependents {
  kind: DependentKind;
  count?: number;
  name?: string;
}

/**
 * How the message names each kind (the design's UI scope). The re-sampled kind is a whole clause
 * rather than a noun, since it states the fact without a count.
 */
const PERSIAN_LABELS: Record<DependentKind, string> = {
  product: 'محصول',
  'standard-bom': 'آنالیز استاندارد',
  'daily-bom': 'آنالیز روزانه',
  'resampled-daily-bom': 'از این آنالیز روزانه نمونه گیری مجدد شده است',
  'equipment-pm-plan': 'برنامه PM',
  order: 'سفارش',
};

const TheDependentsInTheResponse = (): QuestionAdapter<Dependents[]> =>
  Question.about('the dependents the refusal lists', async (actor) => {
    const body = await actor.answer(
      LastResponse.body<RecordHasDependentsProblem>(),
    );
    return body.dependents ?? [];
  });

const describing = (expected: ExpectedDependents): Expectation<Dependents> => {
  const expectations: Expectation<Dependents>[] = [
    property('kind', equals(expected.kind)),
  ];
  if (expected.count !== undefined) {
    expectations.push(property('count', equals(expected.count)));
  }
  if (expected.name !== undefined) {
    expectations.push(property('names', contain(expected.name)));
  }
  return and(...(expectations as [Expectation<Dependents>]));
};

/**
 * The alert of the open dialog as the visitor reads it, made comparable with a Gherkin literal:
 * digits Latin (the frontend may render a count in Persian ones), every run of whitespace — ZWNJ
 * included — one space.
 */
const TheMessageInTheOpenDialog = (): QuestionAdapter<string> =>
  Question.about(
    "the message in the open dialog's alert",
    async (actor: AnswersQuestions & UsesAbilities) =>
      asComparableText(await actor.answer(Text.of(OpenDialog.alert()))),
  );

const asComparableText = (text: string): string =>
  withLatinDigits(text)
    .replace(/[\s‌]+/g, ' ')
    .trim();

/** The pieces of the message a step's expectation pins: «<count> <label>» (or the label alone), and
 * the name. Order and punctuation around them are the frontend's to choose. */
const fragmentsOf = (expected: ExpectedDependents): string[] => {
  const label = PERSIAN_LABELS[expected.kind];
  return [
    expected.count === undefined
      ? label
      : expected.kind === 'equipment-pm-plan'
        ? `${label} ${expected.count} تجهیز`
        : `${expected.count} ${label}`,
    ...(expected.name === undefined ? [] : [expected.name]),
  ].map(asComparableText);
};

export const EnsureToldTheRecordHasDependents = {
  /** Over HTTP: the 409 envelope, then one `dependents` entry matching the expectation. Other kinds
   * may be listed too. */
  viaApi: (expected: ExpectedDependents): Task =>
    Task.where(
      d`#actor ensures they were told the record is used in ${expected}`,
      EnsureProblemDetail(409, 'record-has-dependents'),
      Ensure.that(
        TheDependentsInTheResponse(),
        containAtLeastOneItemThat(describing(expected)),
      ),
    ),

  /** In the browser: the still-open dialog's alert names the kind, the count and the name. */
  onThePage: (expected: ExpectedDependents): Task =>
    Task.where(
      d`#actor ensures the page told them the record is used in ${expected}`,
      Wait.until(
        TheMessageInTheOpenDialog(),
        and(
          ...(fragmentsOf(expected).map((fragment) => includes(fragment)) as [
            Expectation<string>,
          ]),
        ),
      ),
    ),
};

/** «به او گفته شود که … استفاده شده است» — read where the attempt was made
 * (`common/refusal-door-context.ts`). */
export const EnsureToldTheRecordIsUsedIn = (
  expected: ExpectedDependents,
): Task =>
  lastRefusalDoor() === 'browser'
    ? EnsureToldTheRecordHasDependents.onThePage(expected)
    : EnsureToldTheRecordHasDependents.viaApi(expected);
