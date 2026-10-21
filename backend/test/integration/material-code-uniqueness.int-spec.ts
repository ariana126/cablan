import { randomUUID } from 'node:crypto';

import {
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
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { Test, TestingModule } from '@nestjs/testing';
import { MaterialCodeAlreadyExists } from '@products/application/exceptions';
import { Material } from '@products/domain/material.aggregate';
import { MaterialRepository } from '@products/domain/service/material.repository';
import { MaterialCode } from '@products/domain/value/material-code.vo';
import { MaterialName } from '@products/domain/value/material-name.vo';
import { ProductsModule } from '@products/infrastructure/products.module';

// The `code` column's unique index is the backstop behind the handlers'
// `findByCode` pre-check: two writes racing past that check must still end in
// the same 409-mapped `MaterialCodeAlreadyExists`, not a raw Prisma error (a
// 500). These cases save straight through the repository, so the pre-check
// never runs and only the database can refuse. Runs against the test stack's
// real Postgres; every case uses fresh names and codes and deletes its rows.

function uniqueCode(): string {
  return `INT-${randomUUID()}`;
}

describe('material code uniqueness in the database', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let materials: MaterialRepository;
  let createdMaterialIds: string[] = [];

  function newMaterial(code: string): Material {
    const material = Material.register(
      MaterialName.fromString(`Integration material ${randomUUID()}`),
      MaterialCode.fromString(code),
    );
    createdMaterialIds.push(material.id.asString());
    return material;
  }

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        CqrsModule.forRoot(),
        // The same graph as the audit-trail suite, minus audit logging:
        // ProductsModule's controllers need the auth guards, and RolesGuard
        // needs IdentityModule's role provider.
        AuthModule,
        ActorContextModule,
        ClockModule,
        EmailModule,
        PrismaModule,
        PrismaTransactionsModule,
        DomainEventsModule,
        IdentityModule,
        ProductsModule,
      ],
    }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaService, { strict: false });
    materials = moduleRef.get(MaterialRepository, { strict: false });
  });

  afterEach(async () => {
    await prisma.material.deleteMany({
      where: { id: { in: createdMaterialIds } },
    });
    createdMaterialIds = [];
  });

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('rejects saving a new material whose code is already taken, as MaterialCodeAlreadyExists', async () => {
    const code = uniqueCode();
    await materials.save(newMaterial(code));
    const duplicate = newMaterial(code);

    await expect(materials.save(duplicate)).rejects.toBeInstanceOf(
      MaterialCodeAlreadyExists,
    );

    expect(
      await prisma.material.findUnique({
        where: { id: duplicate.id.asString() },
      }),
    ).toBeNull();
  });

  it("rejects saving an edit onto another material's code, as MaterialCodeAlreadyExists", async () => {
    const takenCode = uniqueCode();
    const ownCode = uniqueCode();
    await materials.save(newMaterial(takenCode));
    const material = newMaterial(ownCode);
    await materials.save(material);
    const stored = await materials.get(material.id);
    stored.edit({
      name: stored.name(),
      code: MaterialCode.fromString(takenCode),
    });

    await expect(materials.save(stored)).rejects.toBeInstanceOf(
      MaterialCodeAlreadyExists,
    );

    const row = await prisma.material.findUnique({
      where: { id: material.id.asString() },
    });
    expect(row?.code).toBe(ownCode);
  });

  it('finds a material by its code', async () => {
    const code = uniqueCode();
    const material = newMaterial(code);
    await materials.save(material);

    const found = await materials.findByCode(MaterialCode.fromString(code));

    expect(found?.id.equals(material.id)).toBe(true);
  });
});
