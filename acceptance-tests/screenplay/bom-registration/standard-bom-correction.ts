import {
  Activity,
  Actor,
  actorCalled,
  d,
  Interaction,
  Question,
  Task,
} from '@serenity-js/core';
import { contain, Ensure, equals, isLessThan } from '@serenity-js/assertions';
import {
  GetRequest,
  LastResponse,
  PatchRequest,
  Send,
} from '@serenity-js/rest';
import { Click, Enter } from '@serenity-js/web';
import { StandardBomsPage } from '../ui/standard-boms-page';
import { taskDependingOn } from '../common/task-depending-on';
import { keepingTheSpotlight } from '../common/spotlight';
import { LogInAsPersona } from '../common/personas';
import { withLatinDigits } from '../common/persian-digits';
import {
  OpenEditStandardBomForm,
  SelectOption,
  WaitForTheStandardBomFormToBeAnswered,
} from './standard-bom-form';
import {
  StandardBomSummary,
  TheStandardBomList,
  ViewStandardBomList,
} from './view-standard-bom-list';
import { freshBrand } from './standard-bom-details';
import {
  freshProductDetails,
  theLastRegisteredProduct,
  theProductRegisteredWithName,
} from './product-details';
import { RegisterProductAndRememberIt } from './register-product';
import { RegisterStandardBomAndRememberIt } from './register-standard-bom';
import { SequentiallyDependentTask } from '../common/sequentially-dependent-task';
import {
  RegisterProductComposedOf,
  theStandardBomNotedBeforeTheAttempt,
} from './record-dependencies';
import { freshMaterialDetails } from './material-details';
import { RegisterMaterialAndRememberIt } from './register-material';
import { theLastRegisteredMaterial } from './material-details';
import { readTheOrderNumbered, miCodesOf } from '../planning/order-details';

/**
 * Issue #126: the System Admin's correction of a standard BOM («آنالیز استاندارد») that an order or a
 * daily BOM uses — its standard weights, brand, standard length, description and active flag. Its
 * MI code and the set of its components' materials stay locked (409 `record-has-dependents`, as for
 * everyone), and it is saved directly: no correction confirmation, unlike issue #110's.
 *
 * Two doors, as everywhere in bom-registration: the edit dialog of `/standard-boms` for the active
 * «… را اصلاح می کند», and `PATCH standard-boms/:id` (the existing body; `components` sent back
 * with the same component/material pairs and the new weights) for the passive «… اصلاح کرده باشد»
 * and for the composition attempts, which have no control on the page — a standard BOM's
 * composition is cloned from its product (`ui/standard-boms-page.ts`).
 */

export interface StandardWeightCorrection {
  componentName: string;
  materialName: string;
  weight: number;
}

/** What a correction changes; a field left out stays as it is. */
export interface StandardBomCorrection {
  weights?: StandardWeightCorrection[];
  brand?: string;
  standardLength?: number;
  description?: string;
  active?: boolean;
}

// ---------------------------------------------------------------------------------------------
// The correction, through either door

const sameMiCode = (a: string, b: string): boolean =>
  withLatinDigits(a) === withLatinDigits(b);

/** The edit form's activities for a correction — each corrected field filled, nothing else. */
const fillingIn = (correction: StandardBomCorrection): Activity[] => [
  ...(correction.weights ?? []).map((line) =>
    Enter.theValue(String(line.weight)).into(
      StandardBomsPage.weightField(line.materialName),
    ),
  ),
  ...(correction.brand === undefined
    ? []
    : [Enter.theValue(correction.brand).into(StandardBomsPage.brandField())]),
  ...(correction.standardLength === undefined
    ? []
    : [
        Enter.theValue(String(correction.standardLength)).into(
          StandardBomsPage.standardLengthField(),
        ),
      ]),
  ...(correction.description === undefined
    ? []
    : [
        Enter.theValue(correction.description).into(
          StandardBomsPage.descriptionField(),
        ),
      ]),
  ...(correction.active === undefined
    ? []
    : [
        SelectOption(
          StandardBomsPage.activeToggle(),
          correction.active ? 'فعال' : 'غیرفعال',
        ),
      ]),
];

