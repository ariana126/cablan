import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { ProductDeleted } from '@products/domain/events/product-deleted.event';
import { ProductRegistered } from '@products/domain/events/product-registered.event';
import { ProductRenamed } from '@products/domain/events/product-renamed.event';

import { ProductDeletedAuditHandler } from './product-deleted.handler';
import { ProductRegisteredAuditHandler } from './product-registered.handler';
import { ProductRenamedAuditHandler } from './product-renamed.handler';

function fakeProjector() {
  return { project: jest.fn().mockResolvedValue() };
}

describe('products audit handlers', () => {
  it('projects a ProductRegistered event as a Product Registered entry', async () => {
    const projector = fakeProjector();
    const sut = new ProductRegisteredAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(new ProductRegistered('product-1', 'Widget', []));

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.Product,
      'product-1',
      AuditAction.Registered,
    );
  });

  it("projects a ProductRenamed event as a Product Edited entry with the 'name' field's before/after", async () => {
    const projector = fakeProjector();
    const sut = new ProductRenamedAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(new ProductRenamed('product-1', 'Widget', 'Gadget'));

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.Product,
      'product-1',
      AuditAction.Edited,
      [{ field: 'name', previousValue: 'Widget', newValue: 'Gadget' }],
    );
  });

  it('projects a ProductDeleted event as a Product Deleted entry', async () => {
    const projector = fakeProjector();
    const sut = new ProductDeletedAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(new ProductDeleted('product-1', 'Widget'));

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.Product,
      'product-1',
      AuditAction.Deleted,
    );
  });
});
