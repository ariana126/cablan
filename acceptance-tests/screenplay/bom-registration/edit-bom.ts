import { Check, d, Interaction, Task, Wait } from '@serenity-js/core';
import {
  and,
  containAtLeastOneItemThat,
  Ensure,
  equals,
  isGreaterThan,
  property,
} from '@serenity-js/assertions';
import {
  GetRequest,
  LastResponse,
  PatchRequest,
  Send,
} from '@serenity-js/rest';
import { Click, Enter, isVisible } from '@serenity-js/web';
import { BomsPage } from '../ui/boms-page';
import { OpenEditBomForm, WaitForTheBomFormToBeAnswered } from './bom-form';
import { NewBomDetails, theLastRegisteredBom } from './bom-details';
import { BomSummary, TheBomList, ViewBomList } from './view-bom-list';

type BomFieldChanges = Partial<
  Pick<NewBomDetails, 'orderNumber' | 'trackingNumber' | 'description'>
>;

const fieldFor = (field: keyof BomFieldChanges) => {
  switch (field) {
    case 'orderNumber':
      return BomsPage.orderNumberField();
    case 'trackingNumber':
      return BomsPage.trackingNumberField();
    case 'description':
      return BomsPage.descriptionField();
    default:
      throw new Error(`No daily BOM field mapped for "${String(field)}".`);
  }
};

const editRequestBody = (changes: BomFieldChanges) => {
  const body: Record<string, unknown> = {};
  if (changes.orderNumber !== undefined) body.orderNumber = changes.orderNumber;
  if (changes.trackingNumber !== undefined)
    body.trackingNumber = changes.trackingNumber;
  if (changes.description !== undefined) body.description = changes.description;
  return body;
};

export const EditBom = {
  /**
   * Edits a daily BOM through the real "edit daily BOM" form — the UI door this feature's
   * top-level "ویرایش می کند" scenario, and every "قانون" example driven by نیکروش, drive. Locates
   * the form by the daily BOM's *current* order number, since that's what the rendered list still
   * shows until the edit succeeds (unless the edit itself changes the order number). Mirrors
   * `screenplay/bom-registration/edit-standard-bom.ts#EditStandardBom.using`.
   */
  using: (currentOrderNumber: string, changes: BomFieldChanges): Task =>
    Task.where(
      d`#actor edits the daily BOM "${currentOrderNumber}"`,
      OpenEditBomForm(currentOrderNumber),
      ...(Object.keys(changes) as Array<keyof BomFieldChanges>).map((field) =>
        Enter.theValue(changes[field] ?? '').into(fieldFor(field)),
      ),
      Click.on(BomsPage.submitButton()),
      WaitForTheBomFormToBeAnswered(),
    ),

  /** The API door — used for the access-denied "تلاش می کند" rule. */
  viaApiUsing: (id: string, changes: BomFieldChanges): Task =>
    Task.where(
      d`#actor edits daily BOM ${id} (via API)`,
      Send.a(PatchRequest.to(`boms/${id}`).with(editRequestBody(changes))),
    ),
};

/**
 * Through the UI, assert what the visitor sees. Used for both this feature's generic
 * "اطلاعات ویرایش شده در سیستم ثبت شده باشد" (order number changed — the main "ویرایش می کند"
 * scenario) and its own "آنالیز روزانه ویرایش شده باشد" (description cleared — a rule with no
 * visible distinguishing value), so this checks the daily BOM's row is still present under
 * whichever order number is now current — the changed one if `changes.orderNumber` was given,
 * the unchanged one otherwise, which also proves the form closed without error.
 */
export const EnsureBomWasEditedWith = (changes: BomFieldChanges): Task => {
  const target = theLastRegisteredBom();
  const orderNumber = changes.orderNumber ?? target.orderNumber;
  return Task.where(
    d`#actor ensures the daily BOM was edited (now under order number "${orderNumber}")`,
    Wait.until(BomsPage.bomNamed(orderNumber), isVisible()),
  );
};

/**
 * Door-agnostic on purpose, mirroring
 * `screenplay/bom-registration/edit-standard-bom.ts#EnsureStandardBomWasNotEdited`: this feature's
 * "آنالیز روزانه ویرایش نشده باشد" step follows an API-driven attempt (access-denied) as well as
 * UI-driven ones (missing order/tracking number, invalid material weight), so rather than reading
 * `LastResponse` it re-queries the system and checks the one fact that matters regardless of door —
 * the daily BOM `theLastRegisteredBom()` names is still exactly as it was.
 */