const theLineOf = (
  standardBom: StandardBomSummary,
  line: Pick<StandardWeightCorrection, 'componentName' | 'materialName'>,
) => {
  const material = standardBom.components
    .find((component) => component.name === line.componentName)
    ?.materials.find((candidate) => candidate.name === line.materialName);
  if (!material) {
    throw new Error(
      `Standard BOM "${standardBom.miCode}" has no line "${line.materialName}" in component ` +
        `"${line.componentName}".`,
    );
  }
  return material;
};

/** `components` as `PATCH standard-boms/:id` takes them: the same pairs, each with its weight. */
const compositionBody = (
  components: StandardBomSummary['components'],
  weightOf: (
    componentName: string,
    material: { name: string; weight: number },
  ) => number = (_component, material) => material.weight,
) =>
  components.map((component) => ({
    componentId: component.id,
    materials: component.materials.map((material) => ({
      materialId: material.id,
      weight: weightOf(component.name, material),
    })),
  }));

/** The `PATCH standard-boms/:id` body of a correction of `standardBom`. */
const correctionBody = (
  standardBom: StandardBomSummary,
  correction: StandardBomCorrection,
): Record<string, unknown> => {
  const weights = correction.weights ?? [];
  weights.forEach((line) => theLineOf(standardBom, line));
  return {
    ...(correction.brand === undefined ? {} : { brand: correction.brand }),
    ...(correction.standardLength === undefined
      ? {}
      : { standardLength: correction.standardLength }),
    ...(correction.description === undefined
      ? {}
      : { description: correction.description }),
    ...(correction.active === undefined ? {} : { active: correction.active }),
    ...(weights.length === 0
      ? {}
      : {
          components: compositionBody(
            standardBom.components,
            (componentName, material) =>
              weights.find(
                (line) =>
                  line.componentName === componentName &&
                  line.materialName === material.name,
              )?.weight ?? material.weight,
          ),
        }),
  };
};

/** The standard BOM with `miCode`, out of the last `ViewStandardBomList()`. */
const TheStandardBomWithMiCode = (miCode: string) =>
  Question.about(d`standard BOM "${miCode}"`, async (actor) => {
    const standardBom = (await actor.answer(TheStandardBomList())).find(
      (candidate) => sameMiCode(candidate.miCode, miCode),
    );
    if (!standardBom) {
      throw new Error(
        `No standard BOM with MI code "${miCode}" is registered.`,
      );
    }
    return standardBom;
  });

export const CorrectStandardBom = {
  /** «{actor} … آنالیز استاندارد «…» را … اصلاح می کند» — the edit dialog, the corrected fields
   * filled, «ثبت آنالیز», and the dialog's answer awaited. */
  using: (miCode: string, correction: StandardBomCorrection): Task =>
    Task.where(
      d`#actor corrects standard BOM "${miCode}"`,
      OpenEditStandardBomForm(miCode),
      ...fillingIn(correction),
      Click.on(StandardBomsPage.submitButton()),
      WaitForTheStandardBomFormToBeAnswered(),
    ),

  /** The same correction over HTTP — the standard BOM found by MI code, then patched. */
  viaApiUsing: (miCode: string, correction: StandardBomCorrection): Task =>
    Task.where(
      d`#actor corrects standard BOM "${miCode}" (via API)`,
      ViewStandardBomList(),
      Ensure.that(LastResponse.status(), equals(200)),
      taskDependingOn(
        `#actor sends the correction of standard BOM "${miCode}"`,
        TheStandardBomWithMiCode(miCode),
        (standardBom) => [
          Send.a(
            PatchRequest.to(`standard-boms/${standardBom.id}`).with(
              correctionBody(standardBom, correction),
            ),
          ),
        ],
      ),
    ),
};

/**
 * «{persona} … آنالیز استاندارد «…» را … اصلاح کرده / غیرفعال کرده باشد» — the persona logs in and
 * corrects over HTTP, and the correction must have been accepted; whoever was in the spotlight
 * stays there.
 */
export const correctStandardBomAsAPrecondition = (
  personaName: string,
  miCode: string,
  correction: StandardBomCorrection,
): Promise<void> =>
  keepingTheSpotlight(async () => {
    await actorCalled(personaName).attemptsTo(
      LogInAsPersona(personaName),
      CorrectStandardBom.viaApiUsing(miCode, correction),
      Ensure.that(LastResponse.status(), isLessThan(300)),
    );
  });

