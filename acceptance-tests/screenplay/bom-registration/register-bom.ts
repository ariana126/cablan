import {
  AnswersQuestions,
  Check,
  d,
  Interaction,
  Question,
  QuestionAdapter,
  Task,
  Wait,
} from '@serenity-js/core';
import {
  Ensure,
  equals,
  isGreaterThan,
  isLessThan,
} from '@serenity-js/assertions';
import { GetRequest, LastResponse, PostRequest, Send } from '@serenity-js/rest';
import { Click, Enter, isVisible } from '@serenity-js/web';
import { BomsPage } from '../ui/boms-page';
import {
  OpenNewBomForm,
  SelectOption,
  WaitForTheBomFormToBeAnswered,
} from './bom-form';
import {
  NewBomDetails,
  NewComponentInBom,
  freshBomDetailsFor,
  freshWeightInGrams,
  rememberAttempt,
  rememberRegisteredBom,
  theAttempt,
} from './bom-details';
import { StandardBomSummary } from './view-standard-bom-list';
import { TheBomList, ViewBomList } from './view-bom-list';

export const registerRequestBody = (details: NewBomDetails) => ({
  // `RegisterBomDto` (backend/src/modules/boms/infrastructure/http/controllers/bom/dto/
  // register-bom.dto.ts) takes the standard BOM's MI code, not its id — `boms` resolves it to an
  // id server-side via `GetStandardBomByMiCodeQuery`, deliberately never importing
  // `standard-boms`' own id-keyed lookup (see `backend/src/modules/boms/CLAUDE.md`'s "Why the
  // cross-module query is keyed by MI code, not by id"). `standardBomId` is a real field on
  // `NewBomDetails`/the read model, but only ever the *response*'s shape, never the request's.
  standardBomMiCode: details.standardBomMiCode,
  orderNumber: details.orderNumber,
  trackingNumber: details.trackingNumber,
  ...(details.description !== undefined
    ? { description: details.description }
    : {}),
  components: details.components.map((component) => ({
    componentId: component.componentId,
    materials: component.materials.map((material) => ({
      materialId: material.materialId,
      weight: material.weightInGrams,
    })),
  })),
});

/**
 * Reads the given standard BOM's CURRENT composition off an already-fetched `GET /standard-boms`
 * response (`LastResponse`) and turns it into a fresh, cloned composition (with real master
 * component/material ids, each material given a fresh weight) — the API-door equivalent of what
 * the real "new daily BOM" form is assumed to do automatically once a standard BOM is chosen by
 * its MI code (`bom-form.ts`'s own comment on `OpenNewBomForm`/`BomsPage.standardBomSelect`).
 * Mirrors `screenplay/bom-registration/register-standard-bom.ts#cloneProductComposition` exactly,
 * one level up the clone chain. Assumes a `Send.a(GetRequest.to('standard-boms'))` was already
 * performed by the same actor immediately before this runs.
 */
const cloneStandardBomComposition = async (
  actor: AnswersQuestions,
  standardBomId: string,
  standardBomMiCode: string,
  // Defaults to a fresh, arbitrary weight — every existing call site (registring-bom.feature's own
  // automation) leaves this unset, since no scenario there asserts a specific value. Given an
  // explicit lookup instead (keyed by BOTH component and material name, since a daily BOM can
  // legitimately reuse the same material name under two different components — e.g.
  // bom-reporting's own background fixtures, `screenplay/bom-reporting/bom-report-fixtures.ts`),
  // it's used instead — this is what lets that feature set up daily BOMs whose exact per-material
  // weights its detail-view assertions depend on ("جمع وزن مواد اولیه").
  weightForMaterial: (
    componentName: string,
    materialName: string,
  ) => number = () => freshWeightInGrams(),
): Promise<NewComponentInBom[]> => {
  const standardBoms = await actor.answer(
    LastResponse.body<StandardBomSummary[]>(),
  );
  const found = standardBoms.find(
    (standardBom) => standardBom.id === standardBomId,
  );
  if (!found) {
    throw new Error(
      `Standard BOM with MI code "${standardBomMiCode}" (${standardBomId}) was not found while ` +
        'cloning its composition into a new daily BOM.',
    );
  }
  return found.components.map((component) => ({
    componentId: component.id,
    componentName: component.name,
    materials: component.materials.map((material) => ({
      materialId: material.id,
      materialName: material.name,
      weightInGrams: weightForMaterial(component.name, material.name),
    })),
  }));
};

