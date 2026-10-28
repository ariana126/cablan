import {
  actorCalled,
  d,
  Interaction,
  Question,
  QuestionAdapter,
  Task,
  Wait,
} from '@serenity-js/core';
import { Ensure, equals, isPresent, not } from '@serenity-js/assertions';
import {
  GetRequest,
  LastResponse,
  PatchRequest,
  PostRequest,
  Send,
} from '@serenity-js/rest';
import { Click, Enter, isVisible } from '@serenity-js/web';
import { BomDashboardPage } from '../ui/bom-dashboard-page';
import { LogInAsPersona, realNameFor } from '../common/personas';
import { EnsureProblemDetail } from '../common/problem-detail';
import { keepingTheSpotlight } from '../common/spotlight';
import {
  aCorrection,
  anEditFromTheDashboard,
  editIntentFields,
  EditIntent,
  ROUTINE_EDIT_REASON,
} from '../common/edit-reason';
import {
  freshMaterialInComponent,
  freshProductDetails,
  theLastRegisteredProduct,
} from '../bom-registration/product-details';
import { RegisterProductAndRememberIt } from '../bom-registration/register-product';
import { RegisterStandardBomAndRememberIt } from '../bom-registration/register-standard-bom';
import { theLastRegisteredStandardBom } from '../bom-registration/standard-bom-details';
import { RegisterBomAndRememberIt } from '../bom-registration/register-bom';
import {
  freshTrackingNumber,
  freshWeightInGrams,
  theLastRegisteredBom,
} from '../bom-registration/bom-details';
import { BomSummary } from '../bom-registration/view-bom-list';
import { theDashboardProductNameOf } from './bom-dashboard-fixtures';
import { LocateTheDailyBomCardInTheDashboard } from './bom-dashboard-product-details';

/**
 * Domain layer for "تایید آنالیز روزانه" (`bom-analyzing/approving-bom.feature`), and the review
 * vocabulary every other feature borrows: the "... توسط مصطفی تایید شده باشد" and "... توسط مصطفی با
 * دلیل «...» عدم تایید شده باشد" preconditions (bom-dashboard, reporting-bom, exporting-bom,
 * viewing-audit-log) and the dashboard's own «از داشبورد» approve and reject.
 *
 * A daily BOM is reviewed once: it is registered **در انتظار تایید** (`pending`), and management or
 * the system admin either **approves** it (`approved`, «تایید») or **rejects** it with a written
 * reason (`rejected`, «عدم تایید»). Neither can be undone directly — only an edit sends it back to
 * pending. The reviewer's name is `reviewedBy` («تایید/رد کننده»); `managementNote`
 * («توضیحات مدیریت») is the rejection reason, or on approval the reviewer's own *dashboard* edits
 * made while reviewing — per edit, a heading of reviewer, time and reason, then one line per change
 * (issue #73). Wire names are pinned in `docs/superpowers/plans/2026-10-25-daily-bom-review.md` and
 * `docs/superpowers/plans/2026-10-28-daily-bom-edit-details.md` ("Contract").
 *
 * Every edit sent here says why and from where (`common/edit-reason.ts`): an edit from the dashboard
 * (`editSource: 'dashboard'`) by a reviewer is a review edit; anything else is a correction, which
 * lands in the daily BOM's edit details instead (`daily-bom-edit-details.ts`).
 *
 * **Which door.** `approving-bom.feature` is a feature about backend rules — who may review, what a
 * reason must be, what an edit does to a review — with no screen as its point, so its active steps
 * take the API door (`POST boms/:id/approval`, `POST boms/:id/rejection`, `PATCH boms/:id`), the same
 * exception `acceptance-tests/CLAUDE.md` makes for the dashboard's score rule. The browser variants
 * of the same goals — `ApproveDailyBom.fromTheDashboard` and `RejectDailyBom.fromTheDashboard` — are
 * what `bom-dashboard.feature`'s «از داشبورد» steps drive, so the review workflow is still exercised
 * end to end through the UI at least once.
 *
 * **"آن آنالیز روزانه".** Most steps here say "that daily BOM", so the module keeps the one the
 * scenario is about in focus (`theDailyBomInFocus`), set by whichever step named it first — the
 * background, a review, a registration. Plain module state, not a Notepad: which daily BOM a
 * scenario is about is a fact about the scenario, shared by every actor in it.
 *
 * **Reading the review.** The `Then`s read `GET boms/:id` through an observer — the system admin —
 * rather than through the actor in the spotlight. Several outlines check the review *between* a
 * refused attempt and the step that judges the refusal («پیغام خطای عدم دسترسی نشان داده شود», «به
 * او گفته شود که ...»), which reads the refused request off the actor's last response; a read by
 * that same actor would overwrite it (`CallAnApi.request` caches every response). The spotlight is
 * handed back afterwards, so the following bare `Then` still reads the actor it should.
 */

