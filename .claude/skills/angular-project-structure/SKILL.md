---
name: angular-project-structure
description: Organize this Angular project by feature, using current (standalone-components-era) Angular conventions — not NgModules, not organize-by-technical-layer. Use when scaffolding the project, adding a new feature/page, deciding where a file belongs, splitting up a growing routes file, or reviewing existing Angular code for structure/convention problems.
metadata:
  source: angular.dev (style guide, ngmodules/overview, signals, http/interceptors, forms, testing, routing) — verified via the research agent, not assumed from general Angular familiarity
---

## Baseline: standalone-only, no NgModules

Confirmed directly from `angular.dev/guide/ngmodules/overview`: *"The
Angular team recommends using standalone components instead of NgModule
for all new code"* and *"recommends using `bootstrapApplication` instead
of `bootstrapModule`."* This is not a style preference for this project —
it's current official guidance. Concretely:

- No `@NgModule` anywhere in this codebase. A new `*.module.ts` for a
  feature is a structure regression, not a valid alternative organization.
- `standalone: true` doesn't need to be written (it's the compiler default
  since it became implicit) — components/directives/pipes are just
  declared without an `imports` array pointing at a module, and instead
  directly `imports: [...]` whatever other standalone pieces/`CommonModule`
  bits they template-reference.
- Bootstrap via `bootstrapApplication(AppComponent, appConfig)` in
  `main.ts`, with `ApplicationConfig` (`app.config.ts`) providing
  `provideRouter`, `provideHttpClient(withInterceptors([...]))`, etc. — not
  `platformBrowserDynamic().bootstrapModule(AppModule)`.

## Folder structure — organize by feature, not by type

`angular.dev/style-guide` states directly: *"Organize your project into
subdirectories based on the features of your application or common themes
to the code in those directories,"* and separately warns against grouping
by technical type. There's no single official folder diagram for this
(the CLI's own `reference/configs/file-structure` page only documents the
bare `ng new` scaffold) — the layout below is this project's concrete
application of that "organize by feature" principle, not something
copy-pasted from a dated doc page:

```
src/app/
├── core/                     # singleton, app-wide concerns — imported once, never per-feature
│   ├── auth/                 # AuthService, token storage, refresh-queue logic
│   ├── interceptors/         # auth-header + 401-refresh interceptor, error interceptor
│   ├── guards/               # authGuard, twoFaConfiguredGuard (functional)
│   └── api/                  # thin per-backend-module HTTP services (OrdersApiService, etc.)
├── shared/                   # reusable, presentation-only — no feature-specific business logic
│   ├── ui/                   # buttons, badges, table shell, pagination, modal/confirm-dialog
│   ├── pipes/ directives/
│   └── models/               # cross-feature shared types (Dictionary/lookup item shape, PaginatedResponse<T>)
├── features/
│   ├── orders/
│   │   ├── pages/            # one folder per route: list/, create/, detail/, edit/
│   │   ├── components/       # feature-local, non-routed components (order-item-card, address-step, ...)
│   │   ├── models/           # Order, OrderItem, CreateOrderPayload, etc. — this feature's own types
│   │   ├── services/         # feature-local state/orchestration on top of core/api
│   │   └── orders.routes.ts  # this feature's route definitions, lazy-loaded from app.routes.ts
│   ├── products/  expenses/  crm/  dashboard/  senders/  two-fa/  auth/
│   └── ...                   # same shape per feature
├── app.component.ts
├── app.config.ts
└── app.routes.ts             # top-level route table: eager for the auth/login flow, lazy per feature
```

Rationale per piece:

- **`core/`** — singletons that must exist exactly once for the whole app
  (auth session, interceptors, guards, the typed HTTP client layer). Never
  imported by a feature more than conceptually once; nothing here knows
  about a specific feature's UI.
- **`shared/`** — dumb, reusable, presentational. If a piece here needs to
  know about Orders specifically, it doesn't belong in `shared/`.
