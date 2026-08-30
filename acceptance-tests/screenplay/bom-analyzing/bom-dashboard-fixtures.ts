import { DataTable } from '@cucumber/cucumber';
import { actorCalled, notes } from '@serenity-js/core';
import { AuthNotes, LogIn } from '../common/login';
import { LogInAsPersona, PersonaCredentialsNotes } from '../common/personas';
import { FreezeTimeAt } from '../common/clock';
import { parseJalaliDateTime } from '../common/jalali-datetime';
import {
  freshProductDetails,
  RegisteredProduct,
  theLastRegisteredProduct,
} from '../bom-registration/product-details';
import { RegisterProductAndRememberIt } from '../bom-registration/register-product';
import { RegisterStandardBomAndRememberIt } from '../bom-registration/register-standard-bom';
import {
  NewComponentInStandardBom,
  theLastRegisteredStandardBom,
} from '../bom-registration/standard-bom-details';
import { RegisterBomAndRememberIt } from '../bom-registration/register-bom';

/**
 * Test-data setup for `bom-dashboard.feature`'s own background — two Gherkin tables: standard
 * BOMs (per-material standard weight) and the daily BOMs cloned from them. Mirrors
 * `screenplay/bom-reporting/bom-report-fixtures.ts` exactly:
 * - Standard BOM background registers a product (once per distinct name, with the UNION of every
 *   group's components/materials) and a standard BOM per group sharing that name — cloning only
 *   that group's own subset of the product's composition, since the same product can be reused
 *   with two different subsets across groups.
 * - Daily BOM background reuses the standard BOMs just registered, since the daily BOM's MI code
 *   is the linkage between the two tables.
 *
 * The freeze-the-clock-before-login dance (`screenplay/bom-reporting/bom-report-fixtures.ts`'s
 * own `for (const group of groups) { … await controller.attemptsTo(FreezeTimeAt(...)); … }` block
 * is what this file copies verbatim) is load-bearing here too: the dashboard background's daily
 * BOMs span 1403/06/14 and 1403/06/15 — two consecutive days in Jalali time, and JWT
 * `iat`/`exp` are stamped from the clock at LOGIN time
 * (`screenplay/common/clock.ts`'s own module comment), so logging in first and freezing afterwards
 * silently expires the token. The dispatch explicitly calls this out as the same pattern
 * `bom-report-fixtures.ts` already uses.
 *
 * The feature background's own `# ساعت فریز شده سیستم در زمان تست، "1403/06/15" است` comment
 * is the fixed clock the dashboard scenarios themselves start from — every product-panel
 * scenario's `OpenProductDailyBomList` hard-codes the "1403/06/15 00:00" to "1403/06/16 00:00"
 * range to match.
 */

const MI_CODE = 'کد MI';
const PRODUCT_NAME = 'نام محصول';
const COMPONENT_NAME = 'نام جز';
const MATERIAL_NAME = 'نام مواد اولیه';
const STANDARD_WEIGHT = 'وزن استاندارد مواد اولیه';

const ORDER_NUMBER = 'شماره سفارش';
const REGISTERED_AT = 'تاریخ و زمان ثبت';
const DESCRIPTION = 'توضیحات';
const WEIGHT = 'وزن مواد اولیه';

interface StandardBomBackgroundRow {
  miCode: string;
  productName: string;
  componentName: string;
  materialName: string;
  standardWeight: number;
}

interface DailyBomBackgroundRow {
  orderNumber: string;
  miCode: string;
  registeredAtText: string;
  description?: string;
  componentName: string;
  materialName: string;
  weight: number;
}

/** Every distinct (product, MI code) pair the standard-BOM background declares — each pair is
 * one standard BOM. Order of first appearance is preserved, so the standard BOMs are registered in
 * the same order the table lists them. */
const groupStandardBomRows = (
  table: DataTable,
): Map<
  string,
  { miCode: string; productName: string; rows: StandardBomBackgroundRow[] }
> => {
  const groups = new Map<
    string,
    { miCode: string; productName: string; rows: StandardBomBackgroundRow[] }
  >();
  for (const row of table.hashes()) {
    const miCode = row[MI_CODE];
    const productName = row[PRODUCT_NAME];
    const key = `${miCode}::${productName}`;
    let group = groups.get(key);
    if (!group) {
      group = { miCode, productName, rows: [] };
      groups.set(key, group);
    }
    group.rows.push({
      miCode,
      productName,
      componentName: row[COMPONENT_NAME],
      materialName: row[MATERIAL_NAME],
      standardWeight: Number(row[STANDARD_WEIGHT]),
    });
  }
  return groups;
};

/** Groups the daily-BOM background table's rows by order number — every row sharing one is
 * another component/material line of that same daily BOM (mirrors
 * `bom-report-fixtures.ts#groupBackgroundRows`'s own contract). */
const groupDailyBomRows = (
  table: DataTable,
): Map<
  string,
  {
    orderNumber: string;
    miCode: string;
    registeredAtText: string;
    description?: string;
    rows: DailyBomBackgroundRow[];
  }
