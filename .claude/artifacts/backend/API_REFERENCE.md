# vom-back — Architecture & API Reference

Canonical reference for how `vom-back` is built and how every client-facing
endpoint works. Field-level frontend page specs live in
`.claude/artifacts/frontend/VOM_SYSTEMS.md`; the MongoDB schema lives in
`.claude/artifacts/data-base/DATA-BASE.md`. This document is the bridge
between them: what HTTP surface the backend actually exposes, module by
module. `.claude/skills/backend-api-integration/SKILL.md` covers the
cross-cutting *procedure* (auth flow, conventions, error shape) — this doc
is the exhaustive per-endpoint reference it points to.

## 1. Tech stack & runtime

- **Framework:** NestJS 11 (`@nestjs/common`/`core` ^11), TypeScript.
- **Database:** MongoDB via Prisma Client ^6.19 (pinned — not v7).
- **Auth:** hand-written `JwtService`-based guard (no Passport), Argon2id
  password hashing, TOTP 2FA (`otplib` v13) + 10 SHA-256-hashed recovery
  codes, stateful/rotating refresh tokens.
- **File storage:** Cloudinary (product photos only).
- **External API:** Nova Poshta (`api.novaposhta.ua`) — sender verification,
  address lookups, waybill create/update/delete, shipment status.
- **Validation:** global `class-validator`/`class-transformer`
  `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`).
- **Docs:** `@nestjs/swagger`, served at `/api/docs` outside production.
- **Rate limiting:** `@nestjs/throttler`, app-wide default 60 req/min/IP,
  tighter per-route limits on Nova-Poshta-calling and auth routes.
- **Tests:** Jest (unit, colocated `*.spec.ts`) + a real e2e suite against
  a live Atlas dev database (`test/*.e2e-spec.ts`).

### Required environment variables (`.env`)

| Variable | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | Prisma | MongoDB Atlas connection string |
| `JWT_SECRET` | Auth | Fails fast at boot if unset |
| `ENCRYPTION_KEY` | `EncryptionService` | 64-char hex (32 bytes), AES-256-GCM — encrypts `Sender.apiKey`, `User.twoFaSecret` at rest |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Products photo upload | |
| `NP_TEST_API_KEY` | e2e tests only | Not read by app code at runtime |
| `PORT` | `main.ts` | Optional, defaults to `3000` |
| `NODE_ENV` | `main.ts` | Swagger only mounts when this is **not** `'production'` |

### Running it

```
npm run start:dev        # dev server, watch mode
npm run create-admin     # standalone CLI to create the first User (never via prisma/seed.ts)
npx prisma db seed       # seeds all 7 dictionary collections
npm test                 # unit tests
npm run test:e2e         # e2e tests (needs NODE_OPTIONS=--experimental-vm-modules, already in the script)
```

## 2. Module map

```
src/
├── auth/            login, 2FA (setup/confirm/verify), refresh, logout — global auth guard lives here
├── senders/         Nova Poshta sender accounts (one active at a time)
├── products/        catalog products (Cloudinary photo upload)
├── orders/          order wizard, Nova Poshta waybill lifecycle, stock
├── expenses/        simple expense ledger
├── crm/             read-only aggregated Orders view (own module, not bolted onto orders/)
├── dashboard/       read-only analytics (revenue/expenses/shipment-status breakdowns)
├── dictionaries/    read-only довідники (6 lookup collections)
├── nova-poshta/     Nova Poshta API client + address-lookup endpoints
├── cloudinary/      upload service (used by products/)
├── prisma/          PrismaService (@Global())
├── shared/          AllExceptionsFilter, ParseObjectIdPipe, EncryptionService
├── core/            CoreModule: Config/Prisma/Throttler + global filter/guard wiring
├── app.controller.ts / app.service.ts   → GET /ping only
└── main.ts
```

Every feature module is self-contained (own `dto/`, `entities/`,
`*.controller.ts`, `*.service.ts`, `*.module.ts`) per
`nestjs-project-structure`. `AuthModule` registers the global `JwtAuthGuard`
itself (as `APP_GUARD`); `CoreModule` owns `ConfigModule`, `PrismaModule`,
`ThrottlerModule`, and the global exception filter/IP throttler guard.

