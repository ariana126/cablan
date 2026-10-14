import { HttpResponse } from '@angular/common/http';

import { fileNameFromContentDisposition } from './content-disposition';

/** A file the API produced, ready to hand to `FileSaver`. */
export interface DownloadedFile {
  readonly blob: Blob;
  readonly fileName: string;
}

/** Names the response body after its `Content-Disposition`, or `fallbackFileName` when the header
 * is absent or names nothing — the API always sends one, but a file must never go unnamed. */
export function toDownloadedFile(
  response: HttpResponse<Blob>,
  fallbackFileName: string,
): DownloadedFile {
  return {
    blob: response.body ?? new Blob(),
    fileName:
      fileNameFromContentDisposition(response.headers.get('Content-Disposition')) ??
      fallbackFileName,
  };
}
