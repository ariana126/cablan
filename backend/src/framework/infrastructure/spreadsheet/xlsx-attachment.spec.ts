import { xlsxAttachment } from './xlsx-attachment';

describe('xlsxAttachment', () => {
  it('serves the workbook as an .xlsx spreadsheet', () => {
    const sut = xlsxAttachment(Buffer.from('xlsx'), 'report.xlsx');

    expect(sut.getHeaders()).toMatchObject({
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      length: 4,
    });
  });

  it('names a Persian file with an RFC 5987 filename* and an ASCII fallback', () => {
    const sut = xlsxAttachment(
      Buffer.from('xlsx'),
      'گزارش-آنالیز-های-روزانه.xlsx',
    );

    expect(sut.getHeaders().disposition).toBe(
      'attachment; filename="?????-??????-???-??????.xlsx"; ' +
        "filename*=UTF-8''%DA%AF%D8%B2%D8%A7%D8%B1%D8%B4-%D8%A2%D9%86%D8%A7%D9%84%DB%8C%D8%B2-%D9%87%D8%A7%DB%8C-%D8%B1%D9%88%D8%B2%D8%A7%D9%86%D9%87.xlsx",
    );
  });
});
