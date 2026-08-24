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
- [~] `core/api/`: one thin typed HTTP service per backend module. Done so
  far: `AuthApiService`, `DictionariesApiService`, `SendersApiService`.
  Still open: `ProductsApiService`, `OrdersApiService`,
  `ExpensesApiService`, `CrmApiService`, `DashboardApiService`,
  `NovaPoshtaApiService` — build each alongside its owning feature
  rather than all at once, per `API_REFERENCE.md`'s per-module shape.
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
- [~] **Products.** List (photo/type/name/price/promo/stock, type filter,
      pagination) + create/edit form (multipart photo upload — see
      `backend-api-integration` skill's exact mechanics) + detail page.
      Needed before Orders, since the wizard's item picker searches this
      catalog.
- [ ] **Orders.** The largest feature — list (filters, pagination) →
      two-step creation wizard (Відправлення → Адреса, single
      `POST /orders` submit at the end per `angular-design-implementation`'s
      gotcha) → detail page (readonly, edit/delete actions) → edit page
      (only the backend-editable-post-waybill fields stay live; everything
      else shown disabled with an explanation, per `API_REFERENCE.md` §6).
      Depends on Senders + Products + Dictionaries + Nova Poshta address
      lookups all being wired first.
- [ ] **Expenses.** List (type/name/amount/date/actions, pagination) +
      create/edit form (conditional name field for the "Інше" type).
- [ ] **CRM table.** Read-only aggregated view — filters (date range,
      product type, shipment status, sort order), wide table, sticky
      totals row, pagination. No create/edit affordance.
- [ ] **Dashboard.** Read-only analytics — period filter, 4 metric cards,
      revenue-by-day line chart, expenses-by-category pie chart,
      shipment-status pie chart. No create/edit affordance. (Chart library
      choice not yet decided — a genuine open question, don't pick one
      silently; ask the user or have `research` check current
      Angular-ecosystem options when this item starts.)

## Suggested build order

Foundations (scaffold + core auth/guards/interceptors/API layer + shell
layout) → Auth (login + 2FA) → Senders → Products → Orders (the wizard,
largest single feature) → Expenses → CRM table → Dashboard. Mirrors the
backend's own build order, since the frontend's dependency chain follows
the same shape (Orders needs Senders + Products ready first, CRM/Dashboard
are read-only views built last since they aggregate everything else).
