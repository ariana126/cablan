import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { PrismaService } from '@framework/infrastructure';

// The `resync_material_name_copies` migration rewrites every copy of a
// material's name that products, standard BOMs and daily BOMs took before
// issues #94 and #110 — renames back then left those copies stale — to the
// material's current name, once. These cases seed such copies straight
// through Prisma, run the migration's SQL against the test stack's real
// Postgres, and read the rows back. The SQL is one idempotent DO block, so
// running it again here (the stack has already applied it) is exactly what a
// deploy did. Every case uses fresh values and deletes its own rows.

const MIGRATIONS = path.join(process.cwd(), 'prisma', 'migrations');

function migrationSql(): string {
  const directory = readdirSync(MIGRATIONS).find((name) =>
    name.endsWith('_resync_material_name_copies'),
  );
  if (directory === undefined) {
    throw new Error('The resync_material_name_copies migration is missing');
  }
  return readFileSync(
    path.join(MIGRATIONS, directory, 'migration.sql'),
    'utf8',
  );
}

describe('the resync_material_name_copies migration', () => {
  const prisma = new PrismaService();
  let cleanUps: (() => Promise<unknown>)[] = [];

  async function runMigration(): Promise<void> {
    await prisma.$executeRawUnsafe(migrationSql());
  }

  async function seedMaterial(name: string) {
    const material = await prisma.material.create({
      data: { name, code: `RM-${randomUUID()}` },
    });
    cleanUps.push(() => prisma.material.delete({ where: { id: material.id } }));
    return material;
  }

  async function seedProduct(
    materialId: string,
    materialName: string,
    componentName = `C-${randomUUID()}`,
  ) {
    const product = await prisma.product.create({
      data: {
        name: `P-${randomUUID()}`,
        components: {
          create: {
            componentId: randomUUID(),
            name: componentName,
            materials: { create: { materialId, name: materialName } },
          },
        },
      },
      include: { components: { include: { materials: true } } },
    });
    cleanUps.push(() => prisma.product.delete({ where: { id: product.id } }));
    return product;
  }

  async function seedStandardBom(materialId: string, materialName: string) {
    const standardBom = await prisma.manufacturingInstruction.create({
      data: {
        miCode: `MI-${randomUUID()}`,
        brand: 'Brand',
        standardLength: 305,
        active: true,
        productId: randomUUID(),
        productName: `P-${randomUUID()}`,
        components: {
          create: {
            componentId: randomUUID(),
            name: `C-${randomUUID()}`,
            materials: {
              create: { materialId, name: materialName, weight: 150 },
            },
          },
        },
      },
    });
    cleanUps.push(() =>
      prisma.manufacturingInstruction.delete({ where: { id: standardBom.id } }),
    );
    return standardBom;
  }

  async function seedDailyBom(materialId: string, materialName: string) {
    const bom = await prisma.bom.create({
      data: {
        standardBomId: randomUUID(),
        standardBomMiCode: `MI-${randomUUID()}`,
        brand: 'Brand',
        productName: `P-${randomUUID()}`,
        standardLength: 305,
        orderNumber: `SO-${randomUUID()}`,
        trackingNumber: `TRK-${randomUUID()}`,
        registeredBy: 'Integration user',
        components: {
          create: {
            componentId: randomUUID(),
            name: `C-${randomUUID()}`,
            materials: {
              create: { materialId, name: materialName, weight: 150 },
            },
          },
        },
      },
    });
    cleanUps.push(() => prisma.bom.delete({ where: { id: bom.id } }));
    return bom;
  }

  async function productMaterialName(productId: string): Promise<string> {
    const row = await prisma.productMaterial.findFirstOrThrow({
      where: { productComponent: { productId } },
    });
    return row.name;
  }

  async function standardBomMaterialName(
    standardBomId: string,
  ): Promise<string> {
    const row = await prisma.manufacturingInstructionMaterial.findFirstOrThrow({
      where: {
        manufacturingInstructionComponent: {
          manufacturingInstructionId: standardBomId,
        },
      },
    });
    return row.name;
  }

  async function dailyBomMaterialName(bomId: string): Promise<string> {
    const row = await prisma.bomMaterial.findFirstOrThrow({
      where: { bomComponent: { bomId } },
    });
    return row.name;
  }

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterEach(async () => {
    for (const cleanUp of cleanUps.toReversed()) {
      await cleanUp();
    }
    cleanUps = [];
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rewrites a product's, a standard BOM's and a daily BOM's copy to the material's current name", async () => {
    const id = randomUUID();
    const material = await seedMaterial(`M-new-${id}`);
    const product = await seedProduct(material.id, `M-old-${id}`);
    const standardBom = await seedStandardBom(material.id, `M-old-${id}`);
    const dailyBom = await seedDailyBom(material.id, `M-old-${id}`);

    await runMigration();

    expect(await productMaterialName(product.id)).toBe(`M-new-${id}`);
    expect(await standardBomMaterialName(standardBom.id)).toBe(`M-new-${id}`);
    expect(await dailyBomMaterialName(dailyBom.id)).toBe(`M-new-${id}`);
  });

  it('fixes every copy of a material used in several products', async () => {
    const id = randomUUID();
    const material = await seedMaterial(`M-new-${id}`);
    const first = await seedProduct(material.id, `M-old-${id}`);
    const second = await seedProduct(material.id, `M-older-${id}`);

    await runMigration();

    expect(await productMaterialName(first.id)).toBe(`M-new-${id}`);
    expect(await productMaterialName(second.id)).toBe(`M-new-${id}`);
  });

  it('leaves a copy whose material no longer exists unchanged', async () => {
    const id = randomUUID();
    const product = await seedProduct(randomUUID(), `Gone-${id}`);

    await runMigration();

    expect(await productMaterialName(product.id)).toBe(`Gone-${id}`);
  });

  it('leaves component name copies alone', async () => {
    const id = randomUUID();
    const component = await prisma.component.create({
      data: { name: `C-new-${id}` },
    });
    cleanUps.push(() =>
      prisma.component.delete({ where: { id: component.id } }),
    );
    const material = await seedMaterial(`M-new-${id}`);
    const product = await prisma.product.create({
      data: {
        name: `P-${id}`,
        components: {
          create: {
            componentId: component.id,
            name: `C-old-${id}`,
            materials: {
              create: { materialId: material.id, name: `M-old-${id}` },
            },
          },
        },
      },
    });
    cleanUps.push(() => prisma.product.delete({ where: { id: product.id } }));

    await runMigration();

    const stored = await prisma.productComponent.findFirstOrThrow({
      where: { productId: product.id },
    });
    expect(stored.name).toBe(`C-old-${id}`);
  });

  it('is idempotent and writes no audit entry', async () => {
    const id = randomUUID();
    const material = await seedMaterial(`M-new-${id}`);
    const product = await seedProduct(material.id, `M-old-${id}`);
    const standardBom = await seedStandardBom(material.id, `M-old-${id}`);
    const dailyBom = await seedDailyBom(material.id, `M-old-${id}`);
    const auditEntriesBefore = await prisma.auditLogEntry.count();
    await runMigration();

    await runMigration();

    expect(await productMaterialName(product.id)).toBe(`M-new-${id}`);
    expect(await standardBomMaterialName(standardBom.id)).toBe(`M-new-${id}`);
    expect(await dailyBomMaterialName(dailyBom.id)).toBe(`M-new-${id}`);
    expect(await prisma.auditLogEntry.count()).toBe(auditEntriesBefore);
  });
});