// ---------------------------------------------------------------------------------------------
// «اصلاح آنالیز استاندارد استفاده شده توسط مدیر سیستم» — one outline over what may be corrected

export type CorrectableStandardBomItem =
  'weights' | 'brand' | 'standardLength' | 'description' | 'active';

const ITEM_BY_LABEL: Record<string, CorrectableStandardBomItem> = {
  'وزن های استاندارد': 'weights',
  برند: 'brand',
  'متراژ استاندارد': 'standardLength',
  توضیحات: 'description',
  'وضعیت فعال بودن': 'active',
};

/** The outline's «<مورد>» labels, as the step patterns match them. */
export const CORRECTABLE_STANDARD_BOM_ITEMS: readonly string[] =
  Object.keys(ITEM_BY_LABEL);

export const correctableItemFor = (
  label: string,
): CorrectableStandardBomItem => {
  const item = ITEM_BY_LABEL[label];
  if (!item) {
    throw new Error(
      `"${label}" is not a correctable part of a standard BOM (expected one of: ` +
        `${CORRECTABLE_STANDARD_BOM_ITEMS.join(', ')}).`,
    );
  }
  return item;
};

/** A correction of `item` that certainly changes it — the Gherkin names no value. */
const aCorrectionOf = (
  item: CorrectableStandardBomItem,
  standardBom: StandardBomSummary,
): StandardBomCorrection => {
  switch (item) {
    case 'weights': {
      const component = standardBom.components[0];
      const material = component?.materials[0];
      if (!component || !material) {
        throw new Error(
          `Standard BOM "${standardBom.miCode}" has no material line.`,
        );
      }
      return {
        weights: [
          {
            componentName: component.name,
            materialName: material.name,
            weight: material.weight + 1,
          },
        ],
      };
    }
    case 'brand':
      return { brand: freshBrand() };
    case 'standardLength':
      return { standardLength: standardBom.standardLength + 1 };
    case 'description':
      return { description: `توضیحات اصلاح شده ${Date.now()}` };
    case 'active':
      return { active: !standardBom.active };
  }
};

/** `standardBom` as it should read once `correction` is made, and nothing else changed. */
const correctedPictureOf = (
  standardBom: StandardBomSummary,
  correction: StandardBomCorrection,
): StandardBomSummary => {
  const weights = correction.weights ?? [];
  return {
    ...standardBom,
    ...(correction.brand === undefined ? {} : { brand: correction.brand }),
    ...(correction.standardLength === undefined
      ? {}
      : { standardLength: correction.standardLength }),
    ...(correction.description === undefined
      ? {}
      : { description: correction.description }),
    ...(correction.active === undefined ? {} : { active: correction.active }),
    components: standardBom.components.map((component) => ({
      ...component,
      materials: component.materials.map((material) => ({
        ...material,
        weight:
          weights.find(
            (line) =>
              line.componentName === component.name &&
              line.materialName === material.name,
          )?.weight ?? material.weight,
      })),
    })),
  };
};

/** What «<مورد> آنالیز استاندارد «…» اصلاح شده باشد» compares with — set by the correction. */
let standardBomAfterTheCorrection: StandardBomSummary | undefined;

/**
 * «{actor} <مورد> آنالیز استاندارد «…» را اصلاح می کند» — corrects `item` of the standard BOM as
 * `NoteTheStandardBom` found it (call that first), through the edit dialog, and remembers what the
 * standard BOM should then read.
 */
export const CorrectTheStandardBomItem = (
  miCode: string,
  item: CorrectableStandardBomItem,
): Task =>
  taskDependingOn(
    `#actor corrects the ${item} of standard BOM "${miCode}"`,
    Question.about(d`standard BOM "${miCode}" as noted`, () =>
      theStandardBomNotedBeforeTheAttempt(),
    ),
    (standardBom) => {
      const correction = aCorrectionOf(item, standardBom);
      return [
        Interaction.where(
          d`#actor expects standard BOM "${miCode}" to read ${correction} afterwards`,
          () => {
            standardBomAfterTheCorrection = correctedPictureOf(
              standardBom,
              correction,
            );
          },
        ),
        CorrectStandardBom.using(miCode, correction),
      ];
    },
  );

