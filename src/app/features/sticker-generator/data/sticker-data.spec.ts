import {
  MAX_MOCKUP_OUTPUT_WIDTH,
  MAX_MOCKUP_STICKERS,
  MOCKUP_BACKGROUND_URL,
} from './mockup-config';
import type { StickerIcon } from '../models/sticker.model';
import { DEFAULT_SIZE_PRESET_ID, SIZE_PRESETS } from './size-presets';
import { STICKER_FONTS } from './sticker-fonts';
import { STICKER_ICONS } from './sticker-icons';

describe('sticker data', () => {
  describe('size presets', () => {
    it('offers exactly the agreed width x height presets, in order', () => {
      expect(SIZE_PRESETS.map((preset) => `${preset.width}x${preset.height}`)).toEqual([
        '10x2',
        '13x2',
        '16x3',
        '18x4',
        '20x4',
        '22x5',
        '25x5',
      ]);
    });

    it('has unique ids that match the width x height label', () => {
      expect(new Set(SIZE_PRESETS.map((preset) => preset.id)).size).toBe(SIZE_PRESETS.length);
      for (const preset of SIZE_PRESETS) {
        expect(preset.id).toBe(`${preset.width}x${preset.height}`);
      }
    });

    it('defaults to a preset that exists', () => {
      expect(SIZE_PRESETS.some((preset) => preset.id === DEFAULT_SIZE_PRESET_ID)).toBe(true);
    });

    it('only offers wide banners, which is why the tool lays out a single line of text', () => {
      for (const preset of SIZE_PRESETS) {
        expect(preset.width / preset.height).toBeGreaterThanOrEqual(4.4);
      }
    });
  });

  describe('icons', () => {
    it('provides Instagram, TikTok, Telegram and the two original-colour icons', () => {
      expect(STICKER_ICONS.map((icon) => icon.id)).toEqual(['instagram', 'tiktok', 'telegram', 'instagram-color', 'tiktok-color']);
    });

    const pathsOf = (icon: StickerIcon): string[] =>
      icon.kind === 'mono' ? [...icon.paths] : icon.layers.map((layer) => layer.d);
    const byId = (id: string): StickerIcon => {
      const icon = STICKER_ICONS.find((candidate) => candidate.id === id);
      if (!icon) {
        throw new Error(`Missing icon ${id}`);
      }
      return icon;
    };

    it('has a positive viewBox and at least one path per icon', () => {
      for (const icon of STICKER_ICONS) {
        expect(icon.viewBoxWidth).toBeGreaterThan(0);
        expect(icon.viewBoxHeight).toBeGreaterThan(0);
        expect(pathsOf(icon).length).toBeGreaterThan(0);
      }
    });

    it('stores plain absolute path data only, with no fill or stroke baked in', () => {
      for (const icon of STICKER_ICONS) {
        for (const path of pathsOf(icon)) {
          expect(path).toMatch(/^M[MLHVCQZ\d\s,.eE+-]+Z$/);
        }
      }
    });

    it('matches the supplied artwork proportions', () => {
      const size = (id: string) => [byId(id).viewBoxWidth, byId(id).viewBoxHeight];

      expect(size('instagram')).toEqual([200, 200]);
      expect(size('tiktok')).toEqual([175, 200]);
      expect(size('telegram')).toEqual([200, 201]);
      expect(size('instagram-color')).toEqual([200, 200]);
      expect(size('tiktok-color')).toEqual([177, 200]);
      expect(pathsOf(byId('instagram'))).toHaveLength(3);
      expect(pathsOf(byId('tiktok'))).toHaveLength(1);
      expect(pathsOf(byId('telegram'))).toHaveLength(1);
      expect(pathsOf(byId('instagram-color'))).toHaveLength(2);
      expect(pathsOf(byId('tiktok-color'))).toHaveLength(5);
    });

    it('keeps the three single-colour icons recolourable and the two others fixed', () => {
      expect(STICKER_ICONS.map((icon) => [icon.id, icon.kind])).toEqual([
        ['instagram', 'mono'],
        ['tiktok', 'mono'],
        ['telegram', 'mono'],
        ['instagram-color', 'color'],
        ['tiktok-color', 'color'],
      ]);
    });

    it('gives the coloured TikTok its original cyan, red and black layers and black text', () => {
      const icon = byId('tiktok-color');

      expect(icon.kind === 'color' && icon.layers.map((layer) => layer.paint)).toEqual([
        { type: 'color', color: '#25f4ee' },
        { type: 'color', color: '#25f4ee' },
        { type: 'color', color: '#fe2c55' },
        { type: 'color', color: '#fe2c55' },
        { type: 'color', color: '#000000' },
      ]);
      expect(icon.kind === 'color' && icon.textPaint).toEqual({ type: 'color', color: '#000000' });
    });

    it('gives the coloured Instagram its two original radial gradients and a gradient for the text', () => {
      const icon = byId('instagram-color');

      expect(icon.kind).toBe('color');
      if (icon.kind !== 'color') {
        return;
      }
      expect(icon.layers.map((layer) => layer.paint)).toEqual([
        { type: 'gradient', key: 'ring' },
        { type: 'gradient', key: 'glow' },
      ]);
      expect(icon.gradients.map((gradient) => [gradient.key, gradient.matrix, gradient.stops.map((stop) => [stop.offset, stop.color, stop.opacity])])).toEqual([
        ['ring', [261.094, 0, 0, 261.083, 26.5723, 200.945], [[0.09, '#fa8f21', 1], [0.78, '#d82d7e', 1]]],
        ['glow', [205.778, 0, 0, 205.77, 121.296, 209.905], [[0.64, '#8c3aaa', 0], [1, '#8c3aaa', 1]]],
      ]);
      expect(icon.textPaint.type).toBe('gradient');
    });

    it('references only gradients that exist and uses #rrggbb colours everywhere', () => {
      for (const icon of STICKER_ICONS) {
        if (icon.kind !== 'color') {
          continue;
        }
        const keys = new Set(icon.gradients.map((gradient) => gradient.key));
        for (const layer of icon.layers) {
          if (layer.paint.type === 'gradient') {
            expect(keys.has(layer.paint.key)).toBe(true);
          } else {
            expect(layer.paint.color).toMatch(/^#[0-9a-f]{6}$/);
          }
        }
        for (const gradient of icon.gradients) {
          for (const stop of gradient.stops) {
            expect(stop.color).toMatch(/^#[0-9a-f]{6}$/);
          }
        }
      }
    });
  });

  describe('fonts', () => {
    it('lists Jua and the Cyrillic-capable Nunito ExtraBold, each served from a relative URL under fonts/', () => {
      expect(STICKER_FONTS).toEqual([
        { id: 'jua', label: 'Jua', url: 'fonts/Jua/Jua-Regular.ttf' },
        { id: 'nunito', label: 'Nunito (кирилиця)', url: 'fonts/Nunito/Nunito-ExtraBold.ttf' },
      ]);
    });

    it('keeps font ids unique and Jua as the default first font', () => {
      expect(new Set(STICKER_FONTS.map((font) => font.id)).size).toBe(STICKER_FONTS.length);
      expect(STICKER_FONTS[0]?.id).toBe('jua');
    });

    it('never uses an absolute or protocol-relative URL, so <base href> applies', () => {
      for (const font of STICKER_FONTS) {
        expect(font.url.startsWith('/')).toBe(false);
        expect(font.url).not.toContain('://');
      }
    });

    it('only references formats opentype.js can read', () => {
      for (const font of STICKER_FONTS) {
        expect(font.url).toMatch(/\.(ttf|otf|woff)$/i);
      }
    });
  });

  describe('mock-up', () => {
    it('allows at most five stickers on a 2000 px wide photo', () => {
      expect(MAX_MOCKUP_STICKERS).toBe(5);
      expect(MAX_MOCKUP_OUTPUT_WIDTH).toBe(2000);
    });

    it('uses a relative photo URL under public/', () => {
      expect(MOCKUP_BACKGROUND_URL).toBe('mockup/background.jpg');
    });
  });
});
