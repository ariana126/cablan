import { Identity } from '@framework/domain';
// The handlers' in-memory fakes: this domain service works through the same
// repository ports.
import { InMemoryMaterialImportRepository } from '@products/application/support/in-memory-material-import-repository';
import { InMemoryMaterialRepository } from '@products/application/support/in-memory-material-repository';
import { InMemoryProductRepository } from '@products/application/support/in-memory-product-repository';

import { MaterialImportReverted } from '../events/material-import-reverted.event';
import { MaterialRestoredBeforeImport } from '../events/material-restored-before-import.event';
import { MaterialWithdrawnByImport } from '../events/material-withdrawn-by-import.event';
import { MaterialImportAlreadyReverted } from '../exceptions/material-import-already-reverted.exception';
import { MaterialImportNotLatest } from '../exceptions/material-import-not-latest.exception';
import { MaterialImportNotRevertible } from '../exceptions/material-import-not-revertible.exception';
import { Material } from '../material.aggregate';
import { MaterialImport } from '../material-import.aggregate';
import { Product } from '../product.aggregate';
import { MaterialCode } from '../value/material-code.vo';
import { MaterialImportChange } from '../value/material-import-change.vo';
import { MaterialName } from '../value/material-name.vo';
import { ProductComponentLine } from '../value/product-component-line.vo';
import { ProductMaterialLine } from '../value/product-material-line.vo';
import { ProductName } from '../value/product-name.vo';
import { MaterialImportReversion } from './material-import-reversion';

const IMPORTED_AT = new Date('2026-10-29T08:00:00.000Z');
const NOW = new Date('2026-10-29T09:00:00.000Z');

function makeSut() {
  const materials = new InMemoryMaterialRepository();
  const imports = new InMemoryMaterialImportRepository();
  const products = new InMemoryProductRepository();
  const sut = new MaterialImportReversion(imports, materials, products);
  return { sut, materials, imports, products };
}

type Context = ReturnType<typeof makeSut>;

function seedMaterial(context: Context, name: string, code: string): Material {
  return context.materials.seed(
    Material.register(
      MaterialName.fromString(name),
      MaterialCode.fromString(code),
    ),
  );
}

/**
 * The state after an import registered «آلومینیوم» (A-1), moved «مسی» from
 * M-101 to M-201 and renamed «برنج» (B-1) to «برنج زرد»; «قلع» untouched.
 */
function afterAnImport(context: Context) {
  const aluminium = seedMaterial(context, 'آلومینیوم', 'A-1');
  const copper = seedMaterial(context, 'مسی', 'M-201');
  const brass = seedMaterial(context, 'برنج زرد', 'B-1');
  seedMaterial(context, 'قلع', 'T-1');
  const materialImport = context.imports.seed(
    MaterialImport.fromPersistence(
      Identity.new(),
      [
        MaterialImportChange.registration(aluminium.id, 'آلومینیوم', 'A-1'),
        MaterialImportChange.codeChange(copper.id, 'مسی', 'M-101', 'M-201'),
        MaterialImportChange.rename(brass.id, 'B-1', 'برنج', 'برنج زرد'),
      ],
      IMPORTED_AT,
      null,
    ),
  );
  return { materialImport, aluminium, copper, brass };
}

function seedOtherImport(
  context: Context,
  importedAt: Date,
  revertedAt: Date | null = null,
): MaterialImport {
  return context.imports.seed(
    MaterialImport.fromPersistence(
      Identity.new(),
      [MaterialImportChange.registration(Identity.new(), 'روی', 'Z-1')],
      importedAt,
      revertedAt,
    ),
  );
}

async function materialsOf(context: Context) {
  const all = await context.materials.list();
  return all.map((each) => [each.name().asString(), each.code().asString()]);
}

async function refusalOf(revert: Promise<void>): Promise<string> {
  try {
    await revert;
  } catch (error) {
    if (error instanceof MaterialImportNotRevertible) return error.reason;
    throw error;
  }
  throw new Error('expected the reversion to be refused');
}

const STATE_AFTER_IMPORT = [
  ['آلومینیوم', 'A-1'],
  ['مسی', 'M-201'],
  ['برنج زرد', 'B-1'],
  ['قلع', 'T-1'],
];