- **`features/<name>/`** — mirrors the backend's one-module-per-feature
  convention (`vom-back`'s `nestjs-project-structure` skill) closely enough
  to reason about consistently across both repos, adapted to Angular's
  actual primitives (no controller/service split — a feature here is
  routed pages + feature-local components + a thin service layer over
  `core/api/`).
- One class/concept per file, hyphenated filenames, matching
  `angular.dev/style-guide`'s naming section (`order-item-card.
  component.ts`, `.spec.ts` colocated next to it).

## HTTP layer — typed services, functional interceptors

Confirmed at `angular.dev/guide/http/interceptors`: *"Our recommendation is
to use functional interceptors because they have more predictable
behavior, especially in complex setups."*

- `core/api/` holds one thin service per backend module (mirroring
  `.claude/artifacts/backend/API_REFERENCE.md`'s module list —
  `OrdersApiService`, `ProductsApiService`, etc.), each just wrapping
  `HttpClient` calls with the right path/DTO types. **No component ever
  injects `HttpClient` directly** — always through one of these.
  Feature-level services in `features/<name>/services/` can add
  orchestration/local-state on top, but the raw HTTP call itself lives in
  `core/api/`.
- `core/interceptors/` — a functional `HttpInterceptorFn` attaches the
  `Authorization: Bearer` header (reading the current token from
  `core/auth`'s session state), and a second one handles a `401` by
  triggering the refresh flow and retrying the original request once.
  Concurrent 401s during an in-flight refresh must share one refresh call
  (see `backend-api-integration` skill's rotation-race warning) — model
  this as a single shared `Observable`/promise the interceptor awaits
  rather than one `/auth/refresh` call per failed request.
- Response/request typing always comes from this feature's `models/`
  (or a `shared/models/` type for cross-feature shapes like
  `PaginatedResponse<T>`), matching the DTO shapes in
  `.claude/artifacts/backend/API_REFERENCE.md` field-for-field — don't
  invent a client-side shape that diverges from what the backend actually
  sends/expects.

## State — services + signals by default

`angular.dev/guide/signals` shows the baseline pattern: an injectable
service exposes a private `signal()` and a public read-only view (via
`computed()` or `.asReadonly()`); components read it via the signal
directly in the template (no `async` pipe needed for signals) and call
service methods to change it. **Official docs don't state a size threshold
for when this stops being enough** — for this app's scope (admin CRUD +
a couple of aggregated read-views, no real-time/collab requirements), this
project defaults to plain injectable services + signals for both local
component state and small pieces of cross-component state (active sender,
current user/2FA status, cached dictionaries), with **no NgRx or other
state library** unless a specific, concrete need for it shows up later —
don't introduce one preemptively.

## Forms — Reactive Forms, always (except a single trivial field)

`angular.dev/guide/forms` recommends Reactive Forms as *"more robust: more
scalable, reusable, and testable"* for anything beyond a trivial form;
template-driven (`ngModel`) forms are called out as not scaling. This
project's order-creation wizard (conditionally-visible fields depending on
delivery type / product type / payment type) is exactly the case Reactive
Forms exists for:

- Conditional fields are modeled as real `FormControl`s that get
  added/removed (or `enable()`/`disable()`'d) based on a sibling control's
  `valueChanges`, not template `*ngIf`-hidden-but-still-validated dead
  fields.
- Angular v21 introduced *experimental* Signal Forms — developer-preview,
  not yet a stable replacement. Don't build on it; use `ReactiveFormsModule`
  (`FormBuilder`, `FormGroup`, `FormControl`) until it stabilizes.

## Routing — eager entry point, lazy features, functional guards

`angular.dev/guide/routing/loading-strategies`: *"eager loading is
recommended for primary landing page(s) while other pages would be
lazy-loaded"* — deep lazy-loading chains can hurt performance. Applied
here:

- Eager: the login page and the mandatory 2FA-setup flow (the actual entry
  point every session must pass through).
- Lazy (`loadChildren`/`loadComponent`): every feature area (`orders/`,
  `products/`, `expenses/`, `crm/`, `dashboard/`, `senders/`) — each
  feature's `<feature>.routes.ts` is the thing lazy-loaded from the
  top-level route table.
- Guards are **functional** (`CanActivateFn`, etc. — current documented
  API per `angular.dev/guide/routing/route-guards`), not class-based. Two
  guards apply to every non-public route: an auth guard (valid session)
  and a 2FA-configured guard (mirrors the backend's global 2FA gate — see
  `backend-api-integration` skill) — compose both on the top-level route
  config rather than re-checking inside each feature.

## Testing — Vitest, colocated specs

`angular.dev/guide/testing`: *"New projects include vitest and jsdom by
default"* — Vitest is the current default test runner for new Angular CLI
projects (Karma is legacy/still-supported-for-migration only, not the
default anymore). Spec files are colocated `*.spec.ts` next to the file
they test, same convention as this project's backend sibling.

## Linting

`angular-eslint` (via `ng add`'s `@angular-eslint/schematics`, which wires
`@angular-eslint/builder:lint`) is this project's linter — TSLint/Codelyzer
are dead, don't reach for them. Use the recommended config the schematic
generates (angular-eslint's recommended rules + typescript-eslint's
recommended config) as the baseline; don't hand-roll a rule set from
scratch.

## Gotchas / anti-patterns to flag

- A new `@NgModule` for a feature (see "Baseline" above) — always a
  regression, no exceptions for "it's just this one small feature."
- A component injecting `HttpClient` directly instead of going through a
  `core/api/` service.
- A class implementing `HttpInterceptor`/`CanActivate` instead of the
  functional form.
- Template-driven (`ngModel`) forms anywhere beyond a genuinely
  single-field case.
- A route reachable from the router config without both the auth guard
  and the 2FA-configured guard (unless it's on the explicit public
  allowlist — see `backend-api-integration` skill for exactly which
  backend routes are public).
- Introducing NgRx (or any other state library) without a concrete,
  specific need that plain services+signals can't address — don't
  pre-adopt one "because admin dashboards usually need it."
- A `.subscribe()` in a component with no teardown (`takeUntilDestroyed()`,
  `AsyncPipe`, or equivalent) — a leaked subscription, not a style nit.

## Naming / test placement

- Unit tests: `*.spec.ts` next to the file it tests (Vitest, not Karma).
- Component files: `<name>.component.ts` (+ `.html`/`.css` unless truly
  trivial enough for an inline template/styles), hyphenated names.
- Feature route files: `<feature>.routes.ts`.

## Adding a new feature — checklist

- [ ] `src/app/features/<feature>/` with `pages/`, `components/`,
      `models/`, `services/`, `<feature>.routes.ts`
- [ ] Every HTTP call goes through a `core/api/` service, typed against
      `.claude/artifacts/backend/API_REFERENCE.md`
- [ ] Routes lazy-loaded from the top-level route table, guarded by the
      auth + 2FA-configured functional guards (unless genuinely public)
- [ ] Forms with more than one field, or any conditional-visibility field,
      use Reactive Forms
- [ ] No `@NgModule`, no class-based guard/interceptor, no direct
      `HttpClient` injection in a component
- [ ] Colocated `*.spec.ts` for every component/service
