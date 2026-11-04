import {
  Activity,
  Answerable,
  d,
  Interaction,
  Task,
  Wait,
} from '@serenity-js/core';
import { Ensure, equals } from '@serenity-js/assertions';
import {
  LastResponse,
  PatchRequest,
  PostRequest,
  Send,
} from '@serenity-js/rest';
import { Click, Enter, isVisible, PageElement } from '@serenity-js/web';
import { ConfirmTheCorrection } from '../common/correction-confirmation';
import { WaitForTheDialogToBeAnswered } from './maintenance-pages';
import { ApiReader } from './maintenance-api';

/**
 * Equipment and maintenance activities are both a catalog of uniquely named records, added and
 * renamed through one dialog on their own list page, with the same three rules (who may, a name is
 * required, a name is unique). This builds one such vocabulary; `equipment.ts` and
 * `maintenance-activity.ts` give it its business names.
 */

export interface NamedRecord {
  id: string;
  name: string;
}

type Element = Answerable<PageElement>;

export interface NamedCatalogPage {
  addButton: () => Element;
  nameField: () => Element;
  submitButton: () => Element;
  nameError: () => Element;
  editButton: (name: string) => Element;
  /**
   * Any other field's error the dialog may answer a submission with — the activity's «تخصص»
   * (issue #108). The name's own error is always waited for.
   */
  otherFieldErrors?: () => Element[];
}

/**
 * Fields a record carries besides its name — an activity's `specialty` (issue #108) — sent with
 * every `POST`/`PATCH` and remembered with the record. Equipment has none.
 */
export type OtherFields = Record<string, unknown>;

export interface NamedCatalogConfig {
  /** As a report reads it: "equipment", "maintenance activity". */
  noun: string;
  /** The API collection, relative: `equipment`, `maintenance-activities`. */
  resource: string;
  page: NamedCatalogPage;
  locatePage: () => Task;
  readAll: (actor: ApiReader) => Promise<NamedRecord[]>;
  remember: (record: NamedRecord) => void;
}

