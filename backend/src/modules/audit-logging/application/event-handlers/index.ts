import { BomDeletedAuditHandler } from '@audit-logging/application/event-handlers/boms/bom-deleted.handler';
import { BomEditedAuditHandler } from '@audit-logging/application/event-handlers/boms/bom-edited.handler';
import { BomRegisteredAuditHandler } from '@audit-logging/application/event-handlers/boms/bom-registered.handler';
import { UserDeletedAuditHandler } from '@audit-logging/application/event-handlers/identity/user-deleted.handler';
import { UserEditedAuditHandler } from '@audit-logging/application/event-handlers/identity/user-edited.handler';
import { UserRegisteredAuditHandler } from '@audit-logging/application/event-handlers/identity/user-registered.handler';
import { ManufacturingInstructionDeletedAuditHandler } from '@audit-logging/application/event-handlers/manufacturing-instructions/manufacturing-instruction-deleted.handler';
import { ManufacturingInstructionEditedAuditHandler } from '@audit-logging/application/event-handlers/manufacturing-instructions/manufacturing-instruction-edited.handler';
import { ManufacturingInstructionRegisteredAuditHandler } from '@audit-logging/application/event-handlers/manufacturing-instructions/manufacturing-instruction-registered.handler';
import { ComponentDeletedAuditHandler } from '@audit-logging/application/event-handlers/products/component-deleted.handler';
import { ComponentRegisteredAuditHandler } from '@audit-logging/application/event-handlers/products/component-registered.handler';
import { ComponentRenamedAuditHandler } from '@audit-logging/application/event-handlers/products/component-renamed.handler';
import { MaterialDeletedAuditHandler } from '@audit-logging/application/event-handlers/products/material-deleted.handler';
import { MaterialEditedAuditHandler } from '@audit-logging/application/event-handlers/products/material-edited.handler';
import { MaterialRegisteredAuditHandler } from '@audit-logging/application/event-handlers/products/material-registered.handler';
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
];