## 3. Auth — full flow and every route

**Procedure and gotchas are in `backend-api-integration` skill — read that
first.** This section is the field-level reference for each route.

All `/auth/*` routes are `@ApiTags('auth')`, base path `/auth`.

| Method & path | Auth | Throttle | Body | Response |
|---|---|---|---|---|
| `POST /auth/login` | Public | 10/min/IP + account lockout (10 fails/15min) | `LoginDto {login, password}` | `LoginResponseDto` |
| `POST /auth/2fa/verify-login` | Public | 10/min/IP + account lockout | `VerifyLoginDto {pendingToken, code}` | `TokenPairResponseDto` |
| `POST /auth/refresh` | Public | 10/min/IP | `RefreshDto {refreshToken}` | `TokenPairResponseDto` |
| `POST /auth/logout` | **Protected, 2FA required** | default | — | `204 No Content` |
| `POST /auth/2fa/setup` | Protected, **2FA gate skipped** | default | — | `SetupTwoFaResponseDto` |
| `POST /auth/2fa/confirm` | Protected, **2FA gate skipped** | default | `ConfirmTwoFaDto {code}` | `ConfirmTwoFaResponseDto` |
| `GET /auth/2fa/status` | Protected, **2FA gate skipped** | default | — | `TwoFaStatusResponseDto` |

**DTOs:**

```ts
LoginDto            { login: string; password: string }
LoginResponseDto     { requiresTwoFa: boolean; pendingToken?: string; accessToken?: string; refreshToken?: string }
VerifyLoginDto        { pendingToken: string; code: string }  // code = TOTP or a recovery code
TokenPairResponseDto  { accessToken: string; refreshToken: string }
RefreshDto            { refreshToken: string }
SetupTwoFaResponseDto { qrCodeDataUrl: string; secret: string }  // qrCodeDataUrl is a full data:image/png;base64 URI
ConfirmTwoFaDto       { code: string }
ConfirmTwoFaResponseDto { recoveryCodes: string[] }  // 10 codes, shown once only, never retrievable again
TwoFaStatusResponseDto { twoFaEnabled: boolean }
```

**Token lifetimes:** access 15 min, refresh 7 days. Refresh tokens are
stateful (hashed on `User.refreshTokenHash`) and rotate on every use;
reusing an already-rotated one revokes the session.

**Errors this module can throw** (beyond generic validation 400s):
- `401 "Invalid login or password"` — wrong credentials, or unknown login
  (deliberately identical message/timing for both, to avoid username
  enumeration).
- `429` — account lockout or IP throttle, message
  `"Too many failed attempts — try again later"`.
- `401 "Invalid or expired token"` / `"Invalid token type"` — malformed/
  wrong-kind JWT passed to `verify-login`/`refresh`.
- `401 "Refresh token is invalid or has already been used"` — reused/stale
  refresh token; session is revoked, must log in again.
- `403 "Two-factor authentication setup is required before using this endpoint"`
  — global guard, any non-exempt route, when `twoFaEnabled=false`.
- `400 "Start 2FA setup (POST /auth/2fa/setup) first"` / `"Invalid confirmation code"`
  — from `2fa/confirm` if setup was never started or the code is wrong.

## 4. Senders (`/senders`)

One "sender" = one Nova Poshta account/API key this business ships from.
**Only one sender can be `isActive` at a time** — `activate()` atomically
deactivates every other row first.