export const namedCatalog = (config: NamedCatalogConfig) => {
  const { noun, resource, page } = config;

  /** The records before an attempt, so «… جدیدی ثبت نشده باشد» can say nothing was added. */
  let recordsBeforeTheAttempt: NamedRecord[] | undefined;
  /** What a rename attempt targeted, so «… ویرایش نشده باشد» can say it kept its name. */
  let renameTarget: NamedRecord | undefined;

  const byName = (records: NamedRecord[]): NamedRecord[] =>
    [...records].sort((a, b) => a.name.localeCompare(b.name));

  const SubmitTheForm = (): Task =>
    Task.where(
      `#actor submits the ${noun} form`,
      Click.on(page.submitButton()),
      WaitForTheDialogToBeAnswered(
        page.nameField(),
        page.nameError(),
        ...(page.otherFieldErrors?.() ?? []),
      ),
    );

  const OpenNewForm = (): Task =>
    Task.where(
      `#actor opens the new ${noun} form`,
      config.locatePage(),
      Click.on(page.addButton()),
      Wait.until(page.nameField(), isVisible()),
    );

  const OpenEditForm = (currentName: string): Task =>
    Task.where(
      d`#actor opens the ${noun} form of ${currentName}`,
      config.locatePage(),
      Wait.until(page.editButton(currentName), isVisible()),
      Click.on(page.editButton(currentName)),
      Wait.until(page.nameField(), isVisible()),
    );

  const RememberTheRegistered = (
    name: string,
    otherFields: OtherFields,
  ): Interaction =>
    Interaction.where(
      d`#actor remembers the ${noun} ${name}`,
      async (actor) => {
        const { id } = await actor.answer(LastResponse.body<{ id: string }>());
        config.remember({ ...otherFields, id, name });
      },
    );

  return {
    Register: {
      /** Through the list page's add dialog; `fillIn` completes the dialog's other fields. */
      using: (name: string, ...fillIn: Activity[]): Task =>
        Task.where(
          d`#actor registers the ${noun} ${name}`,
          OpenNewForm(),
          Enter.theValue(name).into(page.nameField()),
          ...fillIn,
          SubmitTheForm(),
        ),

      /** `POST {resource}` — the «تلاش …» attempts. */
      viaApiUsing: (name: string, otherFields: OtherFields = {}): Task =>
        Task.where(
          d`#actor registers the ${noun} ${name} (via API)`,
          Send.a(PostRequest.to(resource).with({ ...otherFields, name })),
        ),
    },

    /**
     * A passive precondition: the record exists, registered now unless the system already has
     * one by that name — backgrounds and their scenarios may both state it.
     */
    RegisterUnlessRegistered: (
      name: string,
      otherFields: OtherFields = {},
    ): Interaction =>
      Interaction.where(
        d`#actor makes sure the ${noun} ${name} is registered`,
        async (actor) => {
          const existing = (await config.readAll(actor)).find(
            (record) => record.name === name,
          );
          if (existing) {
            config.remember(existing);
            return;
          }
          await Send.a(
            PostRequest.to(resource).with({ ...otherFields, name }),
          ).performAs(actor);
          await Ensure.that(LastResponse.status(), equals(201)).performAs(
            actor,
          );
          await RememberTheRegistered(name, otherFields).performAs(actor);
        },
      ),

    Rename: {
      /** Through the row's edit button and the same dialog. */
      using: (currentName: string, newName: string): Task =>
        Task.where(
          d`#actor renames the ${noun} ${currentName} to ${newName}`,
          OpenEditForm(currentName),
          Enter.theValue(newName).into(page.nameField()),
          SubmitTheForm(),
        ),

      /**
       * `PATCH {resource}/:id` — the «تلاش …» attempts. `otherFields` are sent unchanged
       * alongside the new name, for a resource whose `PATCH` takes the whole record.
       */
      viaApiUsing: (
        record: NamedRecord,
        newName: string,
        otherFields: OtherFields = {},
      ): Task =>
        Task.where(
          d`#actor renames the ${noun} ${record.name} to ${newName} (via API)`,
          Send.a(
            PatchRequest.to(`${resource}/${record.id}`).with({
              ...otherFields,
              name: newName,
            }),
          ),
        ),
    },

    /**
     * Issue #110 — «… نام … را به … تغییر می دهد و اعمال آن در اطلاعات و سوابق مرتبط را تایید می
     * کند»: the System Admin's rename of a record in use. The edit dialog is refused with the
     * dependents, which opens the correction confirmation; «تایید» re-sends it with
     * `applyToRelatedRecords: true`, and the dialog's own answer is then waited for.
     */
    Correct: {
      using: (currentName: string, newName: string): Task =>
        Task.where(
          d`#actor corrects the name of the ${noun} ${currentName} to ${newName}`,
          OpenEditForm(currentName),
          Enter.theValue(newName).into(page.nameField()),
          Click.on(page.submitButton()),
          ConfirmTheCorrection(),
          WaitForTheDialogToBeAnswered(
            page.nameField(),
            page.nameError(),
            ...(page.otherFieldErrors?.() ?? []),
          ),
        ),
    },

    /** «اطلاعات … جدید را وارد می کند» — opens the add dialog and types a name, unsubmitted. */
    EnterNewDetails: (name: string, ...fillIn: Activity[]): Task =>
      Task.where(
        d`#actor enters the details of a new ${noun}`,
        OpenNewForm(),
        Enter.theValue(name).into(page.nameField()),
        ...fillIn,
      ),

    /** The building blocks of an edit that changes something other than the name. */
    OpenTheEditForm: OpenEditForm,
    SubmitTheForm,

    /** «اما نام … را خالی می گذارد» — empties the open dialog's name and submits it. */
    SubmitLeavingTheNameEmpty: (): Task =>
      Task.where(
        `#actor submits the ${noun} form leaving the name empty`,
        Enter.theValue('').into(page.nameField()),
        SubmitTheForm(),
      ),

    /** «نام آن … را پاک می کند» — clears the name in the edit dialog and submits it. */
    ClearTheName: (currentName: string): Task =>
      Task.where(
        d`#actor clears the name of the ${noun} ${currentName}`,
        OpenEditForm(currentName),
        Enter.theValue('').into(page.nameField()),
        SubmitTheForm(),
      ),

    NoteTheRecordsBeforeTheAttempt: (): Interaction =>
      Interaction.where(
        `#actor notes the registered ${noun} records`,
        async (actor) => {
          recordsBeforeTheAttempt = byName(await config.readAll(actor));
        },
      ),

    rememberTheRenameTarget: (record: NamedRecord): void => {
      renameTarget = record;
    },

    /** «… «X» در سیستم ثبت شده باشد» — exactly one record of that name. */
    EnsureRegistered: (name: string): Interaction =>
      Interaction.where(
        d`#actor ensures the ${noun} ${name} is registered`,
        async (actor) => {
          const named = (await config.readAll(actor)).filter(
            (record) => record.name === name,
          );
          await Ensure.that(named.length, equals(1)).performAs(actor);
        },
      ),

    /** «… جدیدی ثبت نشده باشد» — the records are the ones noted before the attempt. */
    EnsureNothingNewRegistered: (): Interaction =>
      Interaction.where(
        `#actor ensures no new ${noun} was registered`,
        async (actor) => {
          if (!recordsBeforeTheAttempt) {
            throw new Error(
              `No ${noun} records were noted before the attempt this step judges.`,
            );
          }
          await Ensure.that(
            byName(await config.readAll(actor)),
            equals(recordsBeforeTheAttempt),
          ).performAs(actor);
        },
      ),

    /** «… ویرایش نشده باشد» — the targeted record still has its name. */
    EnsureNotRenamed: (): Interaction =>
      Interaction.where(
        `#actor ensures the ${noun} was not renamed`,
        async (actor) => {
          if (!renameTarget) {
            throw new Error(
              `No ${noun} rename was attempted in this scenario.`,
            );
          }
          const target = renameTarget;
          const now = (await config.readAll(actor)).find(
            (record) => record.id === target.id,
          );
          await Ensure.that(now?.name, equals(target.name)).performAs(actor);
        },
      ),

    /** «پیغام خطای نام …» / «… تکراری بودن نام …» — the dialog's name field says what's wrong. */
    EnsureNameErrorShown: (which: string): Task =>
      Task.where(
        `#actor ensures the ${noun} form shows the ${which} name error`,
        Wait.until(page.nameError(), isVisible()),
      ),
  };
};
