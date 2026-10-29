import { EventHandlers } from '@audit-logging/application/event-handlers';
import { BomApprovedAuditHandler } from '@audit-logging/application/event-handlers/boms/bom-approved.handler';
import { BomRejectedAuditHandler } from '@audit-logging/application/event-handlers/boms/bom-rejected.handler';
import { BomReturnedToPendingAuditHandler } from '@audit-logging/application/event-handlers/boms/bom-returned-to-pending.handler';
import { ComponentDeletedAuditHandler } from '@audit-logging/application/event-handlers/products/component-deleted.handler';
import { ComponentRegisteredAuditHandler } from '@audit-logging/application/event-handlers/products/component-registered.handler';
import { ComponentRenamedAuditHandler } from '@audit-logging/application/event-handlers/products/component-renamed.handler';
import { MaterialDeletedAuditHandler } from '@audit-logging/application/event-handlers/products/material-deleted.handler';
import { MaterialEditedAuditHandler } from '@audit-logging/application/event-handlers/products/material-edited.handler';
import { MaterialImportRevertedAuditHandler } from '@audit-logging/application/event-handlers/products/material-import-reverted.handler';
import { MaterialRegisteredAuditHandler } from '@audit-logging/application/event-handlers/products/material-registered.handler';
import { MaterialsImportedAuditHandler } from '@audit-logging/application/event-handlers/products/materials-imported.handler';
import { DOMAIN_EVENT_HANDLER_METADATA } from '@framework/application';
import { MaterialRegisteredByImport } from '@products/domain/events/material-registered-by-import.event';
import { MaterialRestoredBeforeImport } from '@products/domain/events/material-restored-before-import.event';
import { MaterialRevisedByImport } from '@products/domain/events/material-revised-by-import.event';
import { MaterialWithdrawnByImport } from '@products/domain/events/material-withdrawn-by-import.event';
import { MaterialsImported } from '@products/domain/events/materials-imported.event';

import { EquipmentRegisteredAuditHandler } from './maintenance/equipment-registered.handler';
import { EquipmentRenamedAuditHandler } from './maintenance/equipment-renamed.handler';
import { EquipmentRetiredAuditHandler } from './maintenance/equipment-retired.handler';
import { MaintenanceActivityRegisteredAuditHandler } from './maintenance/maintenance-activity-registered.handler';
import { MaintenanceActivityRenamedAuditHandler } from './maintenance/maintenance-activity-renamed.handler';
import { MaintenanceExecutionRecordedAuditHandler } from './maintenance/maintenance-execution-recorded.handler';
import { PmPlanItemAddedAuditHandler } from './maintenance/pm-plan-item-added.handler';
import { PmPlanItemIntervalChangedAuditHandler } from './maintenance/pm-plan-item-interval-changed.handler';
import { PmPlanItemRemovedAuditHandler } from './maintenance/pm-plan-item-removed.handler';

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

  it('subscribes the audit trail to every daily-BOM review event', () => {
    expect(EventHandlers).toEqual(
      expect.arrayContaining([
        BomApprovedAuditHandler,
        BomRejectedAuditHandler,
        BomReturnedToPendingAuditHandler,
      ]),
    );
  });

  it('subscribes the audit trail to every maintenance event', () => {
    expect(EventHandlers).toEqual(
      expect.arrayContaining([
        EquipmentRegisteredAuditHandler,
        EquipmentRenamedAuditHandler,
        EquipmentRetiredAuditHandler,
        MaintenanceActivityRegisteredAuditHandler,
        MaintenanceActivityRenamedAuditHandler,
        PmPlanItemAddedAuditHandler,
        PmPlanItemIntervalChangedAuditHandler,
        PmPlanItemRemovedAuditHandler,
        MaintenanceExecutionRecordedAuditHandler,
      ]),
    );
  });

  it('subscribes the audit trail to a material import and its reversion', () => {
    expect(EventHandlers).toEqual(
      expect.arrayContaining([
        MaterialsImportedAuditHandler,
        MaterialImportRevertedAuditHandler,
      ]),
    );
  });

  // One audit entry per import, none per material (issue #74): the import's
  // own `MaterialsImported`/`MaterialImportReverted` entry lists every change.
  it('subscribes nothing to the per-material events an import or its reversion records', () => {
    const subscribedEvents = EventHandlers.map(
      (handler): unknown =>
        Reflect.getMetadata(DOMAIN_EVENT_HANDLER_METADATA, handler) as unknown,
    );

    // The lookup itself works: the import's own event is subscribed.
    expect(subscribedEvents).toContain(MaterialsImported);
    expect(subscribedEvents).not.toEqual(
      expect.arrayContaining([MaterialRegisteredByImport]),
    );
    expect(subscribedEvents).not.toEqual(
      expect.arrayContaining([MaterialRevisedByImport]),
    );
    expect(subscribedEvents).not.toEqual(
      expect.arrayContaining([MaterialRestoredBeforeImport]),
    );
    expect(subscribedEvents).not.toEqual(
      expect.arrayContaining([MaterialWithdrawnByImport]),
    );
  });
});
