/**
 * The text an equipment's QR code carries (issue #119): `CABLAN-EQ:<equipment uuid>`. Plain text,
 * not a URL, so a phone's own camera app shows it as text and opens nothing; and the id, which a
 * rename never changes, so a printed sticker stays valid after a rename or a fresh download.
 *
 * The frontend is the format's one owner — it prints it (`/equipment`'s «دانلود QR تجهیز») and reads
 * it (`/qc-inspection`'s scanner). The backend only ever sees the id.
 */
const PREFIX = 'CABLAN-EQ:';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function equipmentQrPayload(equipmentId: string): string {
  return `${PREFIX}${equipmentId}`;
}

/** The equipment id a scanned text names, or `undefined` when it is not one of ours. */
export function equipmentIdInQrPayload(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed.startsWith(PREFIX)) {
    return undefined;
  }
  const id = trimmed.slice(PREFIX.length);
  return UUID.test(id) ? id.toLowerCase() : undefined;
}