/** The wire values of `approvalStatus` — pinned contract. */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

const approvalStatusByLabel: Record<string, ApprovalStatus> = {
  'در انتظار تایید': 'pending',
  تایید: 'approved',
  'عدم تایید': 'rejected',
};

/** Every status label, as the Gherkin and the UI write them. */
export const APPROVAL_STATUS_LABELS: readonly string[] = Object.keys(
  approvalStatusByLabel,
);

/** «در انتظار تایید» / «تایید» / «عدم تایید», as the Gherkin and the UI write them, to the wire value. */
export const approvalStatusFor = (label: string): ApprovalStatus => {
  const status = approvalStatusByLabel[label];
  if (!status) {
    throw new Error(
      `"${label}" is not an approval status (expected one of: ` +
        `${APPROVAL_STATUS_LABELS.join(', ')}).`,
    );
  }
  return status;
};

/** The persona the review is read through — see the module comment. */
const OBSERVER = 'یاشار';

/** The persona that makes an edit no review should take credit for — an inspector (QC operator).
 * Management's and the admin's own edits while reviewing become the management note on approval;
 * an inspector's never do, so a precondition that only has to *set* a weight edits as her. */
const INSPECTOR = 'نیکروش';

interface DailyBomInFocus {
  id: string;
  /** How the step named it — an order number, or the audit log's record id. */
  label: string;
  /** Its order number, when the step that focused it knew it — what a UI task finds its row or
   * card by. */
  orderNumber?: string;
}

let dailyBomInFocus: DailyBomInFocus | undefined;

const focusOn = (bom: DailyBomInFocus): void => {
  dailyBomInFocus = bom;
};

const theDailyBomInFocus = (): DailyBomInFocus => {
  if (!dailyBomInFocus) {
    throw new Error(
      'No daily BOM is in focus yet — expected a preceding step naming one (by order number or ' +
        'record id).',
    );
  }
  return dailyBomInFocus;
};

/**
 * Which daily BOM a task acts on: one named by order number (looked up when the task runs), one
 * named by its id (the audit log's record id), or "that daily BOM" — the one already in focus.
 */
export type DailyBomTarget =
  { orderNumber: string } | { id: string } | { inFocus: true };

export const theDailyBomWithOrderNumber = (
  orderNumber: string,
): DailyBomTarget => ({ orderNumber });

export const theDailyBomWithId = (id: string): DailyBomTarget => ({ id });

export const thatDailyBom = (): DailyBomTarget => ({ inFocus: true });

const describe = (target: DailyBomTarget): string =>
  'orderNumber' in target
    ? `daily BOM "${target.orderNumber}"`
    : 'id' in target
      ? `daily BOM ${target.id}`
      : 'that daily BOM';

/** Brings `target` into focus: a by-order-number one is looked up in `GET boms` (no endpoint
 * filters by order number, so the list is searched), an id is taken as is. */
const FocusOn = (target: DailyBomTarget): Interaction =>
  Interaction.where(d`#actor finds ${describe(target)}`, async (actor) => {
    if ('id' in target) {
      focusOn({ id: target.id, label: target.id });
      return;
    }
    if (!('orderNumber' in target)) {
      theDailyBomInFocus();
      return;
    }
    await Send.a(GetRequest.to('boms')).performAs(actor);
    const boms = await actor.answer(LastResponse.body<BomSummary[]>());
    const matches = (Array.isArray(boms) ? boms : []).filter(
      (bom) => bom.orderNumber === target.orderNumber,
    );
    if (matches.length !== 1) {
      throw new Error(
        `Expected exactly one daily BOM with order number "${target.orderNumber}", found ` +
          `${matches.length}.`,
      );
    }
    focusOn({
      id: matches[0].id,
      label: target.orderNumber,
      orderNumber: target.orderNumber,
    });
  });

/** `POST boms/:id/approval` for the daily BOM in focus. */
const SendApproval = (): Interaction =>
  Interaction.where('#actor sends the approval', async (actor) => {
    const { id } = theDailyBomInFocus();
    await Send.a(PostRequest.to(`boms/${id}/approval`)).performAs(actor);
  });

/** `POST boms/:id/rejection` with `{ reason }` for the daily BOM in focus. */
const SendRejection = (reason: string): Interaction =>
  Interaction.where(
    d`#actor sends the rejection with reason "${reason}"`,
    async (actor) => {
      const { id } = theDailyBomInFocus();
      await Send.a(
        PostRequest.to(`boms/${id}/rejection`).with({ reason }),
      ).performAs(actor);
    },
  );

