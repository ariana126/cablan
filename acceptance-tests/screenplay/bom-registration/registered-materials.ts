import {
  Activity,
  actorCalled,
  actorInTheSpotlight,
  d,
  Interaction,
  Question,
  QuestionAdapter,
  Task,
} from '@serenity-js/core';
import { Ensure, equals } from '@serenity-js/assertions';
import {
  LastResponse,
  PatchRequest,
  PostRequest,
  Send,
} from '@serenity-js/rest';
import { LogIn } from '../common/login';
import { LogInAsPersona, personaIdentity } from '../common/personas';
import { keepingTheSpotlight } from '../common/spotlight';
import {
  MaterialSummary,
  TheMaterialList,
  ViewMaterialList,
} from './view-material-list';
import { RegisterProduct } from './register-product';
import {
  freshComponentInProduct,
  freshProductDetails,
} from './product-details';

/**
 * Facts about the system's registered materials, read and set over HTTP — the material vocabulary
 * `importing-materials.feature` and viewing-audit-log.feature's bulk-import rules share. Both
 * features ask, after an attempt, «… هیچ تغییری در مواد اولیه سیستم اعمال نشده باشد» and then «و
 * پیغام خطای …», so a fact must be read without overwriting the attempting actor's last response:
 * every read here is made by an **observer** — the system admin, or management when the system
 * admin is the one who just acted (`observerName`). Both may list materials.
 */

/** A material as these facts compare it: name and code, `''` for a missing code. */
export interface MaterialFact {
  name: string;
  code: string;
}

const factOf = (material: MaterialSummary): MaterialFact => ({
  name: material.name,
  code: material.code ?? '',
});

const byNameThenCode = (a: MaterialFact, b: MaterialFact): number =>
  `${a.name}|${a.code}`.localeCompare(`${b.name}|${b.code}`);

const sortedFacts = (facts: MaterialFact[]): MaterialFact[] =>
  [...facts].sort(byNameThenCode);

const nameInTheSpotlight = (): string | undefined => {
  try {
    return actorInTheSpotlight().name;
  } catch {
    return undefined;
  }
};

/** Whoever reads a fact without disturbing the actor in the spotlight's last response. */
const observerName = (): string =>
  nameInTheSpotlight() === 'یاشار' ? 'مصطفی' : 'یاشار';

/**
 * Runs `activities` as the observer, logged in afresh over the API (a plain login — no persona
 * provisioning, which would borrow یاشار and overwrite *his* last response), leaving the spotlight
 * where it was.
 */
const asTheObserver = (...activities: Activity[]): Promise<void> => {
  const name = observerName();
  const identity = personaIdentity(name);
  return keepingTheSpotlight(() =>
    actorCalled(name).attemptsTo(
      LogIn.viaApiUsing(identity.username, identity.password),
      ...activities,
    ),
  );
};

/** The materials from the last `ViewMaterialList()`, as facts, sorted. */
const TheMaterialFacts = (): QuestionAdapter<MaterialFact[]> =>
  Question.about('the registered materials', async (actor) =>
    sortedFacts((await actor.answer(TheMaterialList())).map(factOf)),
  );

const snapshots = new Map<string, MaterialSummary[]>();

/** The moment a snapshot is taken before — see `noteTheMaterialsBefore`. */
export type MaterialMoment = 'the change' | 'the first import';

const RememberTheMaterialsBefore = (moment: MaterialMoment): Interaction =>
  Interaction.where(
    d`#actor notes the materials before ${moment}`,
    async (actor) => {
      snapshots.set(moment, await actor.answer(TheMaterialList()));
    },
  );

const theMaterialsBefore = (moment: MaterialMoment): MaterialSummary[] => {
  const snapshot = snapshots.get(moment);
  if (!snapshot) {
    throw new Error(
      `No note was taken of the materials before ${moment} — expected the step that ` +
        'performs it to take one first.',
    );
  }
  return snapshot;
};

/**
 * Takes note of every registered material just before an import, a confirmation or a reversion is
 * attempted — what «هیچ تغییری در مواد اولیه سیستم اعمال نشده باشد» and «مواد اولیه سیستم به حالت
 * پیش از بارگذاری گروهی اول برگشته باشند» compare against. Every step that performs one of those
 * calls this first, so no note outlives its scenario.
 */
export const noteTheMaterialsBefore = (moment: MaterialMoment): Promise<void> =>
  asTheObserver(ViewMaterialList(), RememberTheMaterialsBefore(moment));

/** «(هنوز) هیچ تغییری در مواد اولیه سیستم اعمال نشده باشد» */
export const ensureTheMaterialsAreAsBefore = (
  moment: MaterialMoment,
): Promise<void> => {
  const expected = sortedFacts(theMaterialsBefore(moment).map(factOf));
  return asTheObserver(
    ViewMaterialList(),
    Ensure.that(TheMaterialFacts(), equals(expected)),
  );
};

/** «مواد اولیه زیر در سیستم ثبت شده باشند» — exactly these, no more. */
export const ensureTheMaterialsAreExactly = (
  expected: MaterialFact[],
): Promise<void> =>
  asTheObserver(
    ViewMaterialList(),
    Ensure.that(TheMaterialFacts(), equals(sortedFacts(expected))),
  );

const TheMaterialsNamed = (name: string): QuestionAdapter<MaterialFact[]> =>
  Question.about(d`the materials named "${name}"`, async (actor) =>
    (await actor.answer(TheMaterialFacts())).filter(
      (material) => material.name === name,
    ),
  );

const TheMaterialsWithCode = (code: string): QuestionAdapter<MaterialFact[]> =>
  Question.about(d`the materials with code "${code}"`, async (actor) =>
    (await actor.answer(TheMaterialFacts())).filter(
      (material) => material.code === code,
    ),
  );

