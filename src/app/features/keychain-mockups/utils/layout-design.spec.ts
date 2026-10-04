import type { KeychainDesign } from '../models/keychain-design.model';
import { layoutDesign, resolveSlots, slotsAccepting } from './layout-design';

const AREA = { x: 100, y: 200, width: 200, height: 400 };
const SCALES = { photo: 1, mark: 1, text: 1 };
const SQUARE = { width: 10, height: 10, paths: ['M0 0L10 0L10 10Z'] };
const WIDE_TEXT = { width: 40, height: 10, capHeight: 10, paths: ['M0 0L40 0L40 10Z'] };

const SINGLE: KeychainDesign = {
  id: 'single',
  group: 'eco',
  imageUrl: 'single.svg',
  container: { x: 0, y: 0, width: 100, height: 200 },
  photo: null,
  photoRotated: false,
  slots: [
    {
      id: 'main',
      label: 'Основна',
      accepts: ['mark', 'text'],
      rect: { x: 0, y: 0, width: 100, height: 200 },
      rotated: false,
    },
  ],
};

const TWO_ZONES: KeychainDesign = {
  id: 'two',
  group: 'metal',
  imageUrl: 'two.svg',
  container: { x: 0, y: 0, width: 100, height: 200 },
  photo: { x: 0, y: 0, width: 100, height: 100 },
  photoRotated: false,
  slots: [
    {
      id: 'main',
      label: 'Основна',
      accepts: ['text'],
      rect: { x: 0, y: 100, width: 100, height: 50 },
      rotated: false,
    },
    {
      id: 'small',
      label: 'Мала',
      accepts: ['mark', 'text'],
      rect: { x: 0, y: 150, width: 100, height: 50 },
      rotated: true,
    },
  ],
};

const base = {
  area: AREA,
  photo: null,
  mark: null,
  text: null,
  markSlotId: null,
  textSlotId: null,
  scales: SCALES,
};

