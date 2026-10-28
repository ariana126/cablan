import {
  actorCalled,
  d,
  notes,
  Question,
  QuestionAdapter,
  Task,
  Wait,
} from '@serenity-js/core';
import { Ensure, equals } from '@serenity-js/assertions';
import {
  DeleteRequest,
  GetRequest,
  LastResponse,
  Send,
} from '@serenity-js/rest';
import { Click, isVisible, PageElements, Text } from '@serenity-js/web';
import { BomsPage } from '../ui/boms-page';
import { BomDashboardPage } from '../ui/bom-dashboard-page';
import { LogInAsPersona } from '../common/personas';
import { EnsureProblemDetail } from '../common/problem-detail';
import { keepingTheSpotlight } from '../common/spotlight';
import { withLatinDigits } from '../common/persian-digits';
import { BomFormEdit, EditBom } from '../bom-registration/edit-bom';
import { LocateBomsPage } from '../bom-registration/bom-form';
import { RegisterBomAndRememberIt } from '../bom-registration/register-bom';
import { RegisterBomWithWeightsAndSeeItsPreview } from '../bom-registration/bom-preview';
import { RegisterStandardBomWithMiCodeUnlessRegistered } from '../bom-registration/register-standard-bom';
import { theStandardBomRegisteredWithMiCode } from '../bom-registration/standard-bom-details';
import {
  freshBomDetailsFor,
  freshWeightInGrams,
  theLastRegisteredBom,
} from '../bom-registration/bom-details';
import {
  ViewAuditLog,
  TheAuditLogItems,
} from '../audit-logging/view-audit-log';
import {
  focusOnTheDailyBom,
  MaterialWeightChange,
  theIdOfThatDailyBom,
  theOrderNumberOfThatDailyBom,
  theProductNameOfTheDailyBomToApprove,
  theProductOfTheDailyBomToApprove,
} from './daily-bom-approval';
import {
  ChangeMaterialWeight,
  LocateTheDailyBomCardUnderProduct,
} from './bom-dashboard-product-details';

/**
 * Domain layer for «ثبت دلیل و جزئیات ویرایش آنالیز روزانه»
 * (`bom-analyzing/daily-bom-edit-details.feature`, issue #73): every edit of a daily BOM that
 * changes something carries a written reason, and every *correction* — an edit from the daily BOM
 * list or from the post-registration preview — is recorded as **جزئیات ویرایش**: a heading naming
 * the editor, the Jalali date and time (Asia/Tehran) and the reason, then one line per change,
 * record after record. A reviewer's edit from the dashboard is a *review* edit instead: it goes into
 * the management note at approval, never into the edit details. The reason and the source an edit
 * is sent with live in `common/edit-reason.ts`; the API edits themselves in `daily-bom-approval.ts`.
 *
 * **Which door.** The active, non-«تلاش» `When`s drive the browser: the `/boms` edit form
 * («از لیست آنالیز های روزانه با دلیل …»), the preview's «ویرایش» («از پیش نمایش … با دلیل …»), the
 * dashboard's inline weight edit («از داشبورد با دلیل …»), the `/boms` row's «جزئیات ویرایش» dialog
 * and the dashboard card's edit-details list («… را مشاهده می کند» / «… را در داشبورد مشاهده می کند»,
 * whose `Then` reads what the page shows). The refused «تلاش می کند …» attempts are backend rules
 * with no screen as their point, so they take the API door and their «به او گفته شود …» judges the
 * actor's last response (400 `edit-reason-required`); so do the no-change save, every edit-then-
 * approve (approving-bom's vocabulary), every passive `Given`, and every `Then` that reads a fact —
 * a weight, the edit details, the audit log — which reads `GET boms/:id` through an observer, the
 * same way and for the same reason as `daily-bom-approval.ts`'s review `Then`s.
 *
 * "آن آنالیز روزانه" is the daily BOM in focus in `daily-bom-approval.ts`, set by the background
 * («آنالیز روزانه ای با شماره سفارش «ORD-5002» …», shared with approving-bom) or by the preview
 * precondition that registers a new one.
 */

/** The persona the facts are read through — the System Admin, who may read every daily BOM and the
 * audit log. */
const OBSERVER = 'یاشار';

/** One record of a daily BOM's edit details, as `GET boms/:id` carries it — pinned contract. */
interface BomEditRecord {
  editedBy: string;
  editedAt: string;
  reason: string;
  heading: string;
  changes: string[];
}

