import { BomDeletedAuditHandler } from '@audit-logging/application/event-handlers/boms/bom-deleted.handler';
import { BomEditedAuditHandler } from '@audit-logging/application/event-handlers/boms/bom-edited.handler';
import { BomRegisteredAuditHandler } from '@audit-logging/application/event-handlers/boms/bom-registered.handler';
import { ComponentDeletedAuditHandler } from '@audit-logging/application/event-handlers/components/component-deleted.handler';
import { ComponentRegisteredAuditHandler } from '@audit-logging/application/event-handlers/components/component-registered.handler';
import { ComponentRenamedAuditHandler } from '@audit-logging/application/event-handlers/components/component-renamed.handler';
import { UserDeletedAuditHandler } from '@audit-logging/application/event-handlers/identity/user-deleted.handler';
import { UserEditedAuditHandler } from '@audit-logging/application/event-handlers/identity/user-edited.handler';
import { UserRegisteredAuditHandler } from '@audit-logging/application/event-handlers/identity/user-registered.handler';
import { ManufacturingInstructionDeletedAuditHandler } from '@audit-logging/application/event-handlers/manufacturing-instructions/manufacturing-instruction-deleted.handler';
import { ManufacturingInstructionEditedAuditHandler } from '@audit-logging/application/event-handlers/manufacturing-instructions/manufacturing-instruction-edited.handler';
import { ManufacturingInstructionRegisteredAuditHandler } from '@audit-logging/application/event-handlers/manufacturing-instructions/manufacturing-instruction-registered.handler';
import { MaterialDeletedAuditHandler } from '@audit-logging/application/event-handlers/materials/material-deleted.handler';
import { MaterialEditedAuditHandler } from '@audit-logging/application/event-handlers/materials/material-edited.handler';
import { MaterialRegisteredAuditHandler } from '@audit-logging/application/event-handlers/materials/material-registered.handler';
import { ProductDeletedAuditHandler } from '@audit-logging/application/event-handlers/products/product-deleted.handler';
import { ProductRegisteredAuditHandler } from '@audit-logging/application/event-handlers/products/product-registered.handler';
import { ProductRenamedAuditHandler } from '@audit-logging/application/event-handlers/products/product-renamed.handler';

export const EventHandlers = [
  // identity
  UserRegisteredAuditHandler,
  UserDeletedAuditHandler,
  UserEditedAuditHandler,
  // products
  ProductRegisteredAuditHandler,
  ProductRenamedAuditHandler,
  ProductDeletedAuditHandler,
  // components
  ComponentRegisteredAuditHandler,
  ComponentRenamedAuditHandler,
  ComponentDeletedAuditHandler,
  // materials
  MaterialRegisteredAuditHandler,
  MaterialEditedAuditHandler,
  MaterialDeletedAuditHandler,
  // manufacturing-instructions
  ManufacturingInstructionRegisteredAuditHandler,
  ManufacturingInstructionEditedAuditHandler,
  ManufacturingInstructionDeletedAuditHandler,
  // boms
  BomRegisteredAuditHandler,
  BomEditedAuditHandler,
  BomDeletedAuditHandler,
];
