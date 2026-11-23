/**
 * A new submission's id (issue #132): a random UUID v4, drawn once per «ثبت انجام» and sent again
 * unchanged on «ارسال دوباره», which is how the API knows a resend from a new submission.
 *
 * `crypto.randomUUID` exists only in a secure context (https or localhost); the app opened over
 * plain http on the factory network would lack it, so the same UUID is built from
 * `crypto.getRandomValues`, which every context has.
 */
export function newSubmissionId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
