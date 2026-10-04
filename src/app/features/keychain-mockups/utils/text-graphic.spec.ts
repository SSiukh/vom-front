import type { GlyphSource } from '../../sticker-generator/models/glyph-source.model';
import { buildTextGraphic } from './text-graphic';

function glyphs(overrides: Partial<GlyphSource> = {}): GlyphSource {
  return {
    unitsPerEm: 1000,
    capHeight: 700,
    hasGlyph: (char) => char !== 'Ж',
    advance: () => 600,
    kerning: () => 0,
    outline: () => [
      { type: 'M', x: 50, y: 0 },
      { type: 'L', x: 550, y: 0 },
      { type: 'L', x: 550, y: -700 },
      { type: 'L', x: 50, y: -700 },
      { type: 'Z' },
    ],
    ...overrides,
  };
}

describe('buildTextGraphic', () => {
  it('measures the ink of the text and moves it to the origin', () => {
    const { graphic } = buildTextGraphic('AB', glyphs());

    expect(graphic?.width).toBe(1100);
    expect(graphic?.height).toBe(700);
    expect(graphic?.paths).toHaveLength(1);
    expect(graphic?.paths[0]?.startsWith('M0 700')).toBe(true);
    expect(graphic?.paths[0]).not.toMatch(/-\d/);
  });

  it('passes the cap height of the font through', () => {
    expect(buildTextGraphic('A', glyphs()).graphic?.capHeight).toBe(700);
  });

  it('falls back to a proportional cap height when the font reports none', () => {
    expect(buildTextGraphic('A', glyphs({ capHeight: 0 })).graphic?.capHeight).toBe(700);
    expect(
      buildTextGraphic('A', glyphs({ capHeight: 0, unitsPerEm: 2000 })).graphic?.capHeight,
    ).toBe(1400);
  });

  it('returns no graphic for empty or whitespace-only text', () => {
    expect(buildTextGraphic('', glyphs()).graphic).toBeNull();
    expect(buildTextGraphic('   ', glyphs()).graphic).toBeNull();
  });

  it('reports characters the font does not have and still draws the rest', () => {
    const result = buildTextGraphic('AЖB', glyphs());

    expect(result.missingCharacters).toEqual(['Ж']);
    expect(result.graphic?.width).toBe(1100);
  });

  it('returns no graphic when every character is missing', () => {
    const result = buildTextGraphic('ЖЖ', glyphs());

    expect(result.graphic).toBeNull();
    expect(result.missingCharacters).toEqual(['Ж']);
  });

  it('never emits NaN', () => {
    expect(buildTextGraphic('Hello world', glyphs()).graphic?.paths[0]).not.toMatch(/NaN|Infinity/);
  });
});
