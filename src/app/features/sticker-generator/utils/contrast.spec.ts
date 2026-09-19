import { MIN_READABLE_CONTRAST, contrastRatio } from './contrast';

describe('contrastRatio', () => {
  it('is 21 between black and white, in either order', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
  });

  it('is 1 for identical colours', () => {
    expect(contrastRatio('#e8871e', '#e8871e')).toBeCloseTo(1, 5);
  });

  it('is case-insensitive', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
  });

  it('flags near-identical colours as below the readable threshold', () => {
    expect(contrastRatio('#202020', '#282828')).toBeLessThan(MIN_READABLE_CONTRAST);
  });

  it('uses 3 as the readable threshold', () => {
    expect(MIN_READABLE_CONTRAST).toBe(3);
    expect(contrastRatio('#767676', '#ffffff')).toBeGreaterThan(3);
    expect(contrastRatio('#959595', '#ffffff')).toBeLessThan(3);
  });

  it('accepts clearly distinct colours', () => {
    expect(contrastRatio('#000000', '#e8871e')).toBeGreaterThan(MIN_READABLE_CONTRAST);
  });

  it('rejects anything that is not #rrggbb', () => {
    expect(() => contrastRatio('red', '#000000')).toThrow('Expected a #rrggbb colour');
    expect(() => contrastRatio('#000000', '#fff')).toThrow('Expected a #rrggbb colour');
  });
});