/** `PATCH boms/:id` for the daily BOM in focus, saying why and from where (`common/edit-reason.ts`). */
const SendEdit = (
  changes: Record<string, unknown>,
  intent: EditIntent,
): Interaction =>
  Interaction.where(
    d`#actor sends the edit, with reason "${intent.reason}" from ${intent.source}`,
    async (actor) => {
      const { id } = theDailyBomInFocus();
      await Send.a(
        PatchRequest.to(`boms/${id}`).with({
          ...changes,
          ...editIntentFields(intent),
        }),
      ).performAs(actor);
    },
  );

/** One material line's new weight, named the way the Gherkin names it. */
export interface MaterialWeightChange {
  componentName: string;
  materialName: string;
  weight: number;
}

interface DailyBomComposition {
  standardBomMiCode: string;
  components: {
    id: string;
    name: string;
    materials: { id: string; name: string; weight: number }[];
  }[];
}

/**
 * `PATCH boms/:id` changing material weights of the daily BOM in focus. The API edits a daily BOM's
 * composition only as a whole — `components` replaces the old list, checked against the standard BOM
 * `standardBomMiCode` names — so this reads the current composition back (`GET boms/:id`) and
 * re-sends every line in the order it came, with exactly the named lines' weights replaced. Fails
 * loudly if a named line is not in the daily BOM, rather than sending an edit that changes nothing.
 * With no changes at all it re-sends the composition as it is: a save that changes nothing.
 *
 * `intent` is the reason and the source (`common/edit-reason.ts`); `undefined` sends neither — the
 * no-change save, which is made without writing a reason.
 */
const SendWeightChanges = (
  changes: MaterialWeightChange[],
  intent: EditIntent | undefined,
): Interaction =>
  Interaction.where(
    d`#actor sends the weight changes ${changes.map((c) => `${c.materialName}/${c.componentName}=${c.weight}`).join('، ')}`,
    async (actor) => {
      const { id } = theDailyBomInFocus();
      await Send.a(GetRequest.to(`boms/${id}`)).performAs(actor);
      const current = await actor.answer(
        LastResponse.body<DailyBomComposition>(),
      );
      const changeFor = (componentName: string, materialName: string) =>
        changes.find(
          (change) =>
            change.componentName === componentName &&
            change.materialName === materialName,
        );
      for (const change of changes) {
        const exists = current.components.some(
          (component) =>
            component.name === change.componentName &&
            component.materials.some(
              (material) => material.name === change.materialName,
            ),
        );
        if (!exists) {
          throw new Error(
            `Daily BOM ${id} has no material "${change.materialName}" in component ` +
              `"${change.componentName}" to change the weight of.`,
          );
        }
      }
      await Send.a(
        PatchRequest.to(`boms/${id}`).with({
          standardBomMiCode: current.standardBomMiCode,
          components: current.components.map((component) => ({
            componentId: component.id,
            materials: component.materials.map((material) => ({
              materialId: material.id,
              weight:
                changeFor(component.name, material.name)?.weight ??
                material.weight,
            })),
          })),
          ...(intent ? editIntentFields(intent) : {}),
        }),
      ).performAs(actor);
    },
  );

/** The current weight of one material line of the daily BOM in focus, read as the actor asking. */
const TheWeightOf = (
  componentName: string,
  materialName: string,
): QuestionAdapter<number | undefined> =>
  Question.about(
    `the weight of "${materialName}" in "${componentName}" of that daily BOM`,
    async (actor) => {
      const { id } = theDailyBomInFocus();
      await Send.a(GetRequest.to(`boms/${id}`)).performAs(actor);
      const body = await actor.answer(LastResponse.body<DailyBomComposition>());
      return body.components
        .find((component) => component.name === componentName)
        ?.materials.find((material) => material.name === materialName)?.weight;
    },
  );

export const ApproveDailyBom = {
  /** The API door — `approving-bom.feature`'s own steps and every "تایید شده باشد" precondition. */
  viaApi: (target: DailyBomTarget): Task =>
    Task.where(
      d`#actor approves ${describe(target)} (via API)`,
      FocusOn(target),
      SendApproval(),
      Ensure.that(LastResponse.status(), equals(204)),
    ),

  /** «از داشبورد» — clicks the card's «تایید» under the dashboard's default filters («در انتظار
   * تایید» only), and waits for the card to stop offering «تایید», the sign the approval has been
   * answered: an approved daily BOM leaves the default view, and no card offers «تایید» once it is
   * no longer pending. Brings the daily BOM into focus as "آن آنالیز روزانه", for the review `Then`s
   * that read it back. */
  fromTheDashboard: (orderNumber: string): Task => {
    const card = BomDashboardPage.dailyBomCard(
      theDashboardProductNameOf(orderNumber),
      orderNumber,
    );
    return Task.where(
      d`#actor approves daily BOM "${orderNumber}" from the dashboard`,
      FocusOn(theDailyBomWithOrderNumber(orderNumber)),
      LocateTheDailyBomCardInTheDashboard(orderNumber),
      Click.on(BomDashboardPage.cardApproveButton().of(card)),
      Wait.until(
        BomDashboardPage.cardApproveButton().of(card),
        not(isPresent()),
      ),
    );
  },
};

