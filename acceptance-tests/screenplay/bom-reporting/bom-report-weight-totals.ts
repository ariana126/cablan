import { d, Interaction, Task } from '@serenity-js/core';
import { Ensure, equals } from '@serenity-js/assertions';
import { LastResponse, PatchRequest, Send } from '@serenity-js/rest';
import {
  StandardBomSummary,
  TheStandardBomList,
  ViewStandardBomList,
} from '../bom-registration/view-standard-bom-list';
import { RegisterStandardBomWithStandardWeights } from '../bom-registration/register-standard-bom';
import { theStandardBomRegisteredWithMiCode } from '../bom-registration/standard-bom-details';
import { RegisterBomAndRememberIt } from '../bom-registration/register-bom';
import {
  freshComponentInProduct,
  freshMaterialInComponent,
} from '../bom-registration/product-details';

/**
 * Test data for `exporting-bom.feature`'s weight-total rules — «وزن 1 متر», «وزن متراژ استاندارد»
 * and «اختلاف با استاندارد» in the «هر آنالیز روزانه یک ردیف» export. Each is a passive `Given`, so
 * each goes through the API, as an actor allowed to register and edit standard BOMs.
 */

/**
 * `count` material weights summing to exactly `total`: every line but the last weighs 1 and the
 * last carries the rest. Whole numbers wherever `total` is one, so the sum is exact in floating
 * point and «اختلاف با استاندارد» can come out as exactly `0`. Only the total is a fact the scenario
 * states; how it is spread over the lines is not.
 */
const weightsTotalling = (total: number, count: number): number[] => {
  const rest = total - (count - 1);
  if (rest <= 0) {
    throw new Error(
      `Cannot spread a total material weight of ${total} over ${count} materials with a ` +
        'positive weight each.',
    );
  }
  return [...Array<number>(count - 1).fill(1), rest];
};

/** The standard BOM's composition re-weighted to `total`, in its own order, as a
 * `PATCH standard-boms/:id` body — `components` replaces the composition wholesale. */
const compositionWeighingInTotal = (
  standardBom: StandardBomSummary,
  total: number,
) => {
  const weights = weightsTotalling(
    total,
    standardBom.components.flatMap((component) => component.materials).length,
  );
  let next = 0;
  return {
    components: standardBom.components.map((component) => ({
      componentId: component.id,
      materials: component.materials.map((material) => ({
        materialId: material.id,
        weight: weights[next++],
      })),
    })),
  };
};

/**
 * «آنالیز استاندارد با کد MI «…» با مجموع وزن مواد اولیه N در سیستم ثبت شده باشد» — the standard BOM
 * the background already registered for that MI code is edited so that its CURRENT material
 * weights total N. The daily BOMs cloned from it keep their own weights.
 */
export const MakeStandardBomMaterialWeightsTotal = (
  miCode: string,
  total: number,
): Task =>
  Task.where(
    d`#actor makes the material weights of standard BOM "${miCode}" total ${total} (via API)`,
    ViewStandardBomList(),
    Interaction.where(
      d`#actor re-weighs the materials of standard BOM "${miCode}"`,
      async (actor) => {
        const standardBom = (await actor.answer(TheStandardBomList())).find(
          (candidate) => candidate.miCode === miCode,
        );
        if (!standardBom) {
          throw new Error(
            `No standard BOM with MI code "${miCode}" is registered — expected the background ` +
              'to have registered it.',
          );
        }
        await Send.a(
          PatchRequest.to(`standard-boms/${standardBom.id}`).with(
            compositionWeighingInTotal(standardBom, total),
          ),
        ).performAs(actor);
      },
    ),
    Ensure.that(LastResponse.status(), equals(204)),
  );

/**
 * «آنالیز استاندارد با کد MI «…» و متراژ استاندارد L با مجموع وزن مواد اولیه N …» — a fresh product
 * of one component and one material, and a standard BOM cloning it whose one material weighs N.
 */
export const RegisterStandardBomWithMaterialWeightTotal = (
  miCode: string,
  standardLength: number,
  total: number,
): Task =>
  RegisterStandardBomWithStandardWeights(
    miCode,
    [
      {
        componentName: freshComponentInProduct().name,
        materialName: freshMaterialInComponent().name,
        standardWeightInGrams: total,
      },
    ],
    { standardLength: `${standardLength}` },
  );

/**
 * «آنالیز روزانه با شماره سفارش «…» برای کد MI «…» با یک مواد اولیه به وزن W …» — a daily BOM cloned
 * from the standard BOM this scenario registered with that MI code (a one-material one, per
 * `RegisterStandardBomWithMaterialWeightTotal`), its material weighing W.
 */
export const RegisterDailyBomWithOneMaterialWeighing = (
  orderNumber: string,
  miCode: string,
  weight: number,
): Task =>
  Task.where(
    d`#actor registers daily BOM "${orderNumber}" for standard BOM "${miCode}" with one material weighing ${weight} (via API)`,
    RegisterBomAndRememberIt(
      theStandardBomRegisteredWithMiCode(miCode),
      { orderNumber },
      () => weight,
    ),
  );
