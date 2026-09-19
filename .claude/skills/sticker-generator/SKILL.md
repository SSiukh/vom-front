---
name: sticker-generator
description: How the in-browser sticker generator of vom-front works and how to extend it — the user types one line of text, picks a font, an optional Instagram/TikTok/Telegram icon, a size preset and two colours (background + artwork), and downloads an SVG with the glyphs outlined into paths. Covers the stack (opentype.js, deep ESM import), the pure text → layout → SVG pipeline, layout rules derived from the user's sample, adding fonts/icons/presets, testing, verified facts, and the traps. Also the deferred die-cut-contour option (clipper2-ts). Use when asked to add, extend, review or debug the sticker / наклейки / text-to-SVG tool or its page.
metadata:
  source: research survey of 2026-09-19, the user's answers of the same day, the built feature under src/app/features/sticker-generator, and this repo's code standards
---

## What it is

A frontend-only page at `/stickers` (sidebar "Наклейки"): no backend endpoint, nothing persisted. Input: one line of text, font, icon (none / Instagram / TikTok / Telegram), size preset, background colour, artwork colour. Output: a downloadable `.svg` built from outlines only — `<svg>`, `<rect>` background, `<g id="art">` with the icon paths and **one compound glyph path**. No `<text>`, `<style>`, `<image>`, no cut path. The user's sample (1057×235 px = the 18:4 preset ratio, unitless) is the target shape; they work in proportions and the print shop scales.

## Confirmed product decisions (user, 2026-09-19)

- **Two colours**: background (the rectangle *is* the sticker) and artwork (text + icon). Native `<input type="color">`.
- **No cut line.** The print shop cuts. Do not add `clipper2-ts` or cut code unless asked (see "Deferred").
- **Sizes = a `<select>` of presets** width × height: 10×2, 13×2, 16×3, 18×4, 20×4, 22×5, 25×5. Today they are proportions (canvas is `CANVAS_WIDTH` = 1000 unitless, height by ratio); later they become centimetres. Kept as data in `data/size-presets.ts`; switching to cm means emitting `mm` units and a mm viewBox (Cricut/Silhouette mis-scale by 75 %/133 % without both). The "proportions now, cm later" reading was inferred from the sample being 18:4 — the user may correct it.
- **All presets ≥ 4.4:1 → single line of text only.** No multi-line, no tracking control.
- **Icon** always to the **left** of the text; Instagram/TikTok supplied by the user as SVG.
- **Fonts and icons are supplied by the user**; the end user only picks from the list (no in-app upload).

## Layout rules (`utils/layout-sticker.ts`) — derived from the user's sample, pinned in the spec as literals

- Icon height = **2 × cap height** (sample: icon 157 vs ascender ≈ 80).
- Gap icon ↔ text = **0.75 × icon height** (sample: 124 / 157).
- Padding = **16.6 % of the sticker height** on every side (sample: 39 / 235).
- The icon is centred on the text **body**: from the baseline to the top of the ink, capped at the cap height, descenders ignored. (Centring on the full cap band put the icon visibly high above lowercase-only words like `username`.) Degenerate text below the baseline falls back to the cap band.
- Content = icon + gap + text ink; `scale = min(fit width, fit height)` inside the padding; the composition is centred. Alignment uses the **ink box**, never advance widths.
- Missing glyphs are skipped (no advance) and reported; whitespace collapses to single spaces and is never "missing".

To change a proportion: edit the constant **and** the literal in `layout-sticker.spec.ts` (deliberate — a spec that imports the constant it verifies is a tautology; a mutation run proved that once).

## Mock-up on a photo (PNG)

"Додати на фото" snapshots the current sticker (max 5, removable, each still downloadable as its own SVG). `MockupRenderer` draws `public/mockup/background.jpg` and the stickers on a native `<canvas>` (SVG blob → `Image` → `drawImage`, soft shadow, no rotation) and `toPng` encodes it; no dependency. Output width is `min(photo, 2000)`.