export const RejectDailyBom = {
  /** The API door — `approving-bom.feature`'s own steps and every "عدم تایید شده باشد" precondition. */
  viaApi: (target: DailyBomTarget, reason: string): Task =>
    Task.where(
      d`#actor rejects ${describe(target)} with reason "${reason}" (via API)`,
      FocusOn(target),
      SendRejection(reason),
      Ensure.that(LastResponse.status(), equals(204)),
    ),

  /**
   * «از داشبورد با دلیل «...» عدم تایید می کند» — clicks the card's «عدم تایید», writes the reason in
   * the dialog that opens and submits it, then waits for the dialog to close and for the card to
   * stop offering «عدم تایید»: the sign the rejection has been answered (under the default «در
   * انتظار تایید» filter the rejected card leaves the view altogether). Brings the daily BOM into
   * focus as "آن آنالیز روزانه".
   */
  fromTheDashboard: (orderNumber: string, reason: string): Task => {
    const card = BomDashboardPage.dailyBomCard(
      theDashboardProductNameOf(orderNumber),
      orderNumber,
    );
    const reasonField = BomDashboardPage.rejectionReasonField();
    return Task.where(
      d`#actor rejects daily BOM "${orderNumber}" with reason "${reason}" from the dashboard`,
      FocusOn(theDailyBomWithOrderNumber(orderNumber)),
      LocateTheDailyBomCardInTheDashboard(orderNumber),
      Click.on(BomDashboardPage.cardRejectButton().of(card)),
      Wait.until(reasonField, isVisible()),
      Enter.theValue(reason).into(reasonField),
      Click.on(BomDashboardPage.rejectionDialogSubmitButton()),
      Wait.until(BomDashboardPage.rejectionDialog(), not(isPresent())),
      Wait.until(
        BomDashboardPage.cardRejectButton().of(card),
        not(isPresent()),
      ),
    );
  },
};

/** "تلاش می کند ... را تایید کند" — no expectation on the answer: the `Then`s judge it. */
export const AttemptToApproveDailyBom = {
  viaApi: (target: DailyBomTarget): Task =>
    Task.where(
      d`#actor attempts to approve ${describe(target)} (via API)`,
      FocusOn(target),
      SendApproval(),
    ),
};

/** "تلاش می کند ... را با دلیل «...» عدم تایید کند", "... بدون نوشتن دلیل ...", "... با دلیلی که فقط
 * از فاصله تشکیل شده ..." — no expectation on the answer: the `Then`s judge it. */
export const AttemptToRejectDailyBom = {
  viaApi: (target: DailyBomTarget, reason: string): Task =>
    Task.where(
      d`#actor attempts to reject ${describe(target)} with reason "${reason}" (via API)`,
      FocusOn(target),
      SendRejection(reason),
    ),
};

/** "بدون نوشتن دلیل" — the reason box left empty. */
export const NO_REASON = '';

/** "با دلیلی که فقط از فاصله تشکیل شده" — a reason of spaces only. */
export const A_REASON_OF_SPACES_ONLY = '   ';

/**
 * "آن آنالیز روزانه را ویرایش می کند" — any successful edit. The rule is about *an* edit, not a
 * field, so this changes the one field no other step looks at: the tracking number, to a fresh one,
 * which guarantees something really changed (an edit changing nothing is a different case).
 *
 * Every edit says why and from where (`common/edit-reason.ts`): unless a step names them, a routine
 * reason from the daily BOM list — a correction, which never enters a management note.
 */