describe('layoutDesign', () => {
  it('returns an empty artwork when there is nothing to place', () => {
    expect(layoutDesign({ ...base, design: SINGLE })).toEqual({
      paths: [],
      evenOddPaths: [],
      bounds: null,
    });
  });

  it('maps the design container onto the print area and centres the content in the zone', () => {
    const artwork = layoutDesign({ ...base, design: SINGLE, mark: SQUARE });

    expect(artwork.paths).toHaveLength(1);
    expect(artwork.bounds).toEqual({ minX: 100, minY: 300, maxX: 300, maxY: 500 });
  });

  it('keeps the photo inside its own zone of the design', () => {
    const artwork = layoutDesign({ ...base, design: TWO_ZONES, photo: SQUARE });

    expect(artwork.bounds).toEqual({ minX: 100, minY: 200, maxX: 300, maxY: 400 });
    expect(artwork.paths).toHaveLength(1);
  });

  it('turns the photo a quarter turn when its design is horizontal', () => {
    const wide = { width: 40, height: 10, paths: ['M0 0L40 0L40 10Z'] };
    const upright = layoutDesign({ ...base, design: TWO_ZONES, photo: wide });
    const turned = layoutDesign({
      ...base,
      design: { ...TWO_ZONES, photoRotated: true },
      photo: wide,
    });
    const width = (bounds: { minX: number; maxX: number } | null) =>
      (bounds?.maxX ?? 0) - (bounds?.minX ?? 0);
    const height = (bounds: { minY: number; maxY: number } | null) =>
      (bounds?.maxY ?? 0) - (bounds?.minY ?? 0);

    expect(width(upright.bounds)).toBeGreaterThan(height(upright.bounds));
    expect(height(turned.bounds)).toBeGreaterThan(width(turned.bounds));
  });

  it('turns content of a rotated slot a quarter turn, so a wide line becomes tall', () => {
    const artwork = layoutDesign({
      ...base,
      design: TWO_ZONES,
      text: WIDE_TEXT,
      textSlotId: 'small',
    });
    const bounds = artwork.bounds;

    expect(bounds).not.toBeNull();
    expect((bounds?.maxY ?? 0) - (bounds?.minY ?? 0)).toBeGreaterThan(
      (bounds?.maxX ?? 0) - (bounds?.minX ?? 0),
    );
  });

  it('lets the mark win when it and the text land in the same zone', () => {
    const withText = layoutDesign({ ...base, design: SINGLE, mark: SQUARE, text: WIDE_TEXT });
    const markOnly = layoutDesign({ ...base, design: SINGLE, mark: SQUARE });

    expect(withText).toEqual(markOnly);
  });

  it('places the text and the mark in different zones when they are assigned to different slots', () => {
    const artwork = layoutDesign({
      ...base,
      design: TWO_ZONES,
      mark: SQUARE,
      text: WIDE_TEXT,
      markSlotId: 'small',
      textSlotId: 'main',
    });

    expect(artwork.paths).toHaveLength(2);
  });

  it('shrinks a graphic that would overflow the print area even when enlarged', () => {
    const artwork = layoutDesign({
      ...base,
      design: SINGLE,
      mark: SQUARE,
      scales: { photo: 1, mark: 10, text: 1 },
    });

    expect(artwork.bounds?.maxX ?? 0).toBeLessThanOrEqual(AREA.x + AREA.width + 1e-6);
    expect(artwork.bounds?.maxY ?? 0).toBeLessThanOrEqual(AREA.y + AREA.height + 1e-6);
  });

  it('keeps an enlarged graphic inside the print area when its slot sits in a corner', () => {
    const corner: KeychainDesign = {
      ...SINGLE,
      slots: [
        {
          id: 'main',
          label: 'Основна',
          accepts: ['mark'],
          rect: { x: 0, y: 0, width: 20, height: 20 },
          rotated: false,
        },
      ],
    };
    const wide = { width: 200, height: 30, paths: ['M0 0L200 0L200 30Z'] };

    const artwork = layoutDesign({
      ...base,
      design: corner,
      mark: wide,
      scales: { photo: 1, mark: 10, text: 1 },
    });

    expect(artwork.bounds?.minX ?? -1).toBeGreaterThanOrEqual(AREA.x - 1e-6);
    expect(artwork.bounds?.minY ?? -1).toBeGreaterThanOrEqual(AREA.y - 1e-6);
    expect(artwork.bounds?.maxX ?? Infinity).toBeLessThanOrEqual(AREA.x + AREA.width + 1e-6);
    expect(artwork.bounds?.maxY ?? Infinity).toBeLessThanOrEqual(AREA.y + AREA.height + 1e-6);
  });

  it('carries even-odd paths of a vector graphic through the transform', () => {
    const artwork = layoutDesign({
      ...base,
      design: SINGLE,
      mark: { ...SQUARE, evenOddPaths: ['M0 0L5 0L5 5Z'] },
    });

    expect(artwork.evenOddPaths).toHaveLength(1);
  });
});

describe('resolveSlots', () => {
  it('defaults the text to the first slot and the mark to another slot when one exists', () => {
    const resolved = resolveSlots(TWO_ZONES, null, null);

    expect(resolved.text?.id).toBe('main');
    expect(resolved.mark?.id).toBe('small');
  });

  it('falls back to the single slot for both when the design has only one', () => {
    const resolved = resolveSlots(SINGLE, null, null);

    expect(resolved.text?.id).toBe('main');
    expect(resolved.mark?.id).toBe('main');
  });

  it('uses an explicitly chosen slot and ignores ids the design does not have', () => {
    expect(resolveSlots(TWO_ZONES, 'small', 'main')).toEqual({
      mark: TWO_ZONES.slots[1],
      text: TWO_ZONES.slots[0],
    });
    expect(resolveSlots(TWO_ZONES, 'unknown', 'unknown').text?.id).toBe('main');
  });
});

describe('slotsAccepting', () => {
  it('lists only the slots that take the given element', () => {
    expect(slotsAccepting(TWO_ZONES, 'mark').map((slot) => slot.id)).toEqual(['small']);
    expect(slotsAccepting(TWO_ZONES, 'text').map((slot) => slot.id)).toEqual(['main', 'small']);
  });
});
