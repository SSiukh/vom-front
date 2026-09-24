import { CANVAS_WIDTH, SIZE_PRESETS } from '../data/size-presets';
import { STICKER_ICONS } from '../data/sticker-icons';
import type { GlyphSource } from '../models/glyph-source.model';
import type { ColorStickerIcon, SizePreset, StickerIcon } from '../models/sticker.model';
import { layoutSticker } from './layout-sticker';

const ICON_TO_CAP_RATIO = 2;
const GAP_TO_ICON_RATIO = 0.75;
const PADDING_TO_HEIGHT_RATIO = 0.166;
const MIN_PADDING_TO_HEIGHT_RATIO = 0.08;

interface Box {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const SQUARE_ICON: StickerIcon = {
  id: 'instagram',
  kind: 'mono',
  label: 'Square',
  viewBoxWidth: 100,
  viewBoxHeight: 100,
  paths: ['M0 0L100 0L100 100L0 100Z'],
};

const COLOR_ICON: ColorStickerIcon = {
  id: 'tiktok-color',
  kind: 'color',
  label: 'Colour',
  viewBoxWidth: 100,
  viewBoxHeight: 100,
  layers: [
    { d: 'M0 0L100 0L100 100L0 100Z', paint: { type: 'color', color: '#25f4ee' } },
    { d: 'M0 0L100 0L100 100L0 100Z', paint: { type: 'gradient', key: 'glow' } },
  ],
  gradients: [
    {
      key: 'glow',
      cx: 0,
      cy: 0,
      r: 1,
      matrix: [50, 0, 0, 50, 10, 20],
      stops: [
        { offset: 0.5, color: '#8c3aaa', opacity: 0 },
        { offset: 1, color: '#8c3aaa', opacity: 1 },
      ],
    },
  ],
  textPaint: { type: 'color', color: '#000000' },
};

const GRADIENT_TEXT_ICON: ColorStickerIcon = {
  ...COLOR_ICON,
  id: 'instagram-color',
  textPaint: {
    type: 'gradient',
    contrastColor: '#d82d7e',
    stops: [
      { offset: 0, color: '#fa8f21', opacity: 1 },
      { offset: 1, color: '#8c3aaa', opacity: 1 },
    ],
  },
};

const PRESET_18_4 = requirePreset('18x4');

function requirePreset(id: string): SizePreset {
  const preset = SIZE_PRESETS.find((candidate) => candidate.id === id);
  if (!preset) {
    throw new Error(`Missing preset ${id}`);
  }
  return preset;
}

function glyphs(overrides: Partial<GlyphSource> = {}): GlyphSource {
  return {
    unitsPerEm: 1000,
    capHeight: 700,
    hasGlyph: (char) => char !== 'Ж',
    advance: () => 600,
    kerning: (left, right) => (left === 'A' && right === 'V' ? -100 : 0),
    outline: (char) => {
      const top = char === char.toUpperCase() ? -700 : -430;
      const bottom = char === 'g' ? 200 : 0;
      return [
        { type: 'M', x: 50, y: bottom },
        { type: 'L', x: 550, y: bottom },
        { type: 'L', x: 550, y: top },
        { type: 'L', x: 50, y: top },
        { type: 'Z' },
      ];
    },
    ...overrides,
  };
}

function pathsOf(result: { layers: readonly { d: string }[] }): string[] {
  return result.layers.map((layer) => layer.d);
}

function boundsOf(pathData: string): Box {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const segment of pathData.matchAll(/([MLHVCQZ])([^MLHVCQZ]*)/g)) {
    const numbers = (segment[2]?.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    if (segment[1] === 'H') {
      xs.push(...numbers);
    } else if (segment[1] === 'V') {
      ys.push(...numbers);
    } else {
      numbers.forEach((value, index) => (index % 2 === 0 ? xs : ys).push(value));
    }
  }
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function layout(text: string, icon: StickerIcon | null = null, preset: SizePreset = PRESET_18_4, source = glyphs()) {
  return layoutSticker({ text, glyphs: source, icon, preset });
}

describe('layoutSticker', () => {
  describe('canvas', () => {
    it.each([
      ['10x2', 200],
      ['13x2', (1000 * 2) / 13],
      ['16x3', 187.5],
      ['18x4', (1000 * 4) / 18],
      ['20x4', 200],
      ['22x5', (1000 * 5) / 22],
      ['25x5', 200],
    ])('uses a %s canvas with the preset aspect ratio', (id, expectedHeight) => {
      const result = layout('A', null, requirePreset(id));

      expect(result.width).toBe(CANVAS_WIDTH);
      expect(result.height).toBeCloseTo(expectedHeight, 6);
    });
  });

  describe('empty input', () => {
    it('produces no artwork for empty text without an icon', () => {
      const result = layout('');

      expect(pathsOf(result)).toEqual([]);
      expect(result.missingCharacters).toEqual([]);
      expect(result.width).toBe(CANVAS_WIDTH);
    });

    it('treats whitespace-only text as empty', () => {
      expect(pathsOf(layout('   \t '))).toEqual([]);
    });

    it('lays out only the icon when the text is empty', () => {
      const result = layout('', SQUARE_ICON);

      expect(pathsOf(result)).toHaveLength(1);
      const box = boundsOf(pathsOf(result)[0] ?? '');
      expect(box.minX).toBeCloseTo(CANVAS_WIDTH - box.maxX, 2);
      expect(box.minY).toBeCloseTo(result.height - box.maxY, 2);
    });
  });

  describe('text only', () => {
    it('emits one compound path centred on the canvas', () => {
      const result = layout('AB');

      expect(pathsOf(result)).toHaveLength(1);
      const box = boundsOf(pathsOf(result)[0] ?? '');
      expect(box.minX).toBeCloseTo(CANVAS_WIDTH - box.maxX, 2);
      expect(box.minY).toBeCloseTo(result.height - box.maxY, 2);
    });

    it('fills the padded height when the text is short and wide banners allow it', () => {
      const result = layout('AB');
      const padding = result.height * PADDING_TO_HEIGHT_RATIO;
      const box = boundsOf(pathsOf(result)[0] ?? '');

      expect(box.minY).toBeCloseTo(padding, 2);
      expect(box.maxY).toBeCloseTo(result.height - padding, 2);
    });

    it('is limited by the padded width when the text is long', () => {
      const result = layout('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
      const padding = result.height * PADDING_TO_HEIGHT_RATIO;
      const box = boundsOf(pathsOf(result)[0] ?? '');

      expect(box.minX).toBeCloseTo(padding, 2);
      expect(box.maxX).toBeCloseTo(CANVAS_WIDTH - padding, 2);
    });

    it('never lets the artwork leave the padded area', () => {
      for (const preset of SIZE_PRESETS) {
        for (const text of ['A', 'AB', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ']) {
          const result = layout(text, null, preset);
          const padding = result.height * PADDING_TO_HEIGHT_RATIO;
          const box = boundsOf(pathsOf(result)[0] ?? '');

          expect(box.minX).toBeGreaterThanOrEqual(padding - 0.01);
          expect(box.maxX).toBeLessThanOrEqual(CANVAS_WIDTH - padding + 0.01);
          expect(box.minY).toBeGreaterThanOrEqual(padding - 0.01);
          expect(box.maxY).toBeLessThanOrEqual(result.height - padding + 0.01);
        }
      }
    });

    it('applies kerning between neighbouring glyphs', () => {
      const kerned = boundsOf(pathsOf(layout('AV'))[0] ?? '');
      const plain = boundsOf(pathsOf(layout('AB'))[0] ?? '');

      expect((kerned.maxX - kerned.minX) / (plain.maxX - plain.minX)).toBeCloseTo(1000 / 1100, 3);
    });

    it('collapses runs of whitespace into a single space', () => {
      expect(pathsOf(layout('A   B'))).toEqual(pathsOf(layout('A B')));
    });

    it('advances a space by the glyph advance when the font has one', () => {
      const withSpaceGlyph = boundsOf(pathsOf(layout('A B'))[0] ?? '');
      const withoutSpaceGlyph = boundsOf(
        pathsOf(layout('A B', null, PRESET_18_4, glyphs({ hasGlyph: (char) => char !== ' ' && char !== 'Ж' })))[0] ?? '',
      );

      const widthWith = withSpaceGlyph.maxX - withSpaceGlyph.minX;
      const widthWithout = withoutSpaceGlyph.maxX - withoutSpaceGlyph.minX;
      expect(widthWith / widthWithout).toBeCloseTo(1700 / 1350, 3);
    });
  });

  describe('missing characters', () => {
    it('reports each unsupported character once and skips it', () => {
      const result = layout('AЖЖB');

      expect(result.missingCharacters).toEqual(['Ж']);
      expect(pathsOf(result)).toEqual(pathsOf(layout('AB')));
    });

    it('does not report whitespace as missing', () => {
      expect(layout('A B', null, PRESET_18_4, glyphs({ hasGlyph: (char) => char !== ' ' })).missingCharacters).toEqual([]);
    });
  });

  describe('icon and text', () => {
    it('emits the icon paths first and the text path last', () => {
      const result = layout('A', SQUARE_ICON);

      expect(pathsOf(result)).toHaveLength(SQUARE_ICON.paths.length + 1);
    });

    it('places the icon to the left of the text', () => {
      const result = layout('A', SQUARE_ICON);
      const icon = boundsOf(pathsOf(result)[0] ?? '');
      const text = boundsOf(pathsOf(result)[1] ?? '');

      expect(icon.maxX).toBeLessThan(text.minX);
    });

    it('makes the icon twice as tall as the cap height', () => {
      const result = layout('A', SQUARE_ICON);
      const icon = boundsOf(pathsOf(result)[0] ?? '');
      const text = boundsOf(pathsOf(result)[1] ?? '');

      expect((icon.maxY - icon.minY) / (text.maxY - text.minY)).toBeCloseTo(ICON_TO_CAP_RATIO, 3);
    });

    it('keeps the gap proportional to the icon height', () => {
      const result = layout('A', SQUARE_ICON);
      const icon = boundsOf(pathsOf(result)[0] ?? '');
      const text = boundsOf(pathsOf(result)[1] ?? '');

      expect((text.minX - icon.maxX) / (icon.maxY - icon.minY)).toBeCloseTo(GAP_TO_ICON_RATIO, 3);
    });

    it('centres the icon on the text when the text is as tall as the capitals', () => {
      const result = layout('A', SQUARE_ICON);
      const icon = boundsOf(pathsOf(result)[0] ?? '');
      const text = boundsOf(pathsOf(result)[1] ?? '');

      expect((icon.minY + icon.maxY) / 2).toBeCloseTo((text.minY + text.maxY) / 2, 2);
    });

    it('centres the icon on the body of lowercase text, not on the capital-height band', () => {
      const result = layout('aaa', SQUARE_ICON);
      const icon = boundsOf(pathsOf(result)[0] ?? '');
      const text = boundsOf(pathsOf(result)[1] ?? '');

      expect((icon.minY + icon.maxY) / 2).toBeCloseTo((text.minY + text.maxY) / 2, 2);
    });

    it('ignores descenders when centring the icon on the text body', () => {
      const result = layout('ag', SQUARE_ICON);
      const icon = boundsOf(pathsOf(result)[0] ?? '');
      const text = boundsOf(pathsOf(result)[1] ?? '');
      const scale = (icon.maxY - icon.minY) / 1400;
      const baseline = text.maxY - 200 * scale;

      expect((icon.minY + icon.maxY) / 2).toBeCloseTo((text.minY + baseline) / 2, 2);
    });

    it('falls back to the capital-height band when the text sits entirely below the baseline', () => {
      const underscore = glyphs({
        outline: () => [
          { type: 'M', x: 50, y: 50 },
          { type: 'L', x: 550, y: 50 },
          { type: 'L', x: 550, y: 80 },
          { type: 'L', x: 50, y: 80 },
          { type: 'Z' },
        ],
      });
      const result = layout('_', SQUARE_ICON, PRESET_18_4, underscore);
      const icon = boundsOf(pathsOf(result)[0] ?? '');
      const text = boundsOf(pathsOf(result)[1] ?? '');
      const scale = (icon.maxY - icon.minY) / 1400;

      expect(pathsOf(result).join('')).not.toMatch(/NaN|Infinity/);
      expect(text.minY - (icon.minY + icon.maxY) / 2).toBeCloseTo(400 * scale, 2);
    });

    it('never treats ascenders above the cap height as part of the body', () => {
      const tall = glyphs({
        outline: () => [
          { type: 'M', x: 50, y: 0 },
          { type: 'L', x: 550, y: 0 },
          { type: 'L', x: 550, y: -760 },
          { type: 'L', x: 50, y: -760 },
          { type: 'Z' },
        ],
      });
      const result = layout('A', SQUARE_ICON, PRESET_18_4, tall);
      const icon = boundsOf(pathsOf(result)[0] ?? '');
      const text = boundsOf(pathsOf(result)[1] ?? '');
      const scale = (icon.maxY - icon.minY) / 1400;

      expect((icon.minY + icon.maxY) / 2).toBeCloseTo(text.maxY - (700 / 2) * scale, 2);
    });

    it('centres the whole composition on the canvas', () => {
      const result = layout('AB', SQUARE_ICON);
      const icon = boundsOf(pathsOf(result)[0] ?? '');
      const text = boundsOf(pathsOf(result)[1] ?? '');
      const left = Math.min(icon.minX, text.minX);
      const right = Math.max(icon.maxX, text.maxX);
      const top = Math.min(icon.minY, text.minY);
      const bottom = Math.max(icon.maxY, text.maxY);

      expect(left).toBeCloseTo(CANVAS_WIDTH - right, 2);
      expect(top).toBeCloseTo(result.height - bottom, 2);
    });

    it('keeps the artwork inside the padded area on every preset', () => {
      for (const preset of SIZE_PRESETS) {
        const result = layout('ABCDEFGH', SQUARE_ICON, preset);
        const padding = result.height * PADDING_TO_HEIGHT_RATIO;
        for (const path of pathsOf(result)) {
          const box = boundsOf(path);

          expect(box.minX).toBeGreaterThanOrEqual(padding - 0.01);
          expect(box.maxX).toBeLessThanOrEqual(CANVAS_WIDTH - padding + 0.01);
          expect(box.minY).toBeGreaterThanOrEqual(padding - 0.01);
          expect(box.maxY).toBeLessThanOrEqual(result.height - padding + 0.01);
        }
      }
    });

    it('lays out every supplied brand icon inside the canvas with finite numbers', () => {
      for (const icon of STICKER_ICONS) {
        const result = layout('username', icon);

        expect(pathsOf(result)).toHaveLength((icon.kind === 'mono' ? icon.paths.length : icon.layers.length) + 1);
        for (const path of pathsOf(result)) {
          expect(path).not.toMatch(/NaN|Infinity/);
          const box = boundsOf(path);
          expect(box.minX).toBeGreaterThanOrEqual(0);
          expect(box.maxX).toBeLessThanOrEqual(CANVAS_WIDTH);
          expect(box.minY).toBeGreaterThanOrEqual(0);
          expect(box.maxY).toBeLessThanOrEqual(result.height);
        }
      }
    });

    it('falls back to a proportional cap height when the font reports none', () => {
      const result = layout('A', SQUARE_ICON, PRESET_18_4, glyphs({ capHeight: 0 }));

      expect(pathsOf(result)).toHaveLength(2);
      expect(pathsOf(result).join('')).not.toMatch(/NaN|Infinity/);
    });
  });

  describe('content scale', () => {
    const inkBox = (contentScale?: number, icon: StickerIcon | null = SQUARE_ICON, text = 'AB'): Box => {
      const result = layoutSticker({ text, glyphs: glyphs(), icon, preset: PRESET_18_4, contentScale });
      const boxes = pathsOf(result).map(boundsOf);
      return {
        minX: Math.min(...boxes.map((box) => box.minX)),
        maxX: Math.max(...boxes.map((box) => box.maxX)),
        minY: Math.min(...boxes.map((box) => box.minY)),
        maxY: Math.max(...boxes.map((box) => box.maxY)),
      };
    };

    it('is the full fitted size when no scale is given', () => {
      expect(inkBox(undefined)).toEqual(inkBox(1));
    });

    it('shrinks the whole icon and text composition by the given factor', () => {
      const full = inkBox(1);
      const half = inkBox(0.5);

      expect(half.maxX - half.minX).toBeCloseTo((full.maxX - full.minX) * 0.5, 1);
      expect(half.maxY - half.minY).toBeCloseTo((full.maxY - full.minY) * 0.5, 1);
    });

    it('keeps the smaller composition centred on the sticker', () => {
      for (const factor of [0.5, 0.65, 0.8, 0.9]) {
        const box = inkBox(factor);

        expect((box.minX + box.maxX) / 2).toBeCloseTo(CANVAS_WIDTH / 2, 1);
        expect((box.minY + box.maxY) / 2).toBeCloseTo((CANVAS_WIDTH * 4) / 18 / 2, 1);
      }
    });

    it('enlarges a height-limited composition beyond the standard fit', () => {
      const standard = inkBox(1, SQUARE_ICON, 'A');
      const large = inkBox(1.2, SQUARE_ICON, 'A');

      expect(large.maxY - large.minY).toBeCloseTo((standard.maxY - standard.minY) * 1.2, 1);
    });

    it('never lets an enlarged composition come closer than the minimum padding to any edge', () => {
      const height = (CANVAS_WIDTH * 4) / 18;
      const margin = height * MIN_PADDING_TO_HEIGHT_RATIO;

      for (const text of ['A', 'AB', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ']) {
        for (const factor of [1.1, 1.2, 3]) {
          const box = inkBox(factor, SQUARE_ICON, text);

          expect(box.minX).toBeGreaterThanOrEqual(margin - 0.05);
          expect(box.maxX).toBeLessThanOrEqual(CANVAS_WIDTH - margin + 0.05);
          expect(box.minY).toBeGreaterThanOrEqual(margin - 0.05);
          expect(box.maxY).toBeLessThanOrEqual(height - margin + 0.05);
        }
      }
    });

    it('keeps the enlarged composition centred', () => {
      const box = inkBox(1.2, SQUARE_ICON, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');

      expect((box.minX + box.maxX) / 2).toBeCloseTo(CANVAS_WIDTH / 2, 1);
      expect((box.minY + box.maxY) / 2).toBeCloseTo((CANVAS_WIDTH * 4) / 18 / 2, 1);
    });

    it('scales the text on its own the same way', () => {
      const full = inkBox(1, null);
      const small = inkBox(0.65, null);

      expect(small.maxX - small.minX).toBeCloseTo((full.maxX - full.minX) * 0.65, 1);
    });

    it('scales colour-icon gradients together with the icon', () => {
      const scaled = layoutSticker({ text: 'A', glyphs: glyphs(), icon: COLOR_ICON, preset: PRESET_18_4, contentScale: 0.5 });
      const full = layoutSticker({ text: 'A', glyphs: glyphs(), icon: COLOR_ICON, preset: PRESET_18_4 });
      const [scaledGradient, fullGradient] = [scaled.gradients[0], full.gradients[0]];

      expect(scaledGradient?.type === 'radial' && fullGradient?.type === 'radial' && scaledGradient.matrix[0]).toBeCloseTo(
        fullGradient?.type === 'radial' ? fullGradient.matrix[0] * 0.5 : 0,
        1,
      );
    });
  });

  describe('paints', () => {
    it('leaves single-colour icon and text layers to take the artwork colour', () => {
      const result = layout('A', SQUARE_ICON);

      expect(result.layers.map((layer) => layer.fill)).toEqual([null, null]);
      expect(result.gradients).toEqual([]);
    });

    it('leaves text without an icon to take the artwork colour', () => {
      expect(layout('A').layers.map((layer) => layer.fill)).toEqual([null]);
    });

    it('keeps the original fills of a colour icon and paints the text with its fixed colour', () => {
      const result = layout('A', COLOR_ICON);

      expect(result.layers).toHaveLength(3);
      expect(result.layers[0]?.fill).toBe('#25f4ee');
      expect(result.layers[1]?.fill).toMatch(/^url\(#tiktok-color-glow-[a-z0-9]+\)$/);
      expect(result.layers[2]?.fill).toBe('#000000');
      expect(result.gradients.map((gradient) => gradient.type)).toEqual(['radial']);
    });

    it('carries a colour icon gradient through the same scale and shift as the icon paths', () => {
      const result = layout('A', COLOR_ICON);
      const icon = boundsOf(pathsOf(result)[0] ?? '');
      const k = (icon.maxX - icon.minX) / 100;
      const gradient = result.gradients[0];

      expect(gradient?.type).toBe('radial');
      if (gradient?.type !== 'radial') {
        return;
      }
      expect(gradient.matrix[0]).toBeCloseTo(50 * k, 1);
      expect(gradient.matrix[3]).toBeCloseTo(50 * k, 1);
      expect(gradient.matrix[1]).toBe(0);
      expect(gradient.matrix[2]).toBe(0);
      expect(gradient.matrix[4]).toBeCloseTo(10 * k + icon.minX, 1);
      expect(gradient.matrix[5]).toBeCloseTo(20 * k + icon.minY, 1);
      expect([gradient.cx, gradient.cy, gradient.r]).toEqual([0, 0, 1]);
      expect(result.layers[1]?.fill).toBe(`url(#${gradient.id})`);
    });

    it('paints the text with a bottom-left to top-right gradient when the icon asks for one', () => {
      const result = layout('A', GRADIENT_TEXT_ICON);
      const text = result.layers.at(-1);
      const gradient = result.gradients.find((candidate) => candidate.type === 'linear');

      expect(text?.fill).toBe('url(#instagram-color-text)');
      expect(gradient).toEqual({
        type: 'linear',
        id: 'instagram-color-text',
        x1: 0,
        y1: 1,
        x2: 1,
        y2: 0,
        stops: [
          { offset: 0, color: '#fa8f21', opacity: 1 },
          { offset: 1, color: '#8c3aaa', opacity: 1 },
        ],
      });
    });

    it('adds no text gradient when there is no text to paint', () => {
      const result = layout('', GRADIENT_TEXT_ICON);

      expect(result.gradients.map((gradient) => gradient.type)).toEqual(['radial']);
    });

    it('gives the same gradient the same id for the same layout and another id for another size', () => {
      const instagram = STICKER_ICONS.find((icon) => icon.id === 'instagram-color') ?? null;
      const ids = (preset: SizePreset) => layout('kolo', instagram, preset).gradients.map((gradient) => gradient.id);

      expect(ids(PRESET_18_4)).toEqual(ids(PRESET_18_4));
      expect(ids(requirePreset('10x2'))).not.toEqual(ids(PRESET_18_4));
    });

    it('never gives two different gradient definitions the same id across layouts', () => {
      const definitions = new Map<string, string>();
      const colourIcons = STICKER_ICONS.filter((candidate) => candidate.kind === 'color');

      for (const icon of colourIcons) {
        for (const preset of SIZE_PRESETS) {
          for (const text of ['a', 'username', 'Kolostrack']) {
            for (const gradient of layout(text, icon, preset).gradients) {
              const definition = JSON.stringify(gradient);
              expect(definitions.get(gradient.id) ?? definition).toBe(definition);
              definitions.set(gradient.id, definition);
            }
          }
        }
      }
      expect(definitions.size).toBeGreaterThan(2);
    });

    it('resolves every gradient reference of the supplied colour icons', () => {
      for (const icon of STICKER_ICONS.filter((candidate) => candidate.kind === 'color')) {
        const result = layout('username', icon);
        const ids = new Set(result.gradients.map((gradient) => gradient.id));

        for (const layer of result.layers) {
          const reference = /^url\(#(.+)\)$/.exec(layer.fill ?? '')?.[1];
          if (reference) {
            expect(ids.has(reference)).toBe(true);
          }
        }
        expect(result.layers.every((layer) => layer.fill !== null)).toBe(true);
      }
    });
  });
});
