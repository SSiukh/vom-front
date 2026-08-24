# Code standards

Non-negotiable rules for all code in this project. `CLAUDE.md` and the
`reviewer` agent both point here instead of restating these — this file is
the single source, edit it in place rather than forking a copy elsewhere.

- **Standalone components only, no `@NgModule`.** Confirmed current
  Angular default/recommendation (`angular-project-structure` skill has
  the citation) — a new module file for a feature is a rejected pattern,
  not a valid alternative.
- **Typed everywhere a boundary is crossed.** Every HTTP call has a typed
  request/response model matching `.claude/artifacts/backend/
  API_REFERENCE.md` field-for-field — no `any`, no untyped `Object`, no
  `HttpClient.get<any>(...)`. Every component `@Input()`/form value has an
  explicit interface/type, not an inferred loose shape.
- **HTTP only through `core/api/` services.** No component injects
  `HttpClient` directly (see `angular-project-structure`).
- **Functional guards and interceptors, not class-based.** Current Angular
  API, per the same skill.
- **Reactive Forms for anything beyond one trivial field.** No
  template-driven (`ngModel`) forms for real forms; conditional fields are
  real, added/removed `FormControl`s, not hidden-but-still-live ones.
- **State via injectable services + signals by default.** No state
  library (NgRx or otherwise) introduced without a concrete, specific need
  documented at the time — see `angular-project-structure`'s State
  section.
- **Every component and service gets a colocated `*.spec.ts` (Vitest).**
  Not just the ones that feel risky — all of them. Every routed page gets
  at least one test exercising its main interaction (submit, filter,
  paginate), not just a "component creates successfully" smoke test.
- **No subscription leaks.** Every `.subscribe()` has a teardown
  (`AsyncPipe`, `takeUntilDestroyed()`, or equivalent) — an untorn-down
  subscription in a component is a bug, flagged as such by `reviewer`, not
  a style nit.
- **Zero comments, zero `console.log`, zero unresolved TS/ESLint errors or
  warnings.** Same bar as the backend sibling project — no comments at
  all (not "only non-obvious ones"), clean `ng lint` and a clean
  production build before considering any change finished, no leftover
  debug logging.
- **No unused code.** No unused imports, variables, functions, exports, or
  files left behind after a change — remove them rather than leaving them
  for later.
- **No unsanitized HTML/DOM writes.** No `[innerHTML]` bound to
  non-static content, no `bypassSecurityTrust*`, no direct
  `nativeElement.innerHTML` writes fed anything user-entered (recipient
  names/addresses, product names, expense names, etc. all go through plain
  interpolation).
- **No secrets or backend env values in frontend source.** This app never
  holds a Nova Poshta API key, Cloudinary secret, or any backend-only
  credential — those are entered once via the Senders page and live only
  in the backend's database.