describe('MaterialImportReversion', () => {
  it('undoes every change of the import', async () => {
    const context = makeSut();
    const { materialImport } = afterAnImport(context);

    await context.sut.revert(materialImport, NOW);

    expect(await materialsOf(context)).toEqual([
      ['مسی', 'M-101'],
      ['برنج', 'B-1'],
      ['قلع', 'T-1'],
    ]);
  });

  it('marks the import reverted, recording its MaterialImportReverted', async () => {
    const context = makeSut();
    const { materialImport } = afterAnImport(context);

    await context.sut.revert(materialImport, NOW);

    expect(materialImport.revertedAt()).toEqual(NOW);
    expect(materialImport.releaseEvents()).toEqual([
      new MaterialImportReverted(
        materialImport.id.asString(),
        materialImport.changes().map((change) => change.snapshot()),
      ),
    ]);
  });

  it('withdraws and restores the materials through their import-specific events only', async () => {
    const context = makeSut();
    const { materialImport, aluminium, copper, brass } = afterAnImport(context);

    await context.sut.revert(materialImport, NOW);

    expect(context.materials.dispatchedEvents()).toEqual([
      new MaterialWithdrawnByImport(
        aluminium.id.asString(),
        'آلومینیوم',
        'A-1',
      ),
      new MaterialRestoredBeforeImport(
        copper.id.asString(),
        'مسی',
        'M-201',
        'مسی',
        'M-101',
      ),
      new MaterialRestoredBeforeImport(
        brass.id.asString(),
        'برنج زرد',
        'B-1',
        'برنج',
        'B-1',
      ),
    ]);
  });

  it('refuses an import already reverted', async () => {
    const context = makeSut();
    const { materialImport } = afterAnImport(context);
    await context.sut.revert(materialImport, NOW);

    await expect(
      context.sut.revert(materialImport, NOW),
    ).rejects.toBeInstanceOf(MaterialImportAlreadyReverted);
  });

  it('refuses an import while a later one is still in place', async () => {
    const context = makeSut();
    const { materialImport } = afterAnImport(context);
    seedOtherImport(context, NOW);

    await expect(
      context.sut.revert(materialImport, NOW),
    ).rejects.toBeInstanceOf(MaterialImportNotLatest);
  });

  it('refuses an earlier import recorded at the same instant as a later one', async () => {
    const context = makeSut();
    const { materialImport } = afterAnImport(context);
    seedOtherImport(context, IMPORTED_AT);

    await expect(
      context.sut.revert(materialImport, NOW),
    ).rejects.toBeInstanceOf(MaterialImportNotLatest);
  });

  it('reverts an import once the later one has been reverted', async () => {
    const context = makeSut();
    const { materialImport } = afterAnImport(context);
    seedOtherImport(context, NOW, NOW);

    await context.sut.revert(materialImport, NOW);

    expect(materialImport.isReverted()).toBe(true);
  });

  it('refuses, changing nothing, once a product uses a material the import registered', async () => {
    const context = makeSut();
    const { materialImport, aluminium } = afterAnImport(context);
    context.products.seed(
      Product.register(ProductName.fromString('کابل'), [
        ProductComponentLine.of(Identity.new(), 'هادی', [
          ProductMaterialLine.of(aluminium.id, 'آلومینیوم'),
        ]),
      ]),
    );

    const reason = await refusalOf(context.sut.revert(materialImport, NOW));

    expect(reason).toBe('material-in-use');
    expect(await materialsOf(context)).toEqual(STATE_AFTER_IMPORT);
    expect(materialImport.isReverted()).toBe(false);
  });

  it('stays revertible when a product uses a material the import only renamed', async () => {
    const context = makeSut();
    const { materialImport, brass } = afterAnImport(context);
    context.products.seed(
      Product.register(ProductName.fromString('کابل'), [
        ProductComponentLine.of(Identity.new(), 'هادی', [
          ProductMaterialLine.of(brass.id, 'برنج زرد'),
        ]),
      ]),
    );

    await context.sut.revert(materialImport, NOW);

    expect(materialImport.isReverted()).toBe(true);
  });

  it('refuses once a material the import touched was deleted', async () => {
    const context = makeSut();
    const { materialImport, copper } = afterAnImport(context);
    await context.materials.delete(copper);

    const reason = await refusalOf(context.sut.revert(materialImport, NOW));

    expect(reason).toBe('material-changed');
  });

  it('refuses once a material the import touched was renamed since', async () => {
    const context = makeSut();
    const { materialImport, brass } = afterAnImport(context);
    brass.edit({
      name: MaterialName.fromString('برنج سفید'),
      code: MaterialCode.fromString('B-1'),
    });

    const reason = await refusalOf(context.sut.revert(materialImport, NOW));

    expect(reason).toBe('material-changed');
  });

  it('refuses once a material the import touched had its code changed since', async () => {
    const context = makeSut();
    const { materialImport, copper } = afterAnImport(context);
    copper.edit({
      name: MaterialName.fromString('مسی'),
      code: MaterialCode.fromString('M-301'),
    });

    const reason = await refusalOf(context.sut.revert(materialImport, NOW));

    expect(reason).toBe('material-changed');
  });

  it('refuses, changing nothing, when a code to restore is now held by another material', async () => {
    const context = makeSut();
    const { materialImport } = afterAnImport(context);
    seedMaterial(context, 'سرب', 'M-101');

    const reason = await refusalOf(context.sut.revert(materialImport, NOW));

    expect(reason).toBe('value-taken');
    expect(await materialsOf(context)).toEqual([
      ...STATE_AFTER_IMPORT,
      ['سرب', 'M-101'],
    ]);
  });

  it('refuses when a name to restore is now held by another material', async () => {
    const context = makeSut();
    const { materialImport } = afterAnImport(context);
    seedMaterial(context, 'برنج', 'B-9');

    const reason = await refusalOf(context.sut.revert(materialImport, NOW));

    expect(reason).toBe('value-taken');
  });
});