export const EditDailyBom = {
  viaApi: (target: DailyBomTarget, intent: EditIntent = aCorrection()): Task =>
    Task.where(
      d`#actor edits ${describe(target)} (via API)`,
      FocusOn(target),
      SendEdit({ trackingNumber: freshTrackingNumber() }, intent),
      Ensure.that(LastResponse.status(), equals(204)),
    ),

  /** "شماره ردیابی آن را به «...» تغییر داده باشد" — viewing-audit-log's edit examples. */
  changingTrackingNumberViaApi: (
    target: DailyBomTarget,
    trackingNumber: string,
    intent: EditIntent = aCorrection(),
  ): Task =>
    Task.where(
      d`#actor changes the tracking number of ${describe(target)} to "${trackingNumber}" (via API)`,
      FocusOn(target),
      SendEdit({ trackingNumber }, intent),
      Ensure.that(LastResponse.status(), equals(204)),
    ),

  /** "وزن مواد اولیه «...» جز «...» ... را به «...» تغییر می دهد" — one or more material weights. */
  changingMaterialWeightsViaApi: (
    target: DailyBomTarget,
    changes: MaterialWeightChange[],
    intent: EditIntent = aCorrection(),
  ): Task =>
    Task.where(
      d`#actor changes material weights of ${describe(target)} (via API)`,
      FocusOn(target),
      SendWeightChanges(changes, intent),
      Ensure.that(LastResponse.status(), equals(204)),
    ),
};

/**
 * «تلاش می کند وزن مواد اولیه … را بدون نوشتن دلیل / با دلیلی که فقط از فاصله تشکیل شده … تغییر
 * دهد» — the same weight edit, with no expectation on the answer: the `Then`s judge it (400
 * `edit-reason-required`, nothing changed).
 */
export const AttemptToChangeMaterialWeights = {
  viaApi: (
    target: DailyBomTarget,
    changes: MaterialWeightChange[],
    intent: EditIntent,
  ): Task =>
    Task.where(
      d`#actor attempts to change material weights of ${describe(target)} with reason "${intent.reason}" (via API)`,
      FocusOn(target),
      SendWeightChanges(changes, intent),
    ),
};

/**
 * «آن آنالیز روزانه را بدون هیچ تغییری و بدون نوشتن دلیل ذخیره می کند» — the composition sent back
 * exactly as it is, with no reason and no source: a save that changes nothing is not an edit, so it
 * needs no reason and is answered like any successful edit.
 */
export const SaveDailyBomUnchanged = {
  viaApi: (target: DailyBomTarget): Task =>
    Task.where(
      d`#actor saves ${describe(target)} without changing anything or writing a reason (via API)`,
      FocusOn(target),
      SendWeightChanges([], undefined),
      Ensure.that(LastResponse.status(), equals(204)),
    ),
};

/**
 * «از داشبورد وزن مواد اولیه ... را با دلیل «...» به «...» تغییر می دهد و سپس آن را تایید می کند» —
 * the reviewer edits the daily BOM on the dashboard while reviewing it, then approves it: two
 * requests, the edit (`editSource: 'dashboard'`) and the approval, which is what lets the approval
 * record the edit — under its heading of reviewer, time and reason — as the management note.
 */
export const CorrectAndApproveDailyBom = {
  viaApi: (
    target: DailyBomTarget,
    changes: MaterialWeightChange[],
    reason: string = ROUTINE_EDIT_REASON,
  ): Task =>
    Task.where(
      d`#actor edits material weights of ${describe(target)} from the dashboard and then approves it (via API)`,
      EditDailyBom.changingMaterialWeightsViaApi(
        target,
        changes,
        anEditFromTheDashboard(reason),
      ),
      ApproveDailyBom.viaApi(thatDailyBom()),
    ),
};

/**
 * "شماره سفارش آن آنالیز روزانه را پاک می کند" — the failed-edit example. Ends by confirming the
 * edit really was refused as invalid (`400`): without that, a request that missed the daily BOM
 * altogether (a `404`, say) would leave its review untouched too, and the scenario would pass
 * without ever proving its rule. Gives a reason, so the order number is the only thing wrong.
 */
export const AttemptToClearOrderNumberOfDailyBom = {
  viaApi: (target: DailyBomTarget): Task =>
    Task.where(
      d`#actor attempts to clear the order number of ${describe(target)} (via API)`,
      FocusOn(target),
      SendEdit({ orderNumber: '' }, aCorrection()),
      Ensure.that(LastResponse.status(), equals(400)),
    ),
};

/** "آنالیز روزانه جدیدی با شماره سفارش «...» ثبت می کند" — registered against the standard BOM
 * the background registered, then brought into focus. API door: the rule is that a new daily BOM
 * starts pending, a backend fact the registration form has no part in. */
export const RegisterNewDailyBom = {
  viaApi: (orderNumber: string): Task =>
    Task.where(
      d`#actor registers a new daily BOM "${orderNumber}" (via API)`,
      RegisterBomAndRememberIt(theLastRegisteredStandardBom(), { orderNumber }),
      Interaction.where('#actor keeps the new daily BOM in focus', () => {
        focusOn({
          id: theLastRegisteredBom().id,
          label: orderNumber,
          orderNumber,
        });
      }),
    ),
};

