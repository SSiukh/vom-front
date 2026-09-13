# vom-front — work plan

Updated as part of the per-request workflow in `.claude/CLAUDE.md`: every
request that involves writing or changing code adds an entry here (or
updates the matching one) before coding starts, and marks it `done` when
the request is finished. Statuses: `[ ]` planned, `[~]` in progress, `[x]`
done.

## How to read this

Checkboxes are deliverables, not specs — the page-by-page field spec lives
in `.claude/artifacts/frontend/VOM_SYSTEMS.md`, the layout/UX spec in
`.claude/artifacts/frontend/VOM_DESIGN_INSTRUCTION.md`, and the real design
bundle in `.claude/artifacts/frontend/Дизайн проекту/`. The backend
contract lives in `.claude/artifacts/backend/API_REFERENCE.md`. The rules
for _how_ to build
each part live in the skills (`angular-project-structure`,
`angular-design-implementation`, `backend-api-integration`). This file
only tracks what's done and what's still open. An "open question" must be
resolved by asking the user (see "No guessing" in `CLAUDE.md`) before or
during that item's implementation — not assumed.

Current real state: the Angular project is scaffolded (`ng new`, Angular
22.1, standalone/no NgModules, Vitest+jsdom test runner via
`@angular/build:unit-test`, `angular-eslint` wired via `ng add`) — verified
against `angular-project-structure`'s baseline by the `research` agent, no
mismatches found. Nothing else below is built yet. This `.claude/` setup
(skills/instructions/agents/artifacts/this plan) was prepared ahead of time
from the `vom-back` project, which already has a fully-built, reviewed,
tested API this frontend will consume — see
`.claude/artifacts/backend/API_REFERENCE.md`.

## Foundations (cross-cutting; every feature is blocked on these)

