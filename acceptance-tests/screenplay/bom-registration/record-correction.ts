import {
  AnswersQuestions,
  CollectsArtifacts,
  d,
  Interaction,
  Question,
  Task,
  UsesAbilities,
} from '@serenity-js/core';
import { contain, Ensure, equals } from '@serenity-js/assertions';
import {
  GetRequest,
  LastResponse,
  PatchRequest,
  Send,
} from '@serenity-js/rest';
import { Click, Enter } from '@serenity-js/web';
import { MaterialsPage } from '../ui/materials-page';
import { ComponentsPage } from '../ui/components-page';
import { ProductsPage } from '../ui/products-page';
import {
  ConfirmTheCorrection,
  ConfirmTheCorrectionIfAsked,
  DeclineTheCorrection,
  withTheCorrectionApplied,
} from '../common/correction-confirmation';
import { realNameFor } from '../common/personas';
import { withLatinDigits } from '../common/persian-digits';
import {
  OpenEditMaterialForm,
  WaitForTheMaterialFormToBeAnswered,
} from './materials-form';
import {
  OpenEditComponentForm,
  WaitForTheComponentFormToBeAnswered,
} from './components-form';
import {
  OpenEditProductForm,
  WaitForTheProductFormToBeAnswered,
} from './products-form';
import { freshMaterialDetails } from './material-details';
import { RegisterMaterialAndRememberIt } from './register-material';
import {
  MaterialSummary,
  TheMaterialList,
  ViewMaterialList,
} from './view-material-list';
import { taskDependingOn } from '../common/task-depending-on';
import { ProductSummary } from './view-product-list';
import { BomSummary } from './view-bom-list';
import { StandardBomSummary } from './view-standard-bom-list';

/**
 * Issue #110 in bom-registration: the System Admin corrects the name (and a material's code) of a
 * material, component or product that other records use, and the correction reaches every related
 * record and snapshot — the products composed of it, the standard BOMs cloned from them and the
 * daily BOMs registered on those — without touching weights or reviews.
 *
 * The corrections are made through each record's own edit dialog, then the confirmation
 * (`common/correction-confirmation.ts`); the one API door is the audit-log precondition («… تغییر
 * داده و اعمال آن … را تایید کرده باشد»), `PATCH materials/:id` with `applyToRelatedRecords: true`.
 * Every fact is read over the API by the system admin (`common/observer.ts
 * #performAsTheSystemAdmin`), so the actor's own browser and last response are left alone.
 */

export interface MaterialCorrection {
  name?: string;
  code?: string;
}

// ---------------------------------------------------------------------------------------------
// Reads

type Reader = UsesAbilities & AnswersQuestions & CollectsArtifacts;

const read = async <T>(actor: Reader, resource: string): Promise<T> => {
  await Send.a(GetRequest.to(resource)).performAs(actor);
  await Ensure.that(LastResponse.status(), equals(200)).performAs(actor);
  return actor.answer(LastResponse.body<T>());
};

