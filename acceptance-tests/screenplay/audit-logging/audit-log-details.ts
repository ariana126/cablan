import { DataTable } from '@cucumber/cucumber';
import {
  actorCalled,
  Answerable,
  d,
  q,
  Question,
  QuestionAdapter,
  Task,
} from '@serenity-js/core';
import { Ensure, equals } from '@serenity-js/assertions';
import { GetRequest, LastResponse, Send } from '@serenity-js/rest';
import { FreezeTimeAt } from '../common/clock';
import { parseJalaliDateTime } from '../common/jalali-datetime';
import { LogInAsPersona, realNameFor } from '../common/personas';
import { approvalStatusFor } from '../bom-analyzing/daily-bom-approval';
import {
  freshProductDetails,
  theLastRegisteredProduct,
} from '../bom-registration/product-details';
import { RegisterProductAndRememberIt } from '../bom-registration/register-product';
import { theLastRegisteredStandardBom } from '../bom-registration/standard-bom-details';
import { RegisterStandardBomAndRememberIt } from '../bom-registration/register-standard-bom';
import { EditStandardBom } from '../bom-registration/edit-standard-bom';
import {
  AuditAction,
  AuditLogEntry,
  TheAuditLogItems,
  ViewAuditLog,
} from './view-audit-log';

/**
 * Domain layer for "مدیر سیستم می تواند جزئیات تغییرات هر رویداد را مشاهده کند" — the ONE rule in
 * `viewing-audit-log.feature` whose own example needs a standard BOM edit event that changes BOTH
 * "متراژ استاندارد" and "برند" together, distinct from `audit-log-fixtures.ts`'s own background row
 * 7 (which changes only "متراژ استاندارد"). Deliberately independent of that shared background even
 * though this rule's own Given table narratively echoes row 6/7's own placeholder id and instant:
 * the table states standard length's PREVIOUS value as "305", which is only literally true if THIS
 * scenario performs its own registration-then-edit sequence from scratch — the background's own row
 * 7 (which runs before EVERY scenario in this feature, Backgrounds apply feature-wide, including to
 * scenarios nested inside a Rule) would already have moved that shared standard BOM's own length to
 * "310" by the time this Given runs. A fresh product and standard BOM, entirely unrelated to the
 * background's own MI code "1001", is what keeps this table's literal values true regardless of run
 * order — and since this rule's own assertion only ever looks at ONE targeted event's own details,
 * never the full list, it doesn't matter that this creates a couple of audit events
 * (product/standard-BOM registration) this rule's own scenario never itself asserts against.
 */

const ACTOR = 'کاربر';
const OCCURRED_AT = 'تاریخ و زمان';
const FIELD = 'فیلد';
const PREVIOUS_VALUE = 'مقدار قبلی';
const NEW_VALUE = 'مقدار جدید';

/** The "فیلد" labels this feature names, to their wire-level keys — the standard-BOM pair the
 * multi-field example needs ("متراژ استاندارد"→`standardLength`, "برند"→`brand`), and the daily-BOM
 * fields the approval examples need: "شماره ردیابی" (`trackingNumber`) and the two approval fields
 * the pinned contract names (`approvalStatus`, `approvedBy`). This is the one place in this feature
 * that translates a field label to its wire-level key. */
const fieldKeyByLabel: Record<string, string> = {
  'متراژ استاندارد': 'standardLength',
  برند: 'brand',
  'شماره ردیابی': 'trackingNumber',
  'وضعیت تایید': 'approvalStatus',
  'تایید کننده': 'approvedBy',
};

export const fieldKeyFor = (label: string): string => {
  const key = fieldKeyByLabel[label];
  if (!key) {
    throw new Error(`No known audit-log change field for "${label}".`);
  }
  return key;
};

/**
 * A change line's value as the Gherkin writes it, to the value the audit log carries. Most fields
 * are carried verbatim. The two approval fields are not: the business reads «تایید شده» /
 * «تایید نشده» where the wire says `approved` / `unapproved`, a persona's name where the wire
 * carries the name the backend stores (`personas.ts#realNameFor` — they differ for یاشار), and
 * «-» where the wire carries no value. "No value" is `''` on the wire, the way every other
 * registered-from-nothing line already reads (`AuditSnapshot`'s own convention); the pinned
 * contract's `from: null` is read the same way — see `TheNormalizedSortedChanges`.
 */
export const auditValueFor = (fieldKey: string, shown: string): string => {
  if (fieldKey === 'approvalStatus') {
    return approvalStatusFor(shown);
  }
  if (fieldKey === 'approvedBy') {
    return shown === '-' ? '' : realNameFor(shown);
  }
  return shown;
};

let targetAuditEventId: string | undefined;

/** Points this feature's "جزئیات ... رویداد ... را مشاهده می کند" steps at one event. */
export const targetAuditEvent = (id: string): void => {
  targetAuditEventId = id;
};

