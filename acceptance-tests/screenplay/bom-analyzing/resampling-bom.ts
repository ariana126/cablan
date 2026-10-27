import {
  Actor,
  actorCalled,
  d,
  Interaction,
  Question,
  QuestionAdapter,
  Task,
  Wait,
} from '@serenity-js/core';
import { Ensure, equals, isGreaterThan } from '@serenity-js/assertions';
import { GetRequest, LastResponse, PostRequest, Send } from '@serenity-js/rest';
import { Click, Enter, isVisible } from '@serenity-js/web';
import { BomsPage } from '../ui/boms-page';
import { LogInAsPersona } from '../common/personas';
import { EnsureProblemDetail } from '../common/problem-detail';
import { LetTimePass } from '../common/clock';
import {
  freshOrderNumber,
  freshWeightInGrams,
  theLastRegisteredBom,
} from '../bom-registration/bom-details';
import { RegisterBomAndRememberIt } from '../bom-registration/register-bom';
import {
  RegisteredStandardBom,
  theStandardBomRegisteredWithMiCode,
} from '../bom-registration/standard-bom-details';
import {
  LocateBomsPage,
  WaitForTheBomFormToBeAnswered,
} from '../bom-registration/bom-form';
import {
  ApprovalStatus,
  approvalStatusFor,
  approveDailyBomAsAPrecondition,
  focusOnTheDailyBomWithId,
  keepingTheSpotlight,
  rejectDailyBomAsAPrecondition,
  theDailyBomWithId,
} from './daily-bom-approval';

/**
 * Domain layer for «نمونه گیری مجدد» (`bom-analyzing/resampling-bom.feature`): when the latest daily
 * BOM of a tracking number is rejected, a new daily BOM is registered carrying its order number,
 * tracking number and MI code — only the weights (and an optional description) are new. The new
 * one starts pending; the rejected one stays rejected.
 *
 * **Which door.** The active «… نمونه گیری مجدد می کند» drives the `/boms` list's «نمونه گیری مجدد»
 * row button and the form dialog it opens (`ResampleDailyBom.using`); «… را مشاهده می کند» reads
 * which rows offer that button. The passive «… نمونه گیری مجدد کرده باشد» and the refused
 * «تلاش می کند …» attempts post `POST boms/:id/resampling` (`ResampleDailyBom.viaApiUsing`,
 * `AttemptToResample…`). Every outcome is read from `POST boms/report` filtered by tracking number,
 * through the system admin (`OBSERVER`), so a refused actor's last response survives for
 * «پیغام خطای عدم دسترسی نشان داده شود» — the same reason `daily-bom-approval.ts` gives.
 *
 * **Known daily BOMs.** Every daily BOM this feature's preconditions register is recorded per
 * tracking number, in order of registration. That is what «اول»/«دوم» count in, what «قبلی» and
 * «همان» point at, and what «جدیدی» is new *relative to*: a daily BOM of the tracking number the
 * report lists but no precondition registered. Module state, reset before every scenario by the
 * step-definition file's `Before` hook (`forgetEveryKnownDailyBom`).
 *
 * **"Latest" needs distinct instants.** The backend's test clock is frozen, and "latest" is the most
 * recently *registered* daily BOM of a tracking number — so every precondition that registers one
 * lets a minute pass afterwards, and whatever is registered next is strictly later.
 */

/** The persona outcomes are read through — see the module comment. */
const OBSERVER = 'یاشار';

/** Reviews the «به ترتیب ثبت با وضعیت های …» precondition gives are made by management. */
const REVIEWER = 'مصطفی';

const REJECTION_REASON = 'نمونه خارج از محدوده است';

const ONE_MINUTE = 60_000;

interface KnownDailyBom {
  id: string;
  orderNumber: string;
}

const knownDailyBoms = new Map<string, KnownDailyBom[]>();

/** The standard BOM the background's daily BOM is registered for — every other daily BOM the
 * feature registers uses it too. */
