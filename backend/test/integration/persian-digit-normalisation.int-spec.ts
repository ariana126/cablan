import { randomInt, randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { PrismaService } from '@framework/infrastructure';

// The `normalise_persian_digits` migration rewrites the Persian and
// Arabic-Indic digits stored before issue #62 as English digits, once. These
// cases seed such rows straight through Prisma, run the migration's SQL
// against the test stack's real Postgres, and read the rows back. The SQL is
// one idempotent DO block, so running it again here (the stack has already
// applied it) is exactly what a deploy did. Every case uses fresh values and
// deletes its own rows.

const MIGRATIONS = path.join(process.cwd(), 'prisma', 'migrations');
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function migrationSql(): string {
  const directory = readdirSync(MIGRATIONS).find((name) =>
    name.endsWith('_normalise_persian_digits'),
  );
  return readFileSync(
    path.join(MIGRATIONS, directory, 'migration.sql'),
    'utf8',
  );
}

// A number no other case or run uses, as English digits and as typed on a
// Persian keyboard (Persian, or Arabic-Indic).
function freshNumber(): {
  english: string;
  persian: string;
  arabicIndic: string;
} {
  const english = String(randomInt(100_000_000, 999_999_999));
  const typedIn = (digits: string) =>
    english.replaceAll(/\d/g, (digit) => digits[Number(digit)]);
  return {
    english,
    persian: typedIn(PERSIAN_DIGITS),
    arabicIndic: typedIn(ARABIC_INDIC_DIGITS),
  };
}

describe('the normalise_persian_digits migration', () => {
  const prisma = new PrismaService();
  const sql = migrationSql();
  let cleanUps: (() => Promise<unknown>)[] = [];

  async function runMigration(): Promise<void> {
    await prisma.$executeRawUnsafe(sql);
  }

  async function seedStandardBom(miCode: string, suffix: string) {
    const standardBom = await prisma.manufacturingInstruction.create({
      data: {
        miCode,
        brand: `برند ${suffix}`,
        standardLength: 305,
        active: true,
        productId: randomUUID(),
        productName: `کابل ${suffix}`,
        components: {
          create: {
            componentId: randomUUID(),
            name: `هادی ${suffix}`,
            materials: {
              create: {
                materialId: randomUUID(),
                name: `مس ${suffix}`,
                weight: 150,
              },
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

  async function seedUser(username: string, isDeleted: boolean) {
    const user = await prisma.user.create({
      data: {
        name: 'Integration user',
        username,
        passwordHash: 'hashed',
        role: 'reporter',
        isDeleted,
      },
    });
    cleanUps.push(() => prisma.user.delete({ where: { id: user.id } }));
    return user;
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

  it("rewrites a daily BOM's own fields and every value it cloned in English digits", async () => {
    const n = freshNumber();
    const bom = await prisma.bom.create({
      data: {
        standardBomId: randomUUID(),
        standardBomMiCode: n.persian,
        brand: `برند ${n.arabicIndic}`,
        productName: `کابل ${n.persian}`,
        standardLength: 305,
        orderNumber: `SO-${n.persian}`,
        trackingNumber: `TRK-${n.arabicIndic}`,
        description: `سفارش ${n.persian}`,
        registeredBy: 'سینا',
        components: {
          create: {
            componentId: randomUUID(),
            name: `هادی ${n.persian}`,
            materials: {
              create: {
                materialId: randomUUID(),
                name: `مس ${n.arabicIndic}`,
                weight: 150,
              },
            },
          },
        },
      },
    });
    cleanUps.push(() => prisma.bom.delete({ where: { id: bom.id } }));

    await runMigration();

    const stored = await prisma.bom.findUniqueOrThrow({
      where: { id: bom.id },
      include: { components: { include: { materials: true } } },
    });
    expect(stored).toEqual(
      expect.objectContaining({
        standardBomMiCode: n.english,
        brand: `برند ${n.english}`,
        productName: `کابل ${n.english}`,
        orderNumber: `SO-${n.english}`,
        trackingNumber: `TRK-${n.english}`,
        description: `سفارش ${n.english}`,
      }),
    );
    expect(stored.components[0].name).toBe(`هادی ${n.english}`);
    expect(stored.components[0].materials[0].name).toBe(`مس ${n.english}`);
  });

  it("rewrites a standard BOM's MI code, brand and cloned names when its English-digit MI code is free", async () => {
    const n = freshNumber();
    const standardBom = await seedStandardBom(n.persian, n.arabicIndic);

    await runMigration();

    const stored = await prisma.manufacturingInstruction.findUniqueOrThrow({
      where: { id: standardBom.id },
      include: { components: { include: { materials: true } } },
    });
    expect(stored).toEqual(
      expect.objectContaining({
        miCode: n.english,
        brand: `برند ${n.english}`,
        productName: `کابل ${n.english}`,
      }),
    );
    expect(stored.components[0].name).toBe(`هادی ${n.english}`);
    expect(stored.components[0].materials[0].name).toBe(`مس ${n.english}`);
  });

  it('leaves an MI code whose English-digit form is already taken as it is, still rewriting the brand', async () => {
    const n = freshNumber();
    await seedStandardBom(n.english, 'A');
    const typedInPersian = await seedStandardBom(n.persian, n.persian);

    await runMigration();

    const stored = await prisma.manufacturingInstruction.findUniqueOrThrow({
      where: { id: typedInPersian.id },
    });
    expect(stored.miCode).toBe(n.persian);
    expect(stored.brand).toBe(`برند ${n.english}`);
  });

  it('leaves two MI codes that would both become the same English-digit code as they are', async () => {
    const n = freshNumber();
    const persian = await seedStandardBom(n.persian, 'A');
    const arabicIndic = await seedStandardBom(n.arabicIndic, 'B');

    await runMigration();

    const stored = await prisma.manufacturingInstruction.findMany({
      where: { id: { in: [persian.id, arabicIndic.id] } },
      orderBy: { brand: 'asc' },
    });
    expect(stored.map((row) => row.miCode)).toEqual([n.persian, n.arabicIndic]);
  });

  it("rewrites a material's code and name, a component's name and a product's name and composition", async () => {
    const n = freshNumber();
    const material = await prisma.material.create({
      data: { name: `مس ${n.persian}`, code: `RM-${n.arabicIndic}` },
    });
    cleanUps.push(() => prisma.material.delete({ where: { id: material.id } }));
    const component = await prisma.component.create({
      data: { name: `هادی ${n.persian}` },
    });
    cleanUps.push(() =>
      prisma.component.delete({ where: { id: component.id } }),
    );
    const product = await prisma.product.create({
      data: {
        name: `کابل ${n.persian}`,
        components: {
          create: {
            componentId: component.id,
            name: `هادی ${n.persian}`,
            materials: {
              create: { materialId: material.id, name: `مس ${n.persian}` },
            },
          },
        },
      },
    });
    cleanUps.push(() => prisma.product.delete({ where: { id: product.id } }));

    await runMigration();

    expect(
      await prisma.material.findUniqueOrThrow({ where: { id: material.id } }),
    ).toEqual(
      expect.objectContaining({
        name: `مس ${n.english}`,
        code: `RM-${n.english}`,
      }),
    );
    const storedComponent = await prisma.component.findUniqueOrThrow({
      where: { id: component.id },
    });
    expect(storedComponent.name).toBe(`هادی ${n.english}`);
    const storedProduct = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
      include: { components: { include: { materials: true } } },
    });
    expect(storedProduct.name).toBe(`کابل ${n.english}`);
    expect(storedProduct.components[0].name).toBe(`هادی ${n.english}`);
    expect(storedProduct.components[0].materials[0].name).toBe(
      `مس ${n.english}`,
    );
  });

  it('leaves a material code whose English-digit form another material has as it is, still rewriting its free name', async () => {
    const n = freshNumber();
    const existing = await prisma.material.create({
      data: { name: `Existing ${randomUUID()}`, code: n.english },
    });
    cleanUps.push(() => prisma.material.delete({ where: { id: existing.id } }));
    const typedInPersian = await prisma.material.create({
      data: { name: `مس ${n.persian}`, code: n.persian },
    });
    cleanUps.push(() =>
      prisma.material.delete({ where: { id: typedInPersian.id } }),
    );

    await runMigration();

    expect(
      await prisma.material.findUniqueOrThrow({
        where: { id: typedInPersian.id },
      }),
    ).toEqual(
      expect.objectContaining({ code: n.persian, name: `مس ${n.english}` }),
    );
  });

  it("leaves an active user's username whose English-digit form another active user has as it is", async () => {
    const n = freshNumber();
    await seedUser(`sina.${n.english}`, false);
    const typedInPersian = await seedUser(`sina.${n.persian}`, false);

    await runMigration();

    const storedUser = await prisma.user.findUniqueOrThrow({
      where: { id: typedInPersian.id },
    });
    expect(storedUser.username).toBe(`sina.${n.persian}`);
  });

  it("rewrites an active user's username whose English-digit form only a deleted user has", async () => {
    const n = freshNumber();
    await seedUser(`sina.${n.english}`, true);
    const typedInPersian = await seedUser(`sina.${n.persian}`, false);

    await runMigration();

    const storedUser = await prisma.user.findUniqueOrThrow({
      where: { id: typedInPersian.id },
    });
    expect(storedUser.username).toBe(`sina.${n.english}`);
  });

  it("rewrites a deleted user's username even when an active user has its English-digit form", async () => {
    const n = freshNumber();
    await seedUser(`sina.${n.english}`, false);
    const deleted = await seedUser(`sina.${n.persian}`, true);

    await runMigration();

    const storedUser = await prisma.user.findUniqueOrThrow({
      where: { id: deleted.id },
    });
    expect(storedUser.username).toBe(`sina.${n.english}`);
  });

  it('leaves the audit log as it was recorded', async () => {
    const n = freshNumber();
    const entry = await prisma.auditLogEntry.create({
      data: {
        occurredAt: new Date('2026-01-01T00:00:00.000Z'),
        actorId: randomUUID(),
        actorName: 'سینا',
        recordType: 'Bom',
        recordId: randomUUID(),
        action: 'Edited',
        subjectField: 'trackingNumber',
        subjectValue: `TRK-${n.persian}`,
        changes: {
          create: {
            field: 'orderNumber',
            previousValue: `SO-${n.persian}`,
            newValue: `SO-${n.arabicIndic}`,
          },
        },
      },
    });
    cleanUps.push(() =>
      prisma.auditLogEntry.delete({ where: { id: entry.id } }),
    );

    await runMigration();

    const stored = await prisma.auditLogEntry.findUniqueOrThrow({
      where: { id: entry.id },
      include: { changes: true },
    });
    expect(stored.subjectValue).toBe(`TRK-${n.persian}`);
    expect(stored.changes[0]).toEqual(
      expect.objectContaining({
        previousValue: `SO-${n.persian}`,
        newValue: `SO-${n.arabicIndic}`,
      }),
    );
  });
});
