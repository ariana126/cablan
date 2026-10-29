import {
  Actor,
  actorCalled,
  d,
  notes,
  Question,
  QuestionAdapter,
  Task,
  Wait,
} from '@serenity-js/core';
import { Ensure, equals, isPresent, isTrue } from '@serenity-js/assertions';
import { LastResponse, PostRequest, Send } from '@serenity-js/rest';
import { Click, isVisible, Navigate } from '@serenity-js/web';
import { AuditLogPage } from '../ui/audit-log-page';
import { AuthNotes, LogIn } from '../common/login';
import { LetTimePass } from '../common/clock';
import {
  LogInAsPersona,
  PersonaCredentialsNotes,
  realNameFor,
} from '../common/personas';
import { keepingTheSpotlight } from '../common/spotlight';
import { taskDependingOn } from '../common/task-depending-on';
import { EnsureProblemDetail } from '../common/problem-detail';
import {
  confirmWithoutRegistrationAsAPrecondition,
  importAsAPrecondition,
  theConfirmedImport,
} from '../bom-registration/material-import';
import { noteTheMaterialsBefore } from '../bom-registration/registered-materials';
import {
  AuditChangeRow,
  pollForANewAuditEventId,
  ViewAuditEventDetails,
} from './audit-log-details';
import {
  AuditAction,
  AuditRecordType,
  TheAuditLogItems,
} from './view-audit-log';

/**
 * Domain layer for viewing-audit-log.feature's bulk-import («بارگذاری گروهی») rules: one audit
 * entry per confirmed import (`recordType` `MaterialImport`, `action` `Imported`, `recordId` the
 * import id), and the system admin's reversion of the latest one (`Reverted`).
 *
 * Doors: the active «یاشار … را برمی گرداند» drives `/audit-log` — the entry's details dialog and
 * its «برگرداندن»; the «تلاش …» attempts and every precondition go through
 * `POST materials/imports/{id}/reversion`; the `Then`s read the audit log and the materials over
 * HTTP.
 */

// ---------------------------------------------------------------------------------------------
// Preconditions
// ---------------------------------------------------------------------------------------------

/** A minute — so an import sorts after whatever the background did on the same frozen clock. */
const A_MINUTE = 60_000;

const LetAMinutePass = (): Promise<void> =>
  keepingTheSpotlight(() =>
    actorCalled('یاشار').attemptsTo(LetTimePass(A_MINUTE)),
  );

/** Waits, as the system admin, for the import's `Imported` entry to be in the log. */
const theImportIsLogged = (importId: string): Promise<void> =>
  keepingTheSpotlight(async () => {
    const admin = actorCalled('یاشار');
    await admin.attemptsTo(LogInAsPersona('یاشار'));
    await pollForANewAuditEventId(admin, importId, 'Imported');
  });

/** «{actor} ثبت «…» را از لیست تغییرات حذف و آن را تایید کرده باشد» */
export const confirmWithoutRegistrationForTheAuditLog = async (
  importerName: string,
  name: string,
): Promise<void> => {
  await LetAMinutePass();
  await confirmWithoutRegistrationAsAPrecondition(importerName, name);
  await theImportIsLogged(theConfirmedImport('last'));
};

/** «{actor} اکسلی را بارگذاری و تایید کرده باشد که … را اعمال کرده است» */
export const importForTheAuditLog = async (
  importerName: string,
  description: string,
): Promise<void> => {
  await LetAMinutePass();
  await importAsAPrecondition(importerName, description);
  await theImportIsLogged(theConfirmedImport('last'));
};

/**
 * «{actor} دو اکسل را پشت سر هم بارگذاری و تایید کرده باشد» — the first registers «آلومینیوم» and
 * changes «مسی»'s code (the background registered a «مسی»), the second registers «روی»; a minute
 * apart. The materials are noted just before the first, for «… به حالت پیش از بارگذاری گروهی اول
 * برگشته باشند».
 */
export const importTwiceForTheAuditLog = async (
  importerName: string,
): Promise<void> => {
  await LetAMinutePass();
  await noteTheMaterialsBefore('the first import');
  await importAsAPrecondition(
    importerName,
    'ثبت "آلومینیوم" با کد "A-1" و تغییر کد "مسی" به "M-201"',
  );
  await theImportIsLogged(theConfirmedImport(0));
  await LetAMinutePass();
  await importAsAPrecondition(importerName, 'ثبت "روی" با کد "Z-1"', {
    fresh: false,
  });
  await theImportIsLogged(theConfirmedImport(1));
};

/** «اول» / «دوم» / «آن» — which of the scenario's imports a step means. */
export type ImportOrdinal = 0 | 1 | 'last';

const ORDINALS: Record<string, ImportOrdinal> = { اول: 0, دوم: 1 };

export const importOrdinalFor = (word: string): ImportOrdinal => {
  const ordinal = ORDINALS[word];
  if (ordinal === undefined) {
    throw new Error(`"${word}" is not a known import ordinal (اول, دوم).`);
  }
  return ordinal;
};

