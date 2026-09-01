import { BomComponentsUpdatedAuditHandler } from '@audit-logging/application/event-handlers/boms/bom-components-updated.handler';
import { BomDeletedAuditHandler } from '@audit-logging/application/event-handlers/boms/bom-deleted.handler';
import { BomEditedAuditHandler } from '@audit-logging/application/event-handlers/boms/bom-edited.handler';
import { BomRegisteredAuditHandler } from '@audit-logging/application/event-handlers/boms/bom-registered.handler';
import { ComponentDeletedAuditHandler } from '@audit-logging/application/event-handlers/components/component-deleted.handler';
import { ComponentRegisteredAuditHandler } from '@audit-logging/application/event-handlers/components/component-registered.handler';
import { ComponentRenamedAuditHandler } from '@audit-logging/application/event-handlers/components/component-renamed.handler';
import { UserDeletedAuditHandler } from '@audit-logging/application/event-handlers/identity/user-deleted.handler';
import { UserRegisteredAuditHandler } from '@audit-logging/application/event-handlers/identity/user-registered.handler';
import { UserRenamedAuditHandler } from '@audit-logging/application/event-handlers/identity/user-renamed.handler';
import { UserRoleChangedAuditHandler } from '@audit-logging/application/event-handlers/identity/user-role-changed.handler';
import { UsernameChangedAuditHandler } from '@audit-logging/application/event-handlers/identity/username-changed.handler';
import { MaterialDeletedAuditHandler } from '@audit-logging/application/event-handlers/materials/material-deleted.handler';
import { MaterialRegisteredAuditHandler } from '@audit-logging/application/event-handlers/materials/material-registered.handler';
import { MaterialRenamedAuditHandler } from '@audit-logging/application/event-handlers/materials/material-renamed.handler';
import { ProductDeletedAuditHandler } from '@audit-logging/application/event-handlers/products/product-deleted.handler';
import { ProductRegisteredAuditHandler } from '@audit-logging/application/event-handlers/products/product-registered.handler';
import { ProductRenamedAuditHandler } from '@audit-logging/application/event-handlers/products/product-renamed.handler';
import { StandardBomComponentsUpdatedAuditHandler } from '@audit-logging/application/event-handlers/standard-boms/standard-bom-components-updated.handler';
import { StandardBomDeletedAuditHandler } from '@audit-logging/application/event-handlers/standard-boms/standard-bom-deleted.handler';
import { StandardBomEditedAuditHandler } from '@audit-logging/application/event-handlers/standard-boms/standard-bom-edited.handler';
import { StandardBomRegisteredAuditHandler } from '@audit-logging/application/event-handlers/standard-boms/standard-bom-registered.handler';

export const EventHandlers = [
  // identity
  UserRegisteredAuditHandler,
  UserDeletedAuditHandler,
  UserRenamedAuditHandler,
  UsernameChangedAuditHandler,
  UserRoleChangedAuditHandler,
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
  MaterialRenamedAuditHandler,
  MaterialDeletedAuditHandler,
  // standard-boms
  StandardBomRegisteredAuditHandler,
  StandardBomEditedAuditHandler,
  StandardBomDeletedAuditHandler,
  StandardBomComponentsUpdatedAuditHandler,
  // boms
  BomRegisteredAuditHandler,
  BomEditedAuditHandler,
  BomDeletedAuditHandler,
  BomComponentsUpdatedAuditHandler,
];