/** «<مورد> آنالیز استاندارد «…» اصلاح شده باشد» — the standard BOM now reads exactly as the
 * correction should have left it: the corrected field changed, every other one as it was. */
export const EnsureStandardBomWasCorrected = (miCode: string): Task =>
  Task.where(
    d`#actor ensures standard BOM "${miCode}" was corrected`,
    ViewStandardBomList(),
    Ensure.that(LastResponse.status(), equals(200)),
    Ensure.that(
      TheStandardBomWithMiCode(miCode),
      equals(
        Question.about('the standard BOM the correction should leave', () => {
          if (!standardBomAfterTheCorrection) {
            throw new Error(
              'No correction was made in this scenario — expected a preceding «… آنالیز ' +
                'استاندارد … را اصلاح می کند».',
            );
          }
          return standardBomAfterTheCorrection;
        }),
      ),
    ),
  );

// ---------------------------------------------------------------------------------------------
// «مدیر سیستم هم … اجزا و مواد اولیه آنالیز استاندارد استفاده شده را نمی تواند تغییر دهد»

const SendTheComposition = (
  standardBom: StandardBomSummary,
  components: ReturnType<typeof compositionBody>,
): Activity =>
  Send.a(
    PatchRequest.to(`standard-boms/${standardBom.id}`).with({ components }),
  );

/**
 * The two composition attempts, over HTTP (the page has no control for either). Made on the
 * standard BOM as `NoteTheStandardBom` found it — call that first. Neither change is one the
 * product's composition allows; the refusal being judged is the 409 of a standard BOM in use, which
 * the backend gives before it validates the composition (as for every edit of a record in use).
 */
export const AttemptToChangeTheMaterialsOfStandardBom = {
  /** A material registered just now, added to the first component's materials. */
  byAddingOne: (miCode: string): Task =>
    Task.where(
      d`#actor attempts to add a material to a component of standard BOM "${miCode}"`,
      RegisterMaterialAndRememberIt(freshMaterialDetails()),
      Ensure.that(LastResponse.status(), equals(201)),
      taskDependingOn(
        `#actor sends standard BOM "${miCode}" with one material more`,
        Question.about(d`standard BOM "${miCode}" as noted`, () =>
          theStandardBomNotedBeforeTheAttempt(),
        ),
        (standardBom) => {
          const [first, ...rest] = compositionBody(standardBom.components);
          return [
            SendTheComposition(standardBom, [
              {
                ...first,
                materials: [
                  ...first.materials,
                  { materialId: theLastRegisteredMaterial().id, weight: 1 },
                ],
              },
              ...rest,
            ]),
          ];
        },
      ),
    ),

  /** The first component's last material left out (and the component with it, were it its only
   * one). */
  byRemovingOne: (miCode: string): Task =>
    taskDependingOn(
      `#actor attempts to remove a material from a component of standard BOM "${miCode}"`,
      Question.about(d`standard BOM "${miCode}" as noted`, () =>
        theStandardBomNotedBeforeTheAttempt(),
      ),
      (standardBom) => {
        const [first, ...rest] = compositionBody(standardBom.components);
        const remaining = first.materials.slice(0, -1);
        return [
          SendTheComposition(standardBom, [
            ...(remaining.length === 0
              ? []
              : [{ ...first, materials: remaining }]),
            ...rest,
          ]),
        ];
      },
    ),
};

// ---------------------------------------------------------------------------------------------
// Preconditions

/** «اینکه آنالیز استاندارد «…» با برند «…» و متراژ استاندارد «…» ثبت شده باشد» — for a fresh
 * product. */
export const RegisterStandardBomWithBrandAndStandardLength = (
  miCode: string,
  brand: string,
  standardLength: string,
): Task =>
  new SequentiallyDependentTask(
    d`#actor registers standard BOM "${miCode}" with brand "${brand}" and standard length ${standardLength}`,
    RegisterProductAndRememberIt(freshProductDetails()),
    () =>
      RegisterStandardBomAndRememberIt(theLastRegisteredProduct(), {
        miCode,
        brand,
        standardLength,
      }),
  );