const theOne = <T>(matches: T[], what: string): T => {
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one ${what}, found ${matches.length}.`);
  }
  return matches[0];
};

const theMaterialNamed = async (
  actor: Reader,
  name: string,
): Promise<MaterialSummary> =>
  theOne(
    (await read<MaterialSummary[]>(actor, 'materials')).filter(
      (material) => material.name === name,
    ),
    `material named "${name}"`,
  );

const theProductNamed = async (
  actor: Reader,
  name: string,
): Promise<ProductSummary> =>
  theOne(
    (await read<ProductSummary[]>(actor, 'products')).filter(
      (product) => product.name === name,
    ),
    `product named "${name}"`,
  );

/** `GET boms/:id` — the detail view, which names the product and carries the review. */
interface DailyBomDetail {
  id: string;
  productName: string;
  approvalStatus: string;
  reviewedBy: string | null;
  components: BomSummary['components'];
}

const theDailyBomWithOrderNumber = async (
  actor: Reader,
  orderNumber: string,
): Promise<DailyBomDetail> => {
  const { id } = theOne(
    (await read<BomSummary[]>(actor, 'boms')).filter(
      (bom) => bom.orderNumber === orderNumber,
    ),
    `daily BOM with order number "${orderNumber}"`,
  );
  return read<DailyBomDetail>(actor, `boms/${id}`);
};

/** `GET standard-boms` also names each standard BOM's product (a snapshot the correction rewrites). */
type StandardBomWithProductName = StandardBomSummary & { productName: string };

const theStandardBomWithMiCode = async (
  actor: Reader,
  miCode: string,
): Promise<StandardBomWithProductName> =>
  theOne(
    (await read<StandardBomWithProductName[]>(actor, 'standard-boms')).filter(
      (standardBom) =>
        withLatinDigits(standardBom.miCode) === withLatinDigits(miCode),
    ),
    `standard BOM with MI code "${miCode}"`,
  );

/** Every (id, name) a composition names as a material. */
const materialsOf = (
  composition: Array<{ materials: Array<{ id: string; name: string }> }>,
): Array<{ id: string; name: string }> =>
  composition.flatMap((component) =>
    component.materials.map(({ id, name }) => ({ id, name })),
  );

// ---------------------------------------------------------------------------------------------
// The corrections

/** The material dialog has answered: closed, or showing a field error or its error region. */
const theMaterialFormHasAnswered = async (
  actor: UsesAbilities & AnswersQuestions,
): Promise<boolean> => {
  if (!(await (await actor.answer(MaterialsPage.nameField())).isVisible())) {
    return true;
  }
  for (const refusal of [
    MaterialsPage.codeError(),
    MaterialsPage.nameError(),
    MaterialsPage.dialogError(),
  ]) {
    if (await (await actor.answer(refusal)).isVisible()) {
      return true;
    }
  }
  return false;
};

const FillInTheMaterialCorrection = (
  currentName: string,
  { name, code }: MaterialCorrection,
): Task =>
  Task.where(
    d`#actor changes material "${currentName}" in its edit form`,
    OpenEditMaterialForm(currentName),
    ...(code === undefined
      ? []
      : [Enter.theValue(code).into(MaterialsPage.codeField())]),
    ...(name === undefined
      ? []
      : [Enter.theValue(name).into(MaterialsPage.nameField())]),
    Click.on(MaterialsPage.submitButton()),
  );

export const CorrectMaterial = {
  /**
   * «… نام و کد مواد اولیه … را به … و … تغییر می دهد و اعمال آن … را تایید می کند» — the edit
   * dialog, then the confirmation it must open, then the dialog's own answer.
   */
  using: (currentName: string, correction: MaterialCorrection): Task =>
    Task.where(
      d`#actor corrects material "${currentName}" to ${correction}`,
      FillInTheMaterialCorrection(currentName, correction),
      ConfirmTheCorrection(),
      WaitForTheMaterialFormToBeAnswered(),
    ),

  /**
   * «… کد مواد اولیه … را به «<a taken code>» تغییر می دهد و اعمال آن … را تایید می کند» — the
   * same, with the confirmation given if the site asks for it before refusing the duplicate
   * (`ConfirmTheCorrectionIfAsked`).
   */
  evenIfRefusedUsing: (
    currentName: string,
    correction: MaterialCorrection,
  ): Task =>
    Task.where(
      d`#actor tries to correct material "${currentName}" to ${correction}`,
      FillInTheMaterialCorrection(currentName, correction),
      ConfirmTheCorrectionIfAsked(theMaterialFormHasAnswered),
      WaitForTheMaterialFormToBeAnswered(),
    ),

  /** «… تغییر می دهد اما اعمال آن … را تایید نمی کند» — the confirmation is asked, and declined. */
  withoutConfirmingUsing: (
    currentName: string,
    correction: MaterialCorrection,
  ): Task =>
    Task.where(
      d`#actor changes material "${currentName}" to ${correction} without confirming`,
      FillInTheMaterialCorrection(currentName, correction),
      DeclineTheCorrection(),
    ),

  /**
   * `PATCH materials/:id` `{ name, code, applyToRelatedRecords: true }` — the passive «… تغییر داده
   * و اعمال آن … را تایید کرده باشد». The route takes the whole material, so a field left out of
   * the correction is sent as it is. Checks the 204, as a precondition must.
   */
  viaApiUsing: (currentName: string, correction: MaterialCorrection): Task =>
    Task.where(
      d`#actor has corrected material "${currentName}" to ${correction} (via API)`,
      Interaction.where(
        d`#actor sends the correction of material "${currentName}"`,
        async (actor) => {
          const material = await theMaterialNamed(actor, currentName);
          await Send.a(
            PatchRequest.to(`materials/${material.id}`).with(
              withTheCorrectionApplied({
                name: correction.name ?? material.name,
                code: correction.code ?? material.code,
              }),
            ),
          ).performAs(actor);
        },
      ),
      Ensure.that(LastResponse.status(), equals(204)),
    ),
};