let standardBomOfTheFeature: RegisteredStandardBom | undefined;

/** The rejected daily BOM the last «… نمونه گیری مجدد کرده باشد» re-sampled — «همان». */
let lastResampledSourceId: string | undefined;

/** The tracking number «… آنالیز های روزانه شماره ردیابی … را مشاهده می کند» put on screen. */
let trackingNumberInView: string | undefined;

export const forgetEveryKnownDailyBom = (): void => {
  knownDailyBoms.clear();
  standardBomOfTheFeature = undefined;
  lastResampledSourceId = undefined;
  trackingNumberInView = undefined;
};

const know = (trackingNumber: string, bom: KnownDailyBom): void => {
  knownDailyBoms.set(trackingNumber, [
    ...(knownDailyBoms.get(trackingNumber) ?? []),
    bom,
  ]);
};

const theKnownDailyBomsOf = (trackingNumber: string): KnownDailyBom[] =>
  knownDailyBoms.get(trackingNumber) ?? [];

/** The most recently registered daily BOM of `trackingNumber` — the one a re-sampling is from. */
const theLatestKnownDailyBomOf = (trackingNumber: string): KnownDailyBom => {
  const known = theKnownDailyBomsOf(trackingNumber);
  if (known.length === 0) {
    throw new Error(
      `No daily BOM with tracking number "${trackingNumber}" has been registered in this scenario.`,
    );
  }
  return known[known.length - 1];
};

const theStandardBomOfTheFeature = (): RegisteredStandardBom => {
  if (!standardBomOfTheFeature) {
    throw new Error(
      'No daily BOM has been registered for a standard BOM yet in this scenario — expected the ' +
        "background's «آنالیز روزانه ای با شماره سفارش … برای کد MI …» first.",
    );
  }
  return standardBomOfTheFeature;
};

// ---------------------------------------------------------------------------------------------
// Preconditions (API)

/** Registers one daily BOM through یاشار's admin access, records it, and lets a minute pass. */
const registerAndKnow = async (
  standardBom: RegisteredStandardBom,
  orderNumber: string,
  trackingNumber: string,
): Promise<KnownDailyBom> => {
  const admin = actorCalled(OBSERVER);
  await admin.attemptsTo(
    LogInAsPersona(OBSERVER),
    RegisterBomAndRememberIt(standardBom, { orderNumber, trackingNumber }),
  );
  const bom = { id: theLastRegisteredBom().id, orderNumber };
  know(trackingNumber, bom);
  await admin.attemptsTo(LetTimePass(ONE_MINUTE));
  return bom;
};

/** «آنالیز روزانه ای با شماره سفارش «…» و شماره ردیابی «…» برای کد MI «…» در سیستم ثبت شده باشد» */
export const registerDailyBomOfTrackingNumberAsAPrecondition = (
  orderNumber: string,
  trackingNumber: string,
  miCode: string,
): Promise<void> =>
  keepingTheSpotlight(async () => {
    standardBomOfTheFeature = theStandardBomRegisteredWithMiCode(miCode);
    await registerAndKnow(standardBomOfTheFeature, orderNumber, trackingNumber);
  });

/**
 * «آنالیز های روزانه شماره ردیابی «…» به ترتیب ثبت با وضعیت های «…» در سیستم ثبت شده باشند» — one
 * daily BOM per status, registered in the order given (each a minute after the one before), with a
 * fresh order number, then approved or rejected by management; «در انتظار تایید» is left as
 * registered.
 */
export const registerDailyBomsOfTrackingNumberInOrderAsAPrecondition = (
  trackingNumber: string,
  statusLabels: string[],
): Promise<void> =>
  keepingTheSpotlight(async () => {
    for (const label of statusLabels) {
      const status = approvalStatusFor(label);
      const bom = await registerAndKnow(
        theStandardBomOfTheFeature(),
        freshOrderNumber(),
        trackingNumber,
      );
      if (status === 'approved') {
        await approveDailyBomAsAPrecondition(
          theDailyBomWithId(bom.id),
          REVIEWER,
        );
      } else if (status === 'rejected') {
        await rejectDailyBomAsAPrecondition(
          theDailyBomWithId(bom.id),
          REVIEWER,
          REJECTION_REASON,
        );
      }
    }
  });