/** «اینکه وزن استاندارد مواد اولیه «…» جز «…» آنالیز استاندارد «…» برابر «…» باشد» — a fresh
 * product of that one component holding that one material, and the standard BOM for it with that
 * standard weight. */
export const RegisterStandardBomWithStandardWeight = (
  miCode: string,
  line: StandardWeightCorrection,
): Task => {
  const productName = freshProductDetails().name;
  return Task.where(
    d`#actor registers standard BOM "${miCode}" weighing "${line.materialName}" of "${line.componentName}" at ${line.weight}`,
    RegisterProductComposedOf(
      productName,
      line.componentName,
      line.materialName,
    ),
    taskDependingOn(
      `#actor registers standard BOM "${miCode}" for product "${productName}"`,
      Question.about(`product "${productName}"`, () =>
        theProductRegisteredWithName(productName),
      ),
      (product) => [
        RegisterStandardBomAndRememberIt(product, { miCode }, (composition) =>
          composition.map((component) => ({
            ...component,
            materials: component.materials.map((material) =>
              component.componentName === line.componentName &&
              material.materialName === line.materialName
                ? { ...material, weightInGrams: line.weight }
                : material,
            ),
          })),
        ),
        Ensure.that(LastResponse.status(), equals(201)),
      ],
    ),
  );
};

// ---------------------------------------------------------------------------------------------
// Facts — read by an observer (`common/observer.ts`)

/** A daily BOM as `GET boms/:id` reports it — only what these facts read. */
export interface DailyBomDetail {
  id: string;
  orderNumber: string;
  standardBomMiCode: string;
  brand: string;
  standardLength: number;
}

/** The daily BOM with `orderNumber`, as `GET boms/:id` reports it, read by the actor asking. */
export const TheDailyBomNumbered = (orderNumber: string) =>
  Question.about(d`daily BOM "${orderNumber}"`, async (actor) => {
    const reader = actor as Actor;
    await Send.a(GetRequest.to('boms')).performAs(reader);
    const listed = (
      await reader.answer(
        LastResponse.body<Array<{ id: string; orderNumber: string }>>(),
      )
    ).find((candidate) => candidate.orderNumber === orderNumber);
    if (!listed) {
      throw new Error(`No daily BOM with order number "${orderNumber}".`);
    }
    await Send.a(GetRequest.to(`boms/${listed.id}`)).performAs(reader);
    return reader.answer(LastResponse.body<DailyBomDetail>());
  });

/** «سفارش «…» و آنالیز روزانه «…» همچنان با کد MI «…» باشند» */
export const EnsureOrderAndDailyBomStillHoldMiCode = (
  orderNumber: string,
  dailyBomOrderNumber: string,
  miCode: string,
): Task =>
  Task.where(
    d`#actor ensures order "${orderNumber}" and daily BOM "${dailyBomOrderNumber}" still hold MI code "${miCode}"`,
    Ensure.that(
      Question.about(
        d`the MI codes of order "${orderNumber}"`,
        async (actor) => {
          const order = await readTheOrderNumbered(actor as Actor, orderNumber);
          return order ? miCodesOf(order) : [];
        },
      ),
      contain(withLatinDigits(miCode)),
    ),
    Ensure.that(
      Question.about(
        d`the MI code of daily BOM "${dailyBomOrderNumber}"`,
        async (actor) =>
          withLatinDigits(
            (await actor.answer(TheDailyBomNumbered(dailyBomOrderNumber)))
              .standardBomMiCode,
          ),
      ),
      equals(withLatinDigits(miCode)),
    ),
  );

/** «آنالیز روزانه «…» برند «…» و متراژ استاندارد «…» داشته باشد» */
export const EnsureDailyBomShowsBrandAndStandardLength = (
  orderNumber: string,
  brand: string,
  standardLength: number,
): Task =>
  Task.where(
    d`#actor ensures daily BOM "${orderNumber}" reads brand "${brand}" and standard length ${standardLength}`,
    Ensure.that(
      Question.about(
        d`the brand and standard length of daily BOM "${orderNumber}"`,
        async (actor) => {
          const bom = await actor.answer(TheDailyBomNumbered(orderNumber));
          return { brand: bom.brand, standardLength: bom.standardLength };
        },
      ),
      equals({ brand, standardLength }),
    ),
  );
