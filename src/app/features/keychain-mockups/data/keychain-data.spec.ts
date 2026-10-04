import { KEYCHAIN_MARKS } from './keychain-marks';
import { DEFAULT_KEYCHAIN_TYPE_ID, KEYCHAIN_FAMILY_LABELS, KEYCHAIN_TYPES } from './keychain-types';
import { PHOTO_ACCEPTED_TYPES, PHOTO_MAX_BYTES } from './photo-upload';

const BASE_IMAGE_WIDTH = 1512;
const BASE_IMAGE_HEIGHT = 2016;

describe('keychain data', () => {
  describe('types', () => {
    it('lists the thirteen supplied keychain photos', () => {
      expect(KEYCHAIN_TYPES.map((type) => type.id)).toEqual([
        'leather-black',
        'leather-brown',
        'leather-gray',
        'metal-black',
        'metal-glossy',
        'metal-mat',
        'metal-white',
        'subleather-black',
        'subleather-circle',
        'subleather-green',
        'subleather-mint',
        'subleather-pink',
        'subleather-yellow',
      ]);
    });

    it('serves each photo from a relative URL under keychains/ named after its id', () => {
      for (const type of KEYCHAIN_TYPES) {
        expect(type.imageUrl).toBe(`keychains/${type.id}.jpg`);
      }
    });

    it('groups each type into the family its id starts with', () => {
      for (const type of KEYCHAIN_TYPES) {
        expect(type.id.startsWith(`${type.family}-`)).toBe(true);
      }
      expect(Object.keys(KEYCHAIN_FAMILY_LABELS).sort()).toEqual([
        'leather',
        'metal',
        'subleather',
      ]);
    });

    it('has unique ids and labels', () => {
      expect(new Set(KEYCHAIN_TYPES.map((type) => type.id)).size).toBe(KEYCHAIN_TYPES.length);
      expect(new Set(KEYCHAIN_TYPES.map((type) => type.label)).size).toBe(KEYCHAIN_TYPES.length);
    });

    it('keeps every print area inside the 1512 x 2016 base photo', () => {
      for (const { printArea } of KEYCHAIN_TYPES) {
        expect(printArea.width).toBeGreaterThan(0);
        expect(printArea.height).toBeGreaterThan(0);
        expect(printArea.x).toBeGreaterThanOrEqual(0);
        expect(printArea.y).toBeGreaterThanOrEqual(0);
        expect(printArea.x + printArea.width).toBeLessThanOrEqual(BASE_IMAGE_WIDTH);
        expect(printArea.y + printArea.height).toBeLessThanOrEqual(BASE_IMAGE_HEIGHT);
      }
    });

    it('measures the white metal tag so that the supplied example artwork fits in it', () => {
      const area = KEYCHAIN_TYPES.find((type) => type.id === 'metal-white')?.printArea;

      expect(area).toEqual({ x: 648, y: 912, width: 232, height: 380 });
      expect(
        area &&
          653 >= area.x - 5 &&
          870 <= area.x + area.width &&
          968 >= area.y &&
          1270 <= area.y + area.height,
      ).toBe(true);
    });

    it('prints white on the black metal, black on the other metals, black on the brown, gray and round eco leather, and 9D906C at 80% on the black leather', () => {
      const ink = (id: string) => {
        const type = KEYCHAIN_TYPES.find((candidate) => candidate.id === id);
        return [type?.inkColor, type?.inkBlend];
      };

      expect(ink('metal-black')).toEqual(['#ffffff', 'source-over']);
      for (const id of ['metal-glossy', 'metal-mat', 'metal-white']) {
        expect(ink(id)).toEqual(['#000000', 'multiply']);
      }
      expect(KEYCHAIN_TYPES.find((candidate) => candidate.id === 'leather-black')).toMatchObject({
        inkColor: '#9d906c',
        inkOpacity: 0.8,
      });
      for (const id of ['leather-brown', 'leather-gray', 'subleather-circle']) {
        expect(ink(id)).toEqual(['#000000', 'multiply']);
      }
      for (const id of [
        'subleather-black',
        'subleather-green',
        'subleather-mint',
        'subleather-pink',
        'subleather-yellow',
      ]) {
        expect(KEYCHAIN_TYPES.find((candidate) => candidate.id === id)?.inkColor).toBe('#6f4a2b');
      }
    });

    it('draws over the photo, instead of multiplying, only where the ink is lighter than the base: the three black keychains', () => {
      const overlay = KEYCHAIN_TYPES.filter((type) => type.inkBlend === 'source-over').map(
        (type) => type.id,
      );

      expect(overlay).toEqual(['leather-black', 'metal-black', 'subleather-black']);
    });

    it('starts on the white metal tag, the type of the supplied example', () => {
      expect(DEFAULT_KEYCHAIN_TYPE_ID).toBe('metal-white');
      expect(KEYCHAIN_TYPES.some((type) => type.id === DEFAULT_KEYCHAIN_TYPE_ID)).toBe(true);
    });
  });

  describe('marks', () => {
    it('lists the thirty-six supplied marks with unique ids and labels', () => {
      expect(KEYCHAIN_MARKS).toHaveLength(36);
      expect(new Set(KEYCHAIN_MARKS.map((mark) => mark.id)).size).toBe(36);
      expect(new Set(KEYCHAIN_MARKS.map((mark) => mark.label)).size).toBe(36);
    });

    it('serves every variant a mark has from marks/<id>/<variant>.svg', () => {
      for (const mark of KEYCHAIN_MARKS) {
        for (const [variant, url] of Object.entries(mark.variants)) {
          expect(url).toBe(`marks/${mark.id}/${variant}.svg`);
        }
      }
    });

    it('gives every mark at least one variant, and only icon/text/combined keys', () => {
      for (const mark of KEYCHAIN_MARKS) {
        const keys = Object.keys(mark.variants);
        expect(keys.length).toBeGreaterThan(0);
        for (const key of keys) {
          expect(['icon', 'text', 'combined']).toContain(key);
        }
      }
    });

    it('gives a combined logo both an icon and a text variant alongside it, except the one that could not be split', () => {
      const unsplittable = ['zonsen'];
      for (const mark of KEYCHAIN_MARKS) {
        if (mark.variants.combined && !unsplittable.includes(mark.id)) {
          expect(mark.variants.icon).toBeDefined();
          expect(mark.variants.text).toBeDefined();
        }
      }
    });

    it('never invents a variant the source artwork does not have', () => {
      const iconOnly = ['bmw', 'opel', 'yamaha-3'];
      const textOnly = [
        'benelli',
        'bse',
        'fendt',
        'forte',
        'forte-2',
        'kawaski',
        'kaya',
        'ktm',
        'musstang-2',
        'rottor',
        'tekken',
        'touareg',
        'viper',
      ];
      const combinedOnly = ['zonsen'];
      const byId = (id: string) => KEYCHAIN_MARKS.find((mark) => mark.id === id)?.variants;

      for (const id of iconOnly) {
        expect(Object.keys(byId(id) ?? {})).toEqual(['icon']);
      }
      for (const id of textOnly) {
        expect(Object.keys(byId(id) ?? {})).toEqual(['text']);
      }
      for (const id of combinedOnly) {
        expect(Object.keys(byId(id) ?? {})).toEqual(['combined']);
      }

      expect(Object.keys(byId('kovi') ?? {})).toEqual(['icon', 'text']);
      expect(Object.keys(byId('loncin') ?? {})).toEqual(['icon', 'text', 'combined']);
    });

    it('shows corrected brand names instead of the misspelt file names', () => {
      const label = (id: string) => KEYCHAIN_MARKS.find((mark) => mark.id === id)?.label;

      expect(label('kawaski')).toBe('Kawasaki');
      expect(label('musstang')).toBe('Mustang');
      expect(label('musstang-2')).toBe('Mustang (2)');
      expect(label('honda-2')).toBe('Honda (2)');
    });

    it('is sorted by label, ignoring case', () => {
      const labels = KEYCHAIN_MARKS.map((mark) => mark.label.toLowerCase());

      expect(labels).toEqual([...labels].sort());
    });
  });

  describe('photo upload', () => {
    it('accepts PNG, JPEG and WebP photos up to 10 MB', () => {
      expect(PHOTO_ACCEPTED_TYPES).toEqual(['image/png', 'image/jpeg', 'image/webp']);
      expect(PHOTO_MAX_BYTES).toBe(10485760);
    });
  });
});