const theTargetAuditEventId = (): string => {
  if (!targetAuditEventId) {
    throw new Error(
      'No audit event has been targeted yet — expected a preceding "اینکه رویداد ویرایش زیر با ' +
        'جزئیات تغییرات آن در سیستم ثبت شده باشد:" step.',
    );
  }
  return targetAuditEventId;
};

/** "اینکه رویداد ویرایش زیر با جزئیات تغییرات آن در سیستم ثبت شده باشد:" — registers a fresh
 * product and standard BOM (both starting from the table's own "مقدار قبلی" values), then performs
 * ONE edit changing both fields together, all as مصطفی (the table's own "کاربر"), all at the
 * table's own frozen instant. Remembers the resulting "Edited" audit event's real id
 * (`theTargetAuditEventId`) for the scenario's following `When`/`Then` steps. */
export const registerMultiFieldEditFixture = async (
  table: DataTable,
): Promise<void> => {
  const rows = table.hashes();
  const [first] = rows;
  if (!first) {
    throw new Error('The multi-field edit event table has no rows.');
  }
  const actorName = first[ACTOR];
  const instant = parseJalaliDateTime(first[OCCURRED_AT]);

  const standardLengthRow = rows.find(
    (row) => fieldKeyFor(row[FIELD]) === 'standardLength',
  );
  const brandRow = rows.find((row) => fieldKeyFor(row[FIELD]) === 'brand');
  if (!standardLengthRow || !brandRow) {
    throw new Error(
      'The multi-field edit event table is expected to carry both "متراژ استاندارد" and "برند" ' +
        'rows.',
    );
  }

  const actor = actorCalled(actorName);
  await actor.attemptsTo(FreezeTimeAt(instant), LogInAsPersona(actorName));

  await actor.attemptsTo(RegisterProductAndRememberIt(freshProductDetails()));
  const product = theLastRegisteredProduct();

  await actor.attemptsTo(
    RegisterStandardBomAndRememberIt(product, {
      standardLength: standardLengthRow[PREVIOUS_VALUE],
      brand: brandRow[PREVIOUS_VALUE],
    }),
  );
  const standardBom = theLastRegisteredStandardBom();

  await actor.attemptsTo(
    EditStandardBom.viaApiUsing(standardBom.id, {
      standardLength: standardLengthRow[NEW_VALUE],
      brand: brandRow[NEW_VALUE],
    }),
  );

  // `POST /audit-log` is `@Roles(Role.SystemAdmin)`-gated — مصطفی (`actor`, above) may perform
  // the edit itself, but only یاشار may query the audit log to find its resulting event. Re-affirms
  // her login (idempotent, and cheap — she's already logged in via this feature's own top-level
  // background) at the CURRENT frozen instant, rather than trusting whatever token her background
  // login minted possibly a very different instant ago, for the same "freeze/login immediately
  // before use" reasoning `audit-log-fixtures.ts`'s own module comment gives.
  const admin = actorCalled('یاشار');
  await admin.attemptsTo(LogInAsPersona('یاشار'));

  targetAuditEventId = await pollForANewAuditEventId(
    admin,
    standardBom.id,
    'Edited',
  );
};

/**
 * Polls for an `action` audit entry `AuditLogProjector` writes for `recordId` — one whose id is not
 * among `alreadyKnown` — rather than reading it after a single `ViewAuditLog.viaApiUsing` call:
 * `backend/src/modules/audit-logging/CLAUDE.md` documents projection as fire-and-forget —
 * `PrismaEntityRepository.save()` never awaits `EventBus.publishAll()`, so the HTTP response to the
 * mutation a fixture just performed can reach this suite before the corresponding audit row has
 * actually been written. Every OTHER read of the audit log in this feature (the full background's
 * own list/filter scenarios) has several further awaited HTTP calls happen first — plenty of time
 * for that write to land — so it is the fixtures acting right before a details step that need to
 * wait for it explicitly.
 *
 * `alreadyKnown` is what tells a new event from an older one of the same kind on the same record —
 * the edit examples edit a daily BOM the background's row 9 already edited once
 * (`auditEventIdsFor`).
 *
 * `actor` must be a System Admin — `POST /audit-log` is `@Roles(Role.SystemAdmin)`-gated, so
 * polling as a non-admin gets a 403 problem-detail body with no `items` key.
 */
