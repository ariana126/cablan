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
 * Test-data setup for `reporting-bom.feature`'s own background — "اینکه آنالیز های روزانه زیر با
 * اجزا و مواد اولیه شان در سیستم ثبت شده باشند" (`step-definitions/bom-reporting/common.steps.ts`).
 *
 * The background table gives, per row, a full daily BOM's own fields (order/tracking number,
 * registered-at, registered-by, description) ALONGSIDE its standard BOM's own (MI code, brand,
 * standard length, product name) and one component/material/weight triple — because a daily BOM's
 * composition is cloned from an existing standard BOM at registration time (the same domain rule
 * `screenplay/bom-registration/register-bom.ts`'s own module comment documents), setting one up
 * for reporting purposes means registering all three tiers: a product, a standard BOM cloning it,
 * and finally the daily BOM itself — grouped by order number, since every row sharing one order
 * number is one more component/material line of the SAME daily BOM (mirrors the exact shape
 * `registring-bom.feature`'s own background table already establishes one tier down).
 *
 * `registeredAt`/`registeredBy` aren't request fields — the backend stamps them from whichever
 * identity is authenticated and whatever the test clock currently reads — so producing the table's
 * exact values means: freezing the backend's test clock to that row's own instant
 * (`screenplay/common/clock.ts#FreezeTimeAt`, given its first real call site here — see the dispatch
 * this automation was written against) and performing the registration as that row's own "کنترلگر"
 * persona, immediately before each daily BOM is registered.
 */

interface BackgroundBomGroup {
  orderNumber: string;
  trackingNumber: string;
  registeredAtText: string;
  registeredBy: string;
  miCode: string;
  brand: string;
  standardLength: string;
  productName: string;
  description?: string;
  components: Array<{
    name: string;
    materials: Array<{ name: string; weight: number }>;
  }>;
}

const ORDER_NUMBER = 'شماره سفارش';
const TRACKING_NUMBER = 'شماره ردیابی';
const REGISTERED_AT = 'تاریخ و زمان ثبت';
const REGISTERED_BY = 'کنترلگر';
const MI_CODE = 'کد MI';
const BRAND = 'برند';
const STANDARD_LENGTH = 'متراژ استاندارد';
const PRODUCT_NAME = 'نام محصول';
const DESCRIPTION = 'توضیحات';
const COMPONENT_NAME = 'نام جز';
const MATERIAL_NAME = 'نام مواد اولیه';
const WEIGHT = 'وزن مواد اولیه';

/** Groups the background table's rows by order number — every row sharing one is another
 * component/material line of that same daily BOM (see this module's own comment above). Order of
 * first appearance is preserved, which is also the chronological order the table itself uses. */
const groupBackgroundRows = (table: DataTable): BackgroundBomGroup[] => {
  const groupsByOrderNumber = new Map<string, BackgroundBomGroup>();
  const orderOfAppearance: string[] = [];

  for (const row of table.hashes()) {
    const orderNumber = row[ORDER_NUMBER];
    let group = groupsByOrderNumber.get(orderNumber);
    if (!group) {
      const description = row[DESCRIPTION];
      group = {
        orderNumber,
        trackingNumber: row[TRACKING_NUMBER],
        registeredAtText: row[REGISTERED_AT],
        registeredBy: row[REGISTERED_BY],
        miCode: row[MI_CODE],
        brand: row[BRAND],
        standardLength: row[STANDARD_LENGTH],
        productName: row[PRODUCT_NAME],
        description: description === '-' ? undefined : description,
        components: [],
      };
      groupsByOrderNumber.set(orderNumber, group);
      orderOfAppearance.push(orderNumber);
    }

    const componentName = row[COMPONENT_NAME];
    let component = group.components.find((c) => c.name === componentName);
    if (!component) {
      component = { name: componentName, materials: [] };
      group.components.push(component);
    }
    component.materials.push({
      name: row[MATERIAL_NAME],
      weight: Number(row[WEIGHT]),
    });
  }

  return orderOfAppearance.map((orderNumber) =>
    groupsByOrderNumber.get(orderNumber)!,
  );
};

/**
 * Narrows a product's (possibly full, possibly shared-with-another-group) cloned composition down
 * to exactly `group`'s own component/material rows — product names are unique
 * (`registring-product.feature`'s own rule), but the background table can legitimately reuse one
 * across two groups with two DIFFERENT subsets of its components/materials (e.g. ORD-2001 and
 * ORD-2002 both reference "کابل شبکه U/UTP 0.42 LEGRAND", and `exporting-bom.feature`'s own "هر
 * آنالیز روزانه یک ردیف" example asserts ORD-2002's standard BOM carries only ONE component/material,
 * not ORD-2001's three) — so a standard BOM registered for either group must select only that
 * group's own rows out of the product's full composition, never clone it wholesale.
 */
const selectGroupComposition =
  (group: BackgroundBomGroup) =>
  (composition: NewComponentInStandardBom[]): NewComponentInStandardBom[] =>
    group.components.map((groupComponent) => {
      const clonedComponent = composition.find(
        (component) => component.componentName === groupComponent.name,
      );
      if (!clonedComponent) {
        throw new Error(
          `Component "${groupComponent.name}" was not found on the shared product's composition ` +
            `while setting up bom-reporting's fixtures for order "${group.orderNumber}".`,
        );
      }
      const materials = groupComponent.materials.map((groupMaterial) => {
        const clonedMaterial = clonedComponent.materials.find(
          (material) => material.materialName === groupMaterial.name,
        );
        if (!clonedMaterial) {
          throw new Error(
            `Material "${groupMaterial.name}" of component "${groupComponent.name}" was not found ` +
              `on the shared product's composition while setting up bom-reporting's fixtures for ` +
              `order "${group.orderNumber}".`,
          );
        }
        return clonedMaterial;
      });
      return { ...clonedComponent, materials };
    });

/**
 * Every distinct product name the background table references, each paired with the UNION of the
 * components/materials every group sharing that name declares — e.g. "کابل شبکه U/UTP 0.42 LEGRAND"
 * is declared by both ORD-2001 (مغزی[مسی, آلومینیوم], روکش[مسی]) and ORD-2002 (روکش[آلومینیوم]), so
 * its union carries روکش with BOTH materials, even though neither group alone lists both. The
 * product itself has to be registered with that union — once per distinct name, not once per group
 * (product names are unique, `registring-product.feature`'s own rule) — so that whichever group
 * registers it first still leaves every LATER group's own subset
 * (`selectGroupComposition`, just above) selectable off the product's real composition.
 */
const unionComponentsByProductName = (
  groups: BackgroundBomGroup[],
): Map<string, Array<{ name: string; materials: string[] }>> => {
  const unions = new Map<
    string,
    Array<{ name: string; materials: string[] }>
  >();
  for (const group of groups) {
    let union = unions.get(group.productName);
    if (!union) {
      union = [];
      unions.set(group.productName, union);
    }
    for (const component of group.components) {
      let unionComponent = union.find((c) => c.name === component.name);
      if (!unionComponent) {
        unionComponent = { name: component.name, materials: [] };
        union.push(unionComponent);
      }
      for (const material of component.materials) {
        if (!unionComponent.materials.includes(material.name)) {
          unionComponent.materials.push(material.name);
        }
      }
    }
  }
  return unions;
};

/** Tracks every order number the background has registered, in registration (chronological) order
 * — "تمام آنالیز های روزانه ثبت شده" needs the full set, and the sorting rule's own scenario needs
 * to know the same set exists, reversed, since it registers oldest-first. Plain module state, the
 * same way `screenplay/bom-registration/bom-details.ts`'s own registries are: every scenario starts
 * from a truncated database (`support/hooks.ts`), so nothing here needs resetting between
 * scenarios. */
let backgroundOrderNumbers: string[] = [];

export const theBackgroundOrderNumbers = (): string[] => backgroundOrderNumbers;

/**
 * Registers every daily BOM the background table describes — product, standard BOM, then the daily
 * BOM itself, per group — and remembers their order numbers (`theBackgroundOrderNumbers`). Not
 * wrapped as a Serenity `Task`: this orchestrates several DIFFERENT actors in turn (یاشار for the
 * product/standard-BOM tiers, each row's own "کنترلگر" persona for the daily BOM itself), so there
 * is no single actor to hand a `Task` to — mirrors how `step-definitions/bom-registration/
 * registring-standard-bom.steps.ts`'s own background Given orchestrates یاشار directly, sequential
 * `await`s rather than one eagerly-evaluated `Task.where(...)` list, for the same reason
 * `register-bom.ts`'s own comment on `edit-standard-bom.ts#SequentiallyDependentTask` gives: each
 * tier needs the previous one's freshly-registered id before it can run.
 */
export const registerDailyBomReportFixtures = async (
  table: DataTable,
): Promise<void> => {
  const groups = groupBackgroundRows(table);
  const loggedInControllers = new Set<string>();
  const orderNumbers: string[] = [];
  const productsByName = new Map<string, RegisteredProduct>();
  const componentUnionsByProductName = unionComponentsByProductName(groups);

  for (const group of groups) {
    const admin = actorCalled('یاشار');
    await admin.attemptsTo(LogInAsPersona('یاشار'));

    // Product names are unique (`registring-product.feature`'s own rule), so a name already seen
    // by an earlier group in this same background is the SAME product, registered once with the
    // union of every group's components (see `unionComponentsByProductName`'s own comment) —
    // registering it again here would 409.
    let product = productsByName.get(group.productName);
    if (!product) {
      await admin.attemptsTo(
        RegisterProductAndRememberIt(
          freshProductDetails({
            name: group.productName,
            components: componentUnionsByProductName
              .get(group.productName)!
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
      productsByName.set(group.productName, product);
    }
    await admin.attemptsTo(
      RegisterStandardBomAndRememberIt(
        product,
        {
          miCode: group.miCode,
          brand: group.brand,
          standardLength: group.standardLength,
        },
        selectGroupComposition(group),
      ),
    );
    const standardBom = theLastRegisteredStandardBom();

    const controller = actorCalled(group.registeredBy);

    // Freeze the clock to THIS group's own instant BEFORE the controller authenticates, not
    // after: `POST /testing/clock` needs no auth (confirmed against the live backend), but a JWT's
    // `iat`/`exp` are stamped from whatever the clock reads at LOGIN time
    // (`screenplay/common/clock.ts`'s own module comment; `backend/src/modules/identity/
    // infrastructure/jwt-token.service.ts`'s own comment on why `iat` comes from the tunable
    // clock, not wall-clock time). Logging in first and freezing afterwards silently expires the
    // token the moment this group's own freeze jumps the clock forward by more than its 1h
    // validity window relative to that `iat` — which happens routinely here, since consecutive
    // groups in this background can be days or months apart in Jalali time (e.g. نیکروش's own
    // ORD-2001 group freezes to 1403/04/01, its ORD-2003 group nearly a month later to 1403/05/01).
    await controller.attemptsTo(
      FreezeTimeAt(parseJalaliDateTime(group.registeredAtText)),
    );

    if (!loggedInControllers.has(group.registeredBy)) {
      await controller.attemptsTo(LogInAsPersona(group.registeredBy));
      loggedInControllers.add(group.registeredBy);
    } else {
      // Already provisioned by an earlier group — re-authenticate rather than reuse that group's
      // own token, for the exact same reason freezing moved above the login: that earlier token's
      // `iat` is anchored to THAT group's own (possibly much earlier) frozen instant, which this
      // group's freeze can equally have moved well past. `AuthNotes`/`PersonaCredentialsNotes`
      // were set on this same actor's own notepad the first time `LogInAsPersona` logged them in.
      await controller.attemptsTo(
        LogIn.viaApiUsing(
          notes<AuthNotes>().get('username'),
          notes<PersonaCredentialsNotes>().get('password'),
        ),
      );
    }

    await controller.attemptsTo(
      RegisterBomAndRememberIt(
        standardBom,
        {
          orderNumber: group.orderNumber,
          trackingNumber: group.trackingNumber,
          description: group.description,
        },
        (componentName, materialName) => {
          const component = group.components.find(
            (c) => c.name === componentName,
          );
          const material = component?.materials.find(
            (m) => m.name === materialName,
          );
          if (!material) {
            throw new Error(
              `No weight found for material "${materialName}" of component "${componentName}" ` +
                `in order "${group.orderNumber}" while setting up bom-reporting's fixtures.`,
            );
          }
          return material.weight;
        },
      ),
    );

    orderNumbers.push(group.orderNumber);
  }

  backgroundOrderNumbers = orderNumbers;
};
