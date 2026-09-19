import { layoutMockup } from './layout-mockup';

describe('layoutMockup', () => {
  it('returns nothing for no stickers', () => {
    expect(layoutMockup(1000, 2000, [])).toEqual([]);
  });

  it('gives a sticker 60% of the photo width, keeps its proportion and centres it on both axes', () => {
    const [placement] = layoutMockup(1000, 2000, [{ width: 18, height: 4 }]);

    expect(placement?.x).toBeCloseTo(200, 6);
    expect(placement?.width).toBeCloseTo(600, 6);
    expect(placement?.height).toBeCloseTo(133.3333, 3);
    expect(placement?.y).toBeCloseTo(933.3333, 3);
  });

  it('makes every sticker the same width whatever its preset, each with its own height', () => {
    const placements = layoutMockup(1000, 2000, [
      { width: 10, height: 2 },
      { width: 18, height: 4 },
      { width: 25, height: 5 },
    ]);

    expect(placements.map((placement) => placement.width)).toEqual([600, 600, 600]);
    expect(placements.map((placement) => placement.x)).toEqual([200, 200, 200]);
    expect(placements[0]?.height).toBeCloseTo(120, 6);
    expect(placements[1]?.height).toBeCloseTo(133.3333, 3);
    expect(placements[2]?.height).toBeCloseTo(120, 6);
  });

  it('stacks stickers in one column with a gap of 4% of the sticker width, centring the whole block', () => {
    expect(
      layoutMockup(1000, 2000, [
        { width: 10, height: 2 },
        { width: 25, height: 5 },
      ]),
    ).toEqual([
      { x: 200, y: 868, width: 600, height: 120 },
      { x: 200, y: 1012, width: 600, height: 120 },
    ]);
  });

  it('shrinks the whole block proportionally when it would fill more than 90% of the photo height', () => {
    const [placement] = layoutMockup(1000, 100, [{ width: 25, height: 5 }]);

    expect(placement?.x).toBeCloseTo(275, 6);
    expect(placement?.y).toBeCloseTo(5, 6);
    expect(placement?.width).toBeCloseTo(450, 6);
    expect(placement?.height).toBeCloseTo(90, 6);
  });

  it('keeps every sticker centred horizontally and the block centred vertically for five stickers', () => {
    const sizes = [
      { width: 10, height: 2 },
      { width: 13, height: 2 },
      { width: 16, height: 3 },
      { width: 22, height: 5 },
      { width: 25, height: 5 },
    ];
    const placements = layoutMockup(1805, 2390, sizes);

    expect(placements).toHaveLength(5);
    for (const placement of placements) {
      expect(placement.x + placement.width / 2).toBeCloseTo(1805 / 2, 6);
    }
    const first = placements[0];
    const last = placements[4];
    expect((first?.y ?? 0) + ((last?.y ?? 0) + (last?.height ?? 0) - (first?.y ?? 0)) / 2).toBeCloseTo(2390 / 2, 6);
  });
});
