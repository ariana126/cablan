/**
 * A structurally valid but unsigned JWT, issued at `issuedAt` (seconds since the epoch, by the
 * *server's* clock) and valid for `lifetimeSeconds` — i.e. carrying `iat` and `exp = iat + lifetime`.
 * `subject` tells two otherwise identical tokens apart. For specs and the accessibility audit only:
 * nothing in the app imports it, and the signature segment is a placeholder, since only the API ever
 * verifies one. Kept dependency-free so `a11y/` can import it.
 */
export function fakeAccessToken({
  subject = '1',
  lifetimeSeconds = 3600,
  issuedAt = Math.floor(Date.now() / 1000),
}: { subject?: string; lifetimeSeconds?: number; issuedAt?: number } = {}): string {
  return unsignedJwt({ sub: subject, iat: issuedAt, exp: issuedAt + lifetimeSeconds });
}

/** An unsigned JWT carrying exactly `payload` — for a token missing or mangling a claim. */
export function unsignedJwt(payload: object): string {
  return [{ alg: 'HS256', typ: 'JWT' }, payload]
    .map((part) => base64Url(JSON.stringify(part)))
    .concat('signature')
    .join('.');
}

function base64Url(text: string): string {
  return btoa(text).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}
