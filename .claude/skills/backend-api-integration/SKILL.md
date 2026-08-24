---
name: backend-api-integration
description: How a frontend (or any HTTP client) integrates with the vom-back NestJS API — auth/2FA/token flow, request/response conventions, error shape, throttling, file upload. Use when building or debugging frontend code that calls this backend, or when asked how a given endpoint should be consumed.
metadata:
  source: .claude/artifacts/backend/API_REFERENCE.md
---

## Source of truth

`.claude/artifacts/backend/API_REFERENCE.md` has the exhaustive, per-endpoint
reference (every route, method, auth requirement, request/response DTO shape,
throttle limit) for every module. This skill is the *procedure* — the auth
flow, conventions, and gotchas that apply across all of them. Read the
reference doc for exact field names/types before wiring up a specific call;
don't guess a DTO shape from memory.

## Base setup

- Base URL: `http://localhost:<PORT>` (`PORT` env var, defaults to `3000`
  if unset). No API prefix — routes are mounted at the controller path
  directly (`/auth/login`, `/orders`, etc.), **not** under `/api`.
- Swagger/OpenAPI UI: `/api/docs`, only available when `NODE_ENV !==
  'production'`.
- All request bodies are JSON (`Content-Type: application/json`) **except**
  `POST /products` and `PATCH /products/:id`, which are
  `multipart/form-data` (photo upload) — see "File upload" below.
- The global `ValidationPipe` runs with `whitelist: true` +
  `forbidNonWhitelisted: true` + `transform: true`: any field not declared
  on the DTO is rejected with a 400, not silently dropped or ignored. Don't
  send extra/legacy fields "just in case" — they'll fail the request.

## Auth flow — read this before building any other page

This is the single most important thing to get right; every other endpoint
in the system (except the few marked `Public` in the reference doc) depends
on it.

### 1. Login

`POST /auth/login` with `{ login, password }`.

- If the account has **2FA not yet configured**: response is
  `{ requiresTwoFa: false, accessToken, refreshToken }` — you're fully
  logged in immediately.
- If the account **has 2FA configured**: response is
  `{ requiresTwoFa: true, pendingToken }` — no usable tokens yet. Show a
  "enter your 2FA code" screen, then call step 2.

### 2. Verify 2FA (only when `requiresTwoFa: true` from step 1)

`POST /auth/2fa/verify-login` with `{ pendingToken, code }` (`code` is
either the 6-digit TOTP code, or one of the one-time recovery codes shown at
setup time — both are accepted by the same field). Response:
`{ accessToken, refreshToken }`.

### 3. Store both tokens

There is no server-side session/cookie — the frontend is fully responsible
for holding onto both tokens (e.g. in memory + a persisted store) and
attaching the access token to every subsequent request:

```
Authorization: Bearer <accessToken>
```

- `accessToken` — JWT, expires in **15 minutes**.
- `refreshToken` — expires in **7 days**, and is single-use: each
  `POST /auth/refresh` call **rotates** it (returns a brand-new
  `accessToken` + `refreshToken` pair, and the old `refreshToken` becomes
  invalid immediately). Always overwrite your stored `refreshToken` with
  the new one from the response — never reuse an old one.
- Reusing an already-rotated `refreshToken` (e.g. two tabs refreshing off
  a stale copy) revokes the whole session server-side — the next call
  fails and the user must log in again. Design your refresh logic so only
  one refresh is ever in flight at a time (e.g. a mutex/shared promise),
  not one call per open tab/request.

### 4. The mandatory 2FA-setup gate — the #1 integration gotcha

**Every route in the system except a small allowlist requires the logged-in
user to have 2FA fully enabled** — this is enforced by a global guard on the
backend, not just a frontend routing convention. If the account doesn't have
2FA configured yet, calling anything outside that allowlist (even with a
perfectly valid `accessToken`) returns:

```
403 Forbidden — "Two-factor authentication setup is required before using this endpoint"
```

The allowlist (works with a valid `accessToken` even before 2FA is set up):
`POST /auth/2fa/setup`, `POST /auth/2fa/confirm`, `GET /auth/2fa/status`.

So: right after a first-time login (`requiresTwoFa: false` because the
account has no 2FA yet), don't route straight into the app — call
`GET /auth/2fa/status` first (or just attempt the intended route and catch
the 403), and if `twoFaEnabled: false`, force the user through setup before
anything else is usable:

1. `POST /auth/2fa/setup` (no body) → `{ qrCodeDataUrl, secret }`. Render
   `qrCodeDataUrl` as an `<img>` (it's already a full `data:image/png;base64,...`
   URI) for scanning into an authenticator app; show `secret` too for manual
   entry.
2. User scans/enters it, then submits the 6-digit code:
   `POST /auth/2fa/confirm` with `{ code }` → `{ recoveryCodes: string[] }`
   (10 codes). **Show these to the user once and tell them to save them —
   the backend never returns them again.** After this call, 2FA is enabled
   and every other route unlocks.

**Known quirk:** `POST /auth/logout` is *not* on the skip-gate allowlist —
if you build a "skip 2FA setup for now" escape hatch, don't put a logout
button behind it; the logout call itself will 403 until 2FA is configured.

### 5. Refreshing

When a request comes back `401` with an expired/invalid access token,
call `POST /auth/refresh` with `{ refreshToken }` → new
`{ accessToken, refreshToken }` pair, then retry the original request once.
If `/auth/refresh` itself fails (401), the session is gone — clear stored
tokens and send the user back to login.

