---
name: keychain-mockups
description: How the keychain (брелки) mock-up generator of vom-front works and how to extend it — sidebar tab "Брелки", route /keychains, feature features/keychain-mockups. The user picks one of 13 keychain photos, optionally uploads a black-and-white photo (traced to vector with potrace in the browser), picks one of 36 brand marks and/or types text; the artwork is laid out into the keychain's print area and drawn onto the photo, then downloaded/copied as PNG, and the artwork alone as SVG. Covers the assets, the pipeline, layout rules, the potrace/node:fs build workaround, testing, decisions still open. Use when asked to add, extend, review or debug the keychain / брелок page, its assets, tracing, layout or mock-up styles.
metadata:
  status: working base (2026-09-27); mock-up styles and final layouts still to be described by the user
  source: the user's requests of 2026-09-20…27, the supplied assets, the sticker-generator skill, the potrace/image-tracer comparison
---

## What it is

A frontend-only page at `/keychains` (sidebar "Брелки"), nothing persisted, nothing uploaded: the user's photo is decoded, traced and drawn entirely in the browser. Output: a **PNG mock-up** (the keychain photo with the artwork "printed" on it, 1512×2016, ~5 MB — copyable to the clipboard too) and an **SVG of the artwork alone** (tight bounding box, 1 unit = 1 px of the original 3024×4032 photo, like the user's `example-result.svg`).

## Assets

- **Keychain photos**: 13 JPEGs 1512×2016 in `public/keychains/<id>.jpg` (`metal-black|glossy|mat|white`, `leather-black|brown|gray`, `subleather-black|circle|green|mint|pink|yellow`). Made from the user's 3024×4032 originals (222 MB, deleted; the app never needs them). Served by the app itself (Vercel static); Cloudinary is **not** needed (its delivery URLs would be fine for the canvas too — `access-control-allow-origin: *` — if the photos ever have to move out of the repo). Images must stay same-origin or CORS-enabled, or `toBlob` fails on a tainted canvas (Google Drive links would).
- **Brand marks**: `public/marks/<id>/` — one folder per brand, holding whichever of `icon.svg` / `text.svg` / `combined.svg` the source artwork actually has (never all three by construction; `KeychainMark.variants: Partial<Record<'icon'|'text'|'combined', string>>` in `data/keychain-marks.ts`). Of the 36 brands: 19 had one file with icon+text merged and were split by hand into all three; 3 are icon-only (bmw, opel, yamaha-3), 13 text-only (kept as their single file, no invented second part); Kovi has icon+text supplied separately by the user (2026-09-28), no combined; Loncin originally had only a fused combined mark like Zonsen, but the user later supplied separate icon/text art for it too (2026-09-28), so it now has all three; Zonsen's icon and letters still share one fused contour that could not be split without redrawing — `combined.svg` only, its sole remaining exception. Labels corrected (`kawaski`→Kawasaki, `musstang`→Mustang; `kaya`/`rottor` kept as named — unconfirmed). **When splitting a group of `<path>` elements out of a combined SVG, bake the translation into the `d` coordinates — never leave a `transform` attribute on the path.** `parseMarkSvg` reads only `d` and ignores `transform`; a browser-only file will look right in isolation and silently misplace itself once loaded through the app (this happened once; caught by re-checking through the real app, not just a standalone render). `utils/mark-variants.ts` (`availableVariants`, `defaultVariant` — combined > icon > text, `MARK_VARIANT_LABELS`) drives the page's "Вигляд марки" select, shown only when a mark has more than one variant; switching marks keeps the current variant if the new mark has it. `MarkLibrary.load(mark, variant)` caches per mark **and** variant (native `fetch` + timeout). `benelli` and `loncin` use `fill-rule="evenodd"`: the parser keeps such paths in a separate `evenOddPaths` list that travels through the layout, the canvas (`fill(path, 'evenodd')`), the SVG preview and the export (`fill-rule` attribute) — under the default nonzero rule their holes would fill in (measured: thousands of differing pixels). Paths inside `defs`/`clipPath`/`mask` are ignored.
- Reference material (not used by the app): `.claude/artifacts/keychains-assets/example-result.svg`, `result-example.png`, `web/` (the same JPEGs as `public/keychains`).

## Structure