export const EnsureBomWasNotEdited = (): Task => {
  const target = theLastRegisteredBom();
  return Task.where(
    d`#actor ensures daily BOM "${target.orderNumber}" was not edited`,
    Check.whether(LastResponse.status(), isGreaterThan(399))
      .andIfSo()
      .otherwise(
        ViewBomList(),
        Ensure.that(
          TheBomList(),
          containAtLeastOneItemThat(
            and(
              property('id', equals(target.id)),
              property('orderNumber', equals(target.orderNumber)),
            ),
          ),
        ),
      ),
  );
};

/** The "{actor} شماره شفارش آن را پاک می کند" step. */
export const AttemptToClearOrderNumber = (currentOrderNumber: string): Task =>
  Task.where(
    d`#actor attempts to clear the order number of "${currentOrderNumber}"`,
    OpenEditBomForm(currentOrderNumber),
    Enter.theValue('').into(BomsPage.orderNumberField()),
    Click.on(BomsPage.submitButton()),
    WaitForTheBomFormToBeAnswered(),
  );

/** The "{actor} شماره ردیابی آن را پاک می کند" step. */
export const AttemptToClearTrackingNumber = (
  currentOrderNumber: string,
): Task =>
  Task.where(
    d`#actor attempts to clear the tracking number of "${currentOrderNumber}"`,
    OpenEditBomForm(currentOrderNumber),
    Enter.theValue('').into(BomsPage.trackingNumberField()),
    Click.on(BomsPage.submitButton()),
    WaitForTheBomFormToBeAnswered(),
  );

/** The "{actor} توضیحیات آن را پاک می کند" step. Unlike the other three fields, this one succeeds. */
export const AttemptToClearDescription = (currentOrderNumber: string): Task =>
  Task.where(
    d`#actor clears the description of "${currentOrderNumber}"`,
    OpenEditBomForm(currentOrderNumber),
    Enter.theValue('').into(BomsPage.descriptionField()),
    Click.on(BomsPage.submitButton()),
    WaitForTheBomFormToBeAnswered(),
  );

/**
 * Reaches one specific, already-cloned material's weight field on the currently-open edit form —
 * the first material of the first component, positionally, since neither "پاک کردن وزن برای مواد
 * اولیه" nor "صفر وزن برای مواد اولیه" cares *which* material, only that changing *one* of them is
 * enough to invalidate the whole daily BOM. Re-fetches `GET /boms` to learn that material's name,
 * the one thing `BomsPage.weightField(materialName)` needs — mirroring
 * `register-bom.ts#ForEachClonedMaterialWeightField`'s own reasoning for doing the same lookup.
 */
const SetWeightOfFirstMaterial = (value: string): Interaction =>
  Interaction.where(
    `#actor sets the weight of the first cloned material to "${value}"`,
    async (actor) => {
      const target = theLastRegisteredBom();
      await Send.a(GetRequest.to('boms')).performAs(actor);
      const boms = await actor.answer(LastResponse.body<BomSummary[]>());
      const found = boms.find((bom) => bom.id === target.id);
      if (!found) {
        throw new Error(
          `Daily BOM "${target.orderNumber}" (${target.id}) was not found while reaching its ` +
            'first cloned material weight field.',
        );
      }
      const firstMaterial = found.components[0]?.materials[0];
      if (!firstMaterial) {
        throw new Error(
          `Daily BOM "${target.orderNumber}" (${target.id}) has no material to set the weight ` +
            'of.',
        );
      }
      const weightField = await actor.answer(
        BomsPage.weightField(firstMaterial.name),
      );
      await weightField.enterValue(value);
    },
  );

/** The "{actor} وزن یکی از مواد اولیه آن را پاک می کند" step. */
export const AttemptToClearWeightOfOneMaterial = (
  currentOrderNumber: string,
): Task =>
  Task.where(
    d`#actor attempts to clear the weight of one material of "${currentOrderNumber}"`,
    OpenEditBomForm(currentOrderNumber),
    SetWeightOfFirstMaterial(''),
    Click.on(BomsPage.submitButton()),
    WaitForTheBomFormToBeAnswered(),
  );

/** The "{actor} وزن یکی از مواد اولیه آن را صفر می کند" step. */
export const AttemptToZeroWeightOfOneMaterial = (
  currentOrderNumber: string,
): Task =>
  Task.where(
    d`#actor attempts to zero the weight of one material of "${currentOrderNumber}"`,
    OpenEditBomForm(currentOrderNumber),
    SetWeightOfFirstMaterial('0'),
    Click.on(BomsPage.submitButton()),
    WaitForTheBomFormToBeAnswered(),
  );