### 6. Logout

`POST /auth/logout` (no body, needs a valid `Authorization` header) → `204
No Content`. Invalidates the stored refresh-token session server-side.
Clear both tokens client-side regardless of the response.

## Standard conventions across every other module

- **Pagination.** Any list endpoint accepts `page` (default `1`) and
  `pageSize` (default `10`, max `100`) as query params, and returns
  `{ items: T[], total: number }` — `total` is the count over the full
  filtered set, not just the current page (matters for building pagination
  controls).
- **Date-range filters.** Where present (`Orders`, `CRM`, `Dashboard`),
  `dateFrom`/`dateTo` are ISO date strings (`class-validator`'s
  `@IsDateString()`), applied against each resource's `createdAt`, inclusive
  on both ends.
- **IDs.** Every `:id` path param and every `xxxId` reference field is a
  MongoDB ObjectId string. An `:id` that isn't a syntactically valid
  ObjectId is rejected with a 400 before it ever reaches a DB query
  (`ParseObjectIdPipe`) — a well-formed-but-nonexistent id gets a 404
  instead. Don't rely on catching a specific error message to distinguish
  "malformed" vs. "not found"; check the status code.
- **Dictionaries (довідники) are the source of every "select" field.**
  `orderTypeId`, `shipmentTypeId`, `paymentTypeId`, `deliveryTypeId`,
  `productTypeId` (on order items), `typeId` (on products/expenses) are all
  real ObjectIds referencing `GET /dictionaries/*` collections — never
  hardcode these as string enums client-side; fetch the relevant
  dictionary once (they rarely change) and build selects from `{id, code,
  label}`.
- **Auto-computed fields are never client-supplied.** `totalAmount` on
  Orders, `stockQuantity` decrements, `nameSnapshot`/`photoUrlSnapshot`/
  `subtotal` on order line items, Cloudinary `photoUrl` — all of these are
  derived server-side from other fields (item prices, product lookups,
  the uploaded file). Sending them yourself either does nothing (rejected
  by `forbidNonWhitelisted`) or isn't accepted as input in the first place.

## Error response shape

Every error (validation, business-rule 400s, 401/403/404/409/429/502,
uncaught 500s) comes back through one global filter with the same JSON
envelope:

```json
{
  "statusCode": 400,
  "path": "/orders",
  "timestamp": "2026-08-24T12:00:00.000Z",
  "message": "..." 
}
```

`message` is usually a string, but for `class-validator` failures on a
`ValidationPipe` rejection it's an **array of strings** (one per failed
field) — handle both shapes when rendering form errors. There is no
machine-readable error `code` field — branch on `statusCode` plus, where you
need to distinguish cases with the same status, the literal `message` text
(the reference doc lists the exact strings each endpoint can throw).

## Throttling (429s)

Several routes — anything that calls the real Nova Poshta API, plus
`/auth/*` — carry a tighter per-route rate limit on top of the app-wide
default (60 requests/minute per IP). Hitting a limit returns `429 Too Many
Requests`. The per-route limits are in the reference doc; the practical
implication is: don't poll these routes tightly, and surface a friendly
"too many attempts, try again in a minute" message rather than silently
retrying in a loop.

Note `/auth/login` and `/auth/2fa/verify-login` are throttled by IP (10
req/min) **and** separately locked per-account after 10 failed attempts in
15 minutes (`429` either way) — a build-a-retry-button UI is fine, an
auto-retry loop is not.

## File upload (Products only)

`POST /products` and `PATCH /products/:id` take `multipart/form-data`, not
JSON:

- File field name must be exactly `photo`.
- Accepted types: `image/jpeg`, `image/png`, `image/webp` only (checked by
  real magic-number sniffing server-side, not just the file extension or
  the browser-reported MIME type — renaming a `.txt` to `.png` won't pass).
- Max size: 5 MB.
- On create, `photo` is **required**; on update it's optional (omit it to
  keep the existing photo).
- All other `CreateProductDto`/`UpdateProductDto` fields go in the same
  form body as regular form fields (not JSON-stringified) — e.g. with
  `FormData` in the browser: `formData.append('photo', file);
  formData.append('typeId', typeId); formData.append('price', String(price));`
  etc.

## Quick sanity checklist when a new frontend call misbehaves

1. `401` → missing/expired/malformed `Authorization: Bearer <token>`, or the
   route needs the header and it wasn't sent at all (not on the `Public`
   allowlist — check the reference doc).
2. `403` with the 2FA message → the logged-in user hasn't completed 2FA
   setup yet; check `GET /auth/2fa/status` and route to setup.
3. `400` → check the exact `message` array against the DTO in the
   reference doc — almost always a missing required field, wrong type, or
   an extra field not declared on the DTO (`forbidNonWhitelisted`).
4. `404` on a route with an `:id` → the id is well-formed but no such
   document exists (already deleted, wrong id, etc.).
5. `429` → rate-limited; back off, don't retry immediately.
6. `502` (Orders create/update/delete only) → the local database change
   already succeeded, but the paired real Nova Poshta waybill
   create/update/delete call failed and could not be reliably compensated —
   this needs manual follow-up in Nova Poshta, not just a client-side retry
   of the same request (retrying will likely just create/touch a second
   waybill).
