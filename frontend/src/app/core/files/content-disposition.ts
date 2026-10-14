/**
 * The file name a `Content-Disposition` header carries, or `undefined` when it carries none.
 *
 * An RFC 6266 `filename*` (RFC 5987, `UTF-8''<percent-encoded>`) wins over a plain `filename`, as
 * the RFC asks — it is the only form that can carry a Persian name, and the API sends every export
 * that way. Hand-written rather than a package: the established `content-disposition` package is a
 * Node module (it pulls in `path` and `safe-buffer`), and only this one read-side lookup is needed.
 */
export function fileNameFromContentDisposition(header: string | null): string | undefined {
  if (header === null) {
    return undefined;
  }

  const extended = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header);
  if (extended) {
    try {
      return decodeURIComponent(extended[1].trim());
    } catch {
      return undefined;
    }
  }

  const plain = /filename\s*=\s*(?:"([^"]*)"|([^;]+))/i.exec(header);
  return plain ? (plain[1] ?? plain[2].trim()) : undefined;
}