**The sender always drops packages off at a відділення (warehouse) —
never a street-address door pickup.** This is a real, confirmed business
rule (not a technical default): Nova Poshta's `Counterparty.
getCounterpartyAddresses` API returns the counterparty's registered
*street* address, which is a different thing from the warehouse the
business actually uses to ship from, and there is no NP API that exposes
"the one warehouse pinned in the NP web cabinet's 'Мої адреси' section" —
that's an NP-web-cabinet-only concept, not retrievable via their JSON API
(confirmed by testing against a real account: `getCounterpartyAddresses`
returned a street address, and `Counterparty.getCounterparties` doesn't
return a usable city for a `PrivatePerson` counterparty either). So the
pickup warehouse is **entered manually** by the admin (city search +
warehouse select — the same `GET /nova-poshta/warehouses` mechanism the
Orders wizard already uses for the recipient side), not auto-fetched.

| Method & path | Throttle | Body/Query | Response |
|---|---|---|---|
| `GET /senders` | default | `?page&pageSize` | `ListSendersResponseDto` |
| `POST /senders/verify` | 5/min | `VerifySenderDto {apiKey}` | `SenderVerificationResultDto {fullName, phone}` |
| `POST /senders` | 5/min | `CreateSenderDto {apiKey, cityRef, warehouseRef}` | `SenderResponseDto` |
| `PATCH /senders/:id/activate` | default | — | `SenderResponseDto` |
| `PATCH /senders/:id/refresh` | 5/min | — | `SenderResponseDto` |
| `PATCH /senders/:id/warehouse` | 5/min | `SetSenderWarehouseDto {cityRef, warehouseRef}` | `SenderResponseDto` |
| `DELETE /senders/:id` | default | — | `204` (soft delete — sets `isDeactivated`) |
| `GET /senders/:id/addresses` | default | — | `SenderAddressResponseDto[] {npAddressRef, description}` (currently always 0 or 1 entries — the one configured pickup warehouse) |

`fullName`/`phone`/Nova-Poshta refs are **always** resolved server-side from
the real Nova Poshta account via the `apiKey` — never accept them as client
input. `cityRef`/`warehouseRef` on create (and on `PATCH .../warehouse`)
are validated server-side against a live `GET /nova-poshta/warehouses`
call for that city — `warehouseRef: 'unknown-warehouse-ref' → 400
"Unknown warehouse for the given city"` if it doesn't resolve; the stored
`description` always comes from that live lookup too, never from client
input. `verify` is a pure dry-run (doesn't persist anything) so the
frontend can show "this is who you're about to add" before committing to
`POST /senders`. `refresh` only re-pulls identity (name/phone/NP refs) —
it does **not** touch the configured pickup warehouse; use
`PATCH /senders/:id/warehouse` to change that. `SenderResponseDto`:
`{id, fullName, phone, isActive, createdAt, updatedAt}`.

## 5. Products (`/products`)

**Multipart only** for create/update — see the skill doc's "File upload"
section for the exact form-field mechanics.

| Method & path | Body | Response |
|---|---|---|
| `GET /products` | `?page&pageSize&typeId` | `ListProductsResponseDto` |
| `GET /products/:id` | — | `ProductResponseDto` |
| `POST /products` | multipart: `photo` (required) + `CreateProductDto` fields | `ProductResponseDto` |
| `PATCH /products/:id` | multipart: `photo` (optional) + partial `CreateProductDto` fields | `ProductResponseDto` |
| `DELETE /products/:id` | — | `204` (hard delete) |

```ts
CreateProductDto { typeId: string; name: string; price: number; promoPrice?: number; stockQuantity: number }
ProductResponseDto { id; typeId; name; photoUrl; price; promoPrice: number|null; stockQuantity; createdAt; updatedAt }
```

`typeId` must reference a **non-custom** `product_types` row (`isCustom:
false`) — creating/editing a catalog product against the custom type
("Кастомна наклейка") is rejected: `400 "Cannot create or edit a catalog
product with the custom product type"`. Photo validated server-side by
real magic-number sniffing (jpeg/png/webp), 5MB max; if the DB write fails
after a successful upload, the just-uploaded Cloudinary asset is deleted
automatically (no orphaned images).

## 6. Orders (`/orders`)

The largest module — a multi-step wizard collapsed into one `Order`
document, with Nova Poshta waybill creation/update/deletion kept in sync.

| Method & path | Throttle | Body/Query | Response |
|---|---|---|---|
| `POST /orders` | 20/min | `CreateOrderDto` | `OrderResponseDto` |
| `GET /orders` | default | `?page&pageSize&dateFrom&dateTo` | `ListOrdersResponseDto` |
| `GET /orders/:id` | default | — | `OrderResponseDto` |
| `PATCH /orders/:id` | 20/min | `UpdateOrderDto` (all fields optional) | `OrderResponseDto` |
| `PATCH /orders/:id/sync-status` | 20/min | — | `OrderResponseDto` (manual Nova Poshta status pull, no polling) |
| `DELETE /orders/:id` | 20/min | — | `204` |

