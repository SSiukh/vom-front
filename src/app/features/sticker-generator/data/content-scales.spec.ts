import { CONTENT_SCALES, DEFAULT_CONTENT_SCALE_ID } from './content-scales';

describe('content scales', () => {
  it('offers XS, S, M, L and XL in growing order', () => {
    expect(CONTENT_SCALES.map((scale) => [scale.id, scale.label, scale.factor])).toEqual([
      ['xs', 'XS', 0.7],
      ['s', 'S', 0.85],
      ['m', 'M', 1],
      ['l', 'L', 1.1],
      ['xl', 'XL', 1.2],
    ]);
  });

  it('defaults to M, which is the standard fit-to-padding size', () => {
    expect(DEFAULT_CONTENT_SCALE_ID).toBe('m');
    expect(CONTENT_SCALES.find((scale) => scale.id === DEFAULT_CONTENT_SCALE_ID)?.factor).toBe(1);
  });

  it('makes L and XL larger than the standard size and XS and S smaller', () => {
    const factor = (id: string) => CONTENT_SCALES.find((scale) => scale.id === id)?.factor ?? 0;

    expect(factor('xl')).toBeGreaterThan(factor('l'));
    expect(factor('l')).toBeGreaterThan(1);
    expect(factor('xs')).toBeLessThan(factor('s'));
    expect(factor('s')).toBeLessThan(1);
  });
});