/** «وزن جز {component} مواد اولیه {material}» — how the Gherkin names a weight it changes. */
const MATERIAL_WEIGHT_FIELD = /^وزن جز (.+) مواد اولیه (.+)$/;

/** One «فیلد | مقدار جدید» row — a material weight or the tracking number. */
export type DailyBomChange =
  | {
      field: 'materialWeight';
      componentName: string;
      materialName: string;
      weight: number;
    }
  | { field: 'trackingNumber'; trackingNumber: string };

/** Reads a «فیلد | مقدار جدید» row the way the Gherkin writes it. */
export const dailyBomChangeFrom = (
  label: string,
  newValue: string,
): DailyBomChange => {
  if (label === 'شماره ردیابی') {
    return { field: 'trackingNumber', trackingNumber: newValue };
  }
  const weight = MATERIAL_WEIGHT_FIELD.exec(label);
  if (weight) {
    return {
      field: 'materialWeight',
      componentName: weight[1],
      materialName: weight[2],
      weight: Number(newValue),
    };
  }
  throw new Error(
    `"${label}" is not a daily BOM field this feature changes (expected «شماره ردیابی» or ` +
      '«وزن جز … مواد اولیه …»).',
  );
};

/** One material weight change, as a change. */
export const aWeightChange = (
  change: MaterialWeightChange,
): DailyBomChange => ({
  field: 'materialWeight',
  ...change,
});

/**
 * The changes, as the edit form takes them. A weight field is labelled by its material alone
 * (`BomsPage.weightField`), so the component the Gherkin names is not needed to reach it — every
 * daily BOM this feature edits has each material in one component only.
 */
const asFormEdit = (changes: DailyBomChange[]): BomFormEdit => ({
  materialWeights: changes.flatMap((change) =>
    change.field === 'materialWeight'
      ? [{ materialName: change.materialName, weight: change.weight }]
      : [],
  ),
  ...changes.reduce<BomFormEdit>(
    (fields, change) =>
      change.field === 'trackingNumber'
        ? { ...fields, trackingNumber: change.trackingNumber }
        : fields,
    {},
  ),
});

/**
 * A new weight for «یکی از مواد اولیه» — outside the 50–500 g range a fresh weight is drawn from
 * (`bom-details.ts#freshWeightInGrams`), so it always really changes the line.
 */
export const A_NEW_WEIGHT_FOR_ONE_MATERIAL = 12.5;

export const ChangeThatDailyBom = {
  /** «… آن آنالیز روزانه را از لیست آنالیز های روزانه با دلیل «…» … تغییر می دهد» — the `/boms`
   * row's «ویرایش», the changes, the reason, submitted. */
  fromTheDailyBomList: (changes: DailyBomChange[], reason: string): Task => {
    const orderNumber = theOrderNumberOfThatDailyBom();
    return Task.where(
      d`#actor changes daily BOM "${orderNumber}" from the daily BOM list because "${reason}"`,
      EditBom.using(orderNumber, asFormEdit(changes), reason),
    );
  },

  /** «… از پیش نمایش وزن مواد اولیه «…» جز «…» آن را با دلیل «…» به «…» تغییر می دهد» — the open
   * preview's «ویرایش», the changes, the reason, submitted. */
  fromThePreview: (changes: DailyBomChange[], reason: string): Task =>
    Task.where(
      d`#actor changes the daily BOM from its preview because "${reason}"`,
      EditBom.fromThePreview(asFormEdit(changes), reason),
    ),

  /** «… از پیش نمایش وزن یکی از مواد اولیه آن را با دلیل «…» تغییر می دهد» — whichever material the
   * form shows first, to `A_NEW_WEIGHT_FOR_ONE_MATERIAL`. */
  oneMaterialWeightFromThePreview: (reason: string): Task =>
    Task.where(
      d`#actor changes the weight of one material from the preview because "${reason}"`,
      EditBom.fromThePreview(
        { firstMaterialWeight: A_NEW_WEIGHT_FOR_ONE_MATERIAL },
        reason,
      ),
    ),

  /** «… آن آنالیز روزانه را از داشبورد با دلیل «…» به «…» تغییر می دهد» — the card's inline weight
   * edit, under the product the background registered the daily BOM for, then the reason dialog. */
  fromTheDashboard: (change: MaterialWeightChange, reason: string): Task => {
    const orderNumber = theOrderNumberOfThatDailyBom();
    return Task.where(
      d`#actor changes daily BOM "${orderNumber}" from the dashboard because "${reason}"`,
      ChangeMaterialWeight.fromTheDashboardUnderProduct(
        theProductNameOfTheDailyBomToApprove(orderNumber),
        orderNumber,
        change.componentName,
        change.materialName,
        `${change.weight}`,
        reason,
      ),
    );
  },
};

