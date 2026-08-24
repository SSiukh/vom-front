---
name: angular-design-implementation
description: Turn the VOM Systems page-by-page design spec into actual Angular routes/components/forms that call the real backend correctly. Use when building or reviewing any page, form, table, or widget for this project, or when deciding what a given page's component/service/route should look like.
metadata:
  source: .claude/artifacts/frontend/VOM_SYSTEMS.md, .claude/artifacts/frontend/VOM_DESIGN_INSTRUCTION.md, .claude/artifacts/frontend/"Дизайн проекту/", .claude/artifacts/backend/API_REFERENCE.md
---

## Source of truth

Three things, all under `.claude/artifacts/frontend/`, read in this order
for any page you're building:

1. **`VOM_SYSTEMS.md`** — per-page parameter tables: exact field names,
   control types, conditional visibility, the business rule behind each
   one. This is the primary source for what a page *contains*.
2. **`VOM_DESIGN_INSTRUCTION.md`** — layout/UX per page (which things
   group together, wizard steps, list-vs-widget-grid). This is the primary
   source for how a page's contents are *arranged*, and names the style
   preset (`--preset b1aKQdk7k`) that must be applied consistently across
   every screen.
3. **`Дизайн проекту/`** — the actual rendered design bundle
   (`index.html`, `support.js`, `_ds/*/_ds_bundle.js`, `_ds/*/styles.css`).
   Read this when the two docs above don't settle an exact color, spacing,
   component variant, or interaction detail — grep `styles.css` for the
   relevant class/token rather than eyeballing a description. If it's
   still ambiguous after checking here, dispatch the `research` agent
   rather than guessing a pixel value.
4. **`.claude/artifacts/backend/API_REFERENCE.md`** (+ the
   `backend-api-integration` skill) — what the page's data actually looks
   like over the wire, what's required vs. optional, what a save/submit
   call can fail with. A page's form must accept exactly what the backend
   DTO accepts — no client-invented field, no client-side-only validation
   that's actually a server rule with a different exact condition.

## Procedure: turning a page spec into a routed feature

1. Open `VOM_SYSTEMS.md`'s `### Сторінка ...` section for the page and its
   parameter table, and the matching numbered section in
   `VOM_DESIGN_INSTRUCTION.md` for layout.
2. Classify the page against `angular-project-structure`'s
   `features/<feature>/pages/` split: list page, detail page, create/edit
   form, or a composite/aggregated view (CRM table, dashboard) — an
   aggregated view calls its own dedicated backend read-endpoint
   (`/crm/table`, `/dashboard`), never re-derives an aggregate client-side
   from a raw entity list.
3. For every row in the parameter table:
   - "Селект"/"Випадаючий список" backed by a "довідник" (тип замовлення,
     тип товару, тип оплати, спосіб доставки, тип витрати, статус
     відправлення) → fetch once from `GET /dictionaries/*` (see the
     backend skill), cache it (a signal in a shared/core service), and
     build the select from `{id, code, label}` — never hardcode the
     option list as string literals matching today's seeded values.
   - A field whose visibility depends on another field ("за умови
     обрання...", "відображається за умови") → a Reactive Forms control
     that's conditionally added/enabled based on a sibling control's
     `valueChanges`, per `angular-project-structure`'s forms section —
     don't just template-`*ngIf` a control that's still part of the
     submitted `FormGroup` value when hidden.
   - "Автоматично розраховується" fields (order total, stock quantity,
     line-item subtotal) → **never** computed and submitted from the
     frontend as if authoritative; display whatever the backend last
     returned (or a clearly-marked live preview), but the actual value the
     backend stores is server-computed — don't build client logic whose
     result could silently diverge from what gets saved.
4. Cross-check `VOM_DESIGN_INSTRUCTION.md`'s layout section for whether UI
   steps map to one request or several — e.g. the two-step order-creation
   wizard (`Відправлення` → `Адреса`) is still a **single**
   `POST /orders` call at the end (see `API_REFERENCE.md`'s `CreateOrderDto`
   — it's one flat payload), not two separate API calls; the wizard is a
   client-side-only UI split.
5. Wire the page's API calls through `core/api/` per
   `angular-project-structure`, typed against the exact
   `API_REFERENCE.md` DTO shape for that endpoint.

## Gotchas (business rules easy to miss from the tables alone)

- **The 2FA gate blocks the entire app, not just a redirect nicety.**
  After login, every route except 2FA setup is meant to be unreachable
  until 2FA is configured — and the *backend* enforces this with a real
  403 on every non-exempt call, not just this frontend's routing. Model it
  as a route guard (`angular-project-structure`) that checks 2FA status
  before rendering anything, but also make sure any direct API call from a
  not-yet-fully-guarded spot handles a stray 403 gracefully — don't rely
  on the guard alone to make a 403 impossible.
- **Only one sender can be active.** The "Активний" control on the
  senders list is checkbox-shaped in the spec but radio-*behaved*
  (`VOM_SYSTEMS.md`: "Наявна валідація, що можливо обрати лише одного
  відправника зі списку") — selecting one must visually/logically
  deselect any other row immediately, matching `PATCH /senders/:id/activate`'s
  real backend behavior (it deactivates every other sender atomically).
  Don't implement it as N independent toggles.
- **Stock deduction is a backend side-effect, not something to
  replicate client-side.** Adding a Наклейка/Брелок line item decrements
  that product's stock server-side when the order is actually saved; the
  wizard's live "Вартість" calculation is a preview computed from the same
  prices the backend will use, but the frontend never decrements/restores
  a stock number itself — that's `orders.service.ts` (`vom-back`)'s job
  entirely.
- **Door-to-door ("Адреса") delivery is permanently rejected by the
  backend**, per `API_REFERENCE.md` §6 — the radio option can stay in the
  UI (`VOM_SYSTEMS.md` lists it as one of three choices), but submitting
  it will always 400. Either hide/disable it with an explanatory tooltip,
  or handle the 400 with a specific, non-generic message — don't present
  it as a normal, sometimes-flaky option.
- **CRM table and Dashboard are read-only aggregated views** — their pages
  have no create/edit affordance at all (per both spec docs); don't add
  one that isn't there.
- **Cash-on-delivery amount shown to the operator should match what
  Nova Poshta will actually be told to collect**, which depends on payment
  type (`API_REFERENCE.md` §6: `full`→0, `cod`→total, `partial`→
  `partialAmount`) — when displaying/confirming this to the user (e.g. an
  order-detail summary), don't just show `totalAmount` regardless of
  payment type.
- **Recipient/delivery/sender fields are permanently non-editable once an
  order has a waybill** (`API_REFERENCE.md` §6) — the edit page must
  visually disable these with an explanation, not just let a save attempt
  fail with a raw 400 the operator has to decode.
- **File upload (Products) is `multipart/form-data`**, not JSON — see the
  backend skill's exact form-field mechanics (`photo` field name, jpeg/
  png/webp only, 5MB, required on create/optional on update).
- Довідники recurring across pages: тип замовлення, тип відправки, тип
  товару, тип оплати, тип витрати, спосіб доставки, статус відправлення.
  Fetch/cache each one once (a shared dictionaries service), never
  redefine the option list per page that happens to use it.

## Reviewing existing code against the design

When asked to check whether a page matches the design: open the page's
parameter table, walk it row by row against the component's template/form
model, and flag any field that's missing, wrongly typed (e.g. a free-text
input where the spec says a довідник-backed select), an auto-computed
field the frontend treats as authoritative input, or a conditional-
visibility rule that doesn't match the documented condition.
