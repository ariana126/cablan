# Identity (`src/modules/identity/`)

Users, login and access tokens. A `User` is a name, a case-sensitive `Username`, a bcrypt password
hash, one `Role` (`@framework/domain`) and a soft-delete flag. This module issues the JWT; the
framework verifies it. Follows the vertical-slice layout in `backend/CLAUDE.md`'s "Architecture"
section.

## Endpoints

| Route | Guard | Does |
|---|---|---|
| `POST /auth/login` | none, `@Throttle` 5/min | `{ accessToken }` for a username and password |
| `POST /users` | `@Roles(SystemAdmin)` | register a user → `{ id }` (201) |
| `PATCH /users/:id` | `@Roles(SystemAdmin)` | edit name, username, password and/or role (204) |
| `DELETE /users/:id` | `@Roles(SystemAdmin)` | soft delete (204) |
| `GET /users` | `@Roles(SystemAdmin)` | every non-deleted user |
| `GET /users/me` | `JwtAuthGuard` only | the caller's own `{ id, name, username, role }` |

`GET /users/me` exists because the token carries no role: it is the only way the client learns
what to show. It is a 404, not the user, for a soft-deleted caller whose token has not yet expired.

## The token carries only `sub`

`LoginHandler` issues `{ sub: userId }` through the `AccessTokenIssuer` port, bound to
`JwtTokenService`, which signs with the one `JwtService` `AuthModule` configures (secret, 1h
expiry) — never a second `JwtModule.register`, so issuance and verification share a secret. It
stamps `iat` from the injected `Clock`, because `JwtAuthGuard` checks expiry against that same
clock: an `iat` from real time could never expire under the test stack's pinned `TunableClock`.

No role, name or username is ever a claim. A role can change, or the account be deleted, inside
the token's hour, so everything that needs them looks them up per request through the ports below.

Login failures all collapse to one `InvalidCredentials` (401) with one message: unknown username,
wrong password and a deleted account are indistinguishable, since `findByUsername` excludes deleted
users. `AuthController.login` is `@Throttle({ default: { limit: 5, ttl: 60_000 } })`, the one
unauthenticated, brute-forceable endpoint; like every throttle it is inert on the test stack, where
no `ThrottlerGuard` is registered.

## The framework ports this module binds

`IdentityModule` is `@Global()` and exports three framework ports, so their consumers resolve them
without importing this module (`src/framework/CLAUDE.md`, "Ports here, bindings in a module"):

| Port | Binding | Used by |
|---|---|---|
| `UserRoleProvider` | `IdentityUserRoleProvider` — `find` + `deleted()` check, so a deleted user has no role | `RolesGuard`, on every `@Roles` route |
| `DisplayNameProvider` | `IdentityDisplayNameProvider` — `UserRepository.get`, then `displayName()` | `boms`' `registeredBy`/`approvedBy`, `audit-logging`'s `actorName` |
| `PostTruncateHook` | `DefaultAdminSeeder`, via `useExisting` | `TestingService.truncateAll()` |

The two user lookups deliberately differ. `getRole` treats a soft-deleted user as absent, so a
deleted account loses every `@Roles` route at once. `getName` uses `get`, which does not filter on
`isDeleted`: a deleted user still has a name, and throws `EntityNotFound` (404) only when the row is
gone entirely. `@Global()` exists for these bindings, not as licence for other modules to import
this one.

## `DefaultAdminSeeder` (`infrastructure/bootstrap/`)

Ensures a System Admin named "System Admin" exists, with `DEFAULT_ADMIN_USERNAME` and
`DEFAULT_ADMIN_PASSWORD` (both `ConfigService.getOrThrow`). It is how the first login on an empty
database works, with no bypass endpoint: everyone else is registered through `POST /users`.

- **When it runs.** `main.ts` calls `seed()` after `app.listen()`, and `run()` (the
  `PostTruncateHook`) calls it again after every `POST /testing/truncate`, which the test stack
  would otherwise survive with no admin.
- **Not a lifecycle hook, on purpose.** `OnApplicationBootstrap` fires on `app.init()` too, which
  the Swagger generator calls with no database behind it.
- **"Exists" means an active user with that username.** Soft-delete the admin, or rename its
  username, and the next boot or truncate creates a fresh one. The password is never reset on an
  existing account.
- **A database that isn't ready is not fatal.** Prisma `P2021` (table missing — an unmigrated
  database, the normal state on a fresh volume before `make migrate` or the test runner's migrate
  call) and `PrismaClientInitializationError` are logged as a warning and skipped; the next
  truncate or boot retries. Anything else — a missing env var above all — propagates and kills the
  process after `listen()`.
- **It writes no audit entry.** There is no actor in context at boot or after a truncate, so
  `audit-logging`'s projector skips it.

## Users

- **Username is case-sensitive and untrimmed** (`Username.fromString` only rejects a blank value) —
  "Sina.Q" and "sina.q" are two users, per the login feature.
- **Usernames are unique among active users only.** A soft-deleted user's username is free to reuse.
  The handlers check through `findByUsername` (409 `UsernameAlreadyExists`, carrying `username`);
  the database backstop is a partial unique index `WHERE is_deleted = false`, hand-added to the
  `add_identity_user` migration because Prisma's DSL cannot express it. `PrismaUserRepository` does
  not translate that index's P2002, so a race past the pre-check is a 500, unlike `products`'
  material codes.
- **Delete is soft.** `User.delete()` sets the flag and `save()` persists it; the row stays so
  history can still name the user. There is no `delete` on `UserRepository`.
- **An admin cannot change their own role** — `CannotChangeOwnRole` (409, carrying `userId`) is
  thrown whenever a `PATCH /users/:id` on oneself carries a `role` at all, even an unchanged one,
  and before anything is loaded, so nothing else in that request is applied either. A self-edit
  must omit `role`.
- **`User.edit()` records one `UserEdited` with only the fields that really changed**, and none for
  a no-op. A password change records `UserPasswordChanged` instead, which carries no password
  material and which `audit-logging` deliberately does not subscribe to.
- **A blank-but-not-empty username is a 500.** The DTOs only `@IsNotEmpty()` it, and the
  controller builds a `Username` from it, so `"   "` reaches `Username.fromString`'s plain `Error`.

## Exceptions

`IdentityExceptionMapper` (`infrastructure/http/exception.mapper.ts`) maps the module's three:
`UsernameAlreadyExists` → 409 `username-already-exists`, `CannotChangeOwnRole` → 409
`cannot-change-own-role`, `InvalidCredentials` → 401 `invalid-credentials`. An unknown `:id` is the
framework's 404 `entity-not-found`; a missing or wrong role is `RolesGuard`'s 403.

## Persistence

`prisma/schema/identity.prisma`: one `User` model mapped to `app_user` (`user` is awkward in
Postgres), with `role` a plain string read back with a cast. `PrismaUserRepository` stays on
`txHost.tx` for every query, `findByUsername` included, because the audit projector's actor-name
lookup reaches it from inside other modules' write transactions.