// ---------------------------------------------------------------------------------------------
// The API door

interface DailyBomComposition {
  components: {
    id: string;
    materials: { id: string }[];
  }[];
}

/**
 * `POST boms/:id/resampling` from `sourceId`, with a fresh weight for every material line of the
 * source's composition (read back with `GET boms/:id`) and a description. The composition has the
 * same nested shape as `POST boms` (`register-bom.ts#registerRequestBody`):
 * `{ componentId, materials: [{ materialId, weight }] }` per component.
 */
const SendResampling = (sourceId: () => string): Interaction =>
  Interaction.where('#actor sends the re-sampling', async (actor) => {
    const id = sourceId();
    await Send.a(GetRequest.to(`boms/${id}`)).performAs(actor);
    const source = await actor.answer(LastResponse.body<DailyBomComposition>());
    await Send.a(
      PostRequest.to(`boms/${id}/resampling`).with({
        components: (source.components ?? []).map((component) => ({
          componentId: component.id,
          materials: component.materials.map((material) => ({
            materialId: material.id,
            weight: freshWeightInGrams(),
          })),
        })),
        description: 'نمونه گیری مجدد',
      }),
    ).performAs(actor);
  });

export const ResampleDailyBom = {
  /**
   * «… از آنالیز روزانه عدم تایید شماره ردیابی «…» نمونه گیری مجدد می کند» — the row's «نمونه گیری
   * مجدد» button on `/boms` (only the latest rejected daily BOM of the tracking number offers it),
   * every weight of the cloned composition filled in, a description written, submitted. Success
   * leaves the daily BOM preview open over the list, as a registration does; the `Then`s read the
   * API, so they don't need it closed.
   */
  using: (trackingNumber: string): Task =>
    Task.where(
      d`#actor re-samples the rejected daily BOM of tracking number "${trackingNumber}"`,
      ResampleDailyBom.withoutSubmittingUsing(trackingNumber),
      SubmitTheResampling(),
    ),

  /** The same, short of submitting — for a scenario whose «اما …» step amends the form and submits
   * it (`FinishResamplingWithOneWeight`, `FinishResamplingLeavingDescriptionEmpty`). */
  withoutSubmittingUsing: (trackingNumber: string): Task =>
    Task.where(
      d`#actor fills in a re-sampling of the rejected daily BOM of tracking number "${trackingNumber}"`,
      OpenTheResamplingForm(trackingNumber),
      FillInEveryWeight(),
      Enter.theValue('نمونه گیری مجدد').into(BomsPage.descriptionField()),
    ),

  /** «اینکه … از آنالیز روزانه عدم تایید شماره ردیابی «…» نمونه گیری مجدد کرده باشد» — re-samples
   * the latest daily BOM of the tracking number, records the new one as known and in focus («آن
   * آنالیز روزانه جدید»), and lets a minute pass. */
  viaApiUsing: (trackingNumber: string): Task => {
    let source!: KnownDailyBom;
    return Task.where(
      d`#actor re-samples the rejected daily BOM of tracking number "${trackingNumber}" (via API)`,
      Interaction.where('#actor finds the daily BOM to re-sample', () => {
        source = theLatestKnownDailyBomOf(trackingNumber);
      }),
      SendResampling(() => source.id),
      Ensure.that(LastResponse.status(), equals(201)),
      Interaction.where(
        '#actor remembers the re-sampled daily BOM',
        async (actor) => {
          const { id } = await actor.answer(
            LastResponse.body<{ id: string }>(),
          );
          know(trackingNumber, { id, orderNumber: source.orderNumber });
          lastResampledSourceId = source.id;
          focusOnTheDailyBomWithId(id);
        },
      ),
      LetTimePass(ONE_MINUTE),
    );
  },
};

