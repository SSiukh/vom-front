import {
  DEFAULT_KEYCHAIN_SCALE_ID,
  DEFAULT_KEYCHAIN_TEXT_SCALE_ID,
  KEYCHAIN_SCALES,
  KEYCHAIN_TEXT_SCALES,
} from './keychain-scales';

describe('keychain scales', () => {
  it('offers XS, S, M, L and XL in growing order', () => {
    expect(KEYCHAIN_SCALES.map((scale) => [scale.id, scale.label, scale.factor])).toEqual([
      ['xs', 'XS', 0.8],
      ['s', 'S', 1],
      ['m', 'M', 1.15],
      ['l', 'L', 1.3],
      ['xl', 'XL', 1.5],
    ]);
  });

  it('defaults to L', () => {
    expect(DEFAULT_KEYCHAIN_SCALE_ID).toBe('l');
    expect(KEYCHAIN_SCALES.some((scale) => scale.id === DEFAULT_KEYCHAIN_SCALE_ID)).toBe(true);
  });

  it('offers XS to XL text sizes, with M as the default', () => {
    expect(KEYCHAIN_TEXT_SCALES.map((scale) => [scale.id, scale.label, scale.factor])).toEqual([
      ['xs', 'XS', 0.52],
      ['s', 'S', 0.715],
      ['m', 'M', 0.91],
      ['l', 'L', 1.105],
      ['xl', 'XL', 1.3],
    ]);
    expect(DEFAULT_KEYCHAIN_TEXT_SCALE_ID).toBe('m');
  });

  it('keeps the standard text a little smaller than the standard image and mark', () => {
    const factor = (scales: typeof KEYCHAIN_SCALES, id: string) =>
      scales.find((scale) => scale.id === id)?.factor ?? 0;

    expect(factor(KEYCHAIN_TEXT_SCALES, DEFAULT_KEYCHAIN_TEXT_SCALE_ID)).toBeLessThan(
      factor(KEYCHAIN_SCALES, DEFAULT_KEYCHAIN_SCALE_ID),
    );
    expect(KEYCHAIN_TEXT_SCALES.map((scale) => scale.factor)).toEqual(
      [...KEYCHAIN_TEXT_SCALES.map((scale) => scale.factor)].sort((a, b) => a - b),
    );
  });
});