/** Where the actor last opened a daily BOM's edit details — what «جزئیات ویرایش زیر به … نشان داده
 * شود» reads. Kept on the actor's own notepad, which is per actor and per scenario. */
type EditDetailsPlace =
  | { on: 'dailyBomList' }
  | { on: 'dashboard'; productName: string; orderNumber: string };

interface EditDetailsNotes {
  editDetailsShownIn: EditDetailsPlace;
}

export const ViewEditDetails = {
  /** «… جزئیات آنالیز روزانه با شماره سفارش «…» را مشاهده می کند» — the `/boms` row's «جزئیات
   * ویرایش», and the dialog it opens. */
  inTheDailyBomList: (orderNumber: string): Task => {
    const row = BomsPage.rowWithOrderNumber(orderNumber);
    return Task.where(
      d`#actor views the edit details of daily BOM "${orderNumber}" in the daily BOM list`,
      LocateBomsPage(),
      Wait.until(row, isVisible()),
      Click.on(BomsPage.editDetailsButton().of(row)),
      Wait.until(BomsPage.editDetailsDialog(), isVisible()),
      notes<EditDetailsNotes>().set('editDetailsShownIn', {
        on: 'dailyBomList',
      }),
    );
  },

  /** «… آنالیز روزانه با شماره سفارش «…» را در داشبورد مشاهده می کند» — its card, under the product
   * the background registered it for. */
  onTheDashboard: (orderNumber: string): Task => {
    const productName = theProductNameOfTheDailyBomToApprove(orderNumber);
    return Task.where(
      d`#actor views daily BOM "${orderNumber}" on the dashboard`,
      LocateTheDailyBomCardUnderProduct(productName, orderNumber),
      notes<EditDetailsNotes>().set('editDetailsShownIn', {
        on: 'dashboard',
        productName,
        orderNumber,
      }),
    );
  },
};

/** A shown line, normalised for comparison with the Gherkin: whitespace collapsed, bidi marks
 * dropped, and any Persian digits read as Latin ones — the backend writes the heading's date and
 * time and the change lines' weights with Latin digits, but a page may still render them in Persian
 * ones, and the two mean the same text. */
const asWritten = (shown: string): string =>
  withLatinDigits(shown.replace(/[‎‏]/g, '')).replace(/\s+/g, ' ').trim();

/** The lines of whichever edit details the actor last opened (`ViewEditDetails`), in order. */
const TheEditDetailsShown = (): QuestionAdapter<string[]> =>
  Question.about('the edit details shown', async (actor) => {
    const place = await actor.answer(
      notes<EditDetailsNotes>().get('editDetailsShownIn'),
    );
    const lines: PageElements =
      place.on === 'dashboard'
        ? BomDashboardPage.editDetailsLines().of(
            BomDashboardPage.cardEditDetailsList().of(
              BomDashboardPage.dailyBomCard(
                place.productName,
                place.orderNumber,
              ),
            ),
          )
        : BomsPage.editDetailsLines();
    return (await actor.answer(Text.ofAll(lines))).map(asWritten);
  });

/** «جزئیات ویرایش زیر به … نشان داده شود» — `Ensure.eventually`: the dialog and the card may
 * still be loading them. */
export const EnsureEditDetailsShown = (expected: string[]): Task =>
  Task.where(
    d`#actor ensures the edit details shown are ${expected.join(' / ')}`,
    Ensure.eventually(TheEditDetailsShown(), equals(expected)),
  );

/** `GET boms/:id` of the daily BOM in focus, read by the observer — so a refused attempt's own
 * answer survives on the actor for the step that judges it (see `daily-bom-approval.ts`). */
const ThatDailyBomAsTheSystemHoldsIt = <T>(
  description: string,
  read: (body: Record<string, unknown>) => T,
): QuestionAdapter<T> =>
  Question.about(description, async () => {
    const id = theIdOfThatDailyBom();
    let answer!: T;
    await keepingTheSpotlight(async () => {
      const observer = actorCalled(OBSERVER);
      await observer.attemptsTo(
        LogInAsPersona(OBSERVER),
        Send.a(GetRequest.to(`boms/${id}`)),
        Ensure.that(LastResponse.status(), equals(200)),
      );
      answer = read(
        await observer.answer(LastResponse.body<Record<string, unknown>>()),
      );
    });
    return answer;
  });