/**
 * Re-fetches `standardBom`'s current composition (purely to learn each material's *name* — the
 * one thing `BomsPage.weightField(materialName)` needs, since the real markup carries no other
 * stable per-material identity, mirroring `standard-bom-details.ts`'s own equivalent), then applies
 * `valueFor()` to every cloned material's weight field. A single generic helper, rather than one
 * function per value, because three call sites need this — a fresh valid weight
 * (`FillInClonedMaterialWeights`), an empty one, and a zero one (the two "وزن مواد اولیه" rules'
 * own registration-time negative examples, `register-bom.ts`'s exports below).
 */
const ForEachClonedMaterialWeightField = (
  description: string,
  standardBom: { id: string; miCode: string },
  valueFor: () => string,
): Interaction =>
  Interaction.where(description, async (actor) => {
    await Send.a(GetRequest.to('standard-boms')).performAs(actor);
    const standardBoms = await actor.answer(
      LastResponse.body<StandardBomSummary[]>(),
    );
    const found = standardBoms.find((s) => s.id === standardBom.id);
    if (!found) {
      throw new Error(
        `Standard BOM with MI code "${standardBom.miCode}" (${standardBom.id}) was not found ` +
          'while reaching its cloned material weight fields.',
      );
    }
    for (const component of found.components) {
      for (const material of component.materials) {
        const weightField = await actor.answer(
          BomsPage.weightField(material.name),
        );
        await weightField.enterValue(valueFor());
      }
    }
  });

/**
 * Fills in a fresh weight for every material the open daily BOM form has cloned from
 * `standardBom` — right after the standard BOM has been selected. Mirrors
 * `screenplay/bom-registration/register-standard-bom.ts#FillInClonedMaterialWeights`.
 */
const FillInClonedMaterialWeights = (standardBom: {
  id: string;
  miCode: string;
}): Interaction =>
  ForEachClonedMaterialWeightField(
    '#actor fills in a weight for each cloned material',
    standardBom,
    () => `${freshWeightInGrams()}`,
  );

export const RegisterBom = {
  /**
   * Registers a daily BOM through the real "new daily BOM" form — the UI door this feature's
   * top-level "ثبت می کند" scenario, and every "قانون" example driven by نیکروش, drive (per the
   * dispatch this automation was written against). Selecting `standardBom.miCode` is assumed to
   * make the form clone that standard BOM's current composition automatically, leaving only a
   * weight to fill in per material (`FillInClonedMaterialWeights`) — see `bom-details.ts`'s own
   * comment on why a daily BOM's composition references rather than freely creates master data.
   */
  using: (
    standardBom: { id: string; miCode: string },
    details: Pick<
      NewBomDetails,
      'orderNumber' | 'trackingNumber' | 'description'
    >,
  ): Task =>
    Task.where(
      d`#actor registers a new daily BOM for standard BOM MI code "${standardBom.miCode}"`,
      OpenNewBomForm(),
      SelectOption(BomsPage.standardBomSelect(), standardBom.miCode),
      Enter.theValue(details.orderNumber).into(BomsPage.orderNumberField()),
      Enter.theValue(details.trackingNumber).into(
        BomsPage.trackingNumberField(),
      ),
      ...(details.description !== undefined
        ? [
            Enter.theValue(details.description).into(
              BomsPage.descriptionField(),
            ),
          ]
        : []),
      FillInClonedMaterialWeights(standardBom),
      Click.on(BomsPage.submitButton()),
      WaitForTheBomFormToBeAnswered(),
    ),

  /** The API door — used for background test-data setup and the access-denied "تلاش می کند" rule. */
  viaApiUsing: (details: NewBomDetails): Task =>
    Task.where(
      d`#actor registers a new daily BOM for standard BOM "${details.standardBomMiCode}" (via API)`,
      Send.a(PostRequest.to('boms').with(registerRequestBody(details))),
    ),
};

/**
 * Registers a daily BOM via the API — cloning `standardBom`'s current composition, fetched fresh —
 * and remembers it as "the last registered daily BOM" (`bom-details.ts`), for scenarios that go on
 * to edit or delete it, possibly as a *different* actor than the one performing this task. Used
 * for `Given` (passive-voiced) preconditions only; the feature's active-voiced scenarios drive the
 * UI instead (`RegisterBom.using`). Mirrors
 * `screenplay/bom-registration/register-standard-bom.ts#RegisterStandardBomAndRememberIt`.
 */