// ---------------------------------------------------------------------------------------------
// Reverting
// ---------------------------------------------------------------------------------------------

const EstablishBrowserSession = (): Task =>
  Task.where(
    '#actor establishes a browser session for the audit log',
    LogIn.using(
      notes<AuthNotes>().get('username'),
      notes<PersonaCredentialsNotes>().get('password'),
    ),
  );

const LocateAuditLogPage = (): Task =>
  Task.where(
    '#actor locates the audit log page',
    EstablishBrowserSession(),
    Navigate.to('/audit-log'),
    Wait.until(AuditLogPage.heading(), isVisible()),
  );

/** Whether the «برگرداندن» has been answered: the button is gone, or the dialog says why not. */
const TheReversionHasBeenAnswered = (): QuestionAdapter<boolean> =>
  Question.about('whether the reversion has been answered', async (actor) => {
    const button = await actor.answer(AuditLogPage.revertButton());
    if (!(await button.isVisible())) {
      return true;
    }
    // Present, not visible: the banner follows the change table in the scrolling content, so it can
    // be out of view (see `RevertMaterialImport.using`). It is rendered only when there is an error.
    return (await actor.answer(AuditLogPage.revertError())).isPresent();
  });

export const RevertMaterialImport = {
  /** From the import's entry in the audit log: its details, then «برگرداندن». */
  using: (importId: string): Task =>
    Task.where(
      d`#actor reverts the bulk import ${importId}`,
      LocateAuditLogPage(),
      // Present, not visible: an older import's row can be below the fold, and Serenity/JS's
      // `isVisible()` hit-tests the element's centre (`document.elementFromPoint`), which fails for
      // anything outside the viewport. Playwright's click scrolls to it and checks it is actionable.
      Wait.until(AuditLogPage.detailsButtonFor(importId), isPresent()),
      Click.on(AuditLogPage.detailsButtonFor(importId)),
      Wait.until(AuditLogPage.revertButton(), isVisible()),
      Click.on(AuditLogPage.revertButton()),
      Wait.until(TheReversionHasBeenAnswered(), isTrue()),
    ),

  /** `POST materials/imports/{id}/reversion` */
  viaApiUsing: (importId: string): Task =>
    Task.where(
      d`#actor reverts the bulk import ${importId} (via API)`,
      Send.a(PostRequest.to(`materials/imports/${importId}/reversion`)),
    ),
};

/** The import a step means, by ordinal. */
export const theImport = (ordinal: ImportOrdinal): string =>
  theConfirmedImport(ordinal);

/** «{actor} بارگذاری گروهی دوم را برگردانده باشد» */
export const revertAsAPrecondition = (
  reverterName: string,
  ordinal: ImportOrdinal,
): Promise<void> =>
  keepingTheSpotlight(() =>
    actorCalled(reverterName).attemptsTo(
      LogInAsPersona(reverterName),
      RevertMaterialImport.viaApiUsing(theImport(ordinal)),
      Ensure.that(LastResponse.status(), equals(204)),
    ),
  );

/** «پیغام خطای برگرداندن فقط آخرین بارگذاری گروهی نشان داده شود» */
export const EnsureOnlyTheLatestImportCanBeReverted = (): Task =>
  Task.where(
    '#actor ensures only the latest bulk import may be reverted',
    EnsureProblemDetail(409, 'material-import-not-latest'),
  );

/** «پیغام خطای برگرداندن بارگذاری گروهی نشان داده شود» */
export const EnsureTheImportCouldNotBeReverted = (): Task =>
  Task.where(
    '#actor ensures the bulk import could not be reverted',
    EnsureProblemDetail(409, 'material-import-not-revertible'),
  );

// ---------------------------------------------------------------------------------------------
// The audit entries
// ---------------------------------------------------------------------------------------------

/** «… رویداد «بارگذاری گروهی» …» — the record type and action a label names. */
const EVENT_BY_LABEL: Record<
  string,
  { recordType: AuditRecordType; action: AuditAction }
> = {
  'بارگذاری گروهی': { recordType: 'MaterialImport', action: 'Imported' },
};

export const auditEventFor = (label: string) => {
  const event = EVENT_BY_LABEL[label];
  if (!event) {
    throw new Error(
      `"${label}" is not a known event label (expected one of: ` +
        `${Object.keys(EVENT_BY_LABEL).join(', ')}).`,
    );
  }
  return event;
};

const TheLatestAuditEvent = () =>
  Question.about('the latest audit event', async (actor) => {
    const [latest] = await actor.answer(TheAuditLogItems());
    if (!latest) {
      throw new Error('The audit log shows no events.');
    }
    return {
      actorName: latest.actorName,
      recordType: latest.recordType,
      action: latest.action,
    };
  });

