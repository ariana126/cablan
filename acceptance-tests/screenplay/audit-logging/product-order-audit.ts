import { actorCalled } from '@serenity-js/core';
import { LogInAsPersona } from '../common/personas';
import { readAsTheSystemAdmin } from '../common/observer';
import { keepingTheSpotlight } from '../common/spotlight';
import { ProductSummary } from '../bom-registration/view-product-list';
import { ReorderProductComponentsAsAPrecondition } from '../bom-registration/component-order';
import {
  auditEventIdsFor,
  pollForANewAuditEventId,
  targetAuditEvent,
} from './audit-log-details';

/** The audit log is System-Admin-only, so events are looked up as یاشار. */
const theAdmin = async () => {
  const admin = actorCalled('یاشار');
  await admin.attemptsTo(LogInAsPersona('یاشار'));
  return admin;
};

/**
 * Issue #122 in viewing-audit-log.feature: «مصطفی ترتیب اجزای محصول «…» را به «…» تغییر داده باشد»
 * — the reorder made over the API as the persona named (`PATCH products/:id`, the components
 * permuted), then the `Edited` entry it caused on the product targeted, so «یاشار جزئیات آن رویداد را
 * مشاهده می کند» views exactly that one. The product's earlier entries (its registration) are noted
 * first, so the lookup can't pick one of them; it polls, since projection is fire-and-forget.
 */
export const reorderProductForTheAuditLog = async (
  editorName: string,
  productName: string,
  order: string[],
): Promise<void> => {
  const product = (
    await readAsTheSystemAdmin<ProductSummary[]>('products')
  ).find((candidate) => candidate.name === productName);
  if (!product) {
    throw new Error(`No product named "${productName}" is registered.`);
  }
  const eventsBefore = await auditEventIdsFor(await theAdmin(), product.id);

  await keepingTheSpotlight(() =>
    actorCalled(editorName).attemptsTo(
      LogInAsPersona(editorName),
      ReorderProductComponentsAsAPrecondition(productName, order),
    ),
  );

  targetAuditEvent(
    await pollForANewAuditEventId(
      await theAdmin(),
      product.id,
      'Edited',
      eventsBefore,
    ),
  );
};
