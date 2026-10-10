/**
 * The `localStorage` keys holding the bearer token and the moment this browser received it.
 *
 * They live in their own dependency-free module so the accessibility audit can import them. `a11y/`
 * sits outside `tsconfig.app.json` and runs in Node under Playwright, so it can only import a file
 * that pulls in no Angular runtime — which is exactly what this one is. The alternative was retyping
 * the literals in a second place that nothing keeps in sync.
 */
export const ACCESS_TOKEN_STORAGE_KEY = 'cablan.accessToken';

/**
 * When the token was received, as this browser's own `Date.now()` — the clock its expiry is measured
 * against. See `SessionStore` for why the token's own `exp` is not.
 */
export const ACCESS_TOKEN_RECEIVED_AT_STORAGE_KEY = 'cablan.accessTokenReceivedAt';
