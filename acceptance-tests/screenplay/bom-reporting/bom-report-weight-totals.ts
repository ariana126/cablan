import { d, Question, Task } from '@serenity-js/core';
import { Ensure, equals } from '@serenity-js/assertions';
import {
  TheStandardBomList,
  ViewStandardBomList,
} from '../bom-registration/view-standard-bom-list';
import { RegisterStandardBomWithStandardWeights } from '../bom-registration/register-standard-bom';
import {
  NewComponentInStandardBom,
  theStandardBomRegisteredWithMiCode,
} from '../bom-registration/standard-bom-details';
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

/**
 * The material-weight totals the scenario states for the background's standard BOMs, by MI code.
 *
 * «آنالیز استاندارد با کد MI «…» با مجموع وزن مواد اولیه N …» comes *after* the background, which
 * has already registered daily BOMs on that standard BOM — and a standard BOM with a daily BOM can
 * no longer be edited (issue #94). So the total is read off the scenario before the background
 * runs (`exporting-bom.steps.ts`'s `Before` hook) and the background registers the standard BOM
 * with those weights in the first place; the step itself then only confirms it.
 */
const plannedTotals = new Map<string, number>();

export const planStandardBomMaterialWeightTotal = (
  miCode: string,
  total: number,
): void => {
  plannedTotals.set(miCode, total);
};

export const forgetPlannedStandardBomMaterialWeightTotals = (): void => {
  plannedTotals.clear();
};

/**
 * `composition` with its standard weights spread to the total planned for `miCode`, in its own
 * order — or unchanged when the scenario plans none. Applied by the background as the standard BOM
 * is registered (`bom-report-fixtures.ts`).
 */
export const weighedAsPlannedFor =
  (miCode: string) =>
  (composition: NewComponentInStandardBom[]): NewComponentInStandardBom[] => {
    const total = plannedTotals.get(miCode);
    if (total === undefined) {
      return composition;
    }
    const weights = weightsTotalling(
      total,
      composition.flatMap((component) => component.materials).length,
    );
    let next = 0;
    return composition.map((component) => ({
      ...component,
      materials: component.materials.map((material) => ({
        ...material,
        weightInGrams: weights[next++],
      })),
    }));
  };

/**
 * «آنالیز استاندارد با کد MI «…» با مجموع وزن مواد اولیه N در سیستم ثبت شده باشد» — the standard BOM
 * the background registered for that MI code has material weights totalling N (it was registered
 * that way: see `plannedTotals`). The daily BOMs cloned from it keep their own weights.
 */
export const EnsureStandardBomMaterialWeightsTotal = (
  miCode: string,
  total: number,
): Task =>
  Task.where(
    d`#actor ensures the material weights of standard BOM "${miCode}" total ${total}`,
    ViewStandardBomList(),
    Ensure.that(
      Question.about(
        d`the total material weight of standard BOM "${miCode}"`,
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
          return standardBom.components
            .flatMap((component) => component.materials)
            .reduce((sum, material) => sum + material.weight, 0);
        },
      ),
      equals(total),
    ),
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
