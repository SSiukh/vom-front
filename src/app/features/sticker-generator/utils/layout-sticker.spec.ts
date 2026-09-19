import { CANVAS_WIDTH, SIZE_PRESETS } from '../data/size-presets';
import { STICKER_ICONS } from '../data/sticker-icons';
import type { GlyphSource } from '../models/glyph-source.model';
import type { SizePreset, StickerIcon } from '../models/sticker.model';
import { layoutSticker } from './layout-sticker';

const ICON_TO_CAP_RATIO = 2;
const GAP_TO_ICON_RATIO = 0.75;
const PADDING_TO_HEIGHT_RATIO = 0.166;

interface Box {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const SQUARE_ICON: StickerIcon = {
  id: 'instagram',
  label: 'Square',
  viewBoxWidth: 100,
  viewBoxHeight: 100,
  paths: ['M0 0L100 0L100 100L0 100Z'],
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

      expect(result.artPaths).toEqual([]);
      expect(result.missingCharacters).toEqual([]);
      expect(result.width).toBe(CANVAS_WIDTH);
    });

    it('treats whitespace-only text as empty', () => {
      expect(layout('   \t ').artPaths).toEqual([]);
    });

    it('lays out only the icon when the text is empty', () => {
      const result = layout('', SQUARE_ICON);

      expect(result.artPaths).toHaveLength(1);
      const box = boundsOf(result.artPaths[0] ?? '');
      expect(box.minX).toBeCloseTo(CANVAS_WIDTH - box.maxX, 2);
      expect(box.minY).toBeCloseTo(result.height - box.maxY, 2);
    });
  });

  describe('text only', () => {
    it('emits one compound path centred on the canvas', () => {
      const result = layout('AB');

      expect(result.artPaths).toHaveLength(1);
      const box = boundsOf(result.artPaths[0] ?? '');
      expect(box.minX).toBeCloseTo(CANVAS_WIDTH - box.maxX, 2);
      expect(box.minY).toBeCloseTo(result.height - box.maxY, 2);
    });

    it('fills the padded height when the text is short and wide banners allow it', () => {
      const result = layout('AB');
      const padding = result.height * PADDING_TO_HEIGHT_RATIO;
      const box = boundsOf(result.artPaths[0] ?? '');

      expect(box.minY).toBeCloseTo(padding, 2);
      expect(box.maxY).toBeCloseTo(result.height - padding, 2);
    });

    it('is limited by the padded width when the text is long', () => {
      const result = layout('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
      const padding = result.height * PADDING_TO_HEIGHT_RATIO;
      const box = boundsOf(result.artPaths[0] ?? '');

      expect(box.minX).toBeCloseTo(padding, 2);
      expect(box.maxX).toBeCloseTo(CANVAS_WIDTH - padding, 2);
    });

    it('never lets the artwork leave the padded area', () => {
      for (const preset of SIZE_PRESETS) {
        for (const text of ['A', 'AB', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ']) {
          const result = layout(text, null, preset);
          const padding = result.height * PADDING_TO_HEIGHT_RATIO;
          const box = boundsOf(result.artPaths[0] ?? '');

          expect(box.minX).toBeGreaterThanOrEqual(padding - 0.01);
          expect(box.maxX).toBeLessThanOrEqual(CANVAS_WIDTH - padding + 0.01);
          expect(box.minY).toBeGreaterThanOrEqual(padding - 0.01);
          expect(box.maxY).toBeLessThanOrEqual(result.height - padding + 0.01);
        }
      }
    });

    it('applies kerning between neighbouring glyphs', () => {
      const kerned = boundsOf(layout('AV').artPaths[0] ?? '');
      const plain = boundsOf(layout('AB').artPaths[0] ?? '');

      expect((kerned.maxX - kerned.minX) / (plain.maxX - plain.minX)).toBeCloseTo(1000 / 1100, 3);
    });

    it('collapses runs of whitespace into a single space', () => {
      expect(layout('A   B').artPaths).toEqual(layout('A B').artPaths);
    });

    it('advances a space by the glyph advance when the font has one', () => {
      const withSpaceGlyph = boundsOf(layout('A B').artPaths[0] ?? '');
      const withoutSpaceGlyph = boundsOf(
        layout('A B', null, PRESET_18_4, glyphs({ hasGlyph: (char) => char !== ' ' && char !== 'Ж' })).artPaths[0] ?? '',
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
      expect(result.artPaths).toEqual(layout('AB').artPaths);
    });

    it('does not report whitespace as missing', () => {
      expect(layout('A B', null, PRESET_18_4, glyphs({ hasGlyph: (char) => char !== ' ' })).missingCharacters).toEqual([]);
    });
  });

  describe('icon and text', () => {
    it('emits the icon paths first and the text path last', () => {
      const result = layout('A', SQUARE_ICON);

      expect(result.artPaths).toHaveLength(SQUARE_ICON.paths.length + 1);
    });

    it('places the icon to the left of the text', () => {
      const result = layout('A', SQUARE_ICON);
      const icon = boundsOf(result.artPaths[0] ?? '');
      const text = boundsOf(result.artPaths[1] ?? '');

      expect(icon.maxX).toBeLessThan(text.minX);
    });

    it('makes the icon twice as tall as the cap height', () => {
      const result = layout('A', SQUARE_ICON);
      const icon = boundsOf(result.artPaths[0] ?? '');
      const text = boundsOf(result.artPaths[1] ?? '');

      expect((icon.maxY - icon.minY) / (text.maxY - text.minY)).toBeCloseTo(ICON_TO_CAP_RATIO, 3);
    });

    it('keeps the gap proportional to the icon height', () => {
      const result = layout('A', SQUARE_ICON);
      const icon = boundsOf(result.artPaths[0] ?? '');
      const text = boundsOf(result.artPaths[1] ?? '');

      expect((text.minX - icon.maxX) / (icon.maxY - icon.minY)).toBeCloseTo(GAP_TO_ICON_RATIO, 3);
    });

    it('centres the icon on the text when the text is as tall as the capitals', () => {
      const result = layout('A', SQUARE_ICON);
      const icon = boundsOf(result.artPaths[0] ?? '');
      const text = boundsOf(result.artPaths[1] ?? '');

      expect((icon.minY + icon.maxY) / 2).toBeCloseTo((text.minY + text.maxY) / 2, 2);
    });

    it('centres the icon on the body of lowercase text, not on the capital-height band', () => {
      const result = layout('aaa', SQUARE_ICON);
      const icon = boundsOf(result.artPaths[0] ?? '');
      const text = boundsOf(result.artPaths[1] ?? '');

      expect((icon.minY + icon.maxY) / 2).toBeCloseTo((text.minY + text.maxY) / 2, 2);
    });

    it('ignores descenders when centring the icon on the text body', () => {
      const result = layout('ag', SQUARE_ICON);
      const icon = boundsOf(result.artPaths[0] ?? '');
      const text = boundsOf(result.artPaths[1] ?? '');
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
      const icon = boundsOf(result.artPaths[0] ?? '');
      const text = boundsOf(result.artPaths[1] ?? '');
      const scale = (icon.maxY - icon.minY) / 1400;

      expect(result.artPaths.join('')).not.toMatch(/NaN|Infinity/);
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
      const icon = boundsOf(result.artPaths[0] ?? '');
      const text = boundsOf(result.artPaths[1] ?? '');
      const scale = (icon.maxY - icon.minY) / 1400;

      expect((icon.minY + icon.maxY) / 2).toBeCloseTo(text.maxY - (700 / 2) * scale, 2);
    });

    it('centres the whole composition on the canvas', () => {
      const result = layout('AB', SQUARE_ICON);
      const icon = boundsOf(result.artPaths[0] ?? '');
      const text = boundsOf(result.artPaths[1] ?? '');
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
        for (const path of result.artPaths) {
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

        expect(result.artPaths).toHaveLength(icon.paths.length + 1);
        for (const path of result.artPaths) {
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

      expect(result.artPaths).toHaveLength(2);
      expect(result.artPaths.join('')).not.toMatch(/NaN|Infinity/);
    });
  });
});
