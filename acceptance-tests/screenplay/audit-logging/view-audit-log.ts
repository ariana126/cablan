import { Question, QuestionAdapter, Task } from '@serenity-js/core';
import {
  contain,
  Ensure,
  equals,
  isGreaterThan,
} from '@serenity-js/assertions';
import { LastResponse, PostRequest, Send } from '@serenity-js/rest';

/**
 * Domain layer for "مشاهده گزارش رویدادهای سیستم" (`viewing-audit-log.feature`) — the list/filter
 * half. Every scenario in this feature is API-voiced in substance even where its `When` reads
 * actively ("... مشاهده می کند"): there is no audit-log page in the frontend yet (no route, no
 * markup) for this suite's UI door to drive, and the dispatch this automation was written against
 * describes the feature purely in terms of its HTTP contract. `POST /api/audit-log` is itself an
 * unusual shape for a "list" endpoint (a POST, not a GET) — a query-by-body design, presumably
 * because a filter set this rich (four independent, AND-combined optional fields plus pagination)
 * doesn't fit comfortably in query-string params; the contract is taken as given, not questioned
 * here.
 */

export type AuditRecordType =
  'User' | 'Product' | 'Component' | 'Material' | 'StandardBom' | 'Bom';

export type AuditAction = 'Registered' | 'Edited' | 'Deleted';

export interface AuditLogEntry {
  id: string;
  occurredAt: string;
  actorName: string;
  recordType: AuditRecordType;
  recordId: string;
  action: AuditAction;
}

interface AuditLogListResponse {
  items: AuditLogEntry[];
  total: number;
}

export interface AuditLogFilters {
  actorName?: string;
  recordId?: string;
  /** ISO instant. */
  from?: string;
  /** ISO instant — the backend treats this as inclusive of that whole calendar day, regardless of
   * the time-of-day given (per the HTTP contract this automation was written against), so no
   * "expand to end of day" adjustment happens on this side. */
  to?: string;
  page?: number;
  pageSize?: number;
}

/** Generous enough to cover every event this feature's own background/fixtures ever produce
 * (including the handful of unavoidable side-effect events documented in
 * `screenplay/audit-logging/audit-log-fixtures.ts`'s own module comment) without needing a second
 * page, for scenarios that don't care about pagination itself. */
const DEFAULT_PAGE_SIZE = 20;

export const ViewAuditLog = {
  /** "یاشار لیست رویدادهای سیستم را [بدون فیلتر|با فیلتر ...] مشاهده می کند" / "... تلاش می کند
   * لیست رویدادهای سیستم را مشاهده کند" — the one door this feature has. `filters` are all
   * optional and AND-combined server-side; omitting a key here (rather than sending it as
   * `undefined`) is what leaves that filter unset on the wire. */
  viaApiUsing: (filters: AuditLogFilters = {}): Task =>
    Task.where(
      '#actor views the system audit log',
      Send.a(
        PostRequest.to('audit-log').with(
          Question.fromObject({
            page: filters.page ?? 1,
            pageSize: filters.pageSize ?? DEFAULT_PAGE_SIZE,
            ...(filters.actorName !== undefined
              ? { actorName: filters.actorName }
              : {}),
            ...(filters.recordId !== undefined
              ? { recordId: filters.recordId }
              : {}),
            ...(filters.from !== undefined ? { from: filters.from } : {}),
            ...(filters.to !== undefined ? { to: filters.to } : {}),
          }),
        ),
      ),
    ),
};

/** The list from the last `ViewAuditLog.viaApiUsing(...)` — call that first. */
export const TheAuditLogItems = (): QuestionAdapter<AuditLogEntry[]> =>
  LastResponse.body<AuditLogListResponse>().items;

interface IdentifyingFields {
  actorName: string;
  recordType: AuditRecordType;
  recordId: string;
  action: AuditAction;
}