/** The edit details of that daily BOM as lines — each record's heading, then each of its changes —
 * or `undefined` when the response carries no `editHistory` at all, so a backend that does not
 * send it yet fails a "no edit details" check instead of passing it. */
const TheEditDetailsOfThatDailyBom = (): QuestionAdapter<
  string[] | undefined
> =>
  ThatDailyBomAsTheSystemHoldsIt(
    'the edit details of that daily BOM',
    (body) =>
      Array.isArray(body.editHistory)
        ? (body.editHistory as BomEditRecord[]).flatMap((record) => [
            record.heading,
            ...record.changes,
          ])
        : undefined,
  );

/** «جزئیات ویرایش آن آنالیز روزانه به صورت زیر باشد» — one line per row, in the table's order. */
export const EnsureEditDetailsOfThatDailyBomAre = (lines: string[]): Task =>
  Task.where(
    d`#actor ensures the edit details of that daily BOM are ${lines.join(' / ')}`,
    Ensure.that(
      TheEditDetailsOfThatDailyBom(),
      equals<string[] | undefined>(lines),
    ),
  );

/** «جزئیات ویرایشی برای آن آنالیز روزانه ثبت نشده باشد» */
export const EnsureNoEditDetailsForThatDailyBom = (): Task =>
  Task.where(
    '#actor ensures that daily BOM has no edit details',
    Ensure.that(
      TheEditDetailsOfThatDailyBom(),
      equals<string[] | undefined>([]),
    ),
  );

interface DailyBomComposition {
  orderNumber: string;
  trackingNumber: string;
  standardBomId: string;
  standardBomMiCode: string;
  components: {
    name: string;
    materials: { name: string; weight: number }[];
  }[];
}

/** «وزن مواد اولیه «…» جز «…» آن آنالیز روزانه «…» باشد / باقی بماند» */
export const EnsureMaterialWeightOfThatDailyBomIs = (
  change: MaterialWeightChange,
): Task =>
  Task.where(
    d`#actor ensures the weight of "${change.materialName}" in "${change.componentName}" of that daily BOM is ${change.weight}`,
    Ensure.that(
      ThatDailyBomAsTheSystemHoldsIt(
        `the weight of "${change.materialName}" in "${change.componentName}" of that daily BOM`,
        (body) =>
          (body as unknown as DailyBomComposition).components
            .find((component) => component.name === change.componentName)
            ?.materials.find(
              (material) => material.name === change.materialName,
            )?.weight,
      ),
      equals<number | undefined>(change.weight),
    ),
  );

/** «به او گفته شود که نوشتن دلیل ویرایش لازم است» — the refused edit's own answer. */
export const EnsureToldAnEditReasonIsRequired = (): Task =>
  Task.where(
    '#actor ensures they were told an edit needs a reason',
    EnsureProblemDetail(400, 'edit-reason-required'),
  );

/** How long an absent audit event is watched for. Projection is fire-and-forget
 * (`audit-log-details.ts#pollForANewAuditEventId`), so "none yet" right after the save would prove
 * nothing; an `Edited` event that never turns up within this long is taken as never recorded. */
const AUDIT_SETTLE_MILLISECONDS = 1_500;

/** «هیچ رویداد ویرایشی برای آن آنالیز روزانه در رویدادهای سیستم ثبت نشده باشد» — the audit log, read
 * by the System Admin (the only one who may), holds no `Edited` event for that daily BOM — watched
 * for a moment, not read once. */
export const EnsureNoEditEventRecordedForThatDailyBom = (): Task =>
  Task.where(
    '#actor ensures no edit of that daily BOM was recorded in the audit log',
    Ensure.that(
      Question.about(
        'the edit events recorded for that daily BOM',
        async () => {
          const recordId = theIdOfThatDailyBom();
          const editEvents: string[] = [];
          await keepingTheSpotlight(async () => {
            const admin = actorCalled(OBSERVER);
            await admin.attemptsTo(LogInAsPersona(OBSERVER));
            const deadline = Date.now() + AUDIT_SETTLE_MILLISECONDS;
            do {
              await admin.attemptsTo(
                ViewAuditLog.viaApiUsing({ recordId, page: 1, pageSize: 100 }),
              );
              const items = await admin.answer(TheAuditLogItems());
              editEvents.splice(
                0,
                editEvents.length,
                ...items
                  .filter((item) => item.action === 'Edited')
                  .map((item) => item.id),
              );
              await new Promise((resolve) => setTimeout(resolve, 250));
            } while (editEvents.length === 0 && Date.now() < deadline);
          });
          return editEvents;
        },
      ),
      equals<string[]>([]),
    ),
  );

