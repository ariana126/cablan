import type { ApiResponseOptions } from '@nestjs/swagger';

import { XLSX_CONTENT_TYPE } from '../../spreadsheet/xlsx-attachment';

/** The `@ApiOkResponse` of an endpoint answering with an `.xlsx` download built by
 * `xlsxAttachment`: a binary body and a `Content-Disposition: attachment` naming the file. */
export function xlsxDownloadResponse(fileName: string): ApiResponseOptions {
  return {
    description: `The \`.xlsx\` workbook, as an attachment named \`${fileName}\``,
    content: {
      [XLSX_CONTENT_TYPE]: { schema: { type: 'string', format: 'binary' } },
    },
    headers: {
      'Content-Disposition': {
        description: `\`attachment\`, the file name carried as an RFC 5987 \`filename*\` (UTF-8): ${fileName}`,
        schema: { type: 'string' },
      },
    },
  };
}
