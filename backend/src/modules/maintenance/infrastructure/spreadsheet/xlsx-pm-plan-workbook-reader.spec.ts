import { PmPlanImportFileUnreadable } from '@maintenance/application/exceptions';
import writeXlsxFile from 'write-excel-file/node';

import { XlsxPmPlanWorkbookReader } from './xlsx-pm-plan-workbook-reader';

describe('XlsxPmPlanWorkbookReader', () => {
  it('reads every sheet by name, in workbook order, blank rows and cells kept and a date cell as a date', async () => {
    const workbook = await writeXlsxFile([
      { sheet: 'راهنما', data: [['این برگه راهنماست']] },
      {
        sheet: 'pm',
        data: [
          ['تجهیز', 'اولین موعد', 'تعویض روغن'],
          [null, null, 30],
          [
            'کمپرسور هوا',
            {
              type: Date,
              value: new Date(Date.UTC(2026, 10, 21)),
              format: 'yyyy/mm/dd',
            },
            '+',
          ],
        ],
      },
    ]).toBuffer();
    const sut = new XlsxPmPlanWorkbookReader();

    const sheets = await sut.sheetsOf(workbook);

    expect(sheets).toEqual([
      { name: 'راهنما', cells: [['این برگه راهنماست']] },
      {
        name: 'pm',
        cells: [
          ['تجهیز', 'اولین موعد', 'تعویض روغن'],
          [null, null, 30],
          ['کمپرسور هوا', new Date(Date.UTC(2026, 10, 21)), '+'],
        ],
      },
    ]);
  });

  it('a file that is not an xlsx workbook is unreadable', async () => {
    const sut = new XlsxPmPlanWorkbookReader();

    await expect(
      sut.sheetsOf(Buffer.from('تجهیز,اولین موعد')),
    ).rejects.toBeInstanceOf(PmPlanImportFileUnreadable);
  });
});