```
src/app/features/keychain-mockups/
  keychain-mockups.routes.ts          lazy child of Shell (auth + 2FA guards)
  pages/keychain-mockups/             page: Reactive Form + signals, canvas preview, SVG preview, actions
  data/  keychain-types.ts (13 types: family, imageUrl, printArea, inkColor), keychain-marks.ts,
         keychain-config.ts (all layout/trace constants), photo-upload.ts
  models/keychain.model.ts
  services/ photo-tracer.service.ts (PHOTO_DECODER + POTRACE_LOADER seams), mark-library.service.ts,
            keychain-renderer.service.ts (canvas; reuses IMAGE_LOADER)
  utils/ trace-input.ts, potrace-path.ts, parse-mark-svg.ts, text-graphic.ts, layout-artwork.ts,
         artwork-svg.ts, decode-photo.ts, is-light-color.ts, validate-photo.ts
```

It borrows from `features/sticker-generator` (cross-feature imports; moving them to `shared/` is still an open structural question): `FontLibraryService`, `STICKER_FONTS` (Jua, Nunito), `createGlyphSource`/`layoutText`, `path-data` (`transformPathData`…), `IMAGE_LOADER`, `MockupRenderer.toPng`, `copyPngToClipboard`, `downloadFile`.

## Pipeline

1. **Photo → vector** (`PhotoTracer`): `decodePhoto` (createImageBitmap + canvas, white background, ≤2400 px) → `prepareTraceInput` (luminance < 128 = ink, crop to the ink box + 8 px, resample so the longest side is 1200 px with bilinear + re-threshold — measured: a 2× upscale beats tracing at native size) → **potrace** (`esm-potrace-wasm`, GPL-2.0 accepted for 3 users; default options, `pathonly`, `extractcolors:false`; ~90 ms on the main thread, so no Worker; runs are serialised through a promise queue because the wasm engine may hold global state) → `potraceToPathData` (relative `m c l z` at 10× scale, y flipped → absolute `M L C Z`; after `z` the next relative `m` starts from the subpath start) as ONE path so holes work under nonzero.
2. **Text**: `buildTextGraphic` (glyph outlines via `layoutText`, moved to the origin, with cap height).
3. **Layout** (`layoutArtwork`, constants in `keychain-config.ts`): every block (photo, mark, text) has its **own scale factor** and its **own orientation** (`scales` / `orientations` inputs; the page has a size and a placement select in each of the Зображення, Марка and Текст cards; there is no overall scale). Upright blocks stack top to bottom (photo → mark → text), each centred, inside the type's `printArea` minus 6 % padding; with other blocks the photo is ≤62 % of the height; mark ≤22 % and text cap 7 % only when a photo shares the stack, otherwise mark ≤50 % and text cap 16 %; text ≤90 % of the width; gap 5 %. A block's factor multiplies its base size and is clamped to the area width (edge margin `MIN_EDGE_PADDING_RATIO`, 2 %); the stack shrinks uniformly if too tall; the limits relax from the 6 % padding to the 2 % edge whenever some factor **in that stack** is above 1 (so a factor-1 sibling shrinks a little less than it would alone — with the default L for image and mark this is the common case). **Vertical blocks** are rotated a quarter turn **clockwise (−90°, reads top to bottom)** (`transformPathAffine` handles H/V and curves): they are laid out as a stack in a rotated frame (area width↔height) and rotated back, so they end up side by side along the keychain, photo leftmost and text rightmost (the frame stacks them reversed). When both upright and rotated blocks exist, the upright stack takes the top half (`VERTICAL_PHOTO_SHARE`) and the rotated row the bottom half. Defaults keep the look the user approved: image and mark **L** (1.3, `KEYCHAIN_SCALES` 0.8/1/1.15/1.3/1.5), text **M** (0.91, `KEYCHAIN_TEXT_SCALES` 0.52/0.715/0.91/1.105/1.3 — i.e. 0.7 × 1.3, the user wanted text smaller than the image).
4. **Render** (`KeychainRenderer`): draw the photo, then fill the artwork paths with the ink colour — `multiply` for dark ink (keeps the base texture, an "engraved" look), `source-over` for light ink. **The ink is fixed by the keychain type — there is no colour control** (user's rule): `metal-black` white; the other three metals `#000000`; every leather and eco-leather `#6f4a2b` (medium brown, user's pick). `inkBlend` per type: `source-over` for the three black bases (`metal-black`, `leather-black`, `subleather-black`, where multiplying would make the ink invisible), `multiply` for the rest (keeps the base texture, an "engraved" look). Brown on the brown leather is faint by nature.
5. **SVG** (`exportArtworkSvg`): tight box, ×2 (`FULL_RES_SCALE`), one `<g id="art" fill="ink">` of paths; validates ink and path characters.