/** «آخرین رویداد، رویداد «…» توسط {actor} باشد» — the first item of the list just viewed. */
export const EnsureTheLatestAuditEventIs = (
  label: string,
  actorName: string,
): Task => {
  const expected = {
    actorName: realNameFor(actorName),
    ...auditEventFor(label),
  };
  return Task.where(
    d`#actor ensures the latest audit event is a "${label}" by ${actorName}`,
    Ensure.that(TheLatestAuditEvent(), equals(expected)),
  );
};

const IMPORT_LINE_PATTERNS: Array<{
  pattern: RegExp;
  line: (m: RegExpMatchArray) => AuditChangeRow;
}> = [
  {
    pattern: /^ثبت مواد اولیه جدید با نام "([^"]*)" و کد "([^"]*)"$/,
    line: (m) => ({
      field: `importedMaterial:${m[2]}`,
      previousValue: '',
      newValue: m[1],
    }),
  },
  {
    pattern: /^تغییر کد مواد اولیه "([^"]*)" از "([^"]*)" به "([^"]*)"$/,
    line: (m) => ({
      field: `materialCode:${m[1]}`,
      previousValue: m[2],
      newValue: m[3],
    }),
  },
  {
    pattern: /^تغییر نام مواد اولیه با کد "([^"]*)" از "([^"]*)" به "([^"]*)"$/,
    line: (m) => ({
      field: `materialName:${m[1]}`,
      previousValue: m[2],
      newValue: m[3],
    }),
  },
];

/**
 * A bulk import's change line as the Gherkin words it, to the wire line the plan fixes:
 * `importedMaterial:<code>` (`''` → name), `materialCode:<name>` (old → new code),
 * `materialName:<code>` (old → new name).
 */
export const importChangeLineFor = (sentence: string): AuditChangeRow => {
  const text = sentence.trim();
  for (const { pattern, line } of IMPORT_LINE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return line(match);
    }
  }
  throw new Error(
    `"${sentence}" is not a bulk-import change line this suite knows.`,
  );
};

interface AuditChangesResponse {
  changes: AuditChangeRow[];
}

/** "No value" reads as `''` whether the backend sends `''` or `null`. */
const asLine = (row: AuditChangeRow): string =>
  `${row.field}|${row.previousValue ?? ''}|${row.newValue ?? ''}`;

/** Opens the details of the first event of the list just viewed. */
const ViewTheLatestAuditEventDetails = (): Task =>
  taskDependingOn(
    '#actor views the details of the latest audit event',
    Question.about('the id of the latest audit event', async (actor) => {
      const [latest] = await actor.answer(TheAuditLogItems());
      if (!latest) {
        throw new Error('The audit log shows no events.');
      }
      return latest.id;
    }),
    (eventId) => [ViewAuditEventDetails.of(eventId)],
  );

/** The change lines of the details last viewed, in the order the system gives them. */
const TheChangeLines = (): QuestionAdapter<string[]> =>
  Question.about('the change lines of the audit event', async (actor) =>
    (await actor.answer(LastResponse.body<AuditChangesResponse>())).changes.map(
      asLine,
    ),
  );

/** «جزئیات تغییرات آن رویداد به صورت زیر باشد» — the latest event's lines, in file order. */
export const EnsureTheChangesOfTheLatestAuditEventAre = (
  expected: AuditChangeRow[],
): Task =>
  Task.where(
    "#actor ensures the latest audit event's changes are exactly as expected",
    ViewTheLatestAuditEventDetails(),
    Ensure.that(TheChangeLines(), equals(expected.map(asLine))),
  );

/** «رویداد برگرداندن آن بارگذاری گروهی توسط {actor} ثبت شده باشد» — read as the system admin. */
export const ensureTheReversionWasLoggedBy = (
  reverterName: string,
): Promise<void> =>
  keepingTheSpotlight(async () => {
    const admin = actorCalled('یاشار');
    await admin.attemptsTo(LogInAsPersona('یاشار'));
    const importId = theImport('last');
    const eventId = await pollForANewAuditEventId(admin, importId, 'Reverted');
    const entry = (await admin.answer(TheAuditLogItems())).find(
      (item) => item.id === eventId,
    );
    await admin.attemptsTo(
      Ensure.that(
        Question.about('who reverted the bulk import', () => entry?.actorName),
        equals<string | undefined>(realNameFor(reverterName)),
      ),
    );
  });

/**
 * «{actor} تلاش می کند … بارگذاری گروهی … را برگرداند» — notes the materials first (for «هیچ
 * تغییری در مواد اولیه سیستم اعمال نشده باشد»), then sends the reversion; its answer stays the
 * actor's last response for the «پیغام خطای …» that follows.
 */
export const attemptToRevert = async (
  actor: Actor,
  ordinal: ImportOrdinal,
): Promise<void> => {
  await noteTheMaterialsBefore('the change');
  await actor.attemptsTo(RevertMaterialImport.viaApiUsing(theImport(ordinal)));
};
