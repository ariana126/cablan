import {
  actorCalled,
  actorInTheSpotlight,
  d,
  Interaction,
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
  PatchRequest,
  PostRequest,
  Send,
} from '@serenity-js/rest';
import { Click, isVisible, Scroll } from '@serenity-js/web';
import { BomDashboardPage } from '../ui/bom-dashboard-page';
import { LogInAsPersona, realNameFor } from '../common/personas';
import { freshProductDetails } from '../bom-registration/product-details';
import { theLastRegisteredProduct } from '../bom-registration/product-details';
import { RegisterProductAndRememberIt } from '../bom-registration/register-product';
import { RegisterStandardBomAndRememberIt } from '../bom-registration/register-standard-bom';
import { theLastRegisteredStandardBom } from '../bom-registration/standard-bom-details';
import { RegisterBomAndRememberIt } from '../bom-registration/register-bom';
import {
  freshTrackingNumber,
  theLastRegisteredBom,
} from '../bom-registration/bom-details';
import { BomSummary } from '../bom-registration/view-bom-list';
import { theDashboardProductNameOf } from './bom-dashboard-fixtures';
import {
  OpenProductDailyBomList,
  rememberTheDashboardDailyBomInFocus,
} from './bom-dashboard-product-details';

/**
 * Domain layer for "تایید آنالیز روزانه" (`bom-analyzing/approving-bom.feature`), and the approval
 * vocabulary every other feature borrows: the "... توسط مصطفی تایید شده باشد" precondition
 * (bom-dashboard, reporting-bom, exporting-bom, viewing-audit-log) and the dashboard's own
 * «از داشبورد» approve/revoke.
 *
 * **Which door.** `approving-bom.feature` is a feature about a backend rule — who may approve, what
 * an edit does to an approval — with no screen as its point, so its active steps take the API door
 * (`POST`/`DELETE boms/:id/approval`, pinned in `docs/superpowers/plans/2026-10-20-approving-bom.md`
 * "Wire contract"), the same exception `acceptance-tests/CLAUDE.md` makes for the dashboard's score
 * rule. The browser variant of the same goals — `ApproveDailyBom.fromTheDashboard` and
 * `RevokeDailyBomApproval.fromTheDashboard` — is what `bom-dashboard.feature`'s «از داشبورد» steps
 * drive, so the approval workflow is still exercised end to end through the UI at least once.
 *
 * **"آن آنالیز روزانه".** Most steps here say "that daily BOM", so the module keeps the one the
 * scenario is about in focus (`theDailyBomInFocus`), set by whichever step named it first — the
 * background, an approval, a registration. Plain module state, not a Notepad: which daily BOM a
 * scenario is about is a fact about the scenario, shared by every actor in it.
 *
 * **Reading the approval.** The `Then`s read `GET boms/:id` through an observer — the system admin
 * — rather than through the actor in the spotlight. Two of the outlines check the approval
 * *between* a refused attempt and "پیغام خطای عدم دسترسی نشان داده شود", which reads the refused
 * request's 403 off the actor's last response; a read by that same actor would overwrite it
 * (`CallAnApi.request` caches every response). The spotlight is handed back afterwards, so the
 * following bare `Then` still reads the actor it should.
 */

/** The wire values of `approvalStatus` — pinned contract. */
export type ApprovalStatus = 'approved' | 'unapproved';

const approvalStatusByLabel: Record<string, ApprovalStatus> = {
  'تایید شده': 'approved',
  'تایید نشده': 'unapproved',
};

/** «تایید شده» / «تایید نشده», as the Gherkin and the UI write them, to the wire value. */
export const approvalStatusFor = (label: string): ApprovalStatus => {
  const status = approvalStatusByLabel[label];
  if (!status) {
    throw new Error(
      `"${label}" is not an approval status (expected one of: ` +
        `${Object.keys(approvalStatusByLabel).join(', ')}).`,
    );
  }
  return status;
};

/** The persona the approval is read through — see the module comment. */
const OBSERVER = 'یاشار';

interface DailyBomInFocus {
  id: string;
  /** How the step named it — an order number, or the audit log's record id. */
  label: string;
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
    focusOn({ id: matches[0].id, label: target.orderNumber });
  });

/** `POST` (approve) or `DELETE` (revoke) `boms/:id/approval` for the daily BOM in focus. */
const SendApprovalRequest = (method: 'approve' | 'revoke'): Interaction =>
  Interaction.where(
    method === 'approve'
      ? '#actor sends the approval'
      : '#actor sends the approval revocation',
    async (actor) => {
      const { id } = theDailyBomInFocus();
      const path = `boms/${id}/approval`;
      await Send.a(
        method === 'approve' ? PostRequest.to(path) : DeleteRequest.to(path),
      ).performAs(actor);
    },
  );

/** `PATCH boms/:id` for the daily BOM in focus. */
const SendEdit = (changes: Record<string, unknown>): Interaction =>
  Interaction.where('#actor sends the edit', async (actor) => {
    const { id } = theDailyBomInFocus();
    await Send.a(PatchRequest.to(`boms/${id}`).with(changes)).performAs(actor);
  });

