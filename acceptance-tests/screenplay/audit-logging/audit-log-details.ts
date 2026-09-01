import { DataTable } from '@cucumber/cucumber';
import {
  actorCalled,
  Question,
  QuestionAdapter,
  Task,
} from '@serenity-js/core';
import { Ensure, equals } from '@serenity-js/assertions';
import { GetRequest, LastResponse, Send } from '@serenity-js/rest';
import { FreezeTimeAt } from '../common/clock';
import { parseJalaliDateTime } from '../common/jalali-datetime';
import { LogInAsPersona } from '../common/personas';
import {
  freshProductDetails,
  theLastRegisteredProduct,
} from '../bom-registration/product-details';
import { RegisterProductAndRememberIt } from '../bom-registration/register-product';
import { theLastRegisteredStandardBom } from '../bom-registration/standard-bom-details';
import { RegisterStandardBomAndRememberIt } from '../bom-registration/register-standard-bom';
import { EditStandardBom } from '../bom-registration/edit-standard-bom';
import {
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

/** The three "فیلد" labels this feature ever names — the standard-BOM pair this module's own
 * example needs ("متراژ استاندارد"→`standardLength`, "برند"→`brand`), plus "شماره ردیابی"
 * (`trackingNumber`), a daily-BOM field this module never itself touches but which the HTTP
 * contract this automation was written against names alongside the other two — kept here since
 * this is the one place in this feature that translates a field label to its wire-level key. */
const fieldKeyByLabel: Record<string, string> = {
  'متراژ استاندارد': 'standardLength',
  برند: 'brand',
  'شماره ردیابی': 'trackingNumber',
};

export const fieldKeyFor = (label: string): string => {
  const key = fieldKeyByLabel[label];
  if (!key) {
    throw new Error(`No known audit-log change field for "${label}".`);
  }
  return key;
};

let targetAuditEventId: string | undefined;

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

  targetAuditEventId = await pollForTheEditedAuditEventId(
    admin,
    standardBom.id,
  );
};

/**
 * Polls for the "Edited" audit entry `AuditLogProjector` writes for `recordId`, rather than
 * reading it after a single `ViewAuditLog.viaApiUsing` call: `backend/src/modules/audit-logging/
 * CLAUDE.md` documents projection as fire-and-forget — `PrismaEntityRepository.save()` never
 * awaits `EventBus.publishAll()`, so the HTTP response to the edit this fixture just performed can
 * reach this suite before the corresponding audit row has actually been written. Every OTHER read
 * of the audit log in this feature (the full background's own list/filter scenarios) has several
 * further awaited HTTP calls happen first — plenty of time for that write to land — so this is the
 * one call site close enough to its own triggering mutation to need to wait for it explicitly.
 *
 * `actor` must be a System Admin — `POST /audit-log` is `@Roles(Role.SystemAdmin)`-gated, so
 * polling as the (non-admin) editor themself gets a 403 problem-detail body with no `items` key.
 */
const pollForTheEditedAuditEventId = async (
  actor: ReturnType<typeof actorCalled>,
  recordId: string,
): Promise<string> => {
  const deadline = Date.now() + 5_000;
  do {
    await actor.attemptsTo(
      ViewAuditLog.viaApiUsing({ recordId, page: 1, pageSize: 5 }),
    );
    const items = await actor.answer(TheAuditLogItems());
    const edited = items.find(
      (item: AuditLogEntry) => item.action === 'Edited',
    );
    if (edited) {
      return edited.id;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  } while (Date.now() < deadline);

  throw new Error(
    `Expected an "Edited" audit event for standard BOM ${recordId}, found none within 5s.`,
  );
};

/** "یاشار جزئیات آن رویداد را مشاهده می کند" — a SEPARATE request from the list, per this
 * feature's own "قانون": field-level change details are fetched on demand, per event, keeping the
 * list itself lean. */
export const ViewTargetAuditEventDetails = (): Task =>
  Task.where(
    "#actor views the target audit event's details",
    Send.a(GetRequest.to(`audit-log/${theTargetAuditEventId()}/changes`)),
  );

export interface AuditChangeRow {
  field: string;
  previousValue: string;
  newValue: string;
}

interface AuditChangesResponse {
  changes: AuditChangeRow[];
}

const normalized = (row: AuditChangeRow): string =>
  `${row.field}|${row.previousValue}|${row.newValue}`;

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
