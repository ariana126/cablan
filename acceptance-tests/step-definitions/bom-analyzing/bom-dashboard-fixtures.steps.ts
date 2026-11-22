import { Given, DataTable } from '@cucumber/cucumber';
import {
  DashboardStandardBom,
  registerDailyBomDashboardFixturesOnly,
  registerStandardAndDailyBomsWithWeights,
  registerStandardBomDashboardFixturesOnly,
} from '../../screenplay/bom-analyzing/bom-dashboard-fixtures';
import { correctStandardBomAsAPrecondition } from '../../screenplay/bom-registration/standard-bom-correction';
import { setCurrentDailyBomList } from '../../screenplay/common/daily-bom-list-context';
import { keepingTheSpotlight } from '../../screenplay/common/spotlight';
import { renewTheSessionInTheSpotlight } from '../../screenplay/common/personas';

/**
 * The two-table background of `bom-dashboard.feature`:
 * - "اینکه آنالیز های استاندارد زیر با وزن استاندارد مواد اولیه شان در سیستم ثبت شده باشند" — the
 *   per-MI-code standard BOM registration, with the per-material standard weight from the table.
 * - "و آنالیز های روزانه زیر با اجزا و مواد اولیه شان در سیستم ثبت شده باشند" — the daily BOMs
 *   cloned from the standard BOMs just registered, with the per-material actual weight from the
 *   table.
 *
 * The standard-BOM `Given` performs its half of the registration immediately and stashes the
 * (MI code → standard BOM) map in module state; the daily-BOM `Given` (the "و" continuation
 * in the Gherkin) consumes that map to register its daily BOMs against the right standard BOM
 * ids. Module state is the same way `screenplay/bom-registration/bom-details.ts` and
 * `bom-reporting/bom-report-fixtures.ts` already track "the last registered X" between steps.
 */
Given(
  'اینکه آنالیز های استاندارد زیر با وزن استاندارد مواد اولیه شان در سیستم ثبت شده باشند:',
  async (table: DataTable) => {
    pendingStandardBomsByMiCode =
      await registerStandardBomDashboardFixturesOnly(table);
  },
);

let pendingStandardBomsByMiCode: Map<string, DashboardStandardBom> | undefined;

Given(
  'آنالیز های روزانه زیر با اجزا و مواد اولیه شان در سیستم ثبت شده باشند:',
  async (table: DataTable) => {
    if (!pendingStandardBomsByMiCode) {
      throw new Error(
        'Expected the standard-BOM background to have been declared before the daily-BOM ' +
          'background, but the former was not.',
      );
    }
    // The order-number list questions this feature shares with reporting-bom.feature read the
    // dashboard's panel, not the report list — see `daily-bom-list-context.ts`.
    setCurrentDailyBomList('dashboard');
    await registerDailyBomDashboardFixturesOnly(
      table,
      pendingStandardBomsByMiCode,
    );
    pendingStandardBomsByMiCode = undefined;
  },
);

/**
 * The score rule's own `Given` (MI 2001) — a single product + a single standard BOM with the table's own
 * per-material standard weights + a single daily BOM on the same product with the table's own
 * per-material actual weights. The product is a fresh one named "محصول تست {MI code}", distinct
 * from the feature-wide background's; the following `When`/`Then` find it as the last registered
 * product. The two rows of the table are the standard BOM's two material lines; the
 * daily BOM's per-material weights are the table's fifth column.
 */
/**
 * These fixtures freeze the clock at «امروز» 09:00 — a day after the background's last daily BOM —
 * which expires every API session issued before the jump, the viewer's included (logged in at the
 * end of the background). They register as یاشار and نیکروش, so they keep the spotlight on the
 * viewer and then renew the viewer's session, as every other forward clock move does
 * (`acceptance-tests/CLAUDE.md`, "A forward jump expires every API session issued before it").
 * The viewer used to be نیکروش, whom the fixtures log in afresh themselves, which hid this.
 */
const standardAndDailyBomsWithWeightsAreRegistered = async (
  table: DataTable,
): Promise<void> => {
  await keepingTheSpotlight(() =>
    registerStandardAndDailyBomsWithWeights(table),
  );
  await renewTheSessionInTheSpotlight();
};

Given(
  'اینکه آنالیز استاندارد و آنالیز روزانه زیر با وزن مواد اولیه شان در سیستم ثبت شده باشند:',
  standardAndDailyBomsWithWeightsAreRegistered,
);

/**
 * The plural form (issue #126): one standard BOM and one daily BOM per MI code, the table naming
 * the product — the background's, so the standard BOM clones only the lines its rows name — and
 * each daily BOM's order number.
 */
Given(
  'اینکه آنالیز های استاندارد و آنالیز های روزانه زیر با وزن مواد اولیه شان در سیستم ثبت شده باشند:',
  standardAndDailyBomsWithWeightsAreRegistered,
);

// قانون: اختلاف وزن و امتیاز هر آنالیز روزانه با آخرین وزن های استاندارد همان آنالیز استانداردی که
// بر اساس آن ثبت شده محاسبه می شود (issue #126) — the corrections only need to have happened, so
// they go over HTTP as the persona named (`PATCH standard-boms/:id`, the composition sent back with
// the new weights). The `When`s and `Then`s are the dashboard's existing ones.

Given(
  '{actorName} وزن استاندارد مواد اولیه {string} جز {string} آنالیز استاندارد {string} را به {string} اصلاح کرده باشد',
  (
    personaName: string,
    materialName: string,
    componentName: string,
    miCode: string,
    weight: string,
  ) =>
    correctStandardBomAsAPrecondition(personaName, miCode, {
      weights: [{ componentName, materialName, weight: Number(weight) }],
    }),
);

Given(
  'اینکه {actorName} وزن های استاندارد آنالیز استاندارد {string} را به صورت زیر اصلاح کرده باشد:',
  (personaName: string, miCode: string, table: DataTable) =>
    correctStandardBomAsAPrecondition(personaName, miCode, {
      weights: table.hashes().map((row) => ({
        componentName: row['نام جز'],
        materialName: row['نام مواد اولیه'],
        weight: Number(row['وزن استاندارد مواد اولیه']),
      })),
    }),
);