/** «مواد اولیه «…» با کد «…» در سیستم ثبت شده باشد» (as an outcome). */
export const ensureMaterialIsRegisteredWith = (
  name: string,
  code: string,
): Promise<void> =>
  asTheObserver(
    ViewMaterialList(),
    Ensure.that(TheMaterialsNamed(name), equals([{ name, code }])),
  );

/** «کد مواد اولیه «…» «…» باشد» */
export const ensureCodeOfMaterialIs = (
  name: string,
  code: string,
): Promise<void> => ensureMaterialIsRegisteredWith(name, code);

/** «نام مواد اولیه با کد «…» «…» باشد» */
export const ensureNameOfMaterialWithCodeIs = (
  code: string,
  name: string,
): Promise<void> =>
  asTheObserver(
    ViewMaterialList(),
    Ensure.that(TheMaterialsWithCode(code), equals([{ name, code }])),
  );

/** «مواد اولیه «…» در سیستم ثبت نشده باشد» */
export const ensureNoMaterialIsNamed = (name: string): Promise<void> =>
  asTheObserver(
    ViewMaterialList(),
    Ensure.that(TheMaterialsNamed(name), equals([])),
  );

/** «مواد اولیه «…» همچنان در سیستم ثبت شده باشد» */
export const ensureAMaterialIsNamed = (name: string): Promise<void> =>
  asTheObserver(
    ViewMaterialList(),
    Ensure.that(
      Question.about(
        d`how many materials are named "${name}"`,
        async (actor) => (await actor.answer(TheMaterialsNamed(name))).length,
      ),
      equals(1),
    ),
  );

/** «{n} مواد اولیه جدید در سیستم ثبت شده باشد» — materials the system did not hold before. */
export const ensureNewMaterialsCountIs = (
  moment: MaterialMoment,
  expected: number,
): Promise<void> => {
  const knownIds = new Set(theMaterialsBefore(moment).map((m) => m.id));
  return asTheObserver(
    ViewMaterialList(),
    Ensure.that(
      Question.about(
        `how many materials are new since ${moment}`,
        async (actor) =>
          (await actor.answer(TheMaterialList())).filter(
            (material) => !knownIds.has(material.id),
          ).length,
      ),
      equals(expected),
    ),
  );
};

/** «مواد اولیه سیستم به حالت پیش از بارگذاری گروهی اول برگشته باشند» */
export const ensureTheMaterialsAreAsBeforeTheFirstImport = (): Promise<void> =>
  ensureTheMaterialsAreAsBefore('the first import');

/**
 * Makes «these materials are registered, with these codes» true, as the system admin over the API.
 * Idempotent and tolerant of what a background left behind: viewing-audit-log's background already
 * registers a «مسی» (with a generated code), so a material that exists under the name gets its code
 * edited rather than a second registration that would be refused.
 */
export const registerMaterialsAsAPrecondition = (
  materials: MaterialFact[],
): Promise<void> =>
  keepingTheSpotlight(async () => {
    const admin = actorCalled('یاشار');
    await admin.attemptsTo(LogInAsPersona('یاشار'), ViewMaterialList());
    const existing = await admin.answer(TheMaterialList());
    for (const material of materials) {
      const registered = existing.find((m) => m.name === material.name);
      if (registered && (registered.code ?? '') === material.code) {
        continue;
      }
      await admin.attemptsTo(
        registered
          ? Send.a(
              PatchRequest.to(`materials/${registered.id}`).with({
                name: material.name,
                code: material.code,
              }),
            )
          : Send.a(PostRequest.to('materials').with({ ...material })),
        Ensure.that(LastResponse.status(), equals(registered ? 204 : 201)),
      );
    }
  });

const TheIdOfTheMaterialNamed = (name: string): QuestionAdapter<string> =>
  Question.about(d`the id of the material named "${name}"`, async (actor) => {
    const material = (await actor.answer(TheMaterialList())).find(
      (m) => m.name === name,
    );
    if (!material) {
      throw new Error(`No material named "${name}" is registered.`);
    }
    return material.id;
  });

/** «{actor} کد مواد اولیه «…» را به «…» تغییر داده باشد» — an ordinary edit, over the API. */
export const changeMaterialCodeAsAPrecondition = (
  editorName: string,
  name: string,
  code: string,
): Promise<void> =>
  keepingTheSpotlight(() =>
    actorCalled(editorName).attemptsTo(
      LogInAsPersona(editorName),
      ViewMaterialList(),
      Task.where(
        d`#actor changes the code of "${name}" to "${code}"`,
        Send.a(
          PatchRequest.to(
            Question.about(
              'the material URL',
              async (actor) =>
                `materials/${await actor.answer(TheIdOfTheMaterialNamed(name))}`,
            ),
          ).with({ name, code }),
        ),
        Ensure.that(LastResponse.status(), equals(204)),
      ),
    ),
  );

/** «مواد اولیه «…» در یک محصول استفاده شده باشد» — a fresh product whose one component uses it. */
export const useMaterialInAProductAsAPrecondition = (
  name: string,
): Promise<void> =>
  keepingTheSpotlight(async () => {
    const admin = actorCalled('یاشار');
    await admin.attemptsTo(LogInAsPersona('یاشار'), ViewMaterialList());
    const material = (await admin.answer(TheMaterialList())).find(
      (m) => m.name === name,
    );
    if (!material) {
      throw new Error(`No material named "${name}" is registered to use.`);
    }
    await admin.attemptsTo(
      RegisterProduct.viaApiUsing(
        freshProductDetails({
          components: [
            freshComponentInProduct({
              materials: [{ name, code: material.code ?? '' }],
            }),
          ],
        }),
      ),
      Ensure.that(LastResponse.status(), equals(201)),
    );
  });