export const CorrectComponent = {
  /** «… اسم جز … را به … تغییر می دهد و اعمال آن … را تایید می کند». */
  using: (currentName: string, newName: string): Task =>
    Task.where(
      d`#actor corrects the name of component "${currentName}" to "${newName}"`,
      OpenEditComponentForm(currentName),
      Enter.theValue(newName).into(ComponentsPage.nameField()),
      Click.on(ComponentsPage.submitButton()),
      ConfirmTheCorrection(),
      WaitForTheComponentFormToBeAnswered(),
    ),
};

export const CorrectProduct = {
  /** «… نام محصول … را به … تغییر می دهد و اعمال آن … را تایید می کند». */
  using: (currentName: string, newName: string): Task =>
    Task.where(
      d`#actor corrects the name of product "${currentName}" to "${newName}"`,
      OpenEditProductForm(currentName),
      Enter.theValue(newName).into(ProductsPage.nameField()),
      Click.on(ProductsPage.submitButton()),
      ConfirmTheCorrection(),
      WaitForTheProductFormToBeAnswered(),
    ),
};

// ---------------------------------------------------------------------------------------------
// Preconditions

/**
 * «مواد اولیه «…» با کد «…» …» as a precondition that tolerates what a background left behind:
 * registered unless a material of that name and code exists. viewing-audit-log's background
 * registers «مسی» with the code «M-100» (`audit-log-fixtures.ts`, row 5), so there it is reused —
 * and its registration entry is the one «رویداد ثبت مواد اولیه همچنان …» reads. A material of that
 * name with another code is a contradiction the Gherkin does not state, and fails the step.
 */
export const RegisterMaterialWithCodeUnlessRegistered = (
  name: string,
  code: string,
): Task =>
  Task.where(
    d`#actor makes sure material "${name}" is registered with code "${code}"`,
    ViewMaterialList(),
    taskDependingOn(
      `#actor registers material "${name}" unless it is`,
      Question.about(
        d`the codes of the materials named "${name}"`,
        async (actor) =>
          (await actor.answer(TheMaterialList()))
            .filter((material) => material.name === name)
            .map((material) => material.code),
      ),
      (codes) =>
        codes.length === 0
          ? [
              RegisterMaterialAndRememberIt(
                freshMaterialDetails({ name, code }),
              ),
              Ensure.that(LastResponse.status(), equals(201)),
            ]
          : [Ensure.that(codes, equals<Array<string | null>>([code]))],
    ),
  );

/** The weights of the daily BOMs noted when a precondition registered them, by order number. */
const weightsWhenRegistered = new Map<string, string[]>();

/** Cleared before every scenario. */
export const forgetTheNotedDailyBomWeights = (): void => {
  weightsWhenRegistered.clear();
};

/** Every material line of a daily BOM as `componentId/materialId=weight`, sorted — by ids, since
 * a correction is meant to change the names. */
const weightLinesOf = (bom: DailyBomDetail): string[] =>
  bom.components
    .flatMap((component) =>
      component.materials.map(
        (material) => `${component.id}/${material.id}=${material.weight}`,
      ),
    )
    .sort();

/** Notes the weights of a daily BOM just registered, for «وزن های آنالیز روزانه … تغییر نکرده باشد». */
export const NoteTheWeightsOfDailyBom = (orderNumber: string): Interaction =>
  Interaction.where(
    d`#actor notes the weights of daily BOM "${orderNumber}"`,
    async (actor) => {
      weightsWhenRegistered.set(
        orderNumber,
        weightLinesOf(await theDailyBomWithOrderNumber(actor, orderNumber)),
      );
    },
  );

// ---------------------------------------------------------------------------------------------
// Facts