interface DailyBomReview {
  approvalStatus: ApprovalStatus | undefined;
  /** `undefined` when the response has no such key at all — kept apart from `null` ("nobody"), so
   * a backend that does not send the field yet fails a "no reviewer" check instead of passing it. */
  reviewedBy: string | null | undefined;
  managementNote: string | null | undefined;
}

/** Moved to `common/spotlight.ts`; re-exported for the modules that borrow it from here
 * (`resampling-bom.ts`, `daily-bom-edit-details.ts`). */
export { keepingTheSpotlight };

/** The review of the daily BOM in focus as `GET boms/:id` reports it, read by the observer — see
 * the module comment for why not by the actor asking. */
const TheReviewOfThatDailyBom = (): QuestionAdapter<DailyBomReview> =>
  Question.about('the review of that daily BOM', async () => {
    const { id } = theDailyBomInFocus();
    let review!: DailyBomReview;
    await keepingTheSpotlight(async () => {
      const observer = actorCalled(OBSERVER);
      await observer.attemptsTo(
        LogInAsPersona(OBSERVER),
        Send.a(GetRequest.to(`boms/${id}`)),
        Ensure.that(LastResponse.status(), equals(200)),
      );
      const body = await observer.answer(
        LastResponse.body<Partial<DailyBomReview>>(),
      );
      review = {
        approvalStatus: body.approvalStatus,
        reviewedBy: 'reviewedBy' in body ? body.reviewedBy : undefined,
        managementNote:
          'managementNote' in body ? body.managementNote : undefined,
      };
    });
    return review;
  });

/** "وضعیت آن آنالیز روزانه «...» باشد" / "... باقی بماند" */
export const EnsureApprovalStatusIs = (label: string): Task =>
  Task.where(
    d`#actor ensures that daily BOM is "${label}"`,
    Ensure.that(
      TheReviewOfThatDailyBom().approvalStatus,
      equals<ApprovalStatus | undefined>(approvalStatusFor(label)),
    ),
  );

/** "تایید/رد کننده آن «...» باشد" — the reviewer's name as the backend stores it, which for یاشار is
 * the seeded account's own name, not the suite's label for it (`personas.ts#realNameFor`). */
export const EnsureReviewedBy = (personaName: string): Task =>
  Task.where(
    d`#actor ensures that daily BOM was reviewed by ${personaName}`,
    Ensure.that(
      TheReviewOfThatDailyBom().reviewedBy,
      equals<string | null | undefined>(realNameFor(personaName)),
    ),
  );

/** "تایید/رد کننده ای برای آن ثبت نشده باشد" */
export const EnsureNoReviewer = (): Task =>
  Task.where(
    '#actor ensures that daily BOM has no reviewer',
    Ensure.that(
      TheReviewOfThatDailyBom().reviewedBy,
      equals<string | null | undefined>(null),
    ),
  );

/** "توضیحات مدیریت آن «...» باشد" and the one-column «توضیحات مدیریت» tables — one line per row,
 * joined by a line break, in the order the table gives them. */
export const EnsureManagementNoteIs = (lines: string[]): Task =>
  Task.where(
    d`#actor ensures the management note of that daily BOM reads ${lines.join(' / ')}`,
    Ensure.that(
      TheReviewOfThatDailyBom().managementNote,
      equals<string | null | undefined>(lines.join('\n')),
    ),
  );

/** "توضیحات مدیریتی برای آن ثبت نشده باشد" */
export const EnsureNoManagementNote = (): Task =>
  Task.where(
    '#actor ensures that daily BOM has no management note',
    Ensure.that(
      TheReviewOfThatDailyBom().managementNote,
      equals<string | null | undefined>(null),
    ),
  );

/** "به او گفته شود که نوشتن دلیل عدم تایید لازم است" — the refused rejection's own answer. */
export const EnsureToldARejectionReasonIsRequired = (): Task =>
  Task.where(
    '#actor ensures they were told a rejection needs a reason',
    EnsureProblemDetail(400, 'rejection-reason-required'),
  );

/** "به او گفته شود که آنالیز روزانه باید پیش از تغییر وضعیت ویرایش شود" — the refused review's own
 * answer: an approved or rejected daily BOM must be edited (back to pending) before it is reviewed
 * again. */
export const EnsureToldTheDailyBomMustBeEditedFirst = (): Task =>
  Task.where(
    '#actor ensures they were told the daily BOM must be edited before its status can change',
    EnsureProblemDetail(409, 'bom-already-reviewed'),
  );

