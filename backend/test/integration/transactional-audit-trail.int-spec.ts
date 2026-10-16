import { randomUUID } from 'node:crypto';

import { AuditLogRepository } from '@audit-logging/application/service/audit-log.repository';
import { AuditLoggingModule } from '@audit-logging/infrastructure/audit-logging.module';
import {
  DomainEventHandler,
  DomainEventHandlerOf,
} from '@framework/application';
import { EntityNotFound, Identity, Role } from '@framework/domain';
import {
  ActorContextMiddleware,
  ActorContextModule,
  AuthModule,
  ClockModule,
  DomainEventsModule,
  EmailModule,
  PrismaModule,
  PrismaService,
  PrismaTransactionsModule,
} from '@framework/infrastructure';
import { IdentityModule } from '@identity/infrastructure/identity.module';
import { Injectable, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { MaterialDeleted } from '@products/domain/events/material-deleted.event';
import { MaterialRegistered } from '@products/domain/events/material-registered.event';
import { ProductComponentsUpdated } from '@products/domain/events/product-components-updated.event';
import { Material } from '@products/domain/material.aggregate';
import { Product } from '@products/domain/product.aggregate';
import { MaterialRepository } from '@products/domain/service/material.repository';
import { ProductRepository } from '@products/domain/service/product.repository';
import { MaterialName } from '@products/domain/value/material-name.vo';
import { ProductComponentLine } from '@products/domain/value/product-component-line.vo';
import { ProductMaterialLine } from '@products/domain/value/product-material-line.vo';
import { ProductName } from '@products/domain/value/product-name.vo';
import { ProductsModule } from '@products/infrastructure/products.module';
import { Request, Response } from 'express';

// ADR 0007: an aggregate's change and its audit entry commit or roll back
// together. Runs against the test stack's real Postgres (see
// `make run-integration-tests`). Every case uses fresh ids and unique
// names and deletes its own rows; nothing truncates.

const TRIPWIRE_FAILURE = 'tripwire: a subscriber failed';
// Stored in app_user.password_hash for the test actors; never used to log in.
const UNUSABLE_HASH = 'not-a-bcrypt-hash';

/** A switch the extra subscribers below consult: they fail only when armed. */
@Injectable()
class Tripwire {
  private armed = false;

  arm(): void {
    this.armed = true;
  }

  disarm(): void {
    this.armed = false;
  }

  check(): Promise<void> {
    return this.armed
      ? Promise.reject(new Error(TRIPWIRE_FAILURE))
      : Promise.resolve();
  }
}

@DomainEventHandler(MaterialRegistered)
class MaterialRegisteredTripwire implements DomainEventHandlerOf<MaterialRegistered> {
  constructor(private readonly tripwire: Tripwire) {}

  handle(): Promise<void> {
    return this.tripwire.check();
  }
}

@DomainEventHandler(MaterialDeleted)
class MaterialDeletedTripwire implements DomainEventHandlerOf<MaterialDeleted> {
  constructor(private readonly tripwire: Tripwire) {}

  handle(): Promise<void> {
    return this.tripwire.check();
  }
}

@DomainEventHandler(ProductComponentsUpdated)
class ProductComponentsUpdatedTripwire implements DomainEventHandlerOf<ProductComponentsUpdated> {
  constructor(private readonly tripwire: Tripwire) {}

  handle(): Promise<void> {
    return this.tripwire.check();
  }
}

// The dispatcher runs an event's handlers in discovery order, which is the
// order Nest's scanner inserted their modules: the root module first, then
// its imports depth-first. Provided on the root module, these tripwires
// would fire before the audit handlers and fail before `record()` was ever
// reached, so "no audit entry" would hold however `record()` wrote. Imported
// after AuditLoggingModule instead, they fire once the entry has been written
// inside the transaction, and the rollback cases prove it was undone.
@Module({
  providers: [
    Tripwire,
    MaterialRegisteredTripwire,
    MaterialDeletedTripwire,
    ProductComponentsUpdatedTripwire,
  ],
  exports: [Tripwire],
})
class TripwireModule {}

function compositionLine(
  componentName: string,
  materialName: string,
): ProductComponentLine {
  return ProductComponentLine.of(Identity.new(), componentName, [
    ProductMaterialLine.of(Identity.new(), materialName),
  ]);
}

interface Actor {
  readonly id: string;
  readonly name: string;
}

describe('transactional audit trail', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let materials: MaterialRepository;
  let products: ProductRepository;
  let auditLog: AuditLogRepository;
  let tripwire: Tripwire;
  let jwt: JwtService;
  let actorMiddleware: ActorContextMiddleware;
  // Assigned in beforeAll, before any case runs.
  let actor: Actor;
  let otherActor: Actor;
  let createdMaterialIds: string[] = [];
  let createdProductIds: string[] = [];

  // Runs `work` the way a request does: through the real
  // ActorContextMiddleware, carrying a bearer token whose `sub` is `userId`.
  // Everything `work` awaits inherits that actor.
  function runAs<T>(userId: string, work: () => Promise<T>): Promise<T> {
    const request = {
      headers: { authorization: `Bearer ${jwt.sign({ sub: userId })}` },
    } as unknown as Request;
    return new Promise<T>((resolve, reject) => {
      actorMiddleware.use(request, {} as Response, () => {
        work().then(resolve, reject);
      });
    });
  }

  async function createActor(): Promise<Actor> {
    const id = randomUUID();
    const name = `Integration actor ${id}`;
    await prisma.user.create({
      data: {
        id,
        name,
        username: `integration-${id}`,
        passwordHash: UNUSABLE_HASH,
        role: Role.SystemAdmin,
      },
    });
    return { id, name };
  }

  function newMaterial(): Material {
    const material = Material.register(
      MaterialName.fromString(`Integration material ${randomUUID()}`),
      null,
    );
    createdMaterialIds.push(material.id.asString());
    return material;
  }

  async function savedProduct(): Promise<Product> {
    const product = Product.register(
      ProductName.fromString(`Integration product ${randomUUID()}`),
      [compositionLine('Core', 'Copper')],
    );
    createdProductIds.push(product.id.asString());
    await products.save(product);
    return product;
  }

  function materialRow(material: Material) {
    return prisma.material.findUnique({
      where: { id: material.id.asString() },
    });
  }

  function auditEntriesFor(recordId: string) {
    return prisma.auditLogEntry.findMany({ where: { recordId } });
  }

  async function compositionOf(productId: string) {
    const rows = await prisma.productComponent.findMany({
      where: { productId },
      include: { materials: { orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => ({
      name: row.name,
      materials: row.materials.map((material) => material.name),
    }));
  }

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        // The container's environment (.env.test via Compose) is the config.
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        CqrsModule.forRoot(),
        AuthModule,
        ActorContextModule,
        ClockModule,
        EmailModule,
        PrismaModule,
        PrismaTransactionsModule,
        DomainEventsModule,
        IdentityModule,
        ProductsModule,
        AuditLoggingModule,
        // Must stay after AuditLoggingModule; see TripwireModule.
        TripwireModule,
      ],
    }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaService, { strict: false });
    materials = moduleRef.get(MaterialRepository, { strict: false });
    products = moduleRef.get(ProductRepository, { strict: false });
    auditLog = moduleRef.get(AuditLogRepository, { strict: false });
    tripwire = moduleRef.get(Tripwire, { strict: false });
    jwt = moduleRef.get(JwtService, { strict: false });
    actorMiddleware = moduleRef.get(ActorContextMiddleware, { strict: false });

    actor = await createActor();
    otherActor = await createActor();
  });

  afterEach(async () => {
    tripwire.disarm();
    jest.restoreAllMocks();
    await prisma.auditLogEntry.deleteMany({
      where: {
        recordId: { in: [...createdMaterialIds, ...createdProductIds] },
      },
    });
    await prisma.material.deleteMany({
      where: { id: { in: createdMaterialIds } },
    });
    await prisma.product.deleteMany({
      where: { id: { in: createdProductIds } },
    });
    createdMaterialIds = [];
    createdProductIds = [];
  });

  afterAll(async () => {
    const actorIds = [actor, otherActor].flatMap((created) =>
      created ? [created.id] : [],
    );
    await prisma?.user.deleteMany({ where: { id: { in: actorIds } } });
    await moduleRef?.close();
  });

  // Case 1 (spec): commit.
  it('commits the change and exactly one audit entry for it, stamped with the actor', async () => {
    const material = newMaterial();

    await runAs(actor.id, () => materials.save(material));

    expect(await materialRow(material)).not.toBeNull();
    expect(await auditEntriesFor(material.id.asString())).toEqual([
      expect.objectContaining({
        recordType: 'Material',
        action: 'Registered',
        actorId: actor.id,
        actorName: actor.name,
      }),
    ]);
  });

  // Case 2 (spec): save rolls back.
  it('rolls back a new row and its audit entry when a subscriber fails during save', async () => {
    const material = newMaterial();
    tripwire.arm();

    await expect(
      runAs(actor.id, () => materials.save(material)),
    ).rejects.toThrow(TRIPWIRE_FAILURE);

    expect(await materialRow(material)).toBeNull();
    expect(await auditEntriesFor(material.id.asString())).toEqual([]);
  });

  // Case 3 (spec): delete rolls back.
  it('keeps the row when a subscriber fails during delete', async () => {
    const material = newMaterial();
    await materials.save(material);
    const stored = await materials.get(material.id);
    stored.delete();
    tripwire.arm();

    await expect(
      runAs(actor.id, () => materials.delete(stored)),
    ).rejects.toThrow(TRIPWIRE_FAILURE);

    expect(await materialRow(material)).not.toBeNull();
    expect(await auditEntriesFor(material.id.asString())).toEqual([]);
  });

  // Case 4 (spec): nested write rolls back.
  it('keeps the original composition rows when a subscriber fails while replacing them', async () => {
    const product = await savedProduct();
    const stored = await products.get(product.id);
    stored.updateComponents([compositionLine('Sheath', 'PVC')]);
    tripwire.arm();

    await expect(runAs(actor.id, () => products.save(stored))).rejects.toThrow(
      TRIPWIRE_FAILURE,
    );

    expect(await compositionOf(product.id.asString())).toEqual([
      { name: 'Core', materials: ['Copper'] },
    ]);
  });

  // Case 5 (spec): no actor. Runs outside any request and any CLS context,
  // which is exactly how DefaultAdminSeeder saves at boot.
  it('commits a change made with no actor, and writes no audit entry for it', async () => {
    const material = newMaterial();

    await materials.save(material);

    expect(await materialRow(material)).not.toBeNull();
    expect(await auditEntriesFor(material.id.asString())).toEqual([]);
  });

  // Case 6 (Review Focus 1; ADR 0007's Compliance fitness function).
  it('rolls back the change when its audit entry cannot be written', async () => {
    const material = newMaterial();
    jest
      .spyOn(auditLog, 'record')
      .mockRejectedValueOnce(new Error('audit store unavailable'));

    await expect(
      runAs(actor.id, () => materials.save(material)),
    ).rejects.toThrow('audit store unavailable');

    expect(await materialRow(material)).toBeNull();
  });

  // Case 7 (Review Focus 2): the actor's user row does not exist at all.
  // (Users are soft-deleted, and a soft-deleted actor still resolves.)
  it('rolls back the change when the actor no longer exists', async () => {
    const material = newMaterial();

    await expect(
      runAs(randomUUID(), () => materials.save(material)),
    ).rejects.toBeInstanceOf(EntityNotFound);

    expect(await materialRow(material)).toBeNull();
    expect(await auditEntriesFor(material.id.asString())).toEqual([]);
  });

  // Case 8 (Review Focus 4): concurrent requests stay apart.
  it('keeps concurrent saves in separate transactions, each with its own actor', async () => {
    const first = newMaterial();
    const second = newMaterial();

    await Promise.all([
      runAs(actor.id, () => materials.save(first)),
      runAs(otherActor.id, () => materials.save(second)),
    ]);

    expect(await auditEntriesFor(first.id.asString())).toEqual([
      expect.objectContaining({ actorId: actor.id }),
    ]);
    expect(await auditEntriesFor(second.id.asString())).toEqual([
      expect.objectContaining({ actorId: otherActor.id }),
    ]);
  });

  // Case 9 (Review Focus 3): the delegates' delete-and-recreate, now on the
  // repository's transaction, still replaces the composition in full.
  it('replaces the composition rows in full when an edit commits', async () => {
    const product = await savedProduct();
    const stored = await products.get(product.id);
    stored.updateComponents([
      compositionLine('Sheath', 'PVC'),
      compositionLine('Jacket', 'Rubber'),
    ]);

    await runAs(actor.id, () => products.save(stored));

    expect(await compositionOf(product.id.asString())).toEqual([
      { name: 'Jacket', materials: ['Rubber'] },
      { name: 'Sheath', materials: ['PVC'] },
    ]);
  });
});
