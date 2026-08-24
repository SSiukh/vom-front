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

## Suggested build order

Foundations (scaffold + core auth/guards/interceptors/API layer + shell
layout) → Auth (login + 2FA) → Senders → Products → Orders (the wizard,
largest single feature) → Expenses → CRM table → Dashboard. Mirrors the
backend's own build order, since the frontend's dependency chain follows
the same shape (Orders needs Senders + Products ready first, CRM/Dashboard
are read-only views built last since they aggregate everything else).