/** The daily BOM approving-bom's background registers is composed of these lines, in this order —
 * the components and materials its weight examples name. */
const COMPOSITION_TO_REVIEW: { component: string; materials: string[] }[] = [
  { component: 'مغزی', materials: ['مسی'] },
  { component: 'روکش', materials: ['آلومینیوم'] },
];

/**
 * The weights that daily BOM is registered with — the ones its features' weight preconditions name
 * («… «مسی» جز «مغزی» … برابر «3» باشد», the «مغزی 3 / روکش 6» table). Registered with them rather
 * than edited to them afterwards, because since issue #73 every edit is recorded: an edit made only
 * to set a precondition would show up in the daily BOM's edit details («جزئیات ویرایش»), which
 * daily-bom-edit-details.feature asserts exactly. The weight preconditions still check, and still
 * edit when a scenario names another weight.
 */
const INITIAL_WEIGHT_TO_REVIEW: Record<string, number> = {
  'مغزی|مسی': 3,
  'روکش|آلومینیوم': 6,
};

/** The product each daily BOM `registerDailyBomToApprove` registered sits under, by order number —
 * what a dashboard step needs, since the dashboard shows a daily BOM only inside its product's
 * panel. Set by every background that registers one. */
const productByOrderNumber = new Map<string, { id: string; name: string }>();

/** The product the daily BOM `orderNumber` was registered under by `registerDailyBomToApprove`. */
export const theProductOfTheDailyBomToApprove = (
  orderNumber: string,
): { id: string; name: string } => {
  const product = productByOrderNumber.get(orderNumber);
  if (!product) {
    throw new Error(
      `Daily BOM "${orderNumber}" is not one a "آنالیز روزانه ای با شماره سفارش … در سیستم ثبت شده ` +
        'باشد" background registered.',
    );
  }
  return product;
};

/** The name of that product — what the dashboard's panel is found by. */
export const theProductNameOfTheDailyBomToApprove = (
  orderNumber: string,
): string => theProductOfTheDailyBomToApprove(orderNumber).name;

/**
 * "آنالیز روزانه ای با شماره سفارش «...» در سیستم ثبت شده باشد" — approving-bom's background: a
 * fresh product composed of «مغزی/مسی» and «روکش/آلومینیوم» (the lines its weight examples name),
 * its standard BOM, and the daily BOM itself with `INITIAL_WEIGHT_TO_REVIEW`, all through یاشار's
 * admin access (the step names nobody), then brought into focus. Shared by
 * daily-bom-edit-details.feature's background, byte for byte.
 *
 * Not a single `Task`, for the same reason the other fixture modules aren't: it acts as an actor
 * the scenario never names, and must leave the spotlight where it found it.
 */
export const registerDailyBomToApprove = (orderNumber: string): Promise<void> =>
  keepingTheSpotlight(async () => {
    const admin = actorCalled('یاشار');
    await admin.attemptsTo(
      LogInAsPersona('یاشار'),
      RegisterProductAndRememberIt(
        freshProductDetails({
          components: COMPOSITION_TO_REVIEW.map(({ component, materials }) => ({
            name: component,
            materials: materials.map((name) =>
              freshMaterialInComponent({ name }),
            ),
          })),
        }),
      ),
    );
    await admin.attemptsTo(
      RegisterStandardBomAndRememberIt(theLastRegisteredProduct()),
    );
    await admin.attemptsTo(
      RegisterBomAndRememberIt(
        theLastRegisteredStandardBom(),
        { orderNumber },
        (componentName, materialName) =>
          INITIAL_WEIGHT_TO_REVIEW[`${componentName}|${materialName}`] ??
          freshWeightInGrams(),
      ),
    );
    const { id, name } = theLastRegisteredProduct();
    productByOrderNumber.set(orderNumber, { id, name });
    focusOn({ id: theLastRegisteredBom().id, label: orderNumber, orderNumber });
  });

/**
 * "وزن مواد اولیه «...» جز «...» در آنالیز روزانه با شماره سفارش «...» برابر «...» باشد" and
 * "آنالیز روزانه با شماره سفارش «...» با وزن مواد اولیه زیر در سیستم ثبت شده باشد" — makes the
 * weights true, and brings the daily BOM into focus. Lines already at their weight are left alone;
 * the rest are set in one edit by the inspector, whose edits no review records
 * (`INSPECTOR`) — so the precondition never shows up in a management note.
 */
