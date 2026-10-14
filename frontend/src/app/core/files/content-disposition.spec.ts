import { describe, expect, it } from 'vitest';

import { fileNameFromContentDisposition } from './content-disposition';

describe('fileNameFromContentDisposition', () => {
  it('decodes an RFC 5987 UTF-8 filename*', () => {
    const header =
      "attachment; filename*=UTF-8''%DA%AF%D8%B2%D8%A7%D8%B1%D8%B4-%D8%A2%D9%86%D8%A7%D9%84%DB%8C%D8%B2.xlsx";

    expect(fileNameFromContentDisposition(header)).toBe('گزارش-آنالیز.xlsx');
  });

  it('prefers filename* over a plain filename when both are present', () => {
    const header = `attachment; filename="report.xlsx"; filename*=UTF-8''%DA%AF.xlsx`;

    expect(fileNameFromContentDisposition(header)).toBe('گ.xlsx');
  });

  it('falls back to a quoted plain filename', () => {
    expect(fileNameFromContentDisposition('attachment; filename="report.xlsx"')).toBe(
      'report.xlsx',
    );
  });

  it('reads an unquoted plain filename', () => {
    expect(fileNameFromContentDisposition('attachment; filename=report.xlsx')).toBe('report.xlsx');
  });

  it('answers undefined when there is no header, or no file name in it', () => {
    expect(fileNameFromContentDisposition(null)).toBeUndefined();
    expect(fileNameFromContentDisposition('attachment')).toBeUndefined();
  });

  it('answers undefined rather than throwing on a malformed percent-encoding', () => {
    expect(fileNameFromContentDisposition("attachment; filename*=UTF-8''%E0%A4%A")).toBeUndefined();
  });
});