/**
 * Opens the product panel a dashboard daily BOM sits in, today's range, and waits for its card.
 * The product is the one the dashboard background registered that order number under.
 */
const LocateTheDailyBomCardInTheDashboard = (orderNumber: string): Task => {
  const productName = theDashboardProductNameOf(orderNumber);
  const card = BomDashboardPage.dailyBomCard(productName, orderNumber);
  return Task.where(
    d`#actor locates daily BOM "${orderNumber}" on the dashboard`,
    OpenProductDailyBomList(productName),
    Scroll.to(card),
    Wait.until(card, isVisible()),
    rememberTheDashboardDailyBomInFocus(orderNumber),
  );
};

export const ApproveDailyBom = {
  /** The API door — `approving-bom.feature`'s own steps and every "تایید شده باشد" precondition. */
  viaApi: (target: DailyBomTarget): Task =>
    Task.where(
      d`#actor approves ${describe(target)} (via API)`,
      FocusOn(target),
      SendApprovalRequest('approve'),
      Ensure.that(LastResponse.status(), equals(204)),
    ),

  /** «از داشبورد» — clicks the card's «تایید» and waits for the card to offer «لغو تایید» in its
   * place, the sign the approval has been answered. */
  fromTheDashboard: (orderNumber: string): Task => {
    const card = BomDashboardPage.dailyBomCard(
      theDashboardProductNameOf(orderNumber),
      orderNumber,
    );
    return Task.where(
      d`#actor approves daily BOM "${orderNumber}" from the dashboard`,
      LocateTheDailyBomCardInTheDashboard(orderNumber),
      Click.on(BomDashboardPage.cardApproveButton().of(card)),
      Wait.until(
        BomDashboardPage.cardRevokeApprovalButton().of(card),
        isVisible(),
      ),
    );
  },
};

export const RevokeDailyBomApproval = {
  viaApi: (target: DailyBomTarget): Task =>
    Task.where(
      d`#actor revokes the approval of ${describe(target)} (via API)`,
      FocusOn(target),
      SendApprovalRequest('revoke'),
      Ensure.that(LastResponse.status(), equals(204)),
    ),

  /** «از داشبورد» — the mirror of `ApproveDailyBom.fromTheDashboard`. */
  fromTheDashboard: (orderNumber: string): Task => {
    const card = BomDashboardPage.dailyBomCard(
      theDashboardProductNameOf(orderNumber),
      orderNumber,
    );
    return Task.where(
      d`#actor revokes the approval of daily BOM "${orderNumber}" from the dashboard`,
      LocateTheDailyBomCardInTheDashboard(orderNumber),
      Click.on(BomDashboardPage.cardRevokeApprovalButton().of(card)),
      Wait.until(BomDashboardPage.cardApproveButton().of(card), isVisible()),
    );
  },
};

/** "تلاش می کند ... را تایید کند" — no expectation on the answer: the `Then`s judge it. */
export const AttemptToApproveDailyBom = {
  viaApi: (target: DailyBomTarget): Task =>
    Task.where(
      d`#actor attempts to approve ${describe(target)} (via API)`,
      FocusOn(target),
      SendApprovalRequest('approve'),
    ),
};

/** "تلاش می کند تایید ... را لغو کند" */
export const AttemptToRevokeDailyBomApproval = {
  viaApi: (target: DailyBomTarget): Task =>
    Task.where(
      d`#actor attempts to revoke the approval of ${describe(target)} (via API)`,
      FocusOn(target),
      SendApprovalRequest('revoke'),
    ),
};

/**
 * "آن آنالیز روزانه را ویرایش می کند" — any successful edit. The rule is about *an* edit, not a
 * field, so this changes the one field no other step looks at: the tracking number, to a fresh one,
 * which guarantees something really changed (an edit changing nothing is a different case — the
 * plan's Review Focus 3).
 */
export const EditDailyBom = {
  viaApi: (target: DailyBomTarget): Task =>
    Task.where(
      d`#actor edits ${describe(target)} (via API)`,
      FocusOn(target),
      SendEdit({ trackingNumber: freshTrackingNumber() }),
      Ensure.that(LastResponse.status(), equals(204)),
    ),

  /** "شماره ردیابی آن را به «...» تغییر داده باشد" — viewing-audit-log's edit-reset example. */
  changingTrackingNumberViaApi: (
    target: DailyBomTarget,
    trackingNumber: string,
  ): Task =>
    Task.where(
      d`#actor changes the tracking number of ${describe(target)} to "${trackingNumber}" (via API)`,
      FocusOn(target),
      SendEdit({ trackingNumber }),
      Ensure.that(LastResponse.status(), equals(204)),
    ),
};

/**
 * "شماره سفارش آن آنالیز روزانه را پاک می کند" — the failed-edit example. Ends by confirming the
 * edit really was refused as invalid (`400`): without that, a request that missed the daily BOM
 * altogether (a `404`, say) would leave its approval untouched too, and the scenario would pass
 * without ever proving its rule.
 */