/** The passive «… نمونه گیری مجدد کرده باشد», as the named actor (logged in by the background). */
export const resampleDailyBomAsAPrecondition = (
  actor: Actor,
  trackingNumber: string,
): Promise<void> =>
  actor.attemptsTo(ResampleDailyBom.viaApiUsing(trackingNumber));

/** «… تلاش می کند از آنالیز روزانه عدم تایید شماره ردیابی «…» نمونه گیری مجدد کند» — no expectation
 * on the answer: the `Then`s judge it (a reporter's is a 403). */
export const AttemptToResampleDailyBom = {
  viaApi: (trackingNumber: string): Task =>
    Task.where(
      d`#actor attempts to re-sample the rejected daily BOM of tracking number "${trackingNumber}" (via API)`,
      SendResampling(() => theLatestKnownDailyBomOf(trackingNumber).id),
    ),
};

/**
 * «… تلاش می کند دوباره از همان آنالیز روزانه عدم تایید نمونه گیری مجدد کند» — the daily BOM the
 * precondition already re-sampled, which is no longer the latest of its tracking number. Ends by
 * confirming the refusal was for that reason (409 `bom-not-resamplable`): without it, a request
 * refused for anything else (a malformed body, a 404) would register nothing either, and the
 * scenario would pass without proving its rule.
 */
export const AttemptToResampleTheSameDailyBomAgain = {
  viaApi: (): Task =>
    Task.where(
      '#actor attempts to re-sample the same rejected daily BOM again (via API)',
      SendResampling(() => {
        if (!lastResampledSourceId) {
          throw new Error(
            'No daily BOM has been re-sampled yet in this scenario — expected a preceding ' +
              '«… نمونه گیری مجدد کرده باشد».',
          );
        }
        return lastResampledSourceId;
      }),
      EnsureProblemDetail(409, 'bom-not-resamplable'),
    ),
};

// ---------------------------------------------------------------------------------------------
// The browser door

/** The `/boms` row of `trackingNumber` that offers «نمونه گیری مجدد» — at most one should. */
const theResamplableRowOf = (trackingNumber: string) =>
  BomsPage.rowsWithTrackingNumber(trackingNumber)
    .where(BomsPage.resampleButton(), isVisible())
    .first();

const OpenTheResamplingForm = (trackingNumber: string): Task =>
  Task.where(
    d`#actor opens the re-sampling form for tracking number "${trackingNumber}"`,
    LocateBomsPage(),
    Wait.until(
      BomsPage.resampleButton().of(theResamplableRowOf(trackingNumber)),
      isVisible(),
    ),
    Click.on(BomsPage.resampleButton().of(theResamplableRowOf(trackingNumber))),
    Wait.until(BomsPage.weightFields().count(), isGreaterThan(0)),
  );

/** A fresh, valid weight into every weight field the form cloned. */
const FillInEveryWeight = (): Interaction =>
  Interaction.where(
    '#actor fills in a weight for every material',
    async (actor) => {
      const fields = await actor.answer(BomsPage.weightFields());
      for (const field of fields) {
        await field.enterValue(`${freshWeightInGrams()}`);
      }
    },
  );

const SubmitTheResampling = (): Task =>
  Task.where(
    '#actor submits the re-sampling',
    Click.on(BomsPage.submitButton()),
    WaitForTheBomFormToBeAnswered(),
  );

/** «اما وزن یکی از مواد اولیه را خالی/صفر میگذارد» — overwrites the first weight, then submits. */
export const FinishResamplingWithOneWeight = (weight: string): Task =>
  Task.where(
    d`#actor submits the re-sampling with one material weight set to "${weight}"`,
    Enter.theValue(weight).into(BomsPage.weightFields().first()),
    SubmitTheResampling(),
  );