export const RegisterBomAndRememberIt = (
  standardBom: { id: string; miCode: string },
  overrides: Partial<
    Omit<NewBomDetails, 'standardBomId' | 'standardBomMiCode' | 'components'>
  > = {},
  /** See `cloneStandardBomComposition`'s own comment above — left unset by every
   * bom-registration call site, given explicitly by bom-reporting's own fixture setup. */
  weightForMaterial?: (componentName: string, materialName: string) => number,
): Task => {
  let details!: NewBomDetails;
  return Task.where(
    d`#actor registers a new daily BOM for standard BOM "${standardBom.miCode}" (via API) and remembers it`,
    Send.a(GetRequest.to('standard-boms')),
    Interaction.where(
      '#actor clones the standard BOM composition into fresh daily BOM details',
      async (actor) => {
        const composition = await cloneStandardBomComposition(
          actor,
          standardBom.id,
          standardBom.miCode,
          weightForMaterial,
        );
        details = freshBomDetailsFor(standardBom, composition, overrides);
      },
    ),
    Interaction.where('#actor submits the drafted daily BOM', async (actor) => {
      await Send.a(
        PostRequest.to('boms').with(registerRequestBody(details)),
      ).performAs(actor);
    }),
    // Fails loudly, right here, if the request body doesn't match the backend's contract —
    // rather than silently "remembering" a daily BOM that was never created (`body.id` would be
    // `undefined` on a 4xx) and only surfacing as a confusing timeout several steps later, when
    // some other step waits for a row that was never registered.
    Ensure.that(LastResponse.status(), equals(201)),
    Interaction.where(
      '#actor remembers the registered daily BOM',
      async (actor) => {
        const body = await actor.answer(LastResponse.body<{ id: string }>());
        rememberRegisteredBom({
          id: body.id,
          standardBomId: standardBom.id,
          standardBomMiCode: standardBom.miCode,
          orderNumber: details.orderNumber,
          trackingNumber: details.trackingNumber,
        });
        rememberAttempt<NewBomDetails>(details);
      },
    ),
  );
};

/**
 * The access-denied "تلاش می کند" rule's own attempt: drafts a fresh daily BOM cloning
 * `standardBom`'s composition and attempts to register it via the API, without remembering it as
 * registered (it never will be — `RolesGuard` rejects it before it reaches the domain). Mirrors
 * `screenplay/bom-registration/register-standard-bom.ts#AttemptToRegisterStandardBomForProductViaApi`.
 */
export const AttemptToRegisterBomForMiCodeViaApi = (standardBom: {
  id: string;
  miCode: string;
}): Task => {
  let details!: NewBomDetails;
  return Task.where(
    d`#actor attempts to register a new daily BOM for standard BOM "${standardBom.miCode}" (via API)`,
    Send.a(GetRequest.to('standard-boms')),
    Interaction.where(
      '#actor clones the standard BOM composition into fresh daily BOM details',
      async (actor) => {
        const composition = await cloneStandardBomComposition(
          actor,
          standardBom.id,
          standardBom.miCode,
        );
        details = freshBomDetailsFor(standardBom, composition);
        rememberAttempt<NewBomDetails>(details);
      },
    ),
    Interaction.where('#actor submits the drafted daily BOM', async (actor) => {
      await Send.a(
        PostRequest.to('boms').with(registerRequestBody(details)),
      ).performAs(actor);
    }),
  );
};

/** Through the UI, assert what the visitor sees: the new daily BOM's order number in the rendered list. */
export const EnsureBomWasRegistered = (orderNumber: string): Task =>
  Task.where(
    d`#actor ensures daily BOM "${orderNumber}" was registered`,
    Wait.until(BomsPage.bomNamed(orderNumber), isVisible()),
  );

const CountOfBomsWithOrderNumber = (
  orderNumber: string,
): QuestionAdapter<number> =>
  Question.about(
    `the count of daily BOMs with order number "${orderNumber}"`,
    async (actor) => {
      const boms = await actor.answer(TheBomList());
      return boms.filter((bom) => bom.orderNumber === orderNumber).length;
    },
  );