- Layout (`utils/layout-mockup.ts`, constants in `data/mockup-config.ts`, pinned as literals in the spec): one vertical column, block centred horizontally and vertically; **every sticker has the same width** (60 % of the photo, whatever its preset — the user rejected true relative scale), height from its own preset ratio; gap = 4 % of the sticker width; the block shrinks uniformly if it would exceed 90 % of the photo height.
- Swap the photo: replace `public/mockup/background.jpg` (compress the original — the supplied 6.3 MB PNG became a 0.9 MB JPG; the original stays in `.claude/artifacts/sticker-assets/`). Keep it same-origin or the canvas taints and `toBlob` fails.
- Testing: jsdom has no canvas; the component spec fakes `MockupRenderer`, the renderer spec fakes the canvas/context and the `IMAGE_LOADER` token.
- The exported PNG is large (~5 MB for the textured photo) because the photo is noisy.

## Stack and verified facts

- **`opentype.js` 2.0.0** (MIT, zero dependencies). Verified on the real Jua font: named export `parse`; `font.charToGlyph(ch).getPath(0, 0, unitsPerEm).commands` gives **y-down** font-unit coordinates with the baseline at 0 (`H` spans −712…5); commands are `M L Q` for TrueType (`C` for CFF); `font.tables.os2.sCapHeight` = 711; `charToGlyphIndex` is **0 for a missing glyph** (`.notdef`); `getKerningValue` works from GPOS (`To` −129).
- **Import the ESM build explicitly**: `import('opentype.js/dist/opentype.mjs')`. The package's `browser` field points at the IIFE build, so a plain `import('opentype.js')` makes the production build warn "Module 'opentype.js' is not ESM" and defeats tree-shaking. The package has no `exports` map, so the deep path resolves; a package update that moves the file fails the build loudly.
- **No typings ship**: `src/types/opentype.d.ts` declares a minimal `'opentype.js'` module (`OpentypeFont`, `OpentypeGlyph`, `parse`) and re-exports it for the deep path. No `any`.
- The library lands in its own lazy chunk (`opentype`, ≈240 kB raw / 56 kB gz) loaded only when the page opens; `sticker-generator-routes` is ≈16 kB. The initial bundle grew only by the sidebar entry: **≈3.3 kB is the new Lucide icon itself** (any new sidebar icon costs about that) plus ≈0.5 kB route/nav entry.
- **Test seam instead of `vi.mock`**: `FONT_PARSER_LOADER` (an `InjectionToken` with a lazy `import()` factory) lets specs inject a fake parser; one spec resolves the default factory to prove the real module loads under the test bundler. Do not name a type `FontFace` — it shadows the DOM global; the seam is `GlyphSource`.

## Where things live

```
src/app/features/sticker-generator/
  sticker-generator.routes.ts             lazy child of Shell (auth + 2FA guards apply)
  pages/sticker-generator/                page, Reactive Form, signals, [attr.d] preview
  data/  size-presets.ts, sticker-icons.ts, sticker-fonts.ts
  models/ glyph-source.model.ts, sticker.model.ts
  services/font-library.service.ts        native fetch + cache + FONT_PARSER_LOADER
  utils/ layout-sticker, path-data, svg-export, contrast, file-name, download-file, opentype-glyph-source
src/types/opentype.d.ts
public/fonts/<Family>/<file>.ttf + OFL.txt
.claude/artifacts/sticker-assets/         the user's original source files
```

Wiring: `FEATURE_ROUTES.stickers`, a lazy `loadChildren` in `app.routes.ts`, a `NAV_ITEMS` entry (`LucideStickyNote`) and the sidebar spec (8 links).

## How to add things

- **A font**: put a static TTF/OTF/WOFF (never WOFF2, never variable) and its licence into `public/fonts/<Family>/`; add `{ id, label, url }` to `STICKER_FONTS` with a **relative** URL (`fonts/...`, no leading slash — respects `<base href>`). Check coverage first; the data spec forbids absolute URLs and unreadable formats. Jua (supplied) covers Basic Latin, digits, Hangul and a few symbols — **no Cyrillic**; the page lists any character missing from the chosen font and blocks download rather than drawing `.notdef` boxes. A Cyrillic font must contain `ї є і ґ`. Jua is 2.1 MB (2,520 glyphs, mostly Hangul); it is fetched once when the page opens. Subsetting to Latin would cut it to a few dozen kB — OFL allows it and no Reserved Font Name is declared, but it modifies the user's file, so ask first.
- **An icon**: single colour, strokes already outlined, **paths only, absolute commands** (`M L H V C Q Z`). Add `{ id, label, viewBoxWidth, viewBoxHeight, paths }` to `STICKER_ICONS`, extend `StickerIconId`, and the data/layout specs run over it automatically. `transformPathData` throws on relative commands and arcs. If a source SVG has `<circle>`/`<rect>`, transforms, strokes or several colours, fix it in Inkscape first (Object to Path, Stroke to Path, unite). Brand-logo trademark use is the user's responsibility.
- **A preset**: add to `SIZE_PRESETS` (the data spec pins the exact list — update it deliberately).

