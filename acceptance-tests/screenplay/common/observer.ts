import { actorCalled } from '@serenity-js/core';
import { Ensure, equals } from '@serenity-js/assertions';
import { GetRequest, LastResponse, Send } from '@serenity-js/rest';
import { LogInAsPersona } from './personas';
import { keepingTheSpotlight } from './spotlight';

/**
 * Reads `resource` as the system admin — for an attempt's *setup*: finding which record the
 * attempt is about, before the actor under test makes it. Doing that lookup as the actor fails
 * the moment their role may not read the list (the maintenance roles get 403 on every BOM, product
 * and material read), and the scenario then breaks in setup instead of judging the refusal.
 *
 * Callable from inside an `Interaction`: it borrows یاشار, logged in afresh (the clock may have
 * moved), and leaves the spotlight where it was. Only یاشار's own last response is overwritten,
 * and only before the attempt it serves.
 */
export const readAsTheSystemAdmin = async <T>(resource: string): Promise<T> => {
  let body!: T;
  await keepingTheSpotlight(async () => {
    const admin = actorCalled('یاشار');
    await admin.attemptsTo(
      LogInAsPersona('یاشار'),
      Send.a(GetRequest.to(resource)),
      Ensure.that(LastResponse.status(), equals(200)),
    );
    body = await admin.answer(LastResponse.body<T>());
  });
  return body;
};