The artwork can be photo only, mark only, text only, or any combination (each input is optional).

The photo picker is a large drop zone (`.keychain-dropzone`, a `<label for="photo">` around the visually hidden file input): click, keyboard or drag-and-drop a file (only the first one is used; drags that are not files are ignored). Dropped and chosen files go through the same `acceptPhoto` path (validation, preview, tracing).

## Rendering without flicker

Switching type/scale/orientation redraws the canvas; to avoid the visible "blink" the renderer resizes the canvas only when the photo size differs (assigning `width`/`height` clears it), and the page shows the busy state only if a render takes longer than `RENDER_BUSY_DELAY_MS` (150 ms) — as an overlay inside `.keychain-canvas-wrap`, never as a line that pushes the canvas down; the export buttons follow the delayed state, while a private `renderInFlight` flag still guards the actions. Verified with a rAF sampler in Playwright (no layout shift, no blank frames, no disabled flashes across 11 changes).

## Print areas

Rectangles in the 1512×2016 photo, sized to the printable face minus a ~10–15 px margin (enlarged once when the user asked for a bigger artwork; the artwork can only grow up to the area edge, so the area size is the real limit). Each is centred on the visual centre of that keychain's printable face (the metal insert without the eyelet notch, the leather strap below the clasp, the area inside the stitching, the middle of the round one), measured from pixel overlays (crosshair = centre) and re-checked for all 13 after the user reported the artwork sitting low on the white tag; the white tag's area contains the user's example artwork (x 653–870, y 968–1270). Automatic segmentation (flood fill, saturation/brightness masks) was tried and is NOT reliable here (it bleeds into tabs, rims and the chain) — use overlays. To adjust one, edit `printArea` in `data/keychain-types.ts` (the data spec pins the white tag) and re-check with an overlay. The round keychain uses a portrait rectangle inscribed in the circle.

## Build/dev gotchas (important)

- `esm-potrace-wasm` (Emscripten output) contains `require("node:fs")` behind a Node check. The browser build fails with "Could not resolve node:fs" unless `angular.json` has `"externalDependencies": ["node:fs"]` under the build options (the call becomes a never-executed `require` shim), and the **dev server** additionally needs `"prebundle": { "exclude": ["esm-potrace-wasm"] }` (otherwise Vite's pre-bundle emits a real `import "node:fs"` and the browser blocks it). Both are set.
- The package cannot be imported in Vitest/Node (it thinks it is Node and calls `require`), so the specs use the `POTRACE_LOADER` token with a fake; the real engine is verified only in a browser (Playwright run: photo → trace → PNG/SVG, no console errors).
- Playwright test input: render `.claude/artifacts/keychains-assets/example-result.svg` to a PNG and upload it.

## Decisions taken without the user (to confirm)

Print areas (hand-measured); layout ratios above; the two rotated blocks side by side and the photo/group split for the vertical orientation; labels; text limit 40, photo limit 10 MB PNG/JPEG/WebP; keychain families order (metal, subleather, leather); mock-up size 1512×2016 (not capped at 2000 px wide like the sticker mock-up).

## Still open (ask the user)

Mock-up "styles" (the reserved block in the form; several mock-ups per style at once); the final block order/proportions per keychain type; fonts beyond Jua/Nunito; physical size of the printed SVG; whether the rotation should apply to the photo too, and whether text and mark should also be able to be stacked/side by side without rotation.

## Checklist for changes

Follow `.claude/CLAUDE.md` (plan → research → development → `reviewer` → fix loop → close out). Specs next to every file (pin layout numbers as literals), no comments/`console.log`/`any`/unused code, `ng lint` + `ng build` clean, real-browser check for anything that touches potrace/canvas, update THIS skill.

## Page layout

The left column is one `<form class="keychain-form">` holding four separate panels (`.form-panel.keychain-card`, each with an `h2.keychain-card__title`): **Брелок** (type and the reserved styles block), **Зображення** (drop zone + trace status, size, placement), **Марка** (mark select, size, placement) and **Текст** (text, font, size, placement). Add new settings to the card they belong to. The right column (`.keychain-results`) is an auto-fit grid (`repeat(auto-fit, minmax(min(100%, 420px), 1fr))`): the mock-up and the SVG panels sit **side by side on wide screens** (about 1500 px and up) and stack into one column on narrower ones (checked at 1920/1500/1200/700 px). The mock-up canvas fills the whole width of its panel (no max width) and its height follows the photo's 3:4 ratio.
