import { BomApprovedAuditHandler } from '@audit-logging/application/event-handlers/boms/bom-approved.handler';
import { BomDeletedAuditHandler } from '@audit-logging/application/event-handlers/boms/bom-deleted.handler';
import { BomEditedAuditHandler } from '@audit-logging/application/event-handlers/boms/bom-edited.handler';
import { BomRegisteredAuditHandler } from '@audit-logging/application/event-handlers/boms/bom-registered.handler';
import { BomRejectedAuditHandler } from '@audit-logging/application/event-handlers/boms/bom-rejected.handler';
import { BomReturnedToPendingAuditHandler } from '@audit-logging/application/event-handlers/boms/bom-returned-to-pending.handler';
import { OrderDefinedAuditHandler } from '@audit-logging/application/event-handlers/boms/order-defined.handler';
import { OrderDeletedAuditHandler } from '@audit-logging/application/event-handlers/boms/order-deleted.handler';
import { OrderEditedAuditHandler } from '@audit-logging/application/event-handlers/boms/order-edited.handler';
import { OrderMiCodeAddedAuditHandler } from '@audit-logging/application/event-handlers/boms/order-mi-code-added.handler';
import { UserDeletedAuditHandler } from '@audit-logging/application/event-handlers/identity/user-deleted.handler';
import { UserEditedAuditHandler } from '@audit-logging/application/event-handlers/identity/user-edited.handler';
import { UserRegisteredAuditHandler } from '@audit-logging/application/event-handlers/identity/user-registered.handler';
import { EquipmentDeletedAuditHandler } from '@audit-logging/application/event-handlers/maintenance/equipment-deleted.handler';
import { EquipmentReactivatedAuditHandler } from '@audit-logging/application/event-handlers/maintenance/equipment-reactivated.handler';
import { EquipmentRegisteredAuditHandler } from '@audit-logging/application/event-handlers/maintenance/equipment-registered.handler';
import { EquipmentRenamedAuditHandler } from '@audit-logging/application/event-handlers/maintenance/equipment-renamed.handler';
import { EquipmentRetiredAuditHandler } from '@audit-logging/application/event-handlers/maintenance/equipment-retired.handler';
import { MaintenanceActivityEditedAuditHandler } from '@audit-logging/application/event-handlers/maintenance/maintenance-activity-edited.handler';
import { MaintenanceActivityRegisteredAuditHandler } from '@audit-logging/application/event-handlers/maintenance/maintenance-activity-registered.handler';
import { MaintenanceActivitySpecialtyAssignedAuditHandler } from '@audit-logging/application/event-handlers/maintenance/maintenance-activity-specialty-assigned.handler';
import { MaintenanceExecutionDeletedAuditHandler } from '@audit-logging/application/event-handlers/maintenance/maintenance-execution-deleted.handler';
import { MaintenanceExecutionRecordedAuditHandler } from '@audit-logging/application/event-handlers/maintenance/maintenance-execution-recorded.handler';
import { PmPlanItemAddedAuditHandler } from '@audit-logging/application/event-handlers/maintenance/pm-plan-item-added.handler';
import { PmPlanItemDeactivatedAuditHandler } from '@audit-logging/application/event-handlers/maintenance/pm-plan-item-deactivated.handler';
import { PmPlanItemDeletedAuditHandler } from '@audit-logging/application/event-handlers/maintenance/pm-plan-item-deleted.handler';
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
  // boms: orders (issue #101)
  OrderDefinedAuditHandler,
  OrderMiCodeAddedAuditHandler,
  OrderEditedAuditHandler,
  OrderDeletedAuditHandler,
  // maintenance
  EquipmentRegisteredAuditHandler,
  EquipmentRenamedAuditHandler,
  EquipmentRetiredAuditHandler,
  EquipmentReactivatedAuditHandler,
  EquipmentDeletedAuditHandler,
  MaintenanceActivityRegisteredAuditHandler,
  MaintenanceActivityEditedAuditHandler,
  MaintenanceActivitySpecialtyAssignedAuditHandler,
  PmPlanItemAddedAuditHandler,
  PmPlanItemIntervalChangedAuditHandler,
  PmPlanItemDeactivatedAuditHandler,
  PmPlanItemDeletedAuditHandler,
  MaintenanceExecutionRecordedAuditHandler,
  MaintenanceExecutionDeletedAuditHandler,
];