/**
 * «اینکه {actor} آنالیز روزانه جدیدی برای کد MI «…» که وزن مواد اولیه «…» جز «…» آن «…» است ثبت کرده
 * و پیش نمایش آن به او نشان داده شده باشد» — passive, yet through the browser, like registring-bom's
 * preview precondition: the preview it leaves open exists nowhere else.
 *
 * The MI code's standard BOM is registered by the System Admin for the product of the daily BOM in
 * focus (the background's, composed of the «مغزی / مسی» line the step names) unless one already
 * exists. The actor then signs in and registers through the form with that line at `change.weight`
 * and every other line at a fresh weight, and the new daily BOM becomes "آن آنالیز روزانه". Whoever
 * was in the spotlight stays there; the `When` that follows names its actor anyway.
 */
export const registerDailyBomWithWeightAndSeeItsPreviewAsAPrecondition = (
  actorName: string,
  miCode: string,
  change: MaterialWeightChange,
): Promise<void> =>
  keepingTheSpotlight(async () => {
    await actorCalled(OBSERVER).attemptsTo(
      LogInAsPersona(OBSERVER),
      RegisterStandardBomWithMiCodeUnlessRegistered(
        miCode,
        theProductOfTheDailyBomToApprove(theOrderNumberOfThatDailyBom()),
      ),
    );
    const standardBom = theStandardBomRegisteredWithMiCode(miCode);
    await actorCalled(actorName).attemptsTo(
      LogInAsPersona(actorName),
      RegisterBomWithWeightsAndSeeItsPreview(
        standardBom,
        freshBomDetailsFor(standardBom, []),
        (componentName, materialName) =>
          componentName === change.componentName &&
          materialName === change.materialName
            ? change.weight
            : freshWeightInGrams(),
      ),
    );
    focusOnTheDailyBom(theLastRegisteredBom());
  });

/**
 * «شماره ردیابی آن آنالیز روزانه «…» باشد» — makes the tracking number true **without an edit**:
 * since issue #73 every edit is recorded in the edit details, which the scenario that states this
 * asserts exactly, so a precondition edit would show up there. When the daily BOM holds another
 * tracking number, it is replaced: deleted, and registered again by the System Admin with the same
 * order number, standard BOM and weights and the stated tracking number, then brought into focus in
 * its place.
 */
export const ensureTrackingNumberOfThatDailyBomAsAPrecondition = (
  trackingNumber: string,
): Promise<void> =>
  keepingTheSpotlight(async () => {
    const id = theIdOfThatDailyBom();
    const admin = actorCalled(OBSERVER);
    await admin.attemptsTo(
      LogInAsPersona(OBSERVER),
      Send.a(GetRequest.to(`boms/${id}`)),
      Ensure.that(LastResponse.status(), equals(200)),
    );
    const current = await admin.answer(
      LastResponse.body<DailyBomComposition>(),
    );
    if (current.trackingNumber === trackingNumber) {
      return;
    }
    const weightOf = (componentName: string, materialName: string): number => {
      const weight = current.components
        .find((component) => component.name === componentName)
        ?.materials.find((material) => material.name === materialName)?.weight;
      if (weight === undefined) {
        throw new Error(
          `Daily BOM ${id} has no "${materialName}" in "${componentName}" to carry over.`,
        );
      }
      return weight;
    };
    await admin.attemptsTo(
      Send.a(DeleteRequest.to(`boms/${id}`)),
      Ensure.that(LastResponse.status(), equals(204)),
      RegisterBomAndRememberIt(
        { id: current.standardBomId, miCode: current.standardBomMiCode },
        { orderNumber: current.orderNumber, trackingNumber },
        weightOf,
      ),
    );
    focusOnTheDailyBom({
      id: theLastRegisteredBom().id,
      orderNumber: current.orderNumber,
    });
  });