export const AttemptToClearOrderNumberOfDailyBom = {
  viaApi: (target: DailyBomTarget): Task =>
    Task.where(
      d`#actor attempts to clear the order number of ${describe(target)} (via API)`,
      FocusOn(target),
      SendEdit({ orderNumber: '' }),
      Ensure.that(LastResponse.status(), equals(400)),
    ),
};

/** "آنالیز روزانه جدیدی با شماره سفارش «...» ثبت می کند" — registered against the standard BOM
 * the background registered, then brought into focus. API door: the rule is that a new daily BOM
 * starts unapproved, a backend fact the registration form has no part in. */
export const RegisterNewDailyBom = {
  viaApi: (orderNumber: string): Task =>
    Task.where(
      d`#actor registers a new daily BOM "${orderNumber}" (via API)`,
      RegisterBomAndRememberIt(theLastRegisteredStandardBom(), { orderNumber }),
      Interaction.where('#actor keeps the new daily BOM in focus', () => {
        focusOn({ id: theLastRegisteredBom().id, label: orderNumber });
      }),
    ),
};

interface DailyBomApproval {
  approvalStatus: ApprovalStatus;
  approvedBy: string | null;
}

const nameInTheSpotlight = (): string | undefined => {
  try {
    return actorInTheSpotlight().name;
  } catch {
    return undefined;
  }
};

/** Runs `work` as other actors without leaving any of them in the spotlight — a precondition or
 * an observation shouldn't change who a following bare `Then` speaks about. */
const keepingTheSpotlight = async (
  work: () => Promise<void>,
): Promise<void> => {
  const previous = nameInTheSpotlight();
  await work();
  if (previous) {
    actorCalled(previous);
  }
};

/** The approval of the daily BOM in focus as `GET boms/:id` reports it, read by the observer —
 * see the module comment for why not by the actor asking. */
const TheApprovalOfThatDailyBom = (): QuestionAdapter<DailyBomApproval> =>
  Question.about('the approval of that daily BOM', async () => {
    const { id } = theDailyBomInFocus();
    let approval!: DailyBomApproval;
    await keepingTheSpotlight(async () => {
      const observer = actorCalled(OBSERVER);
      await observer.attemptsTo(
        LogInAsPersona(OBSERVER),
        Send.a(GetRequest.to(`boms/${id}`)),
        Ensure.that(LastResponse.status(), equals(200)),
      );
      const body = await observer.answer(
        LastResponse.body<Partial<DailyBomApproval>>(),
      );
      approval = {
        approvalStatus: body.approvalStatus as ApprovalStatus,
        approvedBy: body.approvedBy ?? null,
      };
    });
    return approval;
  });

/** "وضعیت آن آنالیز روزانه «...» باشد" / "... باقی بماند" */
export const EnsureApprovalStatusIs = (label: string): Task =>
  Task.where(
    d`#actor ensures that daily BOM is "${label}"`,
    Ensure.that(
      TheApprovalOfThatDailyBom().approvalStatus,
      equals(approvalStatusFor(label)),
    ),
  );

/** "تایید کننده آن «...» باشد" — the approver's name as the backend stores it, which for یاشار is
 * the seeded account's own name, not the suite's label for it (`personas.ts#realNameFor`). */
export const EnsureApprovedBy = (personaName: string): Task =>
  Task.where(
    d`#actor ensures that daily BOM was approved by ${personaName}`,
    Ensure.that(
      TheApprovalOfThatDailyBom().approvedBy,
      equals<string | null>(realNameFor(personaName)),
    ),
  );

/** "تایید کننده ای برای آن ثبت نشده باشد" */
export const EnsureNoApprover = (): Task =>
  Task.where(
    '#actor ensures that daily BOM has no approver',
    Ensure.that(
      TheApprovalOfThatDailyBom().approvedBy,
      equals<string | null>(null),
    ),
  );

/**
 * "آنالیز روزانه ای با شماره سفارش «...» در سیستم ثبت شده باشد" — approving-bom's background: a
 * fresh product and standard BOM, and the daily BOM itself, all through یاشار's admin access
 * (the step names nobody), then brought into focus.
 *
 * Not a single `Task`, for the same reason the other fixture modules aren't: it acts as an actor
 * the scenario never names, and must leave the spotlight where it found it.
 */
export const registerDailyBomToApprove = (orderNumber: string): Promise<void> =>
  keepingTheSpotlight(async () => {
    const admin = actorCalled('یاشار');
    await admin.attemptsTo(
      LogInAsPersona('یاشار'),
      RegisterProductAndRememberIt(freshProductDetails()),
    );
    await admin.attemptsTo(
      RegisterStandardBomAndRememberIt(theLastRegisteredProduct()),
    );
    await admin.attemptsTo(
      RegisterBomAndRememberIt(theLastRegisteredStandardBom(), {
        orderNumber,
      }),
    );
    focusOn({ id: theLastRegisteredBom().id, label: orderNumber });
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
 * confirms the daily BOM is as the step says (viewing-audit-log's unapproved-edit example). */
export const focusOnTheDailyBomWithId = (id: string): void => {
  focusOn({ id, label: id });
};

/** The id of the daily BOM in focus — for the audit log, which looks its events up by record id. */
export const theIdOfThatDailyBom = (): string => theDailyBomInFocus().id;