export const pollForANewAuditEventId = async (
  actor: ReturnType<typeof actorCalled>,
  recordId: string,
  action: AuditAction,
  alreadyKnown: string[] = [],
): Promise<string> => {
  const deadline = Date.now() + 5_000;
  do {
    await actor.attemptsTo(
      ViewAuditLog.viaApiUsing({ recordId, page: 1, pageSize: 20 }),
    );
    const items = await actor.answer(TheAuditLogItems());
    const found = items.find(
      (item: AuditLogEntry) =>
        item.action === action && !alreadyKnown.includes(item.id),
    );
    if (found) {
      return found.id;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  } while (Date.now() < deadline);

  throw new Error(
    `Expected a new "${action}" audit event for record ${recordId}, found none within 5s.`,
  );
};

/** The ids of every audit event recorded so far for `recordId` — read before a mutation, so
 * `pollForANewAuditEventId` can tell the event it causes from older ones. `actor` must be a
 * System Admin. */
export const auditEventIdsFor = async (
  actor: ReturnType<typeof actorCalled>,
  recordId: string,
): Promise<string[]> => {
  await actor.attemptsTo(
    ViewAuditLog.viaApiUsing({ recordId, page: 1, pageSize: 100 }),
  );
  return (await actor.answer(TheAuditLogItems())).map((item) => item.id);
};

export const ViewAuditEventDetails = {
  /** One event's details — a SEPARATE request from the list, per this feature's own "قانون":
   * field-level change details are fetched on demand, per event, keeping the list itself lean. */
  of: (eventId: Answerable<string>): Task =>
    Task.where(
      d`#actor views the details of audit event ${eventId}`,
      Send.a(GetRequest.to(q`audit-log/${eventId}/changes`)),
      Ensure.that(LastResponse.status(), equals(200)),
    ),
};

/** "یاشار جزئیات آن رویداد را مشاهده می کند" — the event the preceding precondition targeted. */
export const ViewTargetAuditEventDetails = (): Task =>
  Task.where(
    "#actor views the target audit event's details",
    ViewAuditEventDetails.of(theTargetAuditEventId()),
  );

export interface AuditChangeRow {
  field: string;
  previousValue: string | null;
  newValue: string | null;
}

/** The reference an audit entry names its record by — `{ field: 'trackingNumber', value:
 * 'TRK-3005' }` for a daily BOM's approval events, `null` for every other entry. */
export interface AuditSubject {
  field: string;
  value: string;
}

interface AuditChangesResponse {
  changes: AuditChangeRow[];
  subject: AuditSubject | null;
}

/** "No value" reads as `''` whether the backend sends `''` or `null` — see `auditValueFor`. */
const normalized = (row: AuditChangeRow): string =>
  `${row.field}|${row.previousValue ?? ''}|${row.newValue ?? ''}`;

const TheNormalizedSortedChanges = (): QuestionAdapter<string[]> =>
  Question.about(
    'the audit event changes, normalized and sorted',
    async (actor) => {
      const body = await actor.answer(
        LastResponse.body<AuditChangesResponse>(),
      );
      return body.changes.map(normalized).sort();
    },
  );

/** "جزئیات تغییرات آن رویداد به صورت زیر نمایش داده شود" — set equality (order is not part of the
 * contract this automation was written against). */
export const EnsureAuditEventChangesAreExactly = (
  expected: AuditChangeRow[],
): Task =>
  Task.where(
    "#actor ensures the audit event's changes are exactly as expected",
    Ensure.that(
      TheNormalizedSortedChanges(),
      equals([...expected.map(normalized)].sort()),
    ),
  );

/** The subject of the details last viewed. `undefined` (a response without the key) is reported as
 * `null`, so a backend that does not send it yet fails on the value, not on a type error. */
const TheAuditEventSubject = (): QuestionAdapter<AuditSubject | null> =>
  Question.about("the audit event's subject", async (actor) => {
    const body = await actor.answer(LastResponse.body<AuditChangesResponse>());
    return body.subject ?? null;
  });

/** "شماره ردیابی آنالیز مربوط به آن رویداد «...» باشد" — on the details just viewed. */
export const EnsureAuditEventSubjectIs = (expected: AuditSubject): Task =>
  Task.where(
    d`#actor ensures the audit event names its record by ${expected.field} "${expected.value}"`,
    Ensure.that(TheAuditEventSubject(), equals<AuditSubject | null>(expected)),
  );

/** "جزئیات تغییرات رویداد «...» به صورت زیر باشد" — views one named event's details, then checks
 * its changes the way `EnsureAuditEventChangesAreExactly` does. */
export const EnsureChangesOfAuditEvent = (eventId: Answerable<string>) => ({
  areExactly: (expected: AuditChangeRow[]): Task =>
    Task.where(
      d`#actor ensures the changes of audit event ${eventId} are exactly as expected`,
      ViewAuditEventDetails.of(eventId),
      EnsureAuditEventChangesAreExactly(expected),
    ),
});

/** "شماره ردیابی آنالیز مربوط به رویداد «...» «...» باشد" — views one named event's details, then
 * checks its subject. */
export const EnsureSubjectOfAuditEvent = (eventId: Answerable<string>) => ({
  is: (expected: AuditSubject): Task =>
    Task.where(
      d`#actor ensures audit event ${eventId} names its record as expected`,
      ViewAuditEventDetails.of(eventId),
      EnsureAuditEventSubjectIs(expected),
    ),
});