/**
 * Door-agnostic on purpose, mirroring
 * `screenplay/bom-registration/register-standard-bom.ts#EnsureNewStandardBomWasNotRegistered`:
 * this feature's "آنالیز [روزانه] جدیدی ثبت نشده باشد" steps follow both a UI-driven attempt
 * (missing order/tracking number, invalid material weight) and an API-driven one (access-denied),
 * so rather than reading `LastResponse` — which the UI-driven attempts never populate — this
 * re-queries the system and checks the invariant that matters here: never more than one daily BOM
 * sharing the attempted order number.
 *
 * The re-query is skipped when `LastResponse` already reports an error (> 399): the access-denied
 * rule's API-driven attempt, whose failed response is the proof the re-query would otherwise
 * reconfirm — skipping it also avoids overwriting `LastResponse` with a GET's 200 before the shared
 * "پیغام خطای عدم دسترسی نشان داده شود" step reads the original attempt's 403 off it.
 */
export const EnsureNewBomWasNotRegistered = (): Task => {
  const attempted = theAttempt<NewBomDetails>();
  return Task.where(
    '#actor ensures a new daily BOM was not registered',
    Check.whether(LastResponse.status(), isGreaterThan(399))
      .andIfSo()
      .otherwise(
        ViewBomList(),
        Ensure.that(
          CountOfBomsWithOrderNumber(attempted.orderNumber),
          isLessThan(2),
        ),
      ),
  );
};

/**
 * Opens the "new daily BOM" form for `standardBom`, selects it by MI code (cloning its
 * composition), fills in the order number, tracking number, description (when given) and every
 * cloned material's weight — without submitting yet. The "اما ... را ... میگذارد" steps that
 * follow overwrite one field (or every material's weight) and submit. Mirrors
 * `screenplay/bom-registration/register-standard-bom.ts#EnterNewStandardBomDetails`.
 */
export const EnterNewBomDetails = (
  standardBom: { id: string; miCode: string },
  details: Pick<
    NewBomDetails,
    'orderNumber' | 'trackingNumber' | 'description'
  >,
): Task =>
  Task.where(
    '#actor enters new daily BOM details, without submitting yet',
    OpenNewBomForm(),
    SelectOption(BomsPage.standardBomSelect(), standardBom.miCode),
    Enter.theValue(details.orderNumber).into(BomsPage.orderNumberField()),
    Enter.theValue(details.trackingNumber).into(BomsPage.trackingNumberField()),
    ...(details.description !== undefined
      ? [Enter.theValue(details.description).into(BomsPage.descriptionField())]
      : []),
    FillInClonedMaterialWeights(standardBom),
  );

const SubmitAlreadyOpenBomForm = (): Task =>
  Task.where(
    '#actor submits the already-open daily BOM form',
    Click.on(BomsPage.submitButton()),
    WaitForTheBomFormToBeAnswered(),
  );

/** The "اما شماره سفارش را خالی میگذارد" step. */
export const AttemptToRegisterLeavingOrderNumberEmpty = (): Task =>
  Task.where(
    '#actor attempts to register the daily BOM leaving the order number empty',
    Enter.theValue('').into(BomsPage.orderNumberField()),
    SubmitAlreadyOpenBomForm(),
  );

/** The "اما شماره ردیابی را خالی میگذارد" step. */
export const AttemptToRegisterLeavingTrackingNumberEmpty = (): Task =>
  Task.where(
    '#actor attempts to register the daily BOM leaving the tracking number empty',
    Enter.theValue('').into(BomsPage.trackingNumberField()),
    SubmitAlreadyOpenBomForm(),
  );

/** The "اما وزن هر یک از مواد اولیه ها را خالی میگذارد" step. */
export const AttemptToRegisterLeavingAllMaterialWeightsEmpty = (standardBom: {
  id: string;
  miCode: string;
}): Task =>
  Task.where(
    '#actor attempts to register the daily BOM leaving every material weight empty',
    ForEachClonedMaterialWeightField(
      '#actor clears every cloned material weight',
      standardBom,
      () => '',
    ),
    SubmitAlreadyOpenBomForm(),
  );

/** The "اما وزن هر یک از مواد اولیه ها را صفر میگذارد" step. */
export const AttemptToRegisterWithAllMaterialWeightsZero = (standardBom: {
  id: string;
  miCode: string;
}): Task =>
  Task.where(
    '#actor attempts to register the daily BOM with every material weight zeroed',
    ForEachClonedMaterialWeightField(
      '#actor zeroes every cloned material weight',
      standardBom,
      () => '0',
    ),
    SubmitAlreadyOpenBomForm(),
  );