```ts
CreateOrderDto {
  shipmentTypeId: string; paymentTypeId: string;
  partialAmount?: number;           // required only if paymentType.code === 'partial'
  items: OrderItemDto[];            // ArrayMinSize(1)
  senderId: string; senderAddressRef: string;  // one of GET /senders/:id/addresses — the sender's configured pickup warehouse
  recipient: RecipientDto;          // {phone (UA format), lastName, firstName, middleName?}
  deliveryTypeId: string;
  deliveryDetails: DeliveryDetailsDto;  // {cityRef, warehouseRef?, streetRef?, house?, apartment?, postomatRef?}
}
OrderItemDto {
  productTypeId: string;
  productId?: string;    // required unless the product type is custom
  name?: string;         // required only for the custom product type (no catalog row to name it from)
  price?: number;        // required only for the custom product type
  quantity: number;      // >= 1
  isPromo?: boolean;     // sell at the catalog product's promoPrice, only if it has one
}
UpdateOrderDto {
  shipmentTypeId?; paymentTypeId?; partialAmount?;
  items?: OrderItemDto[];   // full replacement of the line-item list, not a patch
}
```

`OrderResponseDto` includes the resolved `totalAmount` (server-computed,
never trust a client value), the embedded `items[]` (each with a captured
`nameSnapshot`/`photoUrlSnapshot`/`price` at order-creation time — these
don't change retroactively if the underlying product changes later),
`recipient`, `deliveryDetails`, and `npWaybillNumber`/`npWaybillRef`/
`shipmentStatusId` (all nullable until the Nova Poshta call completes).

**Payment types and cash-on-delivery (накладений платіж):** three
`payment_types` codes drive what Nova Poshta is told to collect on
delivery — `full` → nothing (fully prepaid), `cod` → the entire
`totalAmount`, `partial` → exactly `partialAmount` (the still-owed balance;
must not exceed `totalAmount`, enforced server-side).

**Delivery types:** `deliveryTypeId` of code `'address'` (door-to-door to
the recipient) is **permanently rejected** — `400 "Door-to-door ('Адреса')
delivery is not supported yet..."` — this is a real, permanent business/API
limitation, not a temporary gap; only `warehouse`/`postomat` recipient
delivery is supported. The corresponding `deliveryDetails` field
(`warehouseRef` or `postomatRef`) is required depending on which one.

**Editing after a waybill exists:** only shipment type, payment type/
`partialAmount`, and items are editable via `PATCH` — the
recipient, delivery type/details, sender, and sender address are
**permanently non-editable** once set (Nova Poshta's own API has no path to
change them after the waybill's one-shot creation). Sending them in
`UpdateOrderDto` is a 400 (not a declared field).

**Errors specific to this module:**
- `400` — unknown shipment/payment/delivery type id; missing
  warehouse/postomat ref for the chosen delivery type; sender/sender-address
  not found or deactivated; `partialAmount` missing (when required) or
  exceeding `totalAmount`; not enough stock (including under a detected
  concurrent-order race).
- `502` — the Order/stock DB change succeeded, but the paired Nova Poshta
  waybill create/update/delete call (or its revert-on-failure/cleanup
  attempt) failed — needs manual follow-up in Nova Poshta, see the skill
  doc's checklist.

## 7. Expenses (`/expenses`)

Plain CRUD, no external calls, no throttle beyond the app default.

| Method & path | Body/Query | Response |
|---|---|---|
| `POST /expenses` | `CreateExpenseDto {typeId, name?, amount}` | `ExpenseResponseDto` |
| `GET /expenses` | `?page&pageSize` | `ListExpensesResponseDto` |
| `GET /expenses/:id` | — | `ExpenseResponseDto` |
| `PATCH /expenses/:id` | partial `CreateExpenseDto` | `ExpenseResponseDto` |
| `DELETE /expenses/:id` | — | `204` (hard delete) |

`name` is only meaningful (and only stored) when the effective
`expense_types` row has `requiresName: true` (currently just "Інше") — a
`name` sent for any other type is silently dropped, not rejected; switching
*away* from a `requiresName` type on update clears any previously-stored
name.

## 8. CRM table (`GET /crm/table`)

Read-only, aggregated view over Orders — its own module/DTO shape, not
`OrderResponseDto` reused.

Query (`ListCrmQueryDto`): `page`, `pageSize`, `dateFrom`, `dateTo`,
`productTypeId` (orders containing at least one line item of that type),
`shipmentStatusId`, `sortOrder` (`'asc'|'desc'`, by `createdAt`, default
`desc`).

Response (`ListCrmResponseDto`): `{ items: CrmRowResponseDto[], total,
totalAmountSum }` — `totalAmountSum` is the sum over the **entire filtered
set**, not just the current page (computed via a separate aggregate query
run in parallel with the paginated one).

```ts
CrmRowResponseDto {
  id; createdAt; npWaybillNumber: string|null; paymentTypeId;
  recipientFullName: string; recipientPhone: string; totalAmount;
  shipmentStatusId: string|null; productTypeIds: string[]; // deduplicated across the order's items
}
```

## 9. Dashboard (`GET /dashboard`)

Read-only analytics. Query: `dateFrom?`, `dateTo?` (both optional — omit
for all-time).

```ts
DashboardResponseDto {
  totalRevenue: number; totalExpenses: number; profit: number; // revenue - expenses
  orderCount: number;
  revenueByDay: { date: string /* YYYY-MM-DD */; revenue: number }[];
  expensesByCategory: { expenseTypeId; label; amount }[];       // always includes every expense_type, even at 0
  shipmentStatusBreakdown: { shipmentStatusId; label; count }[]; // always includes every shipment_status, even at 0
}
```

`revenueByDay` buckets by **UTC** calendar day (not shop-local Europe/Kyiv
time) — a deliberate, confirmed trade-off, not a bug: an order placed
00:00–03:00 Kyiv time lands on the previous UTC day on this chart. Orders
with `shipmentStatusId: null` (not yet synced) count toward
`orderCount`/`totalRevenue` but are excluded from every status bucket.

## 10. Dictionaries (`/dictionaries/*`) — read-only

Every route returns a flat array, no pagination, no auth beyond the
standard guard. These rarely change — fetch once per session and cache.

| Path | Response item shape |
|---|---|
| `GET /dictionaries/shipment-types` | `{id, code, label, isDefault}` |
| `GET /dictionaries/product-types` | `{id, code, label, isCustom}` |
| `GET /dictionaries/payment-types` | `{id, code, label}` — codes: `full`, `cod`, `partial` |
| `GET /dictionaries/expense-types` | `{id, code, label, requiresName}` |
| `GET /dictionaries/delivery-types` | `{id, code, label}` — codes include `warehouse`, `postomat`, `address` (the last is accepted here for display but rejected by Orders — see §6) |
| `GET /dictionaries/shipment-statuses` | `{id, code, label}` |

## 11. Nova Poshta address lookups (`/nova-poshta/*`)

Powers the Orders wizard's address selects — independent of waybill
creation itself. All throttled at 30/min (higher than Senders' 5/min since
these back autocomplete-style UI, not one-shot verification).

| Path | Query | Response |
|---|---|---|
| `GET /nova-poshta/cities` | `query` (search string) | `AddressOptionDto[] {ref, description}` |
| `GET /nova-poshta/warehouses` | `cityRef` | `AddressOptionDto[]` |
| `GET /nova-poshta/streets` | `cityRef`, `query?` | `AddressOptionDto[]` |
| `GET /nova-poshta/postomats` | `cityRef` | `AddressOptionDto[]` |

These resolve against the **currently active** sender's Nova Poshta API key
server-side — the frontend never sends or sees an API key here.

## 12. Health check

`GET /ping` — `Public`, no auth, no throttle beyond the app default.
Returns `{ status: 'ok' }`, `200`. Use for uptime/liveness checks only, not
as an auth-check (it tells you the server process is up, not that a token
is valid).
