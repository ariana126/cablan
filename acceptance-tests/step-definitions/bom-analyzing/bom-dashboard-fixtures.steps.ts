import { Given, DataTable } from '@cucumber/cucumber';
import { actorCalled } from '@serenity-js/core';
import { LogInAsPersona } from '../../screenplay/common/personas';
import { FreezeTimeAt } from '../../screenplay/common/clock';
import { parseJalaliDateTime } from '../../screenplay/common/jalali-datetime';
import {
  freshProductDetails,
  theLastRegisteredProduct,
} from '../../screenplay/bom-registration/product-details';
import { RegisterProductAndRememberIt } from '../../screenplay/bom-registration/register-product';
import { RegisterStandardBomAndRememberIt } from '../../screenplay/bom-registration/register-standard-bom';
import { theLastRegisteredStandardBom } from '../../screenplay/bom-registration/standard-bom-details';
import { RegisterBomAndRememberIt } from '../../screenplay/bom-registration/register-bom';
import {
  registerDailyBomDashboardFixturesOnly,
  registerStandardBomDashboardFixturesOnly,
} from '../../screenplay/bom-analyzing/bom-dashboard-fixtures';

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

let pendingStandardBomsByMiCode:
  Map<string, { id: string; miCode: string }> | undefined;

Given(
  'آنالیز های روزانه زیر با اجزا و مواد اولیه شان در سیستم ثبت شده باشند:',
  async (table: DataTable) => {
    if (!pendingStandardBomsByMiCode) {
      throw new Error(
        'Expected the standard-BOM background to have been declared before the daily-BOM ' +
          'background, but the former was not.',
      );
    }
    await registerDailyBomDashboardFixturesOnly(
      table,
      pendingStandardBomsByMiCode,
    );
    pendingStandardBomsByMiCode = undefined;
  },
);

/**
 * The score-visibility rule's own `Given` — a single product + a single standard BOM with the
 * table's own per-material standard weights + a single daily BOM on the same product with the
 * table's own per-material actual weights. The MI code is `2001` and the product is named
 * "محصول تست 2001" — a fresh one — distinct from the feature-wide background above, since the
 * MI code is also distinct (and the dashboard's product list would otherwise see it as just
 * another product). The two rows of the table are the standard BOM's two material lines; the
 * daily BOM's per-material weights are the table's fifth column.
 */
Given(
  'اینکه آنالیز استاندارد و آنالیز روزانه زیر با وزن مواد اولیه شان در سیستم ثبت شده باشند:',
  async (table: DataTable) => {
    const rows = table.hashes();
    const miCode = rows[0]['کد MI'];

    const admin = actorCalled('یاشار');
    await admin.attemptsTo(LogInAsPersona('یاشار'));
    await admin.attemptsTo(
      RegisterProductAndRememberIt(
        freshProductDetails({
          name: `محصول تست ${miCode}`,
          components: rows.map((row) => ({
            name: row['نام جز'],
            materials: [{ name: row['نام مواد اولیه'] }],
          })),
        }),
      ),
    );
    const product = theLastRegisteredProduct();

    await admin.attemptsTo(
      RegisterStandardBomAndRememberIt(
        product,
        {
          miCode,
          brand: `برند تست ${miCode}`,
          standardLength: '305',
        },
        (composition) =>
          composition.map((component) => ({
            ...component,
            materials: component.materials.map((material) => {
              const row = rows.find(
                (r) =>
                  r['نام جز'] === component.componentName &&
                  r['نام مواد اولیه'] === material.materialName,
              );
              if (!row) {
                throw new Error(
                  `No standard weight for ${component.componentName} / ${material.materialName}.`,
                );
              }
              return {
                ...material,
                weightInGrams: Number(row['وزن استاندارد مواد اولیه']),
              };
            }),
          })),
      ),
    );
    const standardBom = theLastRegisteredStandardBom();

    const controller = actorCalled('نیکروش');
    await controller.attemptsTo(
      FreezeTimeAt(parseJalaliDateTime('1403/06/15 09:00')),
    );
    await controller.attemptsTo(LogInAsPersona('نیکروش'));

    await controller.attemptsTo(
      RegisterBomAndRememberIt(
        standardBom,
        {
          orderNumber: `ORD-${miCode}`,
          trackingNumber: `TRK-${miCode}`,
        },
        (componentName, materialName) => {
          const row = rows.find(
            (r) =>
              r['نام جز'] === componentName &&
              r['نام مواد اولیه'] === materialName,
          );
          if (!row) {
            throw new Error(
              `No actual weight for ${componentName} / ${materialName}.`,
            );
          }
          return Number(row['وزن مواد اولیه آنالیز روزانه']);
        },
      ),
    );
  },
);
