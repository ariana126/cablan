import { MaterialImportFileUnreadable } from '@products/application/exceptions';
import { SheetCell } from '@products/application/service/material-import-sheet';
import { InMemoryMaterialRepository } from '@products/application/support/in-memory-material-repository';
import { StubMaterialImportSheetReader } from '@products/application/support/stub-material-import-sheet-reader';
import { Material } from '@products/domain/material.aggregate';
import { MaterialCode } from '@products/domain/value/material-code.vo';
import { MaterialName } from '@products/domain/value/material-name.vo';

import {
  MaterialImportPreview,
  MaterialImportPreviewChange,
} from './material-import-preview.read-model';
import { PreviewMaterialImportHandler } from './preview-material-import.handler';
import { PreviewMaterialImportQuery } from './preview-material-import.query';

const FILE = Buffer.from('xlsx');

function accountingExport(...items: [string, string][]): SheetCell[][] {
  return [
    [null, null, null, null, null],
    ['ردیف', 'نوع', 'کد کالا', 'نام کالا', 'واحد'],
    ...items.map(([code, name], index) => [
      index + 1,
      'کالا',
      code,
      name,
      'kg',
    ]),
  ];
}

function makeSut(reader: StubMaterialImportSheetReader) {
  const materialRepository = new InMemoryMaterialRepository();
  const copper = materialRepository.seed(
    Material.register(
      MaterialName.fromString('مسی'),
      MaterialCode.fromString('M-101'),
    ),
  );
  const sut = new PreviewMaterialImportHandler(reader, materialRepository);
  return { sut, materialRepository, copper };
}

describe('PreviewMaterialImportHandler', () => {
  it('lists the changes the file would make, by Excel row number', async () => {
    const { sut, copper } = makeSut(
      StubMaterialImportSheetReader.holding(
        accountingExport(['A-1', 'آلومینیوم'], ['M-201', 'مسی']),
      ),
    );

    const result = await sut.execute(new PreviewMaterialImportQuery(FILE));

    expect(result).toEqual(
      new MaterialImportPreview([
        new MaterialImportPreviewChange(
          3,
          'register',
          'آلومینیوم',
          'A-1',
          null,
          null,
          null,
          [],
        ),
        new MaterialImportPreviewChange(
          4,
          'changeCode',
          'مسی',
          'M-201',
          copper.id.asString(),
          'مسی',
          'M-101',
          [],
        ),
      ]),
    );
  });

  it('an unchanged row is not listed', async () => {
    const { sut } = makeSut(
      StubMaterialImportSheetReader.holding(accountingExport(['M-101', 'مسی'])),
    );

    const result = await sut.execute(new PreviewMaterialImportQuery(FILE));

    expect(result.changes).toEqual([]);
  });

  it('applies nothing', async () => {
    const { sut, materialRepository } = makeSut(
      StubMaterialImportSheetReader.holding(
        accountingExport(['A-1', 'آلومینیوم'], ['M-201', 'مسی']),
      ),
    );

    await sut.execute(new PreviewMaterialImportQuery(FILE));

    const materials = await materialRepository.list();
    expect(
      materials.map((each) => [each.name().asString(), each.code().asString()]),
    ).toEqual([['مسی', 'M-101']]);
  });

  it('a file that is not a spreadsheet is unreadable', async () => {
    const { sut } = makeSut(StubMaterialImportSheetReader.unreadable());

    await expect(
      sut.execute(new PreviewMaterialImportQuery(FILE)),
    ).rejects.toBeInstanceOf(MaterialImportFileUnreadable);
  });

  it('a spreadsheet without the item header row is unreadable', async () => {
    const { sut } = makeSut(
      StubMaterialImportSheetReader.holding([
        ['ردیف', 'واحد'],
        [1, 'kg'],
      ]),
    );

    await expect(
      sut.execute(new PreviewMaterialImportQuery(FILE)),
    ).rejects.toBeInstanceOf(MaterialImportFileUnreadable);
  });
});