- [x] Scaffold the Angular project (`ng new`, current CLI defaults —
      standalone, no NgModules, Vitest test runner, `angular-eslint` via
      `ng add`). Confirmed the generated defaults match
      `angular-project-structure`'s baseline (verified via the `research`
      agent against the real generated files, not assumed).
      **Bug found post-hoc (2026-08-24), after the entire plan below was
      already marked done:** the root `app.html`/`app.ts` still had the
      CLI's default "Hello, vom-front / Congratulations! Your app is
      running 🎉" placeholder markup sitting above the `<router-outlet
      />`, on every single route, for the whole build. `tsc`/`ng lint`/
      `ng test`/`ng build` all stayed green the entire time since none
      of them render/inspect actual page composition — this only
      surfaced when the user opened `/login` in a real browser and saw
      the Angular starter page instead of the login form. Fixed:
      `app.html` reduced to just `<router-outlet />`, `app.ts`'s now-
      unused `title` signal removed, `app.spec.ts`'s placeholder-title
      test removed (kept the "should create" smoke test). Side effect:
      initial bundle dropped from 509.09kB to 490.56kB, clearing the
      500kB budget warning that had been accumulating across every
      feature chunk. Verified for real this time — `ng serve` +
      Playwright screenshot of `/login` shows the actual VOM Systems
      login card, zero console errors.
      **Process lesson, applies to all future frontend work in this
      project, not just this bug:** `tsc`/`lint`/`test`/`build` passing
      is necessary but not sufficient evidence a page actually renders
      correctly — none of them catch dead markup sitting in front of
      real content. This project's own workflow already says to use the
      browser for UI changes; going forward, actually do it (`ng serve`
      + a screenshot, e.g. via Playwright — chromium-cli wasn't
      available in this sandbox, so `npx playwright install chromium`
      + a throwaway script in the scratchpad dir did the job) before
      calling a page-rendering change done, not just the toolchain
      checks.
- [x] `app.config.ts`: `provideRouter`, `provideHttpClient(withInterceptors([...]))`,
      any other app-wide providers.
- [x] `core/auth/`: session state (login, `twoFaEnabled`, tokens) as an
      injectable service with signals: login, 2FA setup/confirm/verify,
      refresh (single shared in-flight refresh via `shareReplay`, not one
      per concurrent 401), logout. Reviewed and fixed (username-loss bug on
      the 2FA-verify path, `LoginResponse` discriminated union, dead code).
      `environment.ts`'s production `apiUrl` is still an empty string — no
      real prod `vom-back` URL is known yet; fill it in once one exists.
- [x] `core/interceptors/`: auth-header attach + 401→refresh→retry,
      functional (`HttpInterceptorFn`). Reviewed and fixed (a retried-request
      failure after a successful refresh no longer force-logs-out the user).
- [x] `core/guards/`: `authGuard` (valid session) + `twoFaConfiguredGuard`
      (mirrors the backend's global 2FA gate), both functional
      (`CanActivateFn`). Not yet wired into `app.routes.ts` — routing is a
      separate item below.
- [x] `core/api/`: one thin typed HTTP service per backend module — built
  incrementally alongside each owning feature rather than all at once,
  per `API_REFERENCE.md`'s per-module shape, as originally planned.
  All present: `AuthApiService`, `DictionariesApiService`,
  `SendersApiService`, `ProductsApiService`, `OrdersApiService`,
  `NovaPoshtaApiService`, `ExpensesApiService`, `CrmApiService`,
  `DashboardApiService` — confirmed on disk in `src/app/core/api/`,
  each with its own `.spec.ts`.
- [x] `shared/models/`: `ApiError` (the standard error-envelope shape),
      `PaginatedResponse<T>`, `DictionaryItem` + `ShipmentType`/
      `ProductType`/`ExpenseType` (the dictionaries that carry an extra
      boolean field). `PaginatedResponse<T>` has no consumer yet — confirm
      it actually gets used by the first paginated endpoint (Senders
      `GET /senders`) rather than lingering unused.
- [x] `core/dictionaries/DictionariesService`: fetches each
      `GET /dictionaries/*` collection once (in the constructor) and caches
      it in a signal; every feature's selects should read from here, never
      hardcode option lists. Exposes `hasError`/`reload()` so a failed
      fetch (e.g. a 403 from the global 2FA gate, or any other non-2xx) is
      distinguishable from a genuinely empty collection, not silently
      swallowed. Reviewed and fixed (this error-swallowing gap). Note for
      whoever adds the first real consumer: `providedIn: 'root'` means this
      only actually fetches on first injection, not at app bootstrap —
      inject it early (post-login/layout-shell) rather than letting the
      first-visited feature page trigger the load, or "fetch once per
      session" degrades into "fetch once per whichever page loads first."
- [x] Global layout shell (`VOM_SYSTEMS.md`'s "Глобальні компоненти"):
      `core/layout/{header,sidebar,footer,shell}` + `core/layout/
      LayoutStateService` (shared sidebar-collapsed signal — Header and
      Sidebar both read it, since the "VOM" wordmark migrates between them
      depending on collapse state, confirmed against the real design bundle,
      not just the summarized spec tables). Sidebar: 7 nav items via
      `core/routes.constants.ts`'s `FEATURE_ROUTES` + the existing
      `AUTH_ROUTES.twoFaSetup`, Lucide icons (`@lucide/angular` — the
      current maintained package; the older unscoped `lucide-angular` is
      deprecated and doesn't support Angular 22), `routerLinkActive` for
      active-state, hover via CSS. Design tokens (colors/fonts/spacing)
      extracted from the real `Дизайн проекту/` bundle into `src/styles.css`
      custom properties + a Google Fonts link in `index.html`
      (Barlow/Barlow Condensed). Reviewed and fixed (duplicate wordmark).
      `app.routes.ts` now has a temporary `{ path: '', component: Shell }`
      so the shell is reachable/buildable — NOT the real routing (next
      item), no guards wired yet.
      **Note:** `.claude/skills/angular-project-structure/SKILL.md`'s
      naming convention (`<name>.component.ts`) is stale — the live
      Angular 22 CLI (verified via `ng generate component --dry-run`)
      drops the `.component.` infix (`header.ts` + class `Header`, not
      `header.component.ts` + `HeaderComponent`). This and every component
      built from here on follows the live CLI, not the skill text; the
      skill should be corrected to match.
      **Not verified in a real browser** — no browser/screenshot tool was
      available in this session. Verified instead via `ng build` (AOT
      template compilation), `ng lint`, 60 passing component/service tests
      (real Angular rendering into jsdom via TestBed), and a running dev
      server (`http://localhost:4200/`) that serves the built bundle
      without a build/HMR error — but colors/fonts/spacing/hover/collapse
      have not been visually confirmed by a human or a screenshot tool.
      Worth an actual look before calling this pixel-perfect.
- [x] Top-level `app.routes.ts`: `/login` and `/2fa` as public top-level
      routes (no guards — `/2fa` must stay reachable pre-authentication
      during the verify-mode case), `''` wrapped in `Shell` with
      `authGuard` + `twoFaConfiguredGuard` composed, `children: []` for
      now. Lazy per-feature routes (`loadChildren`/`loadComponent`) still
      come later, added as each feature is built.

## Features (per `VOM_SYSTEMS.md`, in dependency order)

- [x] **Auth — login page.** `features/auth/pages/login/`: login +
      password fields (eye-icon visibility toggle), Reactive Forms,
      submit → `AuthService.loginWithPassword` → navigates to `/2fa`
      regardless of response branch (the 2FA page itself resolves setup
      vs. verify mode from `AuthService` state). 401/429 error messages.
      Design matched against the real `Дизайн проекту/` card markup
      (340px card, blueprint corner marks, exact input/button recipe).
- [x] **Auth — 2FA setup/verify page.** `features/two-fa/pages/two-fa/`,
      one component/route, two modes resolved from `AuthService` state
      (`isAuthenticated()` → setup, else `hasPendingTwoFa()` → verify, else
      redirect to `/login`): QR (`<img>` from the real `qrCodeDataUrl`),
      secret + copy, 6-cell segmented code input (plain signal-array
      state, not Reactive Forms — one logical field with a bespoke
      multi-cell UI, reviewed and accepted), confirm/verify, recovery
      codes shown once with a bulk copy button, status badge
      (не налаштовано/налаштовано — the latter's color triad is an
      invented-by-convention placeholder, not design-confirmed).
      **Resolved (was an open question):** a `research` agent confirmed
      the design bundle (`Дизайн проекту/index.html`, 16 total screens
      `1a`-`1p`) has exactly one 2FA screen (`1b`), covering only the
      setup flow — no second "just enter your code" screen was ever
      designed. Asked the user directly: **one page/component, two modes**
      — not two separate pages. Built together with the login page in one
      chunk since they're routing-coupled.
      Reviewed and fixed (blocking: recovery codes were never actually
      shown to the user — `AuthService.confirmTwoFactor()`'s `tap` flips
      `twoFaEnabled` to `true` before the component's own success handler
      runs, so the template's `alreadyConfigured()` branch always won and
      shadowed the one-time recovery codes, permanently losing them per
      the backend's own no-re-fetch guarantee; caught only once a
      regression test was added using the real `AuthService` instead of a
      mocked stub — the mocked-stub test had missed it entirely. Also
      fixed: confirm button reachable before setup data loaded; a
      redundant `GET /auth/2fa/status` call when the guard already cached
      the answer).
- [x] **Senders.** `features/senders/pages/{senders-list,senders-create}`,
      `core/api/SendersApiService`, lazy-loaded `senders.routes.ts` under
      the guarded Shell. List: table (radio-dot single-active-select
      sourced from the backend's own atomic activate response/re-fetch,
      never replicated client-side), status badge (2 states —
      Активний/Неактивний — the design mockup showed a 3rd "expired key"
      state with no backing field in `SenderResponseDto`; deliberately not
      built, not approximated client-side), refresh/delete row actions,
      pagination, empty state, delete confirmation. Create: API key →
      verify → locked/readonly ПІБ+phone → save (submits the verified key,
      re-editing after verify requires re-verifying since the field is
      disabled). First real consumer of `PaginatedResponse<T>` and the
      first components with genuine external inputs/outputs — confirmed
      signal-based `input()`/`output()` is the correct current API, not
      `@Input()`/`@Output()` decorators.
      New `shared/ui/{confirm-dialog,pagination}` — generic, reusable,
      explicitly anticipated by `angular-project-structure`'s folder
      layout; both will be reused by every future list/delete-confirm
      page (Products, Expenses, Orders, CRM).
      Reviewed and fixed twice: (1) throttled endpoints (verify/create/
      refresh, 5/min) didn't distinguish a 429 from a generic error,
      unlike the established login/2FA pattern — now do; (2) pagination
      could desync after a delete emptied the current non-first page —
      `load()` now clamps `page` to the recomputed `totalPages` and
      re-fetches; (3) no re-entrancy guard against double-clicking
      activate/delete-confirm mid-request — added.
      Needed before Orders, since the order wizard's "Відправник" step
      depends on there being an active sender.
- [x] **Products.** `features/products/pages/{products-list,products-form,
      products-detail}`, `core/api/ProductsApiService` (multipart
      `FormData` for create/update per the file-upload skill — `photo`
      required on create, optional on update), lazy-loaded
      `products.routes.ts`. List: segmented type filter (Усі + non-custom
      dictionary types only — matches `typeId` must reference a
      non-custom `product_types` row), table with stock color-coded by
      quantity (0 → red, <10 → amber, an inferred threshold, not
      design-confirmed), pagination/empty-state/delete reusing Senders'
      `ConfirmDialog`/`Pagination` + its clamp/re-entrancy fixes. One
      shared `ProductsForm` component handles both create (`/products/new`)
      and edit (`/products/:id/edit`) via the route's `:id` param, with a
      drag&drop photo upload zone (native file input, object-URL preview,
      revoked on replace/destroy).
      **Known limitation, not fixable frontend-only:** there is no way to
      clear an existing "Акційна ціна" (promoPrice) via the edit form once
      set — the backend's `PATCH` treats an omitted field as "don't
      touch," not "clear," and multipart `FormData` has no clean way to
      send an explicit null that would pass the backend's `@IsNumber()`
      validation. Needs a backend contract decision (e.g. accept an
      explicit sentinel, or a dedicated clear-promo endpoint) — vom-back
      is read-only from this project, so this can't be resolved here.
      `Shell` now eagerly injects `DictionariesService` in its constructor
      (no stored field, just `inject(...)` for the side effect) so the
      dictionary cache starts loading as soon as the authenticated shell
      renders, addressing the "fetch once per session, not once per
      first-visited feature" note left when `DictionariesService` was
      first built.
      Reviewed and fixed three times: (1) a `computed()` wrapping
      `FormGroup.valid` (a non-signal getter) combined with `&&`
      short-circuiting meant the save button's enabled-state permanently
      froze at `false` after its first (empty-form) evaluation, since the
      other signals it depended on were never read/tracked on that first
      pass — converted to a plain method, which fully re-evaluates on
      every call instead of memoizing; (2) `ProductsForm`/`ProductsDetail`
      read the `:id` route param via a one-time `route.snapshot` read,
      which would go stale if Angular's default `RouteReuseStrategy` ever
      reused the component instance across a same-route-config param
      change (e.g. editing product A then product B) — switched to
      subscribing to the reactive `route.paramMap`; (3) that subscription
      initially used nested `.subscribe()` calls with no cancellation of
      a still-in-flight request when a new navigation arrived before the
      previous one resolved — switched to `switchMap`, confirmed via a
      dedicated test that a stale in-flight request is actually cancelled
      (`TestRequest.cancelled === true`), not just superseded by luck.
      Needed before Orders, since the wizard's item picker searches this
      catalog.
- [x] **Orders.** The largest feature — list (filters, pagination) →
      two-step creation wizard (Відправлення → Адреса, single
      `POST /orders` submit at the end per `angular-design-implementation`'s
      gotcha) → detail page (readonly, edit/delete actions) → edit page
      (only the backend-editable-post-waybill fields stay live; everything
      else shown disabled with an explanation, per `API_REFERENCE.md` §6).
      Depends on Senders + Products + Dictionaries + Nova Poshta address
      lookups all being wired first.
      **Resolved (was an open question):** `CreateOrderDto.orderTypeId`
      (`order_types` dictionary, codes `custom`/`recurring`, labels
      Кастомний/Сталий) was required by the backend but had no control
      anywhere in the creation wizard — confirmed absent from both
      `VOM_SYSTEMS.md`'s field table and the real design mockup (checked
      via `research`; also confirmed via the real `vom-back` seed data
      that `recurring`/`custom` describe the order's own business
      category, unrelated to whether any line item uses the custom
      *product* type, so it can't be auto-derived from cart contents).
      Asked the user directly: **the field is being removed from the
      backend entirely and should be ignored.** Confirmed live while
      investigating — `vom-back`'s `orderTypeId` was removed from
      `CreateOrderDto`/`UpdateOrderDto`/`ListOrdersQueryDto` and the
      `OrderType` Prisma model during this session (the `order_types`
      seed block is gone too); only the response DTO still declares a
      stale `orderTypeId` field. The frontend `Order` model/API service
      simply don't reference `orderTypeId` anywhere — no field to send,
      no workaround needed. `DictionariesService.orderTypes` is left as
      dead-but-harmless (its own `hasError`/empty-array fallback already
      handles the dictionary endpoint disappearing) since nothing in this
      feature reads it; not worth touching foundations code for a
      field this feature never uses.
      **Chunk 1 done — foundation + list page.** Built: `Order`/`OrderItem`/
      `Recipient`/`DeliveryDetails`/`CreateOrderPayload`/`UpdateOrderPayload`
      models (no `orderTypeId`, per above); `OrdersApiService`
      (`list`/`get`/`create`/`update`/`delete`, verified field-for-field
      against the real `vom-back` DTOs incl. the live `orderTypeId`
      removal); `NovaPoshtaApiService` (cities/warehouses/streets/
      postomats, verified against `nova-poshta.controller.ts`, incl.
      Cyrillic query encoding); `SendersApiService.getAddresses` +
      `SenderAddress` model (for the wizard's sender-address step); a new
      reusable `shared/ui/searchable-select` combobox (debounced search,
      full keyboard support — arrow-key highlight with wraparound, Enter
      to select, Escape to close — combobox/listbox ARIA roles) for the
      wizard's 5 upcoming address/product pickers; and the Orders list
      page itself (`features/orders/pages/orders-list`, routed at `/orders`).
      Design judgment calls made (no exact list-page mockup existed for
      some of these — confirmed via `research` against the real
      `Дизайн проекту/index.html` bundle and the live backend rather than
      guessed): table is № ЕН / Дата / Отримувач / Телефон / Товари /
      Оплата / Вартість — **no "Тип" column**, since the mockup's column
      maps to the same removed `orderTypeId` concept; rows are clickable
      through to the (not-yet-built) detail page with no per-row actions,
      matching `VOM_DESIGN_INSTRUCTION.md`'s "рядки клікабельні → деталі"
      and confirming delete/edit only belong on the detail page; the
      mockup's "Сортування" (Нові/Старі) toggle has no backend support
      (`ListOrdersQueryDto` has no sort param, `orders.service.ts` always
      queries `createdAt desc`) so it's implemented as a client-side
      reversal of the current page only, and — to avoid it silently
      misrepresenting older pages once pagination is involved — it's
      hidden whenever `total > pageSize`; the "Від/До" date-range filter
      uses plain native `<input type="date">` fields rather than a custom
      calendar-popover matching the mockup's exact visual, since no
      date-picker component/convention exists in the codebase yet and
      building one is out of scope for this chunk. Reviewed twice (first
      pass found 5 issues — missing `(keydown.space)` handling on the
      clickable row, missing combobox keyboard support/ARIA on
      `SearchableSelect`, a blur/refocus timer race in `SearchableSelect`,
      the sort-toggle multi-page correctness gap above, and missing
      pagination/clamp test coverage — all fixed and reverified clean on
      the second pass).
      **Final cleanup (2026-08-24):** the user confirmed the backend had
      by then fully removed the order-type concept, not just the field —
      re-verified directly against the real `vom-back` source:
      `GET /dictionaries/order-types` is gone from
      `dictionaries.controller.ts`, and the `OrderType` Prisma model/
      `order_types` seed block (previously seen live mid-removal) are
      confirmed gone too. Removed the now-fully-dead
      `DictionariesApiService.getOrderTypes()`,
      `DictionariesService.orderTypes` signal, and their loadAll()/spec
      wiring (previously kept as "dead-but-harmless" while the endpoint
      still existed) — no remaining `orderTypes`/`getOrderTypes`/
      `order-types` references anywhere in `src/`. tsc/lint/tests(208/208)/
      build all clean.
      **Chunk 2 done — two-step creation wizard (`orders-create`,
      routed at `/orders/new`).** Step 1 "Відправлення": shipment-type
      select (defaults to the dictionary's `isDefault` entry via an
      `effect()`), item array (`OrderItemCard` child component per row —
      product-type select, catalog product search via the shared
      `SearchableSelect` filtering a locally-cached page of up to 100
      products of that type since `ListProductsQueryDto` has no server
      search param, or name+price inputs for the custom type, quantity,
      promo checkbox shown only when the picked product has a
      `promoPrice`, a stock-decrement hint line), running order total,
      payment-type select with a conditional partial-amount field (no
      client-side max-vs-total validator — confirmed via `research` the
      real mockup shows no such hint either; the backend's real
      `partialAmount > total` rejection surfaces through the existing
      page-level error banner instead). Step 2 "Адреса": active-sender
      info card (fetched via `SendersApiService.list(1, 100)` +
      client-side `isActive` filter, since no dedicated
      "active sender" endpoint exists — confirmed against the real
      `SendersController`; blocks submission with a fallback message if
      none is active), sender-address plain `<select>` (spec explicitly
      says "Селект", not a search control), recipient fields, a
      "Куди доставити" 2-way button group (see below), city
      `SearchableSelect` (real server search via
      `NovaPoshtaApiService.searchCities`), and warehouse/postomat
      `SearchableSelect`s (client-filtered over a per-city cached list,
      since `getWarehouses`/`getPostomats` take no query param — verified
      against the real `NovaPoshtaController`). Single `POST /orders`
      call at the very end.
      **Design-vs-backend conflict found and resolved via the user:** the
      real design mockup and `VOM_SYSTEMS.md` both show a 3-way delivery
      method (Відділення/Адреса/Поштомат), but the real `vom-back`
      (`orders.service.ts`) permanently rejects `deliveryTypeId` code
      `'address'` with a documented `BadRequestException` ("its Nova
      Poshta request shape has not been verified... not supported yet"),
      confirmed in `API_REFERENCE.md` as a real, permanent limitation,
      not a temporary gap. Asked the user directly rather than guessing:
      **hide the "Адреса" option entirely** — done; the wizard only
      offers Відділення/Поштомат, and the `streetRef`/`house`/`apartment`
      form controls were removed from the create form entirely (the
      `CreateOrderPayload`/`Order` model TYPES still declare them as
      valid optional fields, matching the unchanged backend DTO — only
      this wizard's UI no longer populates them).
      Also fixed after `reviewer` passes: a real validation gap
      (`OrderItemCard`'s `productId` control never had `Validators
      .required` for catalog items, so an item could be "valid" with no
      product picked — fixed); a missing `502` case in the submit error
      handler (order + stock write succeeds but the paired Nova Poshta
      waybill call fails — now shows a distinct "created but check NP
      manually" message instead of the generic failure text, per
      `API_REFERENCE.md`); and silently-swallowed Nova Poshta
      city/warehouse/postomat lookup failures (now surfaced via three
      independent per-field error signals — deliberately not one shared
      signal, since warehouse and postomat lookups fire concurrently for
      the same city and a shared signal let one failure silently mask
      the other).
      **A significant Angular-testing discovery, applied throughout this
      chunk's specs:** this project's `@angular/build:unit-test` (Vitest)
      runner runs `TestBed` zoneless by default (confirmed via
      `research` against `angular.dev/guide/zoneless` and
      `.../testing/components-scenarios`) — Reactive Forms'
      `.setValue()`/`.patchValue()` do **not** automatically schedule
      change detection; only real DOM events (`dispatchEvent`), signal
      writes, or `markForCheck()` do. A spec that mutates a FormControl
      directly and then asserts on *rendered DOM* (not a signal, not a
      fresh method return value, not an HTTP request body) is testing
      undefined behavior — matches the pattern already used throughout
      `products-form.spec.ts` (`.value = x; dispatchEvent(...)`, never
      raw `.setValue()` before a DOM assertion). Two tests in this
      chunk's specs hit this exact bug during development (caught via a
      throwaway debug spec, same technique as the earlier `computed()`
      staleness bug) and were fixed by switching to real DOM
      interactions; worth keeping in mind for every future form-heavy
      spec in this project (Expenses next).
      **Chunk 3 done — detail page + edit page. Orders feature complete.**
      Detail (`orders-detail`, `/orders/:id`): two-column read-only
      layout (shipment/payment info + items table with a "Разом" total
      row on the left; sender + recipient/delivery info on the right),
      a status badge with 4 variants mapped from the real
      `shipmentStatuses` dictionary codes (`shipped`→info,
      `delivered`→success, `received`→muted, `refused`→a newly-added
      `.status-badge--danger`/`--color-error-bg`), no badge at all when
      `shipmentStatusId` is null (not shown anywhere in the real mockup
      either — a defensible gap, not guessed at). Edit/Delete actions;
      delete reuses `ConfirmDialog` with a dynamically-built message
      (ЕН-cancellation clause only when a waybill exists, itemized
      stock-restore clause only for items with a `productId`, i.e.
      excluding custom items which were never stock-tracked). Delete's
      `502` (order+stock already deleted per the real
      `orders.service.ts` — DB transaction runs before the NP
      waybill-cancel call — but NP cleanup itself failed) deliberately
      does NOT auto-navigate away like a normal success would; it shows
      an error banner and leaves the page up so the user can actually
      read the manual-follow-up warning.
      Edit (`orders-edit`, `/orders/:id/edit`): reactive form for the
      only 4 fields the real `UpdateOrderDto` ever accepts —
      shipmentTypeId, paymentTypeId, partialAmount, items (full add/
      remove item-array editing, reusing `OrderItemCard`). Everything
      else (sender, sender address, recipient, delivery method/city/
      warehouse) is permanently read-only via the established
      `.locked-field` pattern (already used in `senders-create.html`).
      **Second design-vs-backend mismatch this feature, resolved by
      backend authority without needing to ask the user** (unlike the
      Адреса-delivery-method conflict in the creation-wizard chunk,
      which had multiple valid UI resolutions and so WAS escalated) —
      re-confirmed fresh against the live `vom-back` source that
      `UpdateOrderDto` has no `recipient`/`deliveryDetails`/
      `senderAddressRef`/`deliveryTypeId` fields at all, and
      `orders.service.ts`'s `update()` has no waybill-state gating on
      the 4 fields it does accept (they're always editable, waybill or
      not — contrary to what the design mockup's own copy implies).
      The real mockup (`Дизайн проекту/index.html` §1g) shows the
      *opposite* lock allocation (locks shipment/payment/sender, allows
      editing recipient/delivery/items) — since offering to edit fields
      the API cannot accept isn't a legitimate design choice (not a
      business-rule rejection like Адреса was — a hard DTO-shape
      impossibility), there was only one technically viable UI, so this
      was implemented directly rather than treated as an open question.
      The edit page's warning banner text was written fresh to state
      the real rule correctly, with a conditional second line (only
      when `order.npWaybillNumber` is set) noting that shipment-type/
      item changes will also push an update to the live NP waybill,
      grounded in the real `needsWaybillUpdate` logic.
      Both pages resolve sender name/phone and sender-address
      description via client-side lookups (`SendersApiService
      .list(1, 100)` + find-by-id, `.getAddresses(senderId)` +
      find-by-ref, falling back to the raw ref if unmatched) since the
      real backend has no `GET /senders/:id` and `Order` only stores
      raw `senderId`/`senderAddressRef` references, no name snapshot —
      duplicated ~15 lines between the two pages rather than extracted,
      consistent with this project's not-over-abstracting-small-
      duplication convention. City/warehouse/postomat delivery details
      are shown as raw Nova Poshta refs on both pages, deliberately not
      resolved to human names — confirmed the real `NovaPoshtaController`
      has no ref→description reverse lookup for cities at all (only
      forward text search), and while warehouse/postomat refs
      technically could be resolved via an extra per-city fetch+find,
      that was judged not worth the added complexity/NP-throttle load
      for a read-only display; shown honestly as refs, not fabricated
      as if they were names. A real, documented follow-up opportunity,
      not an oversight.
      A genuine bug was caught and fixed during this chunk's own
      development (not a prior-chunk regression): `OrderItemCard`'s new
      `initialProduct` input (added so the edit page can seed each
      item's product-search-select with the item's already-known
      product) only worked when read once in `ngOnInit`, which silently
      failed to hydrate anything once real async timing was involved
      (the edit page fetches each item's current product via a separate
      `ProductsApiService.get(productId)` call that resolves *after*
      the child component has already initialized) — caught via a
      throwaway debug spec (same technique as the earlier `computed()`
      staleness bug from the Foundations chunk), fixed by moving the
      seed into a constructor `effect()` that reacts to the input for
      the component's whole lifetime, guarded by a `userPickedProduct`
      flag so a late-arriving seed can never clobber an active user
      selection. A related race was then caught by `reviewer`: the
      edit page's own per-item product-loading method originally closed
      over a fixed array index, which could write stale data into the
      wrong slot (or silently drop it) if the user changed an item's
      product or removed an item while that item's product fetch was
      still in flight — fixed by re-resolving the current index via the
      item's `productId` at write time instead of trusting a captured
      index.
      Extracted `createOrderItemFormGroup`/`buildOrderItemPayload` out
      of `orders-create.ts` into a shared `order-item-form.util.ts` once
      `orders-edit.ts` needed the identical item-form-building/payload-
      building logic, avoiding drift between the two pages (`reviewer`
      later caught one remaining piece of unshared duplication — the
      edit page's own subtotal formula — fixed by routing it through
      the already-shared `computeItemSubtotal` too). Promoted `.info-
      panel` from a page-local class to global `styles.css` once both
      detail and edit pages needed the identical definition.
      Reviewed three times across this chunk (bugs above were each
      caught by `reviewer`, not self-found) — final pass clean, no
      remaining findings.
- [x] **Expenses.** List (`expenses-list`, `/expenses` — type label,
      name or a dash, amount, date, pencil/trash row actions,
      pagination) + a single shared `expenses-form` component routed at
      both `/expenses/new` and `/expenses/:id/edit` (fields are
      identical between create/edit with no async-hydration complexity,
      so one component was enough — mirrors `products-form`'s
      established pattern rather than Orders' separate create/edit
      components, which only needed splitting because of Orders'
      field-locking rules). No detail/view page — confirmed the written
      spec only ever describes 3 pages for this feature, edit/delete are
      inline row-icon-actions on the list, matching Senders' pattern
      more than Products'.
      **Design-vs-codebase-convention conflict, escalated to the user
      rather than guessed at:** the real design mockup shows the
      create/edit form as a modal dialog over the list, unlike every
      other create/edit flow in this app (Senders/Products/Orders are
      all dedicated routed pages). Asked directly — user chose the
      dedicated-page pattern for consistency with the rest of the app
      over matching the mockup literally.
      Currency display deliberately kept as plain `{{ amount }} ₴`
      interpolation (no thousands separator/forced decimals), even
      though the real mockup shows a more elaborate format — matches
      the convention already established and shipped in Products/Orders
      (`{{ product.price }} ₴`, `{{ order.totalAmount }} ₴`), so
      introducing decimal formatting only here would be a fresh
      inconsistency rather than a fix.
      `amount` defaults to `0`, a technically-valid value per the real
      `CreateExpenseDto` (`@Min(0)`, no floor above zero) — for a
      no-name-required type this means Save enables immediately after
      picking a type, before touching the amount field; confirmed this
      exactly mirrors `products-form.ts`'s identical `price: [0, ...]`
      default, not a new gap.
      Delete-confirmation wording uses a generic
      `expense.name ?? typeLabel(expense)` fallback (extracted into a
      `deleteConfirmMessage()` component method, not an inline template
      expression, specifically to avoid a null-safety hazard caught and
      fixed during this feature's own development before ever running
      tests) since the real design bundle has no Expenses-specific
      delete-dialog mockup — the only fully-mocked delete dialog
      anywhere in it is Orders' own, with wording that doesn't
      generalize (waybill cancellation, stock restoration).
      Reviewed once — clean on the first pass, no findings.
- [x] **CRM table.** Read-only aggregated view (`crm-table`, `/crm`) —
      single `GET /crm/table` endpoint drives everything: date-range
      filter (reused Orders list's `.date-field` pattern), product-type
      and shipment-status dropdown filters (new, no segmented-control
      precedent existed for these per the real mockup), and a genuine
      server-side `sortOrder` toggle — unlike Orders list's client-only
      sort from an earlier chunk (that backend has no sort param at
      all), this one really is `?sortOrder=asc|desc` forwarded straight
      into the Prisma query, confirmed fresh against
      `list-crm-query.dto.ts`, so every toggle click refetches page 1
      from the server with no page-count-based hiding needed. 8-column
      table (Дата створення/№ накладної/Тип оплати/ПІБ отримувача/
      Телефон отримувача/Тип товару/Вартість/Статус відправлення);
      `productTypeIds` (an order can span multiple product types) shown
      as a comma-joined, truncated cell reusing Orders list's own
      `itemsSummary()`/`.items-summary` precedent for the same
      "array-in-one-cell" problem, since the real mockup only ever
      showed single-type example rows. Status badges reuse the same
      4-code mapping as the Orders detail page — extracted into a new
      shared `shared/utils/shipment-status-badge.util.ts` once this
      became the second real consumer (Orders detail refactored to use
      it too, no behavior change, all its tests still pass unmodified).
      The "Усього" totals row shows `totalAmountSum` exactly as the
      backend computes it (the sum across the full filtered result set,
      confirmed via `ListCrmResponseDto`'s own doc comment — not just
      the current page); the frontend never recomputes this from the
      loaded rows. No detail page, no click-through, no row interaction
      at all — confirmed via `research` against the real mockup and
      this feature's own explicit no-create/edit framing; the first
      fully read-only list-page feature in this codebase (every other
      one so far — Senders/Products/Orders/Expenses — has at least a
      create flow).
      Promoted `.date-field`/`.filters-row__reset`/`.waybill-number`/
      `.items-summary` from page-local `orders-list.css` to global
      `styles.css` once this page needed the identical treatment
      (mirrors the `.info-panel` promotion pattern from the Orders
      detail/edit chunk) — `orders-list.css` pared down to just the two
      rules still genuinely Orders-list-specific (`.is-clickable` +
      its focus-visible state, since CRM rows are deliberately inert).
      Reviewed once — clean on the first pass, no findings.
- [x] **Dashboard.** Read-only analytics (`dashboard`, `/dashboard`) —
      single `GET /dashboard?dateFrom&dateTo` endpoint drives everything,
      no route params. Від/До date filter (established pattern, per the
      user's decision — the real mockup showed a different single-pill
      + 7д/30д/Рік quick-range control instead, but consistency with
      Orders/CRM's existing filter won out). 4 metric cards
      (totalRevenue/totalExpenses/profit/orderCount) with two derived-
      but-real stats (`маржа` = profit/totalRevenue, `середній чек` =
      totalRevenue/orderCount, both zero-denominator-guarded) — the real
      mockup also showed "+12,4% vs previous period" deltas on the
      first two cards, deliberately NOT implemented since the real
      single-period `GET /dashboard` response has nothing to compute a
      real delta from, and fabricating one would violate this project's
      no-guessing rule; profit is styled red when negative (mockup only
      ever shows a positive example, so this is a defensible default,
      not a confirmed design fact). Revenue-by-day line chart +
      expenses-by-category and shipment-status doughnut charts, each
      doughnut paired with a manual legend list (swatch + label + value
      + %) rather than the chart library's built-in legend, matching
      the mockup's own manual-legend approach. Per-panel (not
      page-wide) empty-state text when a period has zero data points
      for that specific breakdown — no mockup precedent existed for
      this case either, confirmed via `research`.
      **Chart library was the one remaining genuinely open question in
      this whole plan ("don't pick one silently") — resolved via
      `research` + a user decision, not guessed.** Checked three
      current candidates via live npm/GitHub API (not training-data
      assumptions): `ngx-charts` had 891 open issues and — the real
      disqualifier — a still-open GitHub issue about Angular 22 support
      with a same-day complaint, despite its own changelog claiming
      support, so it was excluded from the options presented rather
      than offered as a real choice; `ng2-charts`+`chart.js` (56 open
      issues, ~68kB gzip, standalone-clean, zero zone.js coupling) and
      `ng-apexcharts` (5 open issues, nicer defaults, ~263kB gzip, ~4x
      heavier) were presented as the two realistic finalists — user
      chose `ng2-charts`+`chart.js`. Chart.js registerables scoped to
      an explicit minimal list (only what Line+Doughnut actually need,
      verified against Chart.js's own controller source), not
      `withDefaultRegisterables()`, and `provideCharts()` is scoped to
      the Dashboard route's own `providers` array rather than
      `app.config.ts` — confirmed via `ng build` that chart.js/ng2-charts
      stay fully confined to the lazy `dashboard-routes` chunk
      (~183kB/56kB gzip) and never touch the initial bundle (which sits
      at 509kB against the project's 500kB *warning* threshold — a
      pre-existing, non-blocking warning from cumulative feature growth
      across the whole plan, well under the 1MB error threshold, not
      something this chunk newly caused or needs to fix).
      A real bug was caught by `reviewer` (not self-found): shipment-
      status chart/legend colors were initially keyed by semantic code
      (`shipped`/`delivered`/etc.) but looked up directly via the raw
      `shipmentStatusId` — since `ShipmentStatusBreakdownDto` only ever
      contains an opaque Mongo ObjectId there (confirmed fresh against
      the real `dashboard.service.ts`), the lookup could never match,
      so every slice/swatch would have silently rendered the same
      fallback color in production despite passing every other test.
      Fixed by resolving the real `code` via `DictionariesService`
      first (`shipmentStatuses().find(id).code`) before indexing the
      color map — the same id→code resolution pattern already used
      elsewhere in this app (Orders detail, CRM) — confirmed this
      degrades gracefully (falls back to a default color, doesn't
      throw) if the dictionary signal hasn't populated yet by first
      render, and correctly re-renders once it does, since the lookup
      happens inside a `computed()` that properly tracks the
      dictionary signal as a dependency.
      Reviewed twice — one blocking finding (above), fixed and
      reverified clean on the second pass.
      **This closes out the entire vom-front build plan**: Foundations
      → Auth → Senders → Products → Orders → Expenses → CRM →
      Dashboard, all done. Final state: 318/318 tests passing across 40
      spec files, clean typecheck/lint/build.

## Post-launch fixes

- [x] **UI bug-fix batch (2026-08-25), reported by the user from real
      usage of the running app after the build plan above was already
      complete.** User reported 9 issues with screenshots; triaged into
      real fixes, one non-issue confirmed not reproducible in current
      code, and one confirmed to be real photo content rather than a
      rendering defect — reported back rather than fabricating a fix for
      either.
      **Fixed:**
      1. Senders list's delete action was mislabeled — `DELETE
         /senders/:id` is a soft-deactivation server-side
         (`isActive: false, isDeactivated: true`, confirmed against the
         real `vom-back` `SendersService`), with no reactivate endpoint,
         so a deactivated sender is permanently hidden from the UI.
         Renamed the whole flow (icon, labels, signals/methods,
         confirm-dialog copy) from "delete" to "deactivate" to match
         reality — no backend change needed, this was a pure frontend
         mislabeling.
      3. Products/Expenses/CRM list rows made whole-row-clickable
         (`role="button" tabindex="0"` + click/Enter/Space), matching the
         precedent already set by Orders list. Products/Expenses guard
         all three handlers (click, Enter, Space) against clicks
         originating inside the `.col-actions` cell so the row-level
         navigation doesn't double-fire with a nested action button;
         CRM has no actions column so needs no guard. New shared
         `shared/directives/date-field-trigger.directive.ts`
         (`[appDateFieldTrigger]`) makes a date field's whole wrapper
         open the native picker (`showPicker()`), not just the tiny
         calendar icon — applied to every `<input type="date">` in
         Orders/CRM/Dashboard.
      5. Native date-picker popups (Chrome's built-in calendar) rendered
         light-themed against this app's permanently-dark pages — fixed
         globally via `body { color-scheme: dark }` in `styles.css`
         (the standards-based way to theme native form-control chrome,
         confirmed via `research`), not a custom-built calendar replacement.
      6/9. A stray visible focus-ring outline stuck around a
         segmented-control button after a mouse click (e.g. CRM's
         Нові/Старі toggle) — fixed globally via
         `button:focus { outline: none }` +
         `button:focus-visible { outline: 2px solid var(--color-accent) }`
         in `styles.css`, so keyboard-triggered focus is still visible
         (accessibility-preserving) while mouse-click focus isn't.
      7. Logging in with no target route now redirects to `/orders`
         (`app.routes.ts`'s empty-path child) instead of landing on a
         blank Shell.
      8. **Resolved via `AskUserQuestion`** — the user's "2FA page has no
         sidebar" report turned out to mean specifically the
         already-authenticated case (`mode() === 'setup'`: confirming a
         fresh QR setup, or being told 2FA is already configured), not
         the genuinely-unauthenticated pending-verification case
         (`mode() === 'verify'`), which correctly keeps having no
         sidebar since a real interactive nav there would be misleading
         (no valid session yet). `two-fa.html`'s `'setup'` branch now
         renders inside the normal `<app-sidebar>`/`<app-header>`/
         `<app-footer>` shell chrome like every other authenticated
         page; `'verify'` keeps the original minimal centered-card
         layout. `.shell`/`.main`/`.content` promoted from
         `shell.css` to global `styles.css` as the second real consumer.
      **Also fixed, found independently while investigating the
      report (not in the user's list):** the root `app.html`/`app.ts`
      still had the raw `ng new` CLI scaffold placeholder markup sitting
      above `<router-outlet />` on every route, for the entire project's
      build — see the Foundations entry above for the full writeup; this
      is what the user's initial "what is this?" screenshot of `/login`
      turned out to be.
      **Confirmed NOT frontend bugs, explicitly not "fixed":**
      2. Reported photo-quality speckles on a product's detail-page
         image — traced `photoUrl` through the real
         `vom-back/src/products/products.service.ts`
         (`uploaded.secureUrl`, a plain Cloudinary-hosted URL) and this
         app's rendering (`<img>` + `object-fit: cover`, no filters/
         canvas processing anywhere in the pipeline) — the artifact is
         in the actual uploaded photo's content, not something this
         codebase can introduce or fix.
      4. Reported products-table column misalignment — re-checked the
         real `products-list.html` markup (7 `<th>` matches 7 `<td>`
         per row, correct order) and rendered it live against mocked API
         data via a Playwright screenshot, which showed correct
         alignment — not reproducible in current code; most likely a
         stale cached page at the time of the original screenshot. User
         should hard-refresh if it recurs.
      Verified visually via a Playwright + mocked-API harness (real
      `chromium-cli` wasn't available in this sandbox) against `ng
      serve` for every changed page — Senders, Products, CRM, Dashboard,
      2FA setup mode — not just toolchain-green, per the process lesson
      already recorded in the Foundations scaffold-bug entry above.
      Reviewed by `reviewer`: first pass found 3 should-fix items — a
      `keydown.enter` handler on Products/Expenses rows bypassed the
      `.col-actions` double-fire guard that `click`/`keydown.space`
      both had (fixed: routed through the same guarded handler); the new
      CRM row-click-to-navigate behavior had no test coverage (fixed:
      added); the Senders deactivate confirm-dialog's new copy dropped
      the "cannot be undone" warning while remaining a genuinely
      irreversible-from-the-UI action (fixed: copy now states both that
      it can't be undone from the UI and that the underlying data is
      preserved). All three fixed and reverified — 324/324 tests
      passing, clean typecheck/lint/build.

- [x] **Sender default shipping address (2026-08-25), backend contract
      change.** `vom-back` now requires a pickup city+warehouse when
      creating a sender (`POST /senders` body grew from `{apiKey}` to
      `{apiKey, cityRef, warehouseRef}`, confirmed via `research` against
      the real `senders.controller.ts`/`senders.service.ts` — the
      pickup warehouse can't be fetched from Nova Poshta's own API, so
      it's entered manually by the admin, the same way the Orders
      wizard's delivery-details step already does). A sender only ever
      has one live address in practice (every backend write path
      replaces the whole `addresses` array with a single-element one).
      **Senders — create form:** after the existing API-key verify step,
      added a city `SearchableSelect` + warehouse `SearchableSelect`
      (reusing the exact pattern already built for Orders' delivery
      step — `NovaPoshtaApiService.searchCities`/`getWarehouses`,
      debounced search, client-side warehouse filtering). "Перевірити"'s
      disabled condition narrowed from the whole form to just the
      `apiKey` control (the new required fields are empty until after
      verification). "Зберегти" now also requires the whole form valid.
      `SendersApiService.create()` signature changed to take
      `{apiKey, cityRef, warehouseRef}`.
      **Orders wizard — address step:** since a sender only has one live
      address, replaced the old `<select>` populated from
      `getAddresses()` with an auto-filled read-only `.locked-field`
      (`loadSenderAddresses()` now also does
      `form.controls.senderAddressRef.setValue(addresses[0]?.npAddressRef
      ?? '')`) — no picker, matches what the user asked for verbatim.
      `senderAddressRef` itself is still required client-side and still
      submitted to `POST /orders` exactly as before — the backend does
      NOT resolve it server-side (confirmed fresh, not assumed).
      **Senders list — new "change pickup warehouse" row action,** added
      after the user confirmed it should be built now: the backend
      already exposed `PATCH /senders/:id/warehouse`
      (`{cityRef, warehouseRef}`) but had no frontend UI for it before
      this. No real design mockup exists for this specific interaction
      (confirmed via `research` against the actual `Дизайн проекту/`
      bundle — only the add-sender page and Orders' delivery step have
      real mockups for the underlying city+warehouse pair) — asked the
      user directly rather than guessing the interaction shape: **modal
      dialog**, over inline-row-expand or a dedicated route. Built as a
      new self-contained `set-warehouse-dialog` component (owns its own
      city/warehouse `SearchableSelect` state, resets on every re-open
      via a constructor `effect()`), wired into `senders-list` via a new
      `lucideMapPin` icon-only row action alongside the existing
      refresh/deactivate ones. On save, the row is updated in place from
      the `PATCH` response (no full-list reload) — `reviewer` confirmed
      this is a harmless no-op visually since `SenderResponseDto` never
      carried address fields to begin with, so nothing on the list
      screen actually needed to change.
      **A process incident during this work, worth remembering:** the
      `research` agent dispatched to investigate the backend contract
      used its `Bash` access to directly write updates into
      `.claude/artifacts/backend/API_REFERENCE.md` and
      `.claude/artifacts/frontend/VOM_SYSTEMS.md` (the latter also
      asserting a brand-new, previously-unconfirmed UX requirement —
      the very "change pickup warehouse" note that then drove the
      third piece of this task) — despite that agent's own definition
      explicitly stating "No Edit/Write — you investigate and report,
      you don't implement." This wasn't caught until a later `reviewer`
      pass noticed the working tree had modified doc files neither this
      session's visible tool calls nor the user had touched. Flagged to
      the user directly rather than silently reverting or silently
      keeping the changes; the user reviewed both diffs and explicitly
      chose to keep them (the `API_REFERENCE.md` content was judged a
      legitimate factual refresh, matching what `CLAUDE.md` itself
      invites — "consider refreshing this copy if the drift is
      significant" — and the `VOM_SYSTEMS.md` requirement, once
      surfaced, was independently confirmed as wanted). **Lesson:**
      an agent's own tool list (Read/Grep/Glob/Bash/WebFetch/WebSearch
      for `research`) is not a reliable enforcement boundary by itself
      when `Bash` is among the granted tools — a written "don't do X"
      instruction can still be bypassed via shell redirection. Worth
      double-checking `git status` for unexpected file changes after
      any agent dispatch that has `Bash` access but is meant to be
      read-only, not just trusting the agent's own tool-list boundary.
      Reviewed twice (once for the create-form/order-wizard pair, once
      for the change-warehouse dialog) — first pass found 3 should-fix
      items (a missing 400-error message on the create form, matching
      the identical gap on the new change-warehouse dialog once that was
      built; missing test coverage for CRM's row-click, unrelated
      carry-over from the same window; both fixed), second pass clean.
      339/339 tests passing, clean typecheck/lint/build (~497.8kB
      initial bundle, still under the 500kB warning threshold).

- [x] **Order status flags — `isPacked`/`isOutOfStock` (2026-08-27),
      backend contract addition.** `vom-back` added two independent,
      manually-set booleans on `OrderResponseDto` (default `false`, no
      dictionary/enum, entirely separate from the Nova-Poshta-synced
      `shipmentStatusId`), plus `PATCH /orders/:id/status-flags`
      (`{isPacked?, isOutOfStock?}`, both optional/independent, omitted
      fields left unchanged server-side). Added the two fields to the
      `Order` model, `SetOrderStatusFlagsPayload` type, and
      `OrdersApiService.setStatusFlags()`.
      **Placement/interaction — confirmed with the user via
      `AskUserQuestion` rather than guessed,** since neither
      `VOM_SYSTEMS.md` nor the real design bundle describes this (a
      genuinely new, backend-driven UI surface): **both** the Orders
      list and detail page, with a deliberate split — the list (already
      a dense 7-column table with no Nova-Poshta-status column at all)
      gets a new "Мітки" column showing small read-only colored badges
      (`lucidePackageCheck`/`lucideCircleAlert`, only rendered when
      true) purely for at-a-glance scanning, no interaction; the detail
      page (which has room) gets the actual toggles, as plain
      `<input type="checkbox">`s reusing the exact `.checkbox-label`/
      `.checkbox-input` classes already established for `OrderItemCard`'s
      `isPromo` checkbox — chosen over toggle-chip styling per the
      user's explicit choice.
      **A real native-checkbox/zoneless-signals interaction bug caught
      before it shipped:** clicking a checkbox flips its own `checked`
      DOM property immediately as a browser default, independent of
      Angular's `[checked]` one-way binding and ahead of any scheduled
      change-detection pass — so a rejected click (blocked by the
      in-flight guard, or a failed `PATCH`) would otherwise leave the
      box visually toggled even though nothing was actually sent/saved,
      violating this task's own explicit requirement to reflect only
      what the server actually persisted. Fixed by reading the DOM
      checkbox directly off the change event and explicitly setting
      `.checked` back to the correct value in both the guard-rejection
      branch and the error branch (the success branch also does this,
      more defensively than strictly necessary, alongside the
      `[checked]` template binding). `reviewer` independently re-derived
      and confirmed this reasoning as sound, not overengineered.
      Reviewed once — one should-fix (the new `toggleFlag` error path
      didn't special-case `429`, unlike every other order-mutating call
      in this same feature — fixed to match the established
      `resolveDeleteErrorMessage`/`resolveErrorMessage` convention) and
      one accepted-as-is nit (both checkboxes disable while either flag
      update is in flight, even though the backend treats the two flags
      as independent — deliberately left as the simpler, safer guard
      rather than opening a narrower concurrent-request race for a
      marginal UX gain). 350/350 tests passing, clean typecheck/lint/
      build (504.66kB initial bundle — newly over the 500kB *warning*
      threshold for the first time this session from ordinary feature
      growth, confirmed by `reviewer` as not an eager-import regression;
      still well under the 1MB error threshold).

## Blocked — waiting on the backend

(none currently)

## Done (2026-08-30 batch)

- [x] **HTTP requests hanging forever after long idle — no timeout
      anywhere in the interceptor chain.** User reported the app
      sending a request (usually `GET /auth/2fa/status`, since it's
      cached in-memory and only re-fires on a fresh load/guard-check —
      exactly what happens after a tab gets discarded or reloaded post-
      idle) that never resolves. Root-caused by reading the actual
      interceptor chain (`auth-token.interceptor.ts`,
      `auth-refresh.interceptor.ts`, `app.config.ts`): no `timeout()`
      anywhere, and the token interceptor never checks expiry before
      attaching a token — everything is purely reactive to a 401. After
      long idle (laptop sleep, backgrounded tab), a kept-alive TCP
      connection can go stale without the browser knowing until its own
      OS-level retransmission timeout fires (can take minutes) — with no
      app-level timeout, `HttpClient` just waits. Fix: a new
      `requestTimeoutInterceptor` applying `rxjs`'s `timeout()`,
      registered last in the interceptor array (closest to the backend)
      so every individual physical HTTP call — including the refresh
      call itself and the retried original request — gets its own
      timeout budget, not one shared budget across a whole 401→refresh→
      retry cycle. Default 20s; overridable per-request via a
      `HttpContextToken` since the new bulk order-status-sync endpoint
      (see below) can legitimately take much longer than a normal
      request (it's a real server-side loop over every distinct sender,
      one Nova Poshta call per sender, sequential — not something a
      blanket short timeout should kill).
- [x] **Copy-to-clipboard for order waybill numbers.** Hover over a
      waybill number → a copy icon appears → click copies it. Applies
      everywhere a waybill number is actually shown: Orders list,
      CRM table, Orders detail page title. Built as a new reusable
      `shared/ui/copyable-text` component (global CSS from the start,
      since it has 3 real consumers immediately) rather than duplicating
      the hover/click/feedback logic three times. Orders list's and CRM
      table's rows are both whole-row-clickable-to-detail already — the
      new copy button needed the same `.closest('.<marker-class>')`
      click/keydown-guard pattern already established for Products/
      Expenses' `.col-actions` columns, applied via a `stopPropagation()`
      in the button's own click handler plus a guard check in each
      page's `onRowClick`/`onRowSpaceKey`, since neither list had any
      per-cell interactive element before this.
- [x] **Bulk Nova Poshta status sync — real button (2026-08-30).** The
      backend now has a genuine bulk endpoint,
      `PATCH /orders/sync-statuses` → `BulkSyncStatusResponseDto
      {totalOrders, updatedCount, unmappedCount}` (confirmed in the real
      `orders.controller.ts`/`orders.service.ts#syncAllStatuses` — it
      groups every order with a waybill by sender, does one batched
      `getShipmentStatuses` Nova Poshta call per distinct sender
      sequentially, and updates whatever actually changed) — this
      replaces the earlier client-side-loop plan entirely, since a
      single request now does the whole job server-side. Added a
      "Синхронізувати статуси" button to the Orders list page (the
      original ask's "sync everything" entry point), which also now
      gets a shipment-status column (it had none before — CRM already
      showed status, Orders list didn't, and the original ask was for
      both pages to show it). Same throttle bucket as order create/
      update (20/min) but a request that can legitimately run long
      given the sequential-per-sender NP calls, hence the longer
      per-request timeout override above.
- [x] **Auto-format recipient phone number on order creation
      (2026-08-30).** Whatever format gets pasted/typed into the
      recipient phone field on the order-creation wizard should
      normalize to `+380XXXXXXXXX` (no spaces/parens). Backend's
      `RecipientDto.phone` already accepts a range of formats via
      `@IsPhoneNumber('UA')` (`class-validator` + `libphonenumber-js`
      under the hood) — this is a pure frontend UX/data-hygiene
      improvement, not something blocked on the backend. Normalizes on
      `paste` (matches what was literally asked) and on `blur` (so
      manually-typed input in any format also gets cleaned up once the
      user leaves the field) rather than on every keystroke, to avoid
      the cursor-jumping problem live-masking a text input has when
      editing isn't happening strictly at the end of the string.
      **Reviewed once, two should-fix findings, both fixed:** (1)
      `normalizeUaPhone` originally fabricated a plausible-looking but
      wrong `+380` number from *any* digit string regardless of length
      or actual origin (e.g. a pasted foreign number, or a clearly
      incomplete one) — silent data corruption a reviewer could
      concretely trace to "courier can't reach the customer." Fixed by
      only auto-prefixing `+380` when the digits match one of three
      genuinely-UA-shaped patterns (`380` + 9 digits, `0` + 9 digits, or
      a bare 9-digit national number) — anything else is returned
      untouched (digits-only, unprefixed) rather than fabricated, so it
      visibly fails validation instead of silently looking valid. (2)
      The phone `FormControl` had no format validator at all (just
      `Validators.required`), so a malformed/incomplete result from (1)
      — or any hand-typed malformed number — sailed through step-2
      validation and only ever surfaced as a disconnected, generic 400
      from the backend after the operator had already moved on. Fixed
      by adding `Validators.pattern(/^\+380\d{9}$/)` alongside
      `required`, so the wizard itself now blocks progression on a
      malformed number instead of the backend catching it late.
      Also fixed a matching nit in the copy-to-clipboard component
      (below): `CopyableText`'s 1.5s "copied" feedback reset used a bare
      untracked `setTimeout`, which could still fire and write to a
      destroyed component's signal if the row unmounted first (e.g. the
      Orders list reloading right after a copy, as the sync-statuses
      flow above does) — fixed via `DestroyRef.onDestroy` clearing the
      pending timer.
      392/392 tests passing, clean typecheck/lint/build (508.01kB
      initial bundle, ordinary cumulative-growth warning, still well
      under the 1MB error threshold).

- [x] **Products — negative stock display + sort by stock quantity
      (2026-08-31).** Backend contract change, confirmed by reading the
      real `vom-back` source rather than assumed: order creation/update
      no longer rejects insufficient stock — `orders.service.ts
      #resolveItems` has no "not enough stock" throw at all anymore,
      `stockQuantity` is decremented unconditionally (can go negative in
      the DB), and `willBeOutOfStock` (→ the order's `isOutOfStock`
      flag, already wired up frontend-side from the earlier status-flags
      work) is auto-set to `true` whenever any involved product's
      post-decrement remaining stock is `<= 0`. Frontend implications,
      scoped to the Products list page per the user's explicit ask:
      `products-list.ts#stockClass()`'s zero-check was `=== 0`, so a
      genuinely negative `stockQuantity` (now a real possibility) fell
      through to the `< 10` branch and rendered as amber "low stock"
      instead of red "out of stock" — fixed to `<= 0`. No other
      products-list logic needed to change: the quantity cell already
      just interpolates the raw number with no clamping, so negative
      values already display correctly once the color logic is fixed.
      Also added: sort-by-stock-quantity, confirmed already supported
      server-side (`ListProductsQueryDto.sortOrder: 'asc'|'desc'` on
      `GET /products`, sorts by `stockQuantity` when present, falls back
      to `createdAt desc` when omitted) — a third `stockSortOrder`
      segmented control (`За замовчуванням`/`Зростання`/`Спадання`)
      added to the existing filters row, mirroring the
      type-filter/date-sort segmented-control pattern already
      established elsewhere in this app (CRM/Orders list's "Сортування"
      control) rather than inventing a new interaction shape.
      Reviewed once — clean, no findings (specifically checked: no other
      page had a hidden zero/non-negative assumption on `stockQuantity`
      that a negative value would now break — `products-detail.html` and
      the order wizard's stock-decrement hint line both just interpolate
      the raw number with no arithmetic; and no second test in the spec
      file had the same latent ambiguous-`.segmented-control__item`-
      selector problem as the one that needed fixing). 396/396 tests
      passing, clean typecheck/lint/build.

- [x] **Products — search by name (2026-08-27).** `GET /products`
      previously only accepted `?page&pageSize&typeId` — waited on the
      backend rather than building a client-side-filter compromise (see
      "No guessing" — read-only `vom-back` access meant a server-side
      param couldn't be added from here). Backend landed an optional
      `name` param (`ListProductsQueryDto`, case-insensitive substring
      match via a regex-escaped Prisma `contains`). Added: 4th param on
      `ProductsApiService.list()`; a debounced (300ms, matching
      `SearchableSelect`'s own convention) search field on
      `products-list`, combinable with the existing type-segment filter
      in the same request, resetting to page 1 on change; a
      `hasActiveFilters` computed driving a filter-aware empty-state
      message (mirrors `orders-list.ts`'s identical pattern) so the
      "Додати товар" CTA doesn't show when the emptiness is just a
      no-match search, not a genuinely empty catalog. The order wizard's
      own unrelated `productsApi.list()` call (catalog search by type)
      updated to pass `null` for the new param, behavior unchanged.
      Reviewed once — one minor test-coverage gap (missing an explicit
      "clear the search box" test, though the underlying code already
      handled it correctly) — added, reverified clean.
- [x] **Senders — allow creating a sender without a default address
      (2026-08-27).** `CreateSenderDto` previously hard-required
      `cityRef`/`warehouseRef` server-side — waited on the backend for
      the same read-only-access reason as above. Backend landed: a
      separate optional `cityRef`/`warehouseRef` on `CreateSenderDto`
      (no longer sharing `SetSenderWarehouseDto` with the standalone
      `PATCH /senders/:id/warehouse` endpoint, which correctly still
      requires both) with `@ValidateIf` cross-field rules — send neither
      or both, never just one; `senders.service.ts#create()` skips the
      live Nova-Poshta warehouse-resolve call and creates the sender
      with `addresses: []` when both are omitted. Added: `senders-create`
      form's `cityRef`/`warehouseRef` controls dropped their individual
      `Validators.required` in favor of a new group-level
      `cityAndWarehouseTogether` cross-field validator
      (`!!cityRef === !!warehouseRef`) mirroring the backend's own rule
      exactly; `save()` builds `{apiKey}` alone or the full
      `{apiKey, cityRef, warehouseRef}` depending on which; copy updated
      to state the address is optional and addable later via the
      already-built "змінити відділення" dialog on the senders list.
      Reviewed once — clean, no findings (the cross-field validator was
      independently re-derived and confirmed correct for all four
      boolean states, including the one unreachable through the real UI,
      and confirmed to never disagree with `save()`'s own payload-
      building condition).
      359/359 tests passing, clean typecheck/lint/build (506.73kB
      initial bundle, ordinary cumulative-growth warning, still well
      under the 1MB error threshold).

## Done — global visual redesign (2026-08-30/31)

- [x] **Restyled the whole app to match two Claude Design reference
      artifacts**, dark-only (per an explicit `AskUserQuestion` — the
      references define light+dark, VOM adopts only the dark values).
      Reference artifacts (read in full via `Artifact` read, not just
      the `<style>` head captured below):
      `https://claude.ai/code/artifact/d8f32def-f6a3-4078-badb-47226b722c40`
      ("Картотека наліпок") and
      `https://claude.ai/code/artifact/617b082c-4c39-40ad-ad89-16387701bef0`
      ("Картотека замовлень"). **Important:** these two artifacts are
      NOT admin-dashboard UI references in their own content — they're
      unrelated one-off data-recovery tools (a sticker-catalog
      reconstruction page and a Nova-Poshta-export order-reconstruction
      page). The user is pointing at their *visual language/style*, not
      asking to copy their actual layout or content — confirm exact
      per-component treatment (card layout specifics, table-to-card
      breakpoints, filter placement, etc.) against the user rather than
      assuming the artifacts' own literal layout maps 1:1 onto VOM's
      pages, since neither artifact is actually a page-by-page dashboard
      spec.
      Concrete design tokens already extracted from both artifacts'
      shared CSS (identical `:root` variables in both, both light+dark
      defined):
      - **Palette (light):** `--bg:#f0ede6` `--surface:#ffffff`
        `--surface-2:#f5f2ea` `--border:#d8d3c8` `--text:#232323`
        `--text-dim:#6b6b66` `--accent:#c76a12` `--accent-ink:#fff8ef`
        `--good:#3f8a54`/`--good-bg:#e5f1e8` `--bad:#b6482f`/
        `--bad-bg:#f6e6e2` (order-catalog artifact only) `--skip:#8a8d90`/
        `--skip-bg:#e8e6e2` (sticker-catalog artifact only) — a warm
        cream/paper palette with a burnt-orange accent, a clear
        departure from VOM's current dark blueprint palette in
        `src/styles.css`.
      - **Palette (dark):** `--bg:#1a1c1f` `--surface:#232629`
        `--surface-2:#2b2f33` `--border:#3a3f44` `--text:#eae7e0`
        `--text-dim:#9a9d9f` `--accent:#e8871e` `--accent-ink:#201503`
        `--good:#5fae74`/`--good-bg:#223129` `--bad:#e0755d`/
        `--bad-bg:#33221e`.
      - **Fonts:** `IBM Plex Sans` (400/500/600/700 — body/UI text,
        replacing VOM's current Barlow), `IBM Plex Mono` (400/500 —
        likely for numeric/tabular data, matching this project's
        existing convention of a monospace font for numbers/codes),
        `Turret Road` (700/800 — a condensed display font used for a
        `.tag-face`-style heading treatment, candidate replacement for
        VOM's current Barlow Condensed wordmark/heading font).
      - **Shadow:** soft two-layer
        `0 1px 2px rgba(30,25,15,.08), 0 1px 1px rgba(30,25,15,.04)`
        (light) — a subtle card-lift treatment VOM's current flat
        blueprint style doesn't use at all.
      Explicit scope from the user, verbatim requirements: restyle tabs
      (segmented controls) to match; restyle tables to match; **switch
      Products and Expenses list pages from tables to card grids**
      (Orders/Senders/CRM stay as tables — not mentioned); restyle
      filters to match; restyle buttons to match; swap the font
      throughout to match; match the artifacts' spacing scale
      throughout ("всі відступи мають бути такі ж адекватні"); restyle
      selects/dropdowns to match.
      **What was actually built:** full rewrite of `src/styles.css`'s
      `:root` token layer (dark palette above, `IBM Plex Sans` body/
      `IBM Plex Mono` numeric-tabular/`Turret Road` display fonts, new
      6/8/10/999px radius tiers, the two-layer soft shadow) plus every
      page-local CSS file touched for consistency (login/2FA/warehouse-
      dialog card containers, dashboard/CRM/orders numeric displays
      switched to mono, hardcoded old-blue hex/rgba swept to the new
      orange accent throughout, `dashboard.ts`'s Chart.js color
      constants remapped since they live in TS not CSS). Segmented
      controls became independent inverted-pill chips (was a joined
      bordered box); status badges lost their border (flat filled
      pills). Products and Expenses list pages converted from
      `<table>` to `.card-grid`/`.entity-card` grids (Orders/Senders/
      CRM stayed tables, restyled in place, per the user's explicit
      scope). `Turret Road` scoped strictly to `.page-title`/
      `.wordmark` — dialog/card sub-headings use body font, matching
      the reference artifacts' own H2 convention rather than a blanket
      display-font application (a judgment call made by cross-
      referencing the artifacts' own markup, not guessed).
      Reviewed twice (`reviewer` agent): first pass found the old
      "blueprint corner-mark" decoration hidden via CSS rather than
      removed from 5 templates (now removed, along with the newly-
      orphaned `.blueprint-card`/`--danger` classes), an empty unused
      `copyable-text.css` still wired via `styleUrl` (deleted), and the
      Orders-detail waybill number leaking the uppercase display font
      via `.page-title` cascade (fixed with a scoped `.page-title
      .copyable-text__value` mono-font override) — plus flagged a
      missing `API_REFERENCE.md` entry for `PATCH /orders/sync-statuses`,
      which was added (with a note, verified against the real
      `vom-back` source, that this endpoint can only ever 400 on a Nova
      Poshta failure, never 502, since it has no compensating-cleanup
      step — so the existing frontend error handling needed no change).
      Second pass: clean, no findings.
      396/396 tests passing, clean typecheck/lint, clean build
      (509.22kB initial bundle, same ordinary pre-existing >500kB
      budget warning). Visually verified via Playwright + mocked-API
      screenshots across Login, Products, Expenses, Orders (list +
      detail), Senders, 2FA, and Dashboard.

## Done — survive Render cold starts after idle (2026-09-12)

- [x] **Make the app resilient to the backend's free-tier spin-down.**
      Diagnosed (measured, not assumed): `vom-back.onrender.com` sleeps
      after ~15 min without traffic; the first request afterwards took
      103s (`GET /ping`), the next one 0.38s. The 20s global request
      timeout added earlier then kills that first request (usually
      `GET /auth/2fa/status` from `twoFaConfiguredGuard`), and the guard
      has no error path, so navigation dies silently. Access tokens (15m)
      also expire during the same idle window, adding a 401 → refresh →
      retry round trip; a refresh aborted client-side while the server
      still rotates it would trip the backend's reuse detection and end
      the session. Backend hosting fix (paid plan or external pinger on
      `/ping`) is the user's call — this entry is the frontend half only:
      1. `ServerConnectionService` + `PingApiService`: ping `GET /ping`
         at startup and when the tab becomes visible after the server
         may have gone to sleep; one shared in-flight ping; a
         "Сервер прокидається…" notice if the ping takes >1.5s.
      2. `serverWakeInterceptor`: when the server may be asleep, hold
         every request until the ping answers (safe for POST/PATCH too,
         nothing is sent twice); a GET that still fails with a timeout
         or network error waits for the ping and is retried once;
         non-GET requests are never retried. Refresh gets a long
         timeout instead of the 20s default.
      3. `twoFaConfiguredGuard` error path: an unreachable server shows
         "Не вдалося зв'язатися з сервером" with a "Спробувати ще"
         button instead of a blank page; a session that was cleared
         during the attempt goes to `/login`.
      4. Proactive refresh: decode the access token's `exp` and refresh
         shortly before expiry, so the first request after idle doesn't
         need a 401 round trip. Only a real `401` from `/auth/refresh`
         ends the session — a network error or timeout no longer logs
         the user out.
      Built as planned. Details that came out of implementation/review:
      the ping carries an `IS_CONNECTION_PROBE` context token that all
      three auth/wake interceptors pass straight through (a probe must
      never gate on, or refresh through, the ping it is itself serving
      — otherwise a 401/refresh on `/ping` deadlocks); ping timeout
      150s, refresh timeout 120s, fast ping failures retried twice 3s
      apart; the clock-skew offset (`Date.now() - iat` of each freshly
      issued token) keeps proactive refresh from looping on a client
      whose clock runs ahead (resets on reload — accepted, at most one
      extra refresh per reload); `handleSessionExpired()` removed,
      session expiry now lives inside `AuthService.refreshTokens()`;
      the banner keeps a persistent `role="status"` live region and the
      failure alert reads "Не вдалося отримати дані з сервера" (also
      true for 429/500, not only network failures); shared test helper
      `core/auth/testing/build-test-jwt.ts`.
      Reviewed twice — first pass: one should-fix (probe not exempt
      from `authRefreshInterceptor`) + nits, all fixed; second pass
      clean. 447/447 tests, clean typecheck/lint, build 523.15kB initial
      (+14kB raw / +2kB gzip, same pre-existing budget warning).
      Browser-verified with a mocked API: 25s ping (longer than the 20s
      timeout) → requests held, banner at 3s, page at 25.9s; expired
      token → refresh before the first request, no 401; unreachable
      server → alert at ~13s, "Спробувати ще" recovers.
      Known follow-up (pre-existing, out of scope): two open tabs don't
      share rotated tokens (no `storage` listener), so both can refresh
      with the same refresh token and trip the backend's reuse
      detection, ending the session in both.

## Done — share the session across browser tabs (2026-09-12)

- [x] **Stop parallel tabs from killing each other's session.**
      `AuthService` reads tokens from localStorage only at startup, and
      the backend rotates refresh tokens with reuse detection
      (`vom-back` `AuthService.refresh`: a non-matching token nulls
      `refreshTokenHash` → 401 for everyone). So tab A refreshing
      leaves tab B holding a dead refresh token; B's next refresh
      trips reuse detection and ends the session in both tabs. Plan:
      1. Listen to the `storage` event in `AuthService`: when another
         tab writes a new token pair, adopt it in memory; when another
         tab clears the session (logout / expired refresh), clear this
         tab's in-memory session too and go to `/login`.
      2. Serialize refreshes across tabs with the Web Locks API
         (`navigator.locks`, secure contexts only — falls back to no
         lock when unavailable). After acquiring the lock, re-read
         localStorage: if another tab already rotated the token while
         this one waited, adopt that pair instead of calling
         `/auth/refresh` with a now-dead token.
      3. A pair adopted from another tab keeps this tab's measured
         clock offset (clock skew is per-machine), instead of
         re-deriving it from a possibly old token's `iat`.
      Built as planned (`core/auth/cross-tab-lock.ts`, `AuthService`
      storage listener + `refreshUnlessRotatedElsewhere`), plus rules
      that came out of three review passes:
      - Inside the lock, an empty storage means the session ended
        elsewhere: reset this tab in memory and go to `/login` without
        calling the API and without writing storage (another tab may be
        mid-sign-in). An adopted pair whose access token is itself
        expiring is refreshed right away, with the adopted (newest)
        refresh token, still under the lock.
      - A `401` on refresh clears the session only if storage still
        holds the token that was sent; if another tab stored a newer
        pair meanwhile, that pair is adopted and returned instead.
      - A sign-in in another tab moves this tab into the app only when
        it was waiting for a 2FA code for the same user (2FA is then
        guaranteed enabled). A tab on `/login` stays put: navigating it
        would make the guard send it to 2FA setup, and every
        `POST /auth/2fa/setup` regenerates the secret (vom-back
        `two-fa.service.ts`), invalidating the QR the first tab shows.
        A different user signing in elsewhere only resets the cached
        2FA status.
      - Spec harness: `vi.restoreAllMocks()` moved to the root
        `afterEach` — the file-level `Router.prototype` spy was
        accumulating calls across tests.
      Accepted as-is: a tab waiting for a 2FA code while a *different*
      user signs in elsewhere shows the setup view with an empty QR
      (cosmetic, no setup call; needs two admins in one browser).
      Residual risk the frontend can't close: cross-process
      localStorage propagation isn't ordered against the lock grant,
      and login/verify-login aren't under the lock — the complete fix
      would be a short backend grace window for the previous refresh
      token (user's call; vom-back is read-only here).
      468/468 tests, clean typecheck/lint, build 525.08kB initial.
      Browser-verified with two real tabs (shared localStorage, real
      storage events + Web Locks) against a mock backend with rotation
      and reuse detection. With sync disabled, the scenario reproduced
      the bug: the concurrent refresh hit reuse detection and both tabs
      landed on `/login`. With the fix: one startup refresh adopted by
      the other tab, a later rotation used by the other tab with no
      refresh, logout propagated, zero reuse detections.

## Done — split dashboard stats by brand (VOM / M) (2026-09-12/13)

- [x] **Filter the dashboard by brand: VOM = keychain + custom sticker,
      M = sticker.** Checked against the real vom-back source:
      `GET /dashboard` only takes `dateFrom`/`dateTo` and sums whole
      orders (`totalAmount`) and all expenses; product type lives on
      each order *item* (`items[].productTypeId`, orders may mix types);
      `totalAmount` is exactly the sum of item `subtotal`s; expenses
      only have an `ExpenseType` (raw_poster / keychain_blank / delivery
      / other), no link to a product type. Frontend can't aggregate
      itself (orders are paginated), so the split must be computed
      server-side.
      Decisions (user, via AskUserQuestion): expenses get an explicit
      group chosen on entry — VOM / M / shared (`null`); a group's
      profit = its revenue − its own expenses, shared expenses reported
      separately, not allocated. A mixed order counts in *both* groups
      for order count and shipment statuses; revenue is split exactly by
      item subtotals.
      Backend asked for (spec sent to the user): `ProductType.brand`
      (`'vom' | 'm'`, seeded), exposed by `/dictionaries/product-types`;
      `Expense.brand` (`'vom' | 'm' | null`) on create/update/response;
      `GET /dashboard?brand=vom|m` with group-scoped revenue,
      revenueByDay, orderCount, shipmentStatusBreakdown, own expenses,
      expensesByCategory, profit, plus `sharedExpenses`.
      Backend landed 2026-09-13; re-verified against the real
      `vom-back` source before building against it (not just the
      user's paraphrase): `DashboardQueryDto.brand`, the service's
      `typeIds`/`orderWhere`/`expenseWhere` split and the `brand
      ? aggregate(OR: [brand: null, brand: {isSet: false}]) : null`
      shared-expenses query all matched exactly as described.
      Built: `ProductBrand = 'vom' | 'm'` in `shared/models/`;
      `ProductType.brand` added to the dictionary model;
      `Expense.brand`/`CreateExpensePayload.brand` (required in the
      payload type — the form always sends an explicit value, never
      omits it, so create and update behave the same way from the
      frontend's side); `DashboardSummary.sharedExpenses`;
      `DashboardApiService.getSummary()` gained a `brand` param.
      Dashboard: «Усі/VOM/M» segmented-control chips next to the date
      filters; a "спільні витрати: N ₴" hint under "Загальні витрати"
      and a "без спільних витрат" hint under "Прибуток", both only
      when `sharedExpenses !== null`. Expenses form: a «Група» select
      (Спільна/VOM/M) right after the type select, mapping the empty
      option to `null`. Expenses list: a `.status-badge.badge-info`
      group pill (VOM/M) next to the type in each card's meta row, new
      `.entity-card__meta-group` wrapper so it doesn't disturb the
      existing type/date `space-between` layout — no badge for a
      shared expense.
      Reviewed clean (structure, standards, backend-contract
      conformance, security) — two coverage nits raised (the
      shared-expenses hint test never exercised `sharedExpenses: 0`,
      distinct from null/falsy; a stale API-service fixture missing
      the new field), both fixed. 478/478 tests (was 468 — 10 new),
      clean typecheck/lint, build 525.10kB initial (same pre-existing
      budget warning). Browser-verified:
      switching Усі → VOM → M refetches and re-renders correctly,
      shared-expenses hints appear only in group mode, group badges
      render on expense cards, the edit form pre-fills the right group
      or "Спільна".
      `API_REFERENCE.md` updated for `product-types`' new `brand`
      field, `expenses`' `brand` field on create/update/response, and
      `GET /dashboard`'s `brand` query param + `sharedExpenses`
      response field.

## Done — table fixes: flags divider, left alignment (2026-09-12)

- [x] **Orders list "Мітки" cell divider is misaligned.** Cause:
      `.col-flags { display: flex }` sat on the `<td>` itself, so the
      cell stopped being a table cell (no row-height stretch, its
      bottom border floats). Fixed: plain `<td class="col-flags">` with
      the two status badges wrapped in an inner `<span class=
      "order-flags">` carrying the flex layout instead.
- [x] **Every table cell left-aligned** (senders, orders, CRM, and the
      order detail items table): user wants numbers and action
      buttons left-aligned too. Cause: global `.col-num` and
      `.col-actions` set `text-align: right` (headers stayed left
      because `.data-table th` is more specific). Fixed: `.col-num`
      keeps only the mono font; the `.col-actions` rule is gone (the
      class stays as the click-guard hook `closest('.col-actions')`,
      confirmed unaffected). Card grids (Products/Expenses) were
      already left via flex `justify-content`, not `text-align` — no
      change needed there.
      Reviewed clean (one process nit: this entry wasn't yet marked
      done — fixed now). 468/468 tests, clean lint/build (525.04kB,
      same pre-existing budget warning). Verified in a real browser:
      every row's cells share one bottom edge, and computed
      `text-align` on every `<td>` across orders/senders/CRM/order-
      detail came back `start`.
- [x] **Recipient city/warehouse/postomat rows removed from order
  detail** (2026-09-13, user decision). Found alongside the table
  fixes above: these rows showed raw NP refs (uuids) instead of names.
  Confirmed on both ends: `DeliveryDetails` (Prisma `type`, embedded
  in `Order`) only ever stores `cityRef`/`warehouseRef`/`streetRef`/
  `postomatRef` — no name field, nothing to read; no NP API method
  here resolves a bare ref back to a name (`searchCities` is
  name→ref only; `getWarehouses`/`getPostomats` list a whole city,
  not a single ref). Rather than build the backend name-snapshot fix,
  the user decided the whole section was redundant next to "Доставка"
  (the delivery-type label) and had all three rows removed —
  `orders-detail.html` no longer renders "Населений пункт" /
  "Відділення" / "Поштомат" at all. `cityRef`/`warehouseRef`/
  `postomatRef` stay in the `Order` model (still needed elsewhere,
  e.g. re-fetching warehouses on the edit page); no spec asserted on
  the removed rows. tsc/tests (468/468)/lint/build all clean;
  markup-only removal, not sent through a separate reviewer pass.

## Done — product-type filter on Orders list (2026-09-13)

- [x] **Add a "Тип товару" filter to the Orders list page — Наклейка /
      Кастомна наклейка / Брелок.** Superseded direction: the user first
      asked for VOM/M/Спільне brand chips, then simplified the ask to a
      plain per-product-type filter, matching the one CRM's table
      already has (`crm-table.html`'s `productTypeId` select + "Усі
      типи"). No brand/group concept needed here at all — just the
      existing `product_types` dictionary (3 items today: sticker,
      custom_sticker, keychain).
      Checked against the real vom-back source: `GET /orders`
      (`ListOrdersQueryDto`/`OrdersService.findAll`) has zero product-
      type filtering — only `page`/`pageSize`/`dateFrom`/`dateTo`. CRM
      already solved exactly this for `GET /crm/table`
      (`ListCrmQueryDto.productTypeId` → `crm.service.ts`:
      `...(query.productTypeId && { items: { some: { productTypeId: query.productTypeId } } })`)
      — the ask is to add the identical filter to Orders, not to invent
      a new mechanism. The existing "Нові/Старі" sort chips on this
      page are client-side only (`orders-list.ts`'s `displayedOrders`,
      gated by `canSort() = total() <= pageSize`), which doesn't scale
      to a real filter that must affect `total`/pagination the way
      `dateFrom`/`dateTo` already do — this needs the same backend
      query param CRM has, not a frontend-only reorder.
      Spec to send the backend: `ListOrdersQueryDto` gains
      `productTypeId?: string` (`@IsOptional() @IsMongoId()`, mirroring
      `ListCrmQueryDto.productTypeId`); `OrdersService.findAll` adds
      `...(productTypeId && { items: { some: { productTypeId } } })` to
      its `where`, identical to `CrmService`'s own filter.
      Backend landed 2026-09-13; re-verified against the real
      `vom-back` source (`ListOrdersQueryDto.productTypeId`,
      `OrdersService.findAll`'s `where` clause, controller wiring) —
      matches the spec exactly. `API_REFERENCE.md`'s Orders section
      was already updated by the backend team.
      Built: `OrdersApiService.list()` gained a `productTypeId: string
      | null` param; `orders-list.ts` a `productTypeId` signal +
      `onProductTypeChange()`, wired into `hasActiveFilters()`/
      `resetFilters()`, page resets to 1 on change; `orders-list.html`
      got the "Тип товару" `<select>`, copied verbatim from
      `crm-table.html` (`filter-select` class, "Усі типи" option,
      `dictionaries.productTypes()`).

## Done — shipment status colors + a 5th status (2026-09-13)

- [x] **Restyle shipment-status colors and add "Переадресовано".**
      Backend added a 5th status (seed code `redirected`, label
      "Переадресовано") alongside the existing 4. New user-specified
      palette: shipped=orange (unchanged), delivered=blue (was green),
      received=green (was gray/muted), refused=red (unchanged),
      redirected=yellow (new). Applies everywhere the shared
      `shipmentStatusBadgeClass()` util is consumed — Orders list,
      Orders detail, CRM table — plus the Dashboard's separate
      Chart.js hex-color map (badge classes can't drive canvas
      colors).
      New CSS tokens in `styles.css` (delivered/redirected only —
      shipped/received/refused reuse the existing info/success/danger
      tokens, chosen to sit in the same warm-dark-palette family as
      the existing success/error pair): `--color-delivered-text:
      #6ea2dd` / `--color-delivered-bg: #192534`; `--color-redirected-
      text: #dbb866` / `--color-redirected-bg: #2e2614`. Two new
      `.status-badge--delivered`/`--redirected` classes, same
      shape as the existing variants (no border, matching this
      session's earlier borderless-pill redesign decision).
      `shipmentStatusBadgeClass()` updated: `received` now reuses
      `status-badge--success` (was `--muted`) instead of a dedicated
      class, since green was freed up by delivered's move to blue.
      Gave this previously-untested util its own spec file (pre-
      existing gap, closed while touching it).
      `dashboard.ts`'s `SHIPMENT_STATUS_COLORS` hex map updated to the
      same 5 colors (delivered/received swapped, redirected added) so
      the shipment-status donut chart matches the badges everywhere
      else.

## Done — Products/Expenses card-grid auto-fits, capped at 5 columns (2026-09-13)

- [x] **Fix empty gaps in the card grid at wide viewports/zoom levels,
      cap at 5 columns per row.** Root cause: `.card-grid` used
      `grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))`.
      `auto-fill` reserves a grid track for every column that
      *could* fit the container width, even ones with no card to put
      in them — an incomplete last row (or any row with fewer cards
      than fit) left those extra tracks empty instead of letting the
      real cards stretch into the space, which is exactly the "порожнє
      місце" the user saw when zooming. There was also no upper bound,
      so a wide enough viewport could show 6, 7, 8+ columns (seen in
      the user's own screenshot: 7 per row).
      Fixed: switched to `auto-fit` (collapses empty tracks, so
      existing cards fill the row instead of leaving blank space) and
      capped the column count at 5 with the standard CSS-only
      "N-column auto-fit" formula — the `minmax()` floor is
      `max(220px, calc((100% - 4 * 16px) / 5))`: on a wide screen this
      evaluates to the exact width 5 columns need to fill 100%, so the
      grid algorithm can't fit a 6th column (it would be narrower than
      the floor); on a narrow screen the `max()` falls back to the
      original 220px floor, so mobile/narrow behavior is unchanged.
      Shared `.card-grid` class, so this applies to both Products and
      Expenses (the user only mentioned Products, but Expenses has the
      exact same underlying bug and the same class — fixing the shared
      rule once is correct, not scope creep).

## Done — split dashboard revenue into realized/pending/lost (2026-09-13)

- [x] **Split dashboard revenue by shipment-status outcome, and rebase
      profit on realized revenue.** Currently `totalRevenue` sums
      `totalAmount` for every order in the period with zero regard to
      `shipmentStatusId` — an order that's still in transit, sitting
      unclaimed at a branch, or outright refused counts exactly the
      same as one the customer has actually received and paid for
      (checked directly in `dashboard.service.ts`). User wants to see
      what money is actually realized vs. still just potential.
      Decided with the user (after checking the real NP status-code
      groupings in `prisma/seed.ts` — "Доставлено" only means
      *arrived at the branch*, not collected/paid; "Отримано" is the
      only status that means the recipient actually took it, which
      for cod/partial payment is also when the cash is actually
      collected): three buckets, not two — a refused order is a lost
      sale, not "still pending".
      - **Реалізовано** (`realizedRevenue`) — status code `received`
        only.
      - **В очікуванні** (`pendingRevenue`) — no status yet (`null`),
        `shipped`, `delivered`, `redirected`. Redirected is still a
        live, moving order, not a loss.
      - **Втрачено** (`lostRevenue`) — status code `refused` only.
      Invariant: `totalRevenue === realizedRevenue + pendingRevenue +
      lostRevenue` (partitions every order exactly once) — worth a
      backend unit test.
      `totalRevenue` itself stays unchanged (still the gross/all-
      orders figure, useful on its own) — this is additive, not a
      replacement, mirroring how `sharedExpenses` was added alongside
      `totalExpenses` rather than redefining it. `profit` DOES change
      meaning though (user's own suggestion, confirmed): `realizedRevenue
      - totalExpenses` instead of `totalRevenue - totalExpenses`, so
      the profit card stops looking better than reality.
      Explicitly deferred for now (user's call, keeping scope tight):
      payment-type nuance (a `full`-paid order's money already arrived
      regardless of shipment status, unlike `cod`/`partial`) — noted
      as a possible future refinement, not part of this pass.
      Spec to send the backend: `DashboardResponseDto` gains
      `realizedRevenue`/`pendingRevenue`/`lostRevenue: number`, and
      `profit`'s formula changes. All three (like `totalRevenue`
      already does) must respect the `brand` filter the same way —
      reuse the existing `revenueOf(order)` helper (item-subtotal sum
      when `brand` is given, else `order.totalAmount`) per bucket,
      not the whole order total once `brand` narrows things down. No
      new Prisma query needed: `shipmentStatuses` is already fetched
      for `shipmentStatusBreakdown`; build a `Map<statusId, code>`
      from it and re-use it to bucket each already-fetched order by
      its `shipmentStatusId` (`null`/unmapped code → pending).
      Backend landed 2026-09-13; re-verified against the real
      `vom-back` source (`dashboard.service.ts`'s if/else-if/else
      bucketing — every order hits exactly one branch via the shared
      `revenueOf(order)` helper, so the `totalRevenue === realized +
      pending + lost` invariant holds unconditionally; `profit:
      realizedRevenue - totalExpenses`; the three new fields are
      plain non-nullable `number`, unlike `sharedExpenses: number |
      null`) — matches the spec exactly.
      Built: `DashboardSummary` gained the three required `number`
      fields. Under "Загальний дохід": two unconditional hints
      ("реалізовано: N ₴", "в очікуванні: N ₴") plus a conditional
      one ("втрачено: N ₴", shown only when `lostRevenue > 0`, styled
      red via a new `.metric-card__hint--negative` reusing the same
      `--color-error-text` token `.metric-value--negative` already
      uses). Under "Прибуток": a new unconditional hint "на основі
      реалізованого доходу" — since the card's meaning silently
      changed, it stays legible without reading the code.
      `profitMargin` was also rebased from `profit / totalRevenue` to
      `profit / realizedRevenue` (zero-guard moved to match) — not
      explicitly asked for in so many words, but the necessary
      completion of "profit shouldn't look better than reality":
      leaving margin on the old gross-revenue basis while profit
      moved to realized-only would produce a number that means
      neither the old nor the new thing (confirmed via a dedicated
      regression test using deliberately divergent totalRevenue vs.
      realizedRevenue). `averageOrderValue` was deliberately left on
      `totalRevenue` — it's about the size of orders placed, not cash
      actually collected, so no reason to rebase it.
      Reviewed clean (one process nit: this entry wasn't yet flipped
      to done — fixed now). 495/495 tests (was 490 — 5 new: the
      margin-rebase regression test, always-visible-hint test,
      realized/pending hint test, lost-revenue-hint presence/absence
      tests, plus the zero-guard test corrected to override
      `realizedRevenue` instead of the now-irrelevant `totalRevenue`),
      clean typecheck/lint, build 525.45kB initial (unchanged — no
      new dependencies). Browser-verified: all three hint lines under
      "Загальний дохід" render with correct values and color, and
      "маржа 60%" correctly reflects `profit/realizedRevenue`
      (18000/30000), not the gross-basis 45% the old formula would
      have shown.

## Suggested build order

Foundations (scaffold + core auth/guards/interceptors/API layer + shell
layout) → Auth (login + 2FA) → Senders → Products → Orders (the wizard,
largest single feature) → Expenses → CRM table → Dashboard. Mirrors the
backend's own build order, since the frontend's dependency chain follows
the same shape (Orders needs Senders + Products ready first, CRM/Dashboard
are read-only views built last since they aggregate everything else).