/**
 * «محصول «…» (همچنان) مواد اولیه «…» با کد «…» را داشته باشد» — the product's composition names
 * the material by that name, and that line is the material registered with that code. The
 * composition carries no code of its own (`GET products`), so the code is the referenced
 * material's.
 */
export const EnsureProductUsesMaterial = (
  productName: string,
  materialName: string,
  code: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures product "${productName}" uses material "${materialName}" with code "${code}"`,
    async (actor) => {
      const material = await theMaterialNamed(actor, materialName);
      await Ensure.that(material.code, equals<string | null>(code)).performAs(
        actor,
      );
      const product = await theProductNamed(actor, productName);
      await Ensure.that(
        materialsOf(product.components),
        contain({ id: material.id, name: materialName }),
      ).performAs(actor);
    },
  );

/** «… و آنالیز روزانه «…» مواد اولیه «…» با کد «…» را داشته باشند» — as for a product, on `GET boms/:id`. */
export const EnsureDailyBomUsesMaterial = (
  orderNumber: string,
  materialName: string,
  code: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures daily BOM "${orderNumber}" uses material "${materialName}" with code "${code}"`,
    async (actor) => {
      const material = await theMaterialNamed(actor, materialName);
      await Ensure.that(material.code, equals<string | null>(code)).performAs(
        actor,
      );
      const bom = await theDailyBomWithOrderNumber(actor, orderNumber);
      await Ensure.that(
        materialsOf(bom.components),
        contain({ id: material.id, name: materialName }),
      ).performAs(actor);
    },
  );

/** «وزن های آنالیز روزانه «…» تغییر نکرده باشد» — the weights noted when it was registered. */
export const EnsureWeightsOfDailyBomAreUnchanged = (
  orderNumber: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures the weights of daily BOM "${orderNumber}" are unchanged`,
    async (actor) => {
      const noted = weightsWhenRegistered.get(orderNumber);
      if (!noted) {
        throw new Error(
          `The weights of daily BOM "${orderNumber}" were not noted when it was registered.`,
        );
      }
      await Ensure.that(
        weightLinesOf(await theDailyBomWithOrderNumber(actor, orderNumber)),
        equals(noted),
      ).performAs(actor);
    },
  );

/** «آنالیز روزانه «…» همچنان توسط «…» تایید شده باشد» — still approved, by that persona. */
export const EnsureDailyBomIsStillApprovedBy = (
  orderNumber: string,
  approverName: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures daily BOM "${orderNumber}" is still approved by ${approverName}`,
    async (actor) => {
      const bom = await theDailyBomWithOrderNumber(actor, orderNumber);
      await Ensure.that(
        { approvalStatus: bom.approvalStatus, reviewedBy: bom.reviewedBy },
        equals<{ approvalStatus: string; reviewedBy: string | null }>({
          approvalStatus: 'approved',
          reviewedBy: realNameFor(approverName),
        }),
      ).performAs(actor);
    },
  );

/** «محصول «…» جز «…» را داشته باشد» — its composition names the component. */
export const EnsureProductHasComponent = (
  productName: string,
  componentName: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures product "${productName}" has component "${componentName}"`,
    async (actor) => {
      const product = await theProductNamed(actor, productName);
      await Ensure.that(
        product.components.map((component) => component.name),
        contain(componentName),
      ).performAs(actor);
    },
  );

/**
 * «آنالیز استاندارد «…» و آنالیز روزانه «…» مربوط به محصول «…» باشند» — the standard BOM still
 * belongs to the product of that name and names it so, and the daily BOM names it so too.
 */
export const EnsureStandardAndDailyBomBelongToProduct = (
  miCode: string,
  orderNumber: string,
  productName: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures standard BOM "${miCode}" and daily BOM "${orderNumber}" belong to product "${productName}"`,
    async (actor) => {
      const product = await theProductNamed(actor, productName);
      const standardBom = await theStandardBomWithMiCode(actor, miCode);
      await Ensure.that(
        {
          productId: standardBom.productId,
          productName: standardBom.productName,
        },
        equals({ productId: product.id, productName }),
      ).performAs(actor);
      const bom = await theDailyBomWithOrderNumber(actor, orderNumber);
      await Ensure.that(bom.productName, equals(productName)).performAs(actor);
    },
  );
