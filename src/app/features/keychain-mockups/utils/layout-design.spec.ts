import type { KeychainDesign } from '../models/keychain-design.model';
import type { ArtworkBounds } from '../models/keychain.model';
import { layoutDesign, resolveTextSlot, slotsAccepting } from './layout-design';

const AREA = { x: 100, y: 200, width: 200, height: 400 };
const SQUARE = { width: 10, height: 10, paths: ['M0 0L10 0L10 10Z'] };
const WIDE_TEXT = { width: 40, height: 10, capHeight: 10, paths: ['M0 0L40 0L40 10Z'] };

const SINGLE: KeychainDesign = {
  id: 'single',
  group: 'eco',
  imageUrl: 'single.svg',
  container: { x: 0, y: 0, width: 100, height: 200 },
  photo: null,
  photoRotated: false,
  fit: 'contain',
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
  fit: 'contain',
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
  marks: {},
  text: null,
  textSlotId: null,
  scales: { photo: 1, text: 1 },
};

const mark = (factor = 1) => ({ graphic: SQUARE, factor });

describe('layoutDesign', () => {
  it('returns an empty artwork when there is nothing to place', () => {
    expect(layoutDesign({ ...base, design: SINGLE })).toEqual({
      paths: [],
      evenOddPaths: [],
      metalPaths: [],
      metalEvenOddPaths: [],
      bounds: null,
    });
  });

  it('maps the design container onto the print area and centres the content in the zone', () => {
    const artwork = layoutDesign({ ...base, design: SINGLE, marks: { main: mark() } });

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
    const withText = layoutDesign({
      ...base,
      design: SINGLE,
      marks: { main: mark() },
      text: WIDE_TEXT,
    });
    const markOnly = layoutDesign({ ...base, design: SINGLE, marks: { main: mark() } });

    expect(withText).toEqual(markOnly);
  });

  it('keeps the text when the mark is in another zone', () => {
    const artwork = layoutDesign({
      ...base,
      design: {
        ...TWO_ZONES,
        slots: TWO_ZONES.slots.map((slot) => ({ ...slot, accepts: ['mark', 'text'] as const })),
      },
      marks: { small: mark() },
      text: WIDE_TEXT,
      textSlotId: 'main',
    });

    expect(artwork.paths).toHaveLength(2);
  });

  it('draws one mark per zone that has a mark, each with its own factor', () => {
    const design: KeychainDesign = {
      ...TWO_ZONES,
      slots: TWO_ZONES.slots.map((slot) => ({ ...slot, accepts: ['mark', 'text'] as const })),
    };
    const artwork = layoutDesign({
      ...base,
      design,
      marks: { main: mark(), small: mark(0.5) },
    });

    expect(artwork.paths).toHaveLength(2);
  });

  it('ignores a mark placed for a slot that does not accept marks', () => {
    const artwork = layoutDesign({ ...base, design: TWO_ZONES, marks: { main: mark() } });

    expect(artwork.paths).toHaveLength(0);
  });

  it('shrinks a graphic that would overflow the print area even when enlarged', () => {
    const artwork = layoutDesign({ ...base, design: SINGLE, marks: { main: mark(10) } });

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
      marks: { main: { graphic: wide, factor: 10 } },
    });

    expect(artwork.bounds?.minX ?? -1).toBeGreaterThanOrEqual(AREA.x - 1e-6);
    expect(artwork.bounds?.minY ?? -1).toBeGreaterThanOrEqual(AREA.y - 1e-6);
    expect(artwork.bounds?.maxX ?? Infinity).toBeLessThanOrEqual(AREA.x + AREA.width + 1e-6);
    expect(artwork.bounds?.maxY ?? Infinity).toBeLessThanOrEqual(AREA.y + AREA.height + 1e-6);
  });

  it('centres a graphic by its ink, not by its declared box', () => {
    const offCentre = { width: 100, height: 100, paths: ['M0 0L20 0L20 20L0 20Z'] };

    const artwork = layoutDesign({
      ...base,
      design: SINGLE,
      marks: { main: { graphic: offCentre, factor: 1 } },
    });
    const bounds = artwork.bounds!;

    expect((bounds.minX + bounds.maxX) / 2).toBeCloseTo(200, 6);
    expect((bounds.minY + bounds.maxY) / 2).toBeCloseTo(400, 6);
  });

  it('a factor of 1 fills the zone and never draws beyond it', () => {
    const artwork = layoutDesign({ ...base, design: SINGLE, marks: { main: mark(1) } });
    const bounds = artwork.bounds!;

    expect(bounds.maxX - bounds.minX).toBeLessThanOrEqual(200 + 1e-6);
    expect(bounds.maxY - bounds.minY).toBeLessThanOrEqual(400 + 1e-6);
  });

  it('carries even-odd paths of a vector graphic through the transform', () => {
    const artwork = layoutDesign({
      ...base,
      design: SINGLE,
      marks: { main: { graphic: { ...SQUARE, evenOddPaths: ['M0 0L5 0L5 5Z'] }, factor: 1 } },
    });

    expect(artwork.evenOddPaths).toHaveLength(1);
  });
});

describe('metal slots', () => {
  const METAL_SINGLE: KeychainDesign = {
    ...SINGLE,
    slots: [
      {
        id: 'metal',
        label: 'Метал',
        accepts: ['mark'],
        rect: { x: 0, y: 0, width: 100, height: 200 },
        rotated: false,
        metal: true,
        scaleFactor: 0.5,
      },
    ],
  };

  it('puts a mark in a metal slot into the metal layer, separate from the leather paths', () => {
    const artwork = layoutDesign({ ...base, design: METAL_SINGLE, marks: { metal: mark() } });

    expect(artwork.paths).toHaveLength(0);
    expect(artwork.metalPaths).toHaveLength(1);
  });

  it('uses its own default size: a metal slot draws the mark smaller than the same slot on leather', () => {
    const onMetal = layoutDesign({ ...base, design: METAL_SINGLE, marks: { metal: mark() } });
    const onLeather = layoutDesign({
      ...base,
      design: {
        ...METAL_SINGLE,
        slots: [{ ...METAL_SINGLE.slots[0]!, metal: false, scaleFactor: undefined }],
      },
      marks: { metal: mark() },
    });

    const width = (bounds: ArtworkBounds | null) => (bounds?.maxX ?? 0) - (bounds?.minX ?? 0);
    expect(width(onMetal.bounds)).toBeLessThan(width(onLeather.bounds));
  });
});

describe('resolveTextSlot', () => {
  it('uses the chosen text slot, and falls back to the first text slot for an unknown id', () => {
    expect(resolveTextSlot(TWO_ZONES, 'small')?.id).toBe('small');
    expect(resolveTextSlot(TWO_ZONES, 'unknown')?.id).toBe('main');
    expect(resolveTextSlot(TWO_ZONES, null)?.id).toBe('main');
  });
});

describe('slotsAccepting', () => {
  it('lists only the slots that take the given element', () => {
    expect(slotsAccepting(TWO_ZONES, 'mark').map((slot) => slot.id)).toEqual(['small']);
    expect(slotsAccepting(TWO_ZONES, 'text').map((slot) => slot.id)).toEqual(['main', 'small']);
  });
});
