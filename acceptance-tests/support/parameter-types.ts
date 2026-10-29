import { defineParameterType } from '@cucumber/cucumber';
import { actorCalled, actorInTheSpotlight } from '@serenity-js/core';

defineParameterType({
  name: 'actor',
  regexp: /[؀-ۿ]+/,
  transformer: (name: string) => actorCalled(name),
});

/**
 * The *name* of an actor, without summoning them.
 *
 * actorCalled() moves the spotlight, so using {actor} for the possessive in
 * "Fateme signs up with Ariana's email" would leave Ariana in the spotlight and the
 * following Then step would read her (empty) last response instead of Fateme's.
 */
defineParameterType({
  name: 'actorName',
  regexp: /[؀-ۿ]+/,
  transformer: (name: string) => name,
  useForSnippets: false,
  preferForRegexpMatch: false,
});

/**
 * Unquoted names that may run to several words and end in a digit — maintenance-management's
 * «انجام تعویض روغن اکسترودر 1 ثبت شده باشد» (an activity, then an equipment) and «سابقه تعمیرات
 * اکسترودر 1 …» (an equipment). Arabic-script words, Latin digits, spaces and ZWNJ; never a quote,
 * which is what keeps a match from swallowing a neighbouring `{string}`. Resolved to a string only:
 * where the activity ends and the equipment begins is decided by the equipment registered in the
 * scenario (`screenplay/maintenance-management/maintenance-records.ts#theMaintenanceTaskNamed`),
 * which a transformer cannot know.
 */
const UNQUOTED_NAME = /[؀-ۿ0-9][؀-ۿ0-9‌ ]*[؀-ۿ0-9]/;

defineParameterType({
  name: 'maintenanceTask',
  regexp: UNQUOTED_NAME,
  transformer: (text: string) => text,
  useForSnippets: false,
});

defineParameterType({
  name: 'equipmentName',
  regexp: UNQUOTED_NAME,
  transformer: (text: string) => text,
  useForSnippets: false,
});

defineParameterType({
  name: 'pronoun',
  regexp: /he|she|they/,
  transformer: () => actorInTheSpotlight(),
  useForSnippets: false,
});