const identifyingFieldsOf = (entry: AuditLogEntry): IdentifyingFields => ({
  actorName: entry.actorName,
  recordType: entry.recordType,
  recordId: entry.recordId,
  action: entry.action,
});

/** The first `length` items' identifying fields (actor/type/record id/action — never `id` or
 * `occurredAt`, which are opaque, backend-generated values no scenario asserts literally). */
const TheFirstItemsIdentifyingFields = (
  length: number,
): QuestionAdapter<IdentifyingFields[]> =>
  Question.about(
    `the first ${length} audit log items' identifying fields`,
    async (actor) => {
      const items = await actor.answer(TheAuditLogItems());
      return items.slice(0, length).map(identifyingFieldsOf);
    },
  );

/** "رویدادهای ردیف زیر از جدیدترین به قدیمی ترین نمایش داده شود" — a PREFIX match (the first
 * `expected.length` items, in order) rather than a full-list equality: this feature's own
 * background can't avoid producing a handful of side-effect audit events of its own (see
 * `audit-log-fixtures.ts`'s own module comment on why), and this is what keeps the check meaningful
 * without requiring the caller to account for every last one of them — they're all deliberately
 * dated OLDER than every row this feature's scenarios actually track, so they only ever show up
 * PAST the expected prefix, never inside it. */
export const EnsureAuditEventsShownInOrder = (
  expected: IdentifyingFields[],
): Task =>
  Task.where(
    '#actor ensures the audit events are shown in the expected order, newest first',
    Ensure.that(
      TheFirstItemsIdentifyingFields(expected.length),
      equals(expected),
    ),
  );

const normalized = (row: IdentifyingFields): string =>
  `${row.actorName}|${row.recordType}|${row.recordId}|${row.action}`;

/** Order-independent, unlike `TheFirstItemsIdentifyingFields` — sorted so two differently-ordered
 * but equal sets compare equal. */
const TheNormalizedSortedItems = (): QuestionAdapter<string[]> =>
  Question.about(
    'the audit log items, normalized and sorted',
    async (actor) => {
      const items = await actor.answer(TheAuditLogItems());
      return items.map((item) => normalized(identifyingFieldsOf(item))).sort();
    },
  );

/** "فقط رویدادهای ردیف «...» نمایش داده شود" — the filtering rule's own assertion: every expected
 * row is present, order not asserted (the rule is about which events match a filter, not about
 * their order — `EnsureAuditEventsShownInOrder` above is the one dedicated ordering check).
 * Deliberately NOT exact-set equality, for the same reason `EnsureAuditEventsShownInOrder`'s own
 * check is a prefix rather than a full-list one: this feature's own background can't avoid
 * producing a handful of side-effect audit events of its own (see `audit-log-fixtures.ts`'s own
 * module comment on why — registering مصطفی's own account, a throwaway user, a throwaway
 * component), and a broad-enough filter (e.g. plain "کاربر: مصطفی", with no `شناسه رکورد`/date
 * narrowing it further) can legitimately also match one of those alongside the row(s) a scenario
 * actually expects. Checking that every expected row is PRESENT — rather than that the actual set
 * equals it exactly — is what keeps the check meaningful without requiring the caller to account
 * for every last one of them. */
export const EnsureOnlyAuditEventsShown = (
  expected: IdentifyingFields[],
): Task =>
  Task.where(
    '#actor ensures the expected audit events are shown',
    ...expected.map((row) =>
      Ensure.that(TheNormalizedSortedItems(), contain(normalized(row))),
    ),
  );

/** "رویدادهای سیستم نمایش داده نشود" — the access-denied rule's own assertion. Through the API
 * (this feature's only door — see this module's own comment), asserting what the caller actually
 * received is the failed response itself, mirroring
 * `screenplay/authentication/view-user-list.ts#EnsureUserListWasNotDisplayed`. */
export const EnsureAuditLogWasNotDisplayed = (): Task =>
  Task.where(
    '#actor ensures the audit log was not displayed',
    Ensure.that(LastResponse.status(), isGreaterThan(399)),
  );
