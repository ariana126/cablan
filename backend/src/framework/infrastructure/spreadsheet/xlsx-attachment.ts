import { StreamableFile } from '@nestjs/common';
import contentDisposition from 'content-disposition';

export const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Wraps a rendered workbook as a download: the `.xlsx` content type, and a
 * `Content-Disposition: attachment` naming the file. A non-ASCII (Persian) name is carried in an
 * RFC 5987 `filename*`, with a `?`-substituted `filename` fallback for clients that ignore it.
 */
export function xlsxAttachment(
  workbook: Buffer,
  fileName: string,
): StreamableFile {
  return new StreamableFile(workbook, {
    type: XLSX_CONTENT_TYPE,
    disposition: contentDisposition(fileName),
    length: workbook.length,
  });
}