/** «اما توضیحات را خالی میگذارد» — clears the description, then submits. */
export const FinishResamplingLeavingDescriptionEmpty = (): Task =>
  Task.where(
    '#actor submits the re-sampling leaving the description empty',
    Enter.theValue('').into(BomsPage.descriptionField()),
    SubmitTheResampling(),
  );

/** «… آنالیز های روزانه شماره ردیابی «…» را مشاهده می کند» — the `/boms` list, once its rows of
 * that tracking number have rendered. */
export const ViewDailyBomsOfTrackingNumber = {
  using: (trackingNumber: string): Task =>
    Task.where(
      d`#actor views the daily BOMs of tracking number "${trackingNumber}"`,
      Interaction.where('#actor notes the tracking number in view', () => {
        trackingNumberInView = trackingNumber;
      }),
      LocateBomsPage(),
      Wait.until(
        BomsPage.rowsWithTrackingNumber(trackingNumber).first(),
        isVisible(),
      ),
    ),
};

/** «اول» / «دوم» — a position in order of registration; «هیچکدام» — none. */
export const ordinalFor = (label: string): number | null => {
  const ordinals: Record<string, number | null> = {
    اول: 0,
    دوم: 1,
    هیچکدام: null,
  };
  if (!(label in ordinals)) {
    throw new Error(
      `"${label}" is not an ordinal (expected one of: ${Object.keys(ordinals).join(', ')}).`,
    );
  }
  return ordinals[label];
};

/** For each known daily BOM of the tracking number in view, in order of registration: does its
 * row on screen offer «نمونه گیری مجدد»? */
const RowsOfferingResampling = (): QuestionAdapter<boolean[]> =>
  Question.about(
    'which daily BOMs on screen offer re-sampling',
    async (actor) => {
      if (!trackingNumberInView) {
        throw new Error(
          'No tracking number is in view — expected «… آنالیز های روزانه شماره ردیابی … را ' +
            'مشاهده می کند» first.',
        );
      }
      const offered: boolean[] = [];
      for (const bom of theKnownDailyBomsOf(trackingNumberInView)) {
        const buttons = await actor.answer(
          BomsPage.resampleButton().of(
            BomsPage.rowWithOrderNumber(bom.orderNumber),
          ),
        );
        offered.push(await buttons.isPresent());
      }
      return offered;
    },
  );

/** «نمونه گیری مجدد فقط برای آنالیز روزانه «…» ممکن باشد» — what the list offers the visitor. */
export const EnsureResamplingOfferedOnlyFor = (position: number | null): Task =>
  Task.where(
    d`#actor ensures only daily BOM ${position === null ? 'none' : `#${position + 1}`} offers re-sampling`,
    Ensure.that(
      RowsOfferingResampling(),
      equals(
        Question.about('which daily BOMs should offer re-sampling', () =>
          theKnownDailyBomsOf(trackingNumberInView ?? '').map(
            (_bom, index) => index === position,
          ),
        ),
      ),
    ),
  );

// ---------------------------------------------------------------------------------------------
// Facts about the system (API, read by the observer)

interface ReportedDailyBom {
  id: string;
  orderNumber: string;
  trackingNumber: string;
  standardBomMiCode: string;
  approvalStatus: ApprovalStatus;
}

/** Every daily BOM `POST boms/report` lists for `trackingNumber`, read by the observer. */
const TheDailyBomsOfTrackingNumber = (
  trackingNumber: string,
): QuestionAdapter<ReportedDailyBom[]> =>
  Question.about(
    `the daily BOMs of tracking number "${trackingNumber}"`,
    async () => {
      let items: ReportedDailyBom[] = [];
      await keepingTheSpotlight(async () => {
        const observer = actorCalled(OBSERVER);
        await observer.attemptsTo(
          LogInAsPersona(OBSERVER),
          Send.a(
            PostRequest.to('boms/report').with({
              page: 1,
              pageSize: 100,
              filters: { trackingNumbers: [trackingNumber] },
            }),
          ),
          Ensure.that(LastResponse.status(), equals(200)),
        );
        items = (
          await observer.answer(
            LastResponse.body<{ items: ReportedDailyBom[] }>(),
          )
        ).items;
      });
      return items;
    },
  );

