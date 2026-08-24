# vom-front — agent instructions

VOM Systems admin dashboard frontend — Angular, talking to the `vom-back`
NestJS API (a sibling project; this project has **read-only** access to it
for reference — never write/edit anything there).

## Language

- Respond to the user in Ukrainian only.
- Write all skills, in-repo instructions/docs, comments, and code in
  English.

## Git

- Never stage (`git add`), commit, or push in this repository, under any
  circumstances, even if asked in passing. These operations are blocked at
  the tool-permission level in `.claude/settings.json`
  (`permissions.deny: Bash(git add:*)`, `Bash(git commit:*)`,
  `Bash(git push:*)`) — do not attempt to route around that (no
  `--no-verify`, no manual `git` invocations via other tools, no editing
  the deny list). The user handles all git history operations themselves.

## No guessing

- Never invent an answer, a value, or a design decision you don't
  actually know. If something has more than one reasonable answer, stop
  and ask — present concrete options (`AskUserQuestion`) rather than
  picking one silently or asking a bare open-ended question.
- If something required is missing — an env variable, an API key/secret,
  a credential, a config value, an external account resource — don't
  fabricate a placeholder and move on as if it were real. State exactly
  what's missing, explain the concrete steps to obtain it, and wait for
  the user to provide it before continuing anything that depends on it.
- Current Angular conventions shift across major versions — don't answer
  "how does Angular do X" from general/training-data familiarity alone
  when it's checkable. Dispatch the `research` agent against the official
  docs (`angular.dev`) instead, the same way this project's sibling
  backend checks NestJS's own docs rather than assuming.

## Workflow for every coding request

For any request that involves writing or changing code (not for plain
questions, discussions, or read-only look-ups), follow this sequence —
don't skip steps or reorder them:

1. **Plan.** Check `.claude/PLAN.md`. Add an entry for this request's
   work, or update the matching existing one — do nothing here if it's
   already accurately tracked.
2. **Research, if needed.** If something is a genuine unknown — a design
   corner case the summarized specs don't cover, how current Angular
   itself expects something to be built, or an unclear point in the
   backend contract — dispatch the `research` agent before writing code,
   rather than guessing (see "No guessing" above).
3. **Development.** Write the code, consulting whichever skill(s) apply
   (see "Which skill to use for what") as you go. If something still
   can't be decided confidently from those plus the docs, stop and ask
   rather than filling the gap yourself.
4. **Review.** Run the `reviewer` agent against the change (structure,
   current Angular best practices, this project's code standards,
   backend-contract conformance, security).
5. **Fix loop.** If `reviewer` finds anything, fix it, then run `reviewer`
   again. Repeat until it comes back clean.
6. **Close out.** Update the entry in `.claude/PLAN.md` to `done`, then
   finish with a short message stating what was actually built — not a
   step-by-step narration of this process.

## Code standards

See `.claude/instructions/code-standards.md` for the non-negotiable code
rules for this project (standalone-only, typed HTTP boundaries, Reactive
Forms, signals-based state, unit test coverage, zero comments/
`console.log`/unresolved lint or type errors, no unused code, no
unsanitized HTML). The `reviewer` agent enforces these, plus project
structure, current Angular best practices, and backend-contract
conformance — run it after non-trivial changes rather than only
self-checking.

`.claude/instructions/` is where standing project-wide rules like this one
live, as the single source of truth. When a rule applies broadly (not a
skill-shaped procedure grounded in one specific doc), add it there and
reference it from here and from any skill/agent that needs to enforce it
— don't restate the rule text in more than one place.

## Which skill to use for what

- **Project / file / folder structure** — use the
  `angular-project-structure` skill. Applies to scaffolding the project,
  adding a new feature/page, deciding where a file belongs, splitting up
  a growing route table, or reviewing existing structure. Grounded in
  current `angular.dev` guidance (standalone components, signals,
  Reactive Forms, functional guards/interceptors, Vitest) — verified via
  the `research` agent, not assumed.
- **Turning a page design into actual Angular code** — use the
  `angular-design-implementation` skill. Applies to building or reviewing
  any page/form/table/widget, or deciding what a page's component/
  service/route should look like. Grounded in
  `.claude/artifacts/frontend/VOM_SYSTEMS.md`/`VOM_DESIGN_INSTRUCTION.md`/
  `Дизайн проекту/` (the page-by-page spec, layout/UX instructions, and
  the real rendered design bundle) plus
  `.claude/artifacts/backend/API_REFERENCE.md` for what the
  data actually looks like over the wire.
- **Calling the vom-back API** — use the `backend-api-integration` skill.
  Applies to any HTTP call this app makes: auth/2FA/token flow, request/
  response conventions, error shape, throttling, file upload. Grounded in
  `.claude/artifacts/backend/API_REFERENCE.md` (full per-endpoint
  reference, copied from the backend project — may drift from the live
  backend; when in doubt, use this project's read-only access to
  `vom-back` to check the real source instead of trusting a stale
  snapshot).
- **Creating or fixing a skill** — use the `skill-creator` skill (generic,
  not project-specific).

## Which agent to use for what

- **Research before/during implementation** — use the `research` agent.
  Applies when a design corner case isn't answered by the
  `angular-design-implementation` skill's summarized spec (needs digging
  into the actual design source under `Дизайн проекту/`), when it's
  unclear how current Angular itself expects something to be built (check
  `angular.dev`, not memory of an older Angular version), or when the
  backend contract snapshot doesn't answer a question and the real
  `vom-back` source needs checking. Read-only — it never writes or edits
  code, and never writes to `vom-back` even though it can read it.
- **Final check before considering a change done** — use the `reviewer`
  agent. Applies after non-trivial code changes: verifies project
  structure (via `angular-project-structure`), current Angular best
  practices, this project's code standards, backend-contract conformance,
  and security (token handling, XSS, auth/2FA guard coverage). Read-only
  — it reports findings back rather than fixing them itself.

## About the backend

`vom-back` (sibling directory, read-only from here) is a NestJS + Prisma/
MongoDB API — already built, not something this project modifies.
`.claude/artifacts/backend/API_REFERENCE.md` is a point-in-time copy of
its architecture + full endpoint reference; treat it as a strong starting
point but not infallible — it can fall out of sync with the real backend
as that project keeps evolving. When something here doesn't match what the
API actually does, re-check the real `vom-back` source (or its own
`.claude/artifacts/backend/API_REFERENCE.md`, which is the authoritative,
continuously-updated copy) rather than trusting this snapshot blindly, and
consider refreshing this copy if the drift is significant.
