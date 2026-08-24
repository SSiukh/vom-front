---
name: skill-creator
description: Create a new Claude Code skill or review/fix an existing SKILL.md in .claude/skills/. Use when asked to "make a skill", "write a skill for X", "turn this workflow into a skill", "package this runbook as a skill", or to validate/fix a skill's frontmatter or structure.
---

Agent Skills is an open format (spec: https://agentskills.io/specification). A
skill is a folder containing a `SKILL.md` file, plus optional
`scripts/`, `references/`, `assets/`.

## 1. Ground the skill in real material first

Do not invent generic advice ("handle errors appropriately") from general
knowledge. Base the skill on one of:

- A task just completed in this conversation — extract the steps that
  actually worked, the corrections the user made along the way, and any
  project-specific facts the agent didn't already know.
- Existing project artifacts — runbooks, style guides, API specs, past
  incident fixes, code review comments. Ask for these if the user hasn't
  supplied any and the topic is non-trivial.

If neither is available, say so before drafting — a skill written from
guesswork is close to worthless.

## 2. Scope it as one coherent unit

Like a function: not so narrow that trivial tasks need multiple skills to
load, not so broad it can't activate precisely ("query the DB and format
results" is one skill; adding "and administer the DB" makes it two).

## 3. Write `SKILL.md`

### Frontmatter (all fields validated against these constraints)

| Field | Required | Constraints |
|---|---|---|
| `name` | yes | 1-64 chars. Lowercase unicode alphanumerics and hyphens only. No leading/trailing hyphen, no `--`. **Must equal the parent folder name.** |
| `description` | yes | 1-1024 chars. State what it does *and* when to use it, with concrete trigger keywords the user would actually say. |
| `license` | no | License name, or pointer to a bundled license file. |
| `compatibility` | no | 1-500 chars. Only add if there's a real environment requirement (specific product, system packages, network access). Most skills omit this. |
| `metadata` | no | Map of string→string for anything outside the spec. |
| `allowed-tools` | no | Space-separated pre-approved tools, e.g. `Bash(git:*) Read`. Experimental. |

Minimal frontmatter:

```markdown
---
name: pdf-processing
description: Extract PDF text, fill forms, merge files. Use when handling PDFs.
---
```

Description quality bar — bad: `Helps with PDFs.` Good: `Extracts text and
tables from PDF files, fills PDF forms, and merges multiple PDFs. Use when
working with PDF documents or when the user mentions PDFs, forms, or
document extraction.`

### Body

No format is enforced, but:

- Write for what the agent *wouldn't* already know — skip explaining what a
  PDF or HTTP is; jump straight to the project-specific procedure, library
  choice, or non-obvious edge case.
- Give the agent freedom (explain *why*, not rigid steps) when several
  approaches are valid; be exact and prescriptive (literal commands, "do not
  add flags") when the operation is fragile or order-dependent.
- Pick one default tool/approach and mention alternatives briefly — don't
  present a menu.
- Prefer a reusable *procedure* ("read the schema, join on the `_id`
  convention, apply filters, aggregate") over a one-off *answer* ("join
  orders to customers on customer_id...").
- Add a **Gotchas** section for concrete, non-obvious environment facts the
  agent will get wrong otherwise (e.g. "the users table uses soft deletes —
  always add `WHERE deleted_at IS NULL`"). This is usually the highest-value
  part of a skill. When a user corrects the agent while a skill is active,
  that correction belongs here.
- For output-format requirements, give a literal template instead of prose.
- For multi-step work, give a `- [ ]` checklist.
- For destructive/batch operations, use plan → validate → execute: produce
  an intermediate artifact, validate it against a source of truth, execute
  only after validation passes.

### Keep it small; push detail out

Target under 500 lines / ~5000 tokens for `SKILL.md` itself — this is the
part loaded into context every time the skill activates. Move longer
material to:

- `references/*.md` — docs the agent reads on demand. Tell it exactly when:
  "Read `references/api-errors.md` if the API returns non-200," not a bare
  "see references/ for details."
- `scripts/*` — code the agent runs rather than reproduces inline. Bundle a
  script once you notice the agent re-deriving the same logic (a parser, a
  validator, a chart builder) on every run.
- `assets/*` — templates, sample data, images.

Keep references one level deep from `SKILL.md` — avoid chains of files that
reference other files.

## 4. Validate before finishing

Check by hand (no `skills-ref` CLI is assumed to be installed):

- [ ] `name` matches the folder name exactly
- [ ] `name` passes the charset/hyphen rules above
- [ ] `description` is non-empty, ≤1024 chars, states what + when
- [ ] `SKILL.md` body stays well under 500 lines; anything longer is split
      into `references/`
- [ ] Every `references/` or `scripts/` file mentioned in the body has an
      explicit trigger condition, not just a pointer
- [ ] No invented, untested advice — everything traces back to the real
      task or source material from step 1

## 5. Place it

Write to `.claude/skills/<name>/SKILL.md` in this project (the format is
also portable to `.agents/skills/` or other agents' skill directories
un­changed, if the user wants that too — see agentskills.io/clients).
