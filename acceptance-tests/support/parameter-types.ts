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

defineParameterType({
  name: 'pronoun',
  regexp: /he|she|they/,
  transformer: () => actorInTheSpotlight(),
  useForSnippets: false,
});