## Gotchas

- **`HttpClient` is the wrong tool for font files.** Every `HttpClient` call passes `authTokenInterceptor` (Bearer + possible proactive refresh), `serverWakeInterceptor` (gated on the cold-start `/ping`) and `requestTimeoutInterceptor` (20 s). Static same-origin assets need none of it — `FontLibraryService` uses native `fetch` (verified in a real browser: the font request carries no `Authorization`). This is a deliberate exception to "HTTP only through `core/api/`"; tell the reviewer.
- **Preview is bound attributes, never `innerHTML`**: `[attr.viewBox]`, `[attr.d]`, `[attr.fill]` on `<svg>/<rect>/<g>/<path>` need no sanitizer. The SVG string exists only for the download `Blob`.
- **Export is defensive**: `exportSvg` rejects colours that are not `#rrggbb` and path data outside `[MLHVCQZ0-9 ,.eE+-]`, so nothing user-controlled can break out of an attribute. User text never enters the file as text.
- **Fill rule**: keep the default `nonzero`. Font contours wind counters opposite to outers, so it renders counters and unions overlaps; `evenodd` would punch holes where glyphs overlap. (The research survey suggested `evenodd`; this corrects it.) Mixing TrueType and CFF fonts in one string would flip winding — not supported.
- **Reactive state**: `canDownload` must depend only on signals; `FormGroup.valid` is not one. The form is read through `toSignal(valueChanges…, { requireSync: true })`.
- **Contrast**: identical colours produce an invisible sticker — a WCAG contrast ratio < 3 shows a warning (does not block).
- **Numbers** go through `formatNumber` (3 decimals, never `-0`); guard empty text, zero-size content and missing glyphs.
- **`vi.spyOn` on ES-module exports does not work** — spec the download helper by stubbing `URL.createObjectURL` and `HTMLAnchorElement.prototype.click` (jsdom has no `createObjectURL`).

## Deferred: die-cut contour (only if the user asks)

Union all glyph + icon polylines (non-zero), offset outward with round joins, optionally drop inner contours, emit `<g id="CutContour" fill="none" stroke="#ff00ff" stroke-width="0.1">`. Library `clipper2-ts` (pure TS, ≈34 kB gz, Boost licence; `clipper2-wasm` needs a served `.wasm`); Clipper needs polylines, so flatten Béziers first (start 0.05 mm tolerance, integer scale ×1000 — untested starting values). Plain SVG has no spot colours: `CutContour` is a convention (Roland VersaWorks wants a swatch literally named `CutContour`, renamed by hand in Illustrator/Corel); Summa/Graphtec/Mimaki conventions are unverified. Needs the target cutter software from the user, an offset control and a toggle.

## Not verified

Variable-font rendering in opentype.js 2.0; whether a CFF/OpenType font renders through the same adapter (only TrueType Jua was exercised); how printers/plotters treat the unitless SVG (the sample is unitless too); the size-preset unit reading.

## Checklist for future changes

Follow `.claude/CLAUDE.md` (plan → research → development → `reviewer` → fix loop → close out).

- [ ] Plan entry in `.claude/PLAN.md`
- [ ] Specs updated next to every changed file (pin layout constants as literals)
- [ ] `tsc` (app + spec), `ng test`, `ng lint`, `ng build` clean; no new build warnings; note any initial-bundle change
- [ ] Real-browser check: Latin text, a missing-glyph string, each icon and preset, both colours, download, open the SVG in Inkscape/Illustrator
- [ ] `reviewer` pass, then mark the plan entry done