/** The daily BOMs of `trackingNumber` no precondition registered — what «جدیدی» means. */
const TheNewDailyBomsOf = (
  trackingNumber: string,
): QuestionAdapter<ReportedDailyBom[]> =>
  Question.about(
    `the new daily BOMs of tracking number "${trackingNumber}"`,
    async (actor) => {
      const known = new Set(
        theKnownDailyBomsOf(trackingNumber).map((bom) => bom.id),
      );
      return (
        await actor.answer(TheDailyBomsOfTrackingNumber(trackingNumber))
      ).filter((bom) => !known.has(bom.id));
    },
  );

const FocusOnTheNewDailyBomOf = (trackingNumber: string): Interaction =>
  Interaction.where(
    '#actor keeps the new daily BOM in focus',
    async (actor) => {
      const [bom] = await actor.answer(TheNewDailyBomsOf(trackingNumber));
      focusOnTheDailyBomWithId(bom.id);
    },
  );

/** «آنالیز روزانه جدیدی برای شماره ردیابی «…» ثبت شده باشد» — exactly one, brought into focus for
 * «وضعیت آن آنالیز روزانه … باشد» (approving-bom's step). */
export const EnsureANewDailyBomWasRegisteredFor = (
  trackingNumber: string,
): Task =>
  Task.where(
    d`#actor ensures a new daily BOM was registered for tracking number "${trackingNumber}"`,
    Ensure.that(TheNewDailyBomsOf(trackingNumber).length, equals(1)),
    FocusOnTheNewDailyBomOf(trackingNumber),
  );

/** «آنالیز روزانه جدیدی ثبت نشده باشد» / «… جدید دیگری … ثبت نشده باشد» */
export const EnsureNoNewDailyBomWasRegisteredFor = (
  trackingNumber: string,
): Task =>
  Task.where(
    d`#actor ensures no new daily BOM was registered for tracking number "${trackingNumber}"`,
    Ensure.that(TheNewDailyBomsOf(trackingNumber).length, equals(0)),
  );

/** «آنالیز روزانه جدیدی با اطلاعات زیر ثبت شده باشد | شماره سفارش | شماره ردیابی | کد MI |» */
export const EnsureANewDailyBomWasRegisteredWith = (expected: {
  orderNumber: string;
  trackingNumber: string;
  miCode: string;
}): Task =>
  Task.where(
    d`#actor ensures a new daily BOM was registered with ${expected}`,
    EnsureANewDailyBomWasRegisteredFor(expected.trackingNumber),
    Ensure.that(
      Question.about(
        "the new daily BOM's order, tracking and MI code",
        async (actor) => {
          const [bom] = await actor.answer(
            TheNewDailyBomsOf(expected.trackingNumber),
          );
          return {
            orderNumber: bom.orderNumber,
            trackingNumber: bom.trackingNumber,
            miCode: bom.standardBomMiCode,
          };
        },
      ),
      equals(expected),
    ),
  );

/** «وضعیت آنالیز روزانه قبلی شماره ردیابی «…» «…» باقی بماند» — the daily BOM that was re-sampled:
 * the latest one a precondition registered. */
export const EnsurePreviousDailyBomStatusIs = (
  trackingNumber: string,
  label: string,
): Task =>
  Task.where(
    d`#actor ensures the previous daily BOM of tracking number "${trackingNumber}" is still "${label}"`,
    Ensure.that(
      Question.about(
        `the status of the previous daily BOM of tracking number "${trackingNumber}"`,
        async (actor) => {
          const previous = theLatestKnownDailyBomOf(trackingNumber);
          return (
            await actor.answer(TheDailyBomsOfTrackingNumber(trackingNumber))
          ).find((bom) => bom.id === previous.id)?.approvalStatus;
        },
      ),
      equals<ApprovalStatus | undefined>(approvalStatusFor(label)),
    ),
  );
