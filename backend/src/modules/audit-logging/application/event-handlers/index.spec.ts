import { EventHandlers } from '@audit-logging/application/event-handlers';
import { ComponentDeletedAuditHandler } from '@audit-logging/application/event-handlers/products/component-deleted.handler';
import { ComponentRegisteredAuditHandler } from '@audit-logging/application/event-handlers/products/component-registered.handler';
import { ComponentRenamedAuditHandler } from '@audit-logging/application/event-handlers/products/component-renamed.handler';
import { MaterialDeletedAuditHandler } from '@audit-logging/application/event-handlers/products/material-deleted.handler';
import { MaterialEditedAuditHandler } from '@audit-logging/application/event-handlers/products/material-edited.handler';
import { MaterialRegisteredAuditHandler } from '@audit-logging/application/event-handlers/products/material-registered.handler';

// A handler missing from `EventHandlers` is never registered with Nest, so its
// event is silently not audited. Nothing else notices: each handler's own spec
// calls it directly.
describe('EventHandlers', () => {
  it('subscribes the audit trail to every material and component event', () => {
    expect(EventHandlers).toEqual(
      expect.arrayContaining([
        MaterialRegisteredAuditHandler,
        MaterialEditedAuditHandler,
        MaterialDeletedAuditHandler,
        ComponentRegisteredAuditHandler,
        ComponentRenamedAuditHandler,
        ComponentDeletedAuditHandler,
      ]),
    );
  });
});
