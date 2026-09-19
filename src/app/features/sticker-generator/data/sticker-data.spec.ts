import {
  MAX_MOCKUP_OUTPUT_WIDTH,
  MAX_MOCKUP_STICKERS,
  MOCKUP_BACKGROUND_URL,
} from './mockup-config';
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
    it('provides Instagram, TikTok and Telegram', () => {
      expect(STICKER_ICONS.map((icon) => icon.id)).toEqual(['instagram', 'tiktok', 'telegram']);
    });

    it('has a positive viewBox and at least one path per icon', () => {
      for (const icon of STICKER_ICONS) {
        expect(icon.viewBoxWidth).toBeGreaterThan(0);
        expect(icon.viewBoxHeight).toBeGreaterThan(0);
        expect(icon.paths.length).toBeGreaterThan(0);
      }
    });

    it('stores plain absolute path data only, with no fill or stroke baked in', () => {
      for (const icon of STICKER_ICONS) {
        for (const path of icon.paths) {
          expect(path).toMatch(/^M[MLHVCQZ\d\s,.eE+-]+Z$/);
        }
      }
    });

    it('matches the supplied artwork proportions', () => {
      const [instagram, tiktok, telegram] = STICKER_ICONS;

      expect([instagram?.viewBoxWidth, instagram?.viewBoxHeight]).toEqual([200, 200]);
      expect([tiktok?.viewBoxWidth, tiktok?.viewBoxHeight]).toEqual([175, 200]);
      expect([telegram?.viewBoxWidth, telegram?.viewBoxHeight]).toEqual([200, 201]);
      expect(instagram?.paths).toHaveLength(3);
      expect(tiktok?.paths).toHaveLength(1);
      expect(telegram?.paths).toHaveLength(1);
    });
  });

  describe('fonts', () => {
    it('lists Jua served from a relative URL under fonts/', () => {
      expect(STICKER_FONTS).toEqual([{ id: 'jua', label: 'Jua', url: 'fonts/Jua/Jua-Regular.ttf' }]);
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
