import { BomApprovedAuditHandler } from '@audit-logging/application/event-handlers/boms/bom-approved.handler';
import { BomDeletedAuditHandler } from '@audit-logging/application/event-handlers/boms/bom-deleted.handler';
import { BomEditedAuditHandler } from '@audit-logging/application/event-handlers/boms/bom-edited.handler';
import { BomRegisteredAuditHandler } from '@audit-logging/application/event-handlers/boms/bom-registered.handler';
import { BomRejectedAuditHandler } from '@audit-logging/application/event-handlers/boms/bom-rejected.handler';
import { BomReturnedToPendingAuditHandler } from '@audit-logging/application/event-handlers/boms/bom-returned-to-pending.handler';
import { UserDeletedAuditHandler } from '@audit-logging/application/event-handlers/identity/user-deleted.handler';
import { UserEditedAuditHandler } from '@audit-logging/application/event-handlers/identity/user-edited.handler';
import { UserRegisteredAuditHandler } from '@audit-logging/application/event-handlers/identity/user-registered.handler';
import { EquipmentRegisteredAuditHandler } from '@audit-logging/application/event-handlers/maintenance/equipment-registered.handler';
import { EquipmentRenamedAuditHandler } from '@audit-logging/application/event-handlers/maintenance/equipment-renamed.handler';
import { EquipmentRetiredAuditHandler } from '@audit-logging/application/event-handlers/maintenance/equipment-retired.handler';
import { MaintenanceActivityEditedAuditHandler } from '@audit-logging/application/event-handlers/maintenance/maintenance-activity-edited.handler';
import { MaintenanceActivityRegisteredAuditHandler } from '@audit-logging/application/event-handlers/maintenance/maintenance-activity-registered.handler';
import { MaintenanceActivitySpecialtyAssignedAuditHandler } from '@audit-logging/application/event-handlers/maintenance/maintenance-activity-specialty-assigned.handler';
import { MaintenanceExecutionRecordedAuditHandler } from '@audit-logging/application/event-handlers/maintenance/maintenance-execution-recorded.handler';
import { PmPlanItemAddedAuditHandler } from '@audit-logging/application/event-handlers/maintenance/pm-plan-item-added.handler';
import { PmPlanItemDeactivatedAuditHandler } from '@audit-logging/application/event-handlers/maintenance/pm-plan-item-deactivated.handler';
import { PmPlanItemIntervalChangedAuditHandler } from '@audit-logging/application/event-handlers/maintenance/pm-plan-item-interval-changed.handler';
import { ManufacturingInstructionDeletedAuditHandler } from '@audit-logging/application/event-handlers/manufacturing-instructions/manufacturing-instruction-deleted.handler';
import { ManufacturingInstructionEditedAuditHandler } from '@audit-logging/application/event-handlers/manufacturing-instructions/manufacturing-instruction-edited.handler';
import { ManufacturingInstructionRegisteredAuditHandler } from '@audit-logging/application/event-handlers/manufacturing-instructions/manufacturing-instruction-registered.handler';
import { ComponentDeletedAuditHandler } from '@audit-logging/application/event-handlers/products/component-deleted.handler';
import { ComponentRegisteredAuditHandler } from '@audit-logging/application/event-handlers/products/component-registered.handler';
import { ComponentRenamedAuditHandler } from '@audit-logging/application/event-handlers/products/component-renamed.handler';
import { MaterialDeletedAuditHandler } from '@audit-logging/application/event-handlers/products/material-deleted.handler';
import { MaterialEditedAuditHandler } from '@audit-logging/application/event-handlers/products/material-edited.handler';
import { MaterialImportRevertedAuditHandler } from '@audit-logging/application/event-handlers/products/material-import-reverted.handler';
import { MaterialRegisteredAuditHandler } from '@audit-logging/application/event-handlers/products/material-registered.handler';
import { MaterialsImportedAuditHandler } from '@audit-logging/application/event-handlers/products/materials-imported.handler';
import { ProductDeletedAuditHandler } from '@audit-logging/application/event-handlers/products/product-deleted.handler';
import { ProductRegisteredAuditHandler } from '@audit-logging/application/event-handlers/products/product-registered.handler';
import { ProductRenamedAuditHandler } from '@audit-logging/application/event-handlers/products/product-renamed.handler';

export const EventHandlers = [
  // identity
  UserRegisteredAuditHandler,
  UserDeletedAuditHandler,
  UserEditedAuditHandler,
  // products: materials, components and products
  MaterialRegisteredAuditHandler,
  MaterialEditedAuditHandler,
  MaterialDeletedAuditHandler,
  MaterialsImportedAuditHandler,
  MaterialImportRevertedAuditHandler,
  ComponentRegisteredAuditHandler,
  ComponentRenamedAuditHandler,
  ComponentDeletedAuditHandler,
  ProductRegisteredAuditHandler,
  ProductRenamedAuditHandler,
  ProductDeletedAuditHandler,
  // manufacturing-instructions
  ManufacturingInstructionRegisteredAuditHandler,
  ManufacturingInstructionEditedAuditHandler,
  ManufacturingInstructionDeletedAuditHandler,
  // boms
  BomRegisteredAuditHandler,
  BomEditedAuditHandler,
  BomDeletedAuditHandler,
  BomApprovedAuditHandler,
  BomRejectedAuditHandler,
  BomReturnedToPendingAuditHandler,
  // maintenance
  EquipmentRegisteredAuditHandler,
  EquipmentRenamedAuditHandler,
  EquipmentRetiredAuditHandler,
  MaintenanceActivityRegisteredAuditHandler,
  MaintenanceActivityEditedAuditHandler,
  MaintenanceActivitySpecialtyAssignedAuditHandler,
  PmPlanItemAddedAuditHandler,
  PmPlanItemIntervalChangedAuditHandler,
  PmPlanItemDeactivatedAuditHandler,
  MaintenanceExecutionRecordedAuditHandler,
];