> => {
  const groups = new Map<
    string,
    {
      orderNumber: string;
      miCode: string;
      registeredAtText: string;
      description?: string;
      rows: DailyBomBackgroundRow[];
    }
  >();
  for (const row of table.hashes()) {
    const orderNumber = row[ORDER_NUMBER];
    let group = groups.get(orderNumber);
    if (!group) {
      const description = row[DESCRIPTION];
      group = {
        orderNumber,
        miCode: row[MI_CODE],
        registeredAtText: row[REGISTERED_AT],
        description: description === '-' ? undefined : description,
        rows: [],
      };
      groups.set(orderNumber, group);
    }
    group.rows.push({
      orderNumber,
      miCode: row[MI_CODE],
      registeredAtText: row[REGISTERED_AT],
      description: row[DESCRIPTION] === '-' ? undefined : row[DESCRIPTION],
      componentName: row[COMPONENT_NAME],
      materialName: row[MATERIAL_NAME],
      weight: Number(row[WEIGHT]),
    });
  }
  return groups;
};

/** Every distinct product name the background references, paired with the UNION of the
 * components/materials every group sharing that name declares — mirrors
 * `bom-report-fixtures.ts#unionComponentsByProductName` exactly. */
const unionComponentsByProductName = (
  standardGroups: ReturnType<typeof groupStandardBomRows>,
): Map<string, Array<{ name: string; materials: string[] }>> => {
  const unions = new Map<
    string,
    Array<{ name: string; materials: string[] }>
  >();
  for (const { rows } of standardGroups.values()) {
    let union = unions.get(rows[0].productName);
    if (!union) {
      union = [];
      unions.set(rows[0].productName, union);
    }
    for (const row of rows) {
      let unionComponent = union.find((c) => c.name === row.componentName);
      if (!unionComponent) {
        unionComponent = { name: row.componentName, materials: [] };
        union.push(unionComponent);
      }
      if (!unionComponent.materials.includes(row.materialName)) {
        unionComponent.materials.push(row.materialName);
      }
    }
  }
  return unions;
};

/** The standard BOM's own per-material standard weight, keyed by (component name, material name)
 * within a single standard BOM group — the per-group composition draft that
 * `RegisterStandardBomAndRememberIt`'s `selectComposition` callback would otherwise draft with
 * arbitrary weights (`freshWeightInGrams()`) is rebuilt here with the table's own standard
 * weights, so a daily BOM's score (sum of |actual - standard|) lines up with the
 * expected-score assertions in the score-visibility rule. */
const selectGroupCompositionWithStandardWeights =
  (group: { rows: StandardBomBackgroundRow[] }) =>
  (composition: NewComponentInStandardBom[]): NewComponentInStandardBom[] =>
    group.rows.map((row) => {
      const clonedComponent = composition.find(
        (component) => component.componentName === row.componentName,
      );
      if (!clonedComponent) {
        throw new Error(
          `Component "${row.componentName}" was not found on the shared product's composition ` +
            "while setting up bom-dashboard's fixtures.",
        );
      }
      const clonedMaterial = clonedComponent.materials.find(
        (material) => material.materialName === row.materialName,
      );
      if (!clonedMaterial) {
        throw new Error(
          `Material "${row.materialName}" of component "${row.componentName}" was not found ` +
            "on the shared product's composition while setting up bom-dashboard's fixtures.",
        );
      }
      return {
        ...clonedComponent,
        materials: [{ ...clonedMaterial, weightInGrams: row.standardWeight }],
      };
    });

/**
 * Registers every standard BOM the background table describes — product once per distinct name
 * (with the union of every group's components/materials), then one standard BOM per group
 * cloning only that group's own subset with the table's own per-material standard weights.
 *
 * Tracks the (MI code) → (registered standard BOM) mapping so the daily-BOM step can look up
 * the right standard BOM by its MI code when registering each daily BOM — the daily BOM's
 * `standardBomMiCode` is what `RegisterBomDto` actually takes on the wire
 * (`screenplay/bom-registration/register-bom.ts#registerRequestBody`'s own comment).
 *
 * Exported separately from `registerDailyBomDashboardFixturesOnly` so the step definitions
 * (`step-definitions/bom-analyzing/bom-dashboard-fixtures.steps.ts`) can split the two-table
 * background into two `Given` steps with module-state handoff, the same way
 * `bom-reporting/common.steps.ts` does for its two-background setup.
 */