export const ensureMaterialWeightsAsAPrecondition = (
  target: DailyBomTarget,
  weights: MaterialWeightChange[],
): Promise<void> =>
  keepingTheSpotlight(async () => {
    const inspector = actorCalled(INSPECTOR);
    await inspector.attemptsTo(LogInAsPersona(INSPECTOR), FocusOn(target));
    const toChange: MaterialWeightChange[] = [];
    for (const line of weights) {
      const current = await inspector.answer(
        TheWeightOf(line.componentName, line.materialName),
      );
      if (current !== line.weight) {
        toChange.push(line);
      }
    }
    if (toChange.length > 0) {
      await inspector.attemptsTo(
        EditDailyBom.changingMaterialWeightsViaApi(thatDailyBom(), toChange),
      );
    }
  });

/** "آنالیز روزانه ... توسط «...» تایید شده باشد" — the approver logs in and approves, through the
 * API; whoever was in the spotlight stays there. */
export const approveDailyBomAsAPrecondition = (
  target: DailyBomTarget,
  approverName: string,
): Promise<void> =>
  keepingTheSpotlight(async () => {
    await actorCalled(approverName).attemptsTo(
      LogInAsPersona(approverName),
      ApproveDailyBom.viaApi(target),
    );
  });

/** "آنالیز روزانه ... توسط «...» با دلیل «...» عدم تایید شده باشد" — the reviewer logs in and
 * rejects, through the API; whoever was in the spotlight stays there. */
export const rejectDailyBomAsAPrecondition = (
  target: DailyBomTarget,
  reviewerName: string,
  reason: string,
): Promise<void> =>
  keepingTheSpotlight(async () => {
    await actorCalled(reviewerName).attemptsTo(
      LogInAsPersona(reviewerName),
      RejectDailyBom.viaApi(target, reason),
    );
  });

/** "«...» (از داشبورد) وزن مواد اولیه «...» جز «...» ... را (با دلیل «...») به «...» تغییر داده و سپس
 * آن را تایید کرده باشد" — a review edit from the dashboard, then the approval; a routine reason
 * when the step names none. */
export const correctAndApproveDailyBomAsAPrecondition = (
  target: DailyBomTarget,
  reviewerName: string,
  changes: MaterialWeightChange[],
  reason: string = ROUTINE_EDIT_REASON,
): Promise<void> =>
  keepingTheSpotlight(async () => {
    await actorCalled(reviewerName).attemptsTo(
      LogInAsPersona(reviewerName),
      CorrectAndApproveDailyBom.viaApi(target, changes, reason),
    );
  });

/** "«...» وزن مواد اولیه «...» جز «...» آن را به «...» تغییر داده باشد", and the «از لیست آنالیز های
 * روزانه … با دلیل «...»» forms of it — a correction unless `intent` says otherwise. */
export const changeMaterialWeightsAsAPrecondition = (
  target: DailyBomTarget,
  editorName: string,
  changes: MaterialWeightChange[],
  intent: EditIntent = aCorrection(),
): Promise<void> =>
  keepingTheSpotlight(async () => {
    await actorCalled(editorName).attemptsTo(
      LogInAsPersona(editorName),
      EditDailyBom.changingMaterialWeightsViaApi(target, changes, intent),
    );
  });

/** "و پس از آن توسط «...» ویرایش شده باشد" */
export const editDailyBomAsAPrecondition = (
  target: DailyBomTarget,
  editorName: string,
): Promise<void> =>
  keepingTheSpotlight(async () => {
    await actorCalled(editorName).attemptsTo(
      LogInAsPersona(editorName),
      EditDailyBom.viaApi(target),
    );
  });

/** Brings a daily BOM into focus by id without acting on it — for a precondition that only
 * confirms the daily BOM is as the step says (viewing-audit-log's pending-edit example). */
export const focusOnTheDailyBomWithId = (id: string): void => {
  focusOn({ id, label: id });
};

/** The id of the daily BOM in focus — for the audit log, which looks its events up by record id. */
export const theIdOfThatDailyBom = (): string => theDailyBomInFocus().id;

/** Brings the daily BOM with this id and order number into focus — for a step that has just
 * registered one some other way (the preview's form) and makes it "آن آنالیز روزانه". */
export const focusOnTheDailyBom = (bom: {
  id: string;
  orderNumber: string;
}): void => {
  focusOn({ id: bom.id, label: bom.orderNumber, orderNumber: bom.orderNumber });
};

/** The order number of the daily BOM in focus — what a UI task finds its row or card by. Fails
 * loudly when the step that focused it named it by id only. */
export const theOrderNumberOfThatDailyBom = (): string => {
  const { orderNumber, label } = theDailyBomInFocus();
  if (!orderNumber) {
    throw new Error(
      `The daily BOM in focus (${label}) was named by id; no step has said its order number.`,
    );
  }
  return orderNumber;
};
