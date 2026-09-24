---
name: keychain-mockups
description: State, conventions and open questions of the keychain (брелки) mock-up page of vom-front — sidebar tab "Брелки", route /keychains, feature features/keychain-mockups. Currently only the base interface (form on the left, previews and a reserved SVG block on the right); tracing, keychain types, styles and mock-up rendering are NOT built yet. Use when asked to extend, review or continue the keychain / брелок page, its photo upload, the raster-to-SVG tracing (potrace) or its mock-up styles. DRAFT: update this skill after the user's clarifications.
metadata:
  status: draft — written before the user described types, styles and rendering
  source: the user's requests of 2026-09-20, the sticker-generator skill, the potrace/image-tracer comparison of 2026-09-19
---

## Status: draft — update after the user's details

Built (base UI shell, 2026-09-20): a lazy page at `/keychains` (sidebar "Брелки", Lucide `KeyRound`), form on the left, results on the right. **Nothing is wired to real behaviour yet.** The user said the page will be "somewhat bigger than just converting to SVG": it will produce keychain mock-ups, several at once (one per style), all processed **on the frontend**. Keychain types and styles "will be described in detail later" — do not invent them, ask.

## What exists

```
src/app/features/keychain-mockups/
  keychain-mockups.routes.ts               KEYCHAIN_ROUTES (lazy child of Shell → auth + 2FA guards apply)
  pages/keychain-mockups/                  page (Reactive Form, signals), .html/.css/.spec.ts
  data/keychain-types.ts                   KEYCHAIN_TYPES — EMPTY on purpose
  data/photo-upload.ts                     PHOTO_ACCEPTED_TYPES (png/jpeg/webp), PHOTO_MAX_BYTES (10 MB)
  models/keychain.model.ts                 KeychainType {id,label}
  utils/validate-photo.ts                  file type + size check → error text | null
```

Wiring: `FEATURE_ROUTES.keychains = '/keychains'`, a lazy `loadChildren` in `app.routes.ts`, a `NAV_ITEMS` entry and the sidebar spec (9 links).

Form (left): photo upload with preview/name/remove (object URL, revoked on replace, remove and destroy; never `bypassSecurityTrust*`), keychain-type select (shows "Типи буде додано пізніше" while empty), logo select (none + the sticker icons), text input (max 40, one field), font select (sticker fonts), and a reserved "Стилі макета" block.

Right: "Макети" panel (reserved place for one preview per style; **Завантажити** / **Копіювати** are disabled placeholders) and, below it, a reserved "SVG" panel with a disabled "Завантажити SVG".

## Decisions taken without the user (confirm or revert)

- Route `/keychains`, label "Брелки", `KeyRound` icon.
- Photo: PNG/JPEG/WebP, ≤ 10 MB. Text: one field, ≤ 40 characters (copied from stickers).
- Fonts and logos are imported straight from `features/sticker-generator/data/…` (a cross-feature import). The clean alternative is moving `sticker-fonts`, `sticker-icons`, their models and `FontLibraryService` to `shared/`; do that when the keychain page starts actually rendering text/icons.

## Decided earlier for the tracing part (not built yet)

- Everything on the frontend, in a Web Worker; nothing persisted (icons live on the page only).
- Library: **potrace via `esm-potrace-wasm`** (GPL-2.0 accepted: 3 users, no legal entity, nothing distributed). Fallback if that ever changes: `@image-tracer-ts/core` (MIT).
- Measured on the user's black-and-white motorcycle line art: upscale the raster **2×** first, threshold to pure black/white, default potrace options → ~22 ms, ~125 KB of path data; visibly smoother than the MIT tracer. Without upscaling both are noticeably worse.
- The `esm-potrace-wasm` output (with `pathonly: true`) is relative `m c l z` at 10× scale with a flipped Y. Convert to absolute `M L C Z`: x' = 0.1·x, y' = H − 0.1·y, and after `z` the current point returns to the subpath start. Feed it `ImageData` (not a Blob/canvas) or it touches `document` and fails in a Worker. The wasm is inlined in the JS (~30 KB gz), so import it lazily like `opentype.js`.
- Keep the whole `d` in ONE path so holes work under the default nonzero fill rule. Round coordinates.
- The old comparison files were removed from `.claude/artifacts/`; re-run the test on a real sample before tuning.

## Reuse from the sticker generator

`.claude/skills/sticker-generator/SKILL.md` covers `transformPathData`, `exportSvg`, the canvas mock-up renderer (`MockupRenderer`, SVG → Image → canvas → PNG), clipboard copy (`copyPngToClipboard`), `downloadFile` and the `ColorField` component. Reuse them instead of re-implementing, moving to `shared/` when a second feature needs them.

## Open questions for the user

Keychain types (names, shapes, dimensions); what a "style" is and how many; whether text may be several lines or several separate texts; how mock-ups are rendered (on a photo? flat? which background); what exactly the SVG output contains (traced photo only, or the whole keychain, cut lines); photo limits; where the tracing threshold control belongs (slider with live preview?).

## Checklist for changes

Follow `.claude/CLAUDE.md` (plan → research → development → `reviewer` → fix loop → close out). Specs for every file, no comments/`console.log`/`any`/unused code, nothing unsanitized, `ng lint` + `ng build` clean, real-browser check, update THIS skill when the user's details arrive.