export const registerStandardBomDashboardFixturesOnly = async (
  table: DataTable,
): Promise<Map<string, { id: string; miCode: string }>> => {
  const groups = groupStandardBomRows(table);
  const productsByName = new Map<string, RegisteredProduct>();
  const standardBomsByMiCode = new Map<
    string,
    { id: string; miCode: string }
  >();
  const componentUnionsByProductName = unionComponentsByProductName(groups);

  for (const { miCode, productName, rows } of groups.values()) {
    const admin = actorCalled('یاشار');
    await admin.attemptsTo(LogInAsPersona('یاشار'));

    let product = productsByName.get(productName);
    if (!product) {
      await admin.attemptsTo(
        RegisterProductAndRememberIt(
          freshProductDetails({
            name: productName,
            components: componentUnionsByProductName
              .get(productName)!
              .map((component) => ({
                name: component.name,
                materials: component.materials.map((materialName) => ({
                  name: materialName,
                })),
              })),
          }),
        ),
      );
      product = theLastRegisteredProduct();
      productsByName.set(productName, product);
    }

    await admin.attemptsTo(
      RegisterStandardBomAndRememberIt(
        product,
        {
          miCode,
          brand: `برند تست ${miCode}`,
          standardLength: '305',
        },
        selectGroupCompositionWithStandardWeights({ rows }),
      ),
    );
    const standardBom = theLastRegisteredStandardBom();
    standardBomsByMiCode.set(miCode, { id: standardBom.id, miCode });
  }

  return standardBomsByMiCode;
};

/**
 * Registers every daily BOM the background table describes, in registration (chronological) order
 * — freezing the clock BEFORE each login, exactly the way
 * `bom-report-fixtures.ts#registerDailyBomReportFixtures` does (and the dispatch explicitly
 * calls out: "the freeze-the-clock-before-login pattern is required because consecutive groups
 * can be days apart in Jalali time").
 */
export const registerDailyBomDashboardFixturesOnly = async (
  table: DataTable,
  standardBomsByMiCode: Map<string, { id: string; miCode: string }>,
): Promise<void> => {
  const groups = groupDailyBomRows(table);
  let controllerHasProvisioned = false;

  for (const group of groups.values()) {
    const { orderNumber, miCode, registeredAtText, description, rows } = group;
    const controller = actorCalled('نیکروش');

    // Freeze BEFORE login — a JWT's `iat`/`exp` are stamped from the clock at LOGIN time
    // (`screenplay/common/clock.ts`'s own comment), so logging in first and freezing afterwards
    // silently expires the token. The dashboard background's daily BOMs span 1403/06/14 and
    // 1403/06/15 — two consecutive days in Jalali time — which is exactly the kind of clock
    // jump that breaks an already-issued token.
    await controller.attemptsTo(
      FreezeTimeAt(parseJalaliDateTime(registeredAtText)),
    );

    if (!controllerHasProvisioned) {
      // First group: provision نیکروش's account (via یاشار) and log in fresh.
      await controller.attemptsTo(LogInAsPersona('نیکروش'));
      controllerHasProvisioned = true;
    } else {
      // Subsequent groups: re-authenticate using the credentials نیکروش's notepad already
      // carries (set by the first `LogInAsPersona` call above), so the new freeze jump doesn't
      // invalidate the token.
      await controller.attemptsTo(
        LogIn.viaApiUsing(
          notes<AuthNotes>().get('username'),
          notes<PersonaCredentialsNotes>().get('password'),
        ),
      );
    }

    const standardBom = standardBomsByMiCode.get(miCode);
    if (!standardBom) {
      throw new Error(
        `Standard BOM with MI code "${miCode}" was not registered by the standard-BOM ` +
          "background while setting up bom-dashboard's fixtures.",
      );
    }

    await controller.attemptsTo(
      RegisterBomAndRememberIt(
        standardBom,
        {
          orderNumber,
          trackingNumber: `TRK-${orderNumber}`,
          description,
        },
        (componentName, materialName) => {
          const row = rows.find(
            (r) =>
              r.componentName === componentName &&
              r.materialName === materialName,
          );
          if (!row) {
            throw new Error(
              `No weight found for material "${materialName}" of component "${componentName}" ` +
                `in order "${orderNumber}" while setting up bom-dashboard's fixtures.`,
            );
          }
          return row.weight;
        },
      ),
    );
  }
};

/**
 * The feature's two-table background: standard BOMs first (sets up the products and the
 * (MI code → standard BOM) mapping), then daily BOMs (registers each one with the right
 * standard BOM's id and the table's own per-material actual weight).
 *
 * Not wrapped as a Serenity `Task`: this orchestrates several DIFFERENT actors in turn
 * (یاشار for the product/standard-BOM tiers, نیکروش for the daily BOM itself) — mirrors
 * `bom-report-fixtures.ts#registerDailyBomReportFixtures`'s own shape, which is for the
 * same reason. Kept for symmetry with `bom-reporting/bom-report-fixtures.ts#registerDailyBomReportFixtures`
 * even though the step definitions now call the two halves separately.
 */
export const registerBomDashboardFixtures = async (
  standardBomTable: DataTable,
  dailyBomTable: DataTable,
): Promise<void> => {
  const standardBomsByMiCode =
    await registerStandardBomDashboardFixturesOnly(standardBomTable);
  await registerDailyBomDashboardFixturesOnly(
    dailyBomTable,
    standardBomsByMiCode,
  );
};
