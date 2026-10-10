/**
 * A structurally valid but unsigned JWT whose `exp` lies `secondsFromNow` seconds away — negative
 * for one that has already expired. For specs only: nothing in the app imports it, and the
 * signature segment is a placeholder, since only the API ever verifies one.
 */
export function fakeAccessToken(secondsFromNow: number): string {
  const exp = Math.floor(Date.now() / 1000) + secondsFromNow;

  return [
    { alg: 'HS256', typ: 'JWT' },
    { sub: '1', exp },
  ]
    .map((part) => base64Url(JSON.stringify(part)))
    .concat('signature')
    .join('.');
}

function base64Url(text: string): string {
  return btoa(text).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}
