import { Activity, actorCalled, Actor } from '@serenity-js/core';
import { LogInAsPersona } from '../common/personas';
import { readTheEquipmentNamed } from '../maintenance-management/maintenance-api';

/**
 * What the suite knows about the QC records a scenario has created — activity ids by name — so a
 * *different* actor than the one who defined an activity (the «تلاش …» outlines' whole point) can
 * address it over the API. Equipment is the maintenance registry's
 * (`maintenance-management/maintenance-records.ts`), since QC lives beside it.
 *
 * Plain module state, cleared before every scenario (`step-definitions/quality-control/
 * common.steps.ts`). Never used to decide whether something exists — the «… unless …»
 * preconditions ask the system.
 */

export interface DefinedQcActivity {
  id: string;
  name: string;
}

const activitiesByName = new Map<string, DefinedQcActivity>();
let printedQrPayload: string | undefined;

export const forgetQcRecords = (): void => {
  activitiesByName.clear();
  printedQrPayload = undefined;
};

export const rememberQcActivity = (activity: DefinedQcActivity): void => {
  activitiesByName.set(activity.name, activity);
};

export const theQcActivityNamed = (name: string): DefinedQcActivity => {
  const activity = activitiesByName.get(name);
  if (!activity) {
    throw new Error(
      `No QC activity named "${name}" has been defined in this scenario.`,
    );
  }
  return activity;
};

/** «QR تجهیز … چاپ شده باشد» — the payload on the sticker on the machine. */
export const rememberThePrintedQr = (payload: string): void => {
  printedQrPayload = payload;
};

export const thePrintedQr = (): string => {
  if (printedQrPayload === undefined) {
    throw new Error('No QR has been printed in this scenario.');
  }
  return printedQrPayload;
};

type Reader = Parameters<typeof readTheEquipmentNamed>[0];

/**
 * The equipment the system has by `name` now — QC facts are stated of equipment by its current
 * name, which after a System Admin correction is not the one the scenario registered it under.
 */
export const theEquipmentIdNamed = async (
  actor: Reader,
  name: string,
): Promise<string> => (await readTheEquipmentNamed(actor, name)).id;

/**
 * Performs `activities` as the actor the step names, logged in afresh as their persona first: a
 * precondition may have moved the system's clock past an earlier session's expiry (the QC
 * preconditions record «در … ساعت …»), and a session or a credentials note can never be trusted to
 * belong to this scenario's database — a suite run showed an actor's notes outliving the scenario
 * that wrote them, so "renew if logged in" logged in as a persona the truncate had removed (401).
 * Logging a persona in for the first time provisions it through یاشار, which moves the spotlight;
 * it is given back to the actor afterwards, so the bare `Then`s that follow speak about them.
 */
export const performAsTheActor = async (
  actor: Actor,
  ...activities: Activity[]
): Promise<void> => {
  await actor.attemptsTo(LogInAsPersona(actor.name), ...activities);
  actorCalled(actor.name);
};
