import type { OpentypeFont, OpentypeGlyph, OpentypePathCommand } from 'opentype.js';
import { createGlyphSource } from './opentype-glyph-source';

interface FakeGlyphOptions {
  index?: number;
  advanceWidth?: number;
  commands?: OpentypePathCommand[];
  capY2?: number;
}

function fakeGlyph(options: FakeGlyphOptions = {}): OpentypeGlyph & { getPath: ReturnType<typeof vi.fn> } {
  return {
    index: options.index ?? 5,
    advanceWidth: options.advanceWidth ?? 600,
    getPath: vi.fn().mockReturnValue({ commands: options.commands ?? [] }),
    getBoundingBox: () => ({ x1: 0, y1: 0, x2: 0, y2: options.capY2 ?? 0 }),
  };
}

function fakeFont(overrides: Partial<OpentypeFont> = {}, glyphs: Record<string, OpentypeGlyph> = {}): OpentypeFont {
  const notdef = fakeGlyph({ index: 0 });
  return {
    unitsPerEm: 1000,
    tables: { os2: { sCapHeight: 711 } },
    charToGlyph: (char) => glyphs[char] ?? notdef,
    charToGlyphIndex: (char) => (glyphs[char] ?? notdef).index,
    getKerningValue: () => 0,
    ...overrides,
  };
}

describe('createGlyphSource', () => {
  it('exposes the font size in units per em', () => {
    expect(createGlyphSource(fakeFont({ unitsPerEm: 2048 })).unitsPerEm).toBe(2048);
  });

  describe('capHeight', () => {
    it('uses the OS/2 value when the font declares one', () => {
      expect(createGlyphSource(fakeFont()).capHeight).toBe(711);
    });

    it('measures the H glyph when OS/2 has no usable value', () => {
      const font = fakeFont({ tables: { os2: { sCapHeight: 0 } } }, { H: fakeGlyph({ capY2: 690 }) });

      expect(createGlyphSource(font).capHeight).toBe(690);
    });

    it('measures the H glyph when the font has no OS/2 table at all', () => {
      const font = fakeFont({ tables: {} }, { H: fakeGlyph({ capY2: 700 }) });

      expect(createGlyphSource(font).capHeight).toBe(700);
    });

    it('falls back to 70% of the em when there is no H glyph either', () => {
      expect(createGlyphSource(fakeFont({ tables: {} })).capHeight).toBe(700);
    });
  });

  describe('hasGlyph', () => {
    it('is true for mapped characters and false for .notdef', () => {
      const source = createGlyphSource(fakeFont({}, { k: fakeGlyph({ index: 74 }) }));

      expect(source.hasGlyph('k')).toBe(true);
      expect(source.hasGlyph('Ж')).toBe(false);
    });
  });

  describe('advance and kerning', () => {
    it('reads the advance width of the glyph', () => {
      const source = createGlyphSource(fakeFont({}, { A: fakeGlyph({ advanceWidth: 640 }) }));

      expect(source.advance('A')).toBe(640);
    });

    it('asks the font for the kerning between the two glyphs', () => {
      const a = fakeGlyph({ index: 1 });
      const v = fakeGlyph({ index: 2 });
      const getKerningValue = vi.fn().mockReturnValue(-100);
      const source = createGlyphSource(fakeFont({ getKerningValue }, { A: a, V: v }));

      expect(source.kerning('A', 'V')).toBe(-100);
      expect(getKerningValue).toHaveBeenCalledWith(a, v);
    });
  });

  describe('outline', () => {
    it('requests the path at one em so coordinates stay in font units, y down', () => {
      const glyph = fakeGlyph({ commands: [{ type: 'Z' }] });
      const source = createGlyphSource(fakeFont({}, { A: glyph }));

      source.outline('A');

      expect(glyph.getPath).toHaveBeenCalledWith(0, 0, 1000);
    });

    it('maps every supported command type', () => {
      const commands: OpentypePathCommand[] = [
        { type: 'M', x: 1, y: 2 },
        { type: 'L', x: 3, y: 4 },
        { type: 'Q', x1: 5, y1: 6, x: 7, y: 8 },
        { type: 'C', x1: 1, y1: 2, x2: 3, y2: 4, x: 5, y: 6 },
        { type: 'Z' },
      ];
      const source = createGlyphSource(fakeFont({}, { A: fakeGlyph({ commands }) }));

      expect(source.outline('A')).toEqual([
        { type: 'M', x: 1, y: 2 },
        { type: 'L', x: 3, y: 4 },
        { type: 'Q', x1: 5, y1: 6, x: 7, y: 8 },
        { type: 'C', x1: 1, y1: 2, x2: 3, y2: 4, x: 5, y: 6 },
        { type: 'Z' },
      ]);
    });

    it('throws on an unknown command type', () => {
      const source = createGlyphSource(fakeFont({}, { A: fakeGlyph({ commands: [{ type: 'X' }] }) }));

      expect(() => source.outline('A')).toThrow('Unsupported glyph command: X');
    });

    it('throws when a command lacks a coordinate', () => {
      const source = createGlyphSource(fakeFont({}, { A: fakeGlyph({ commands: [{ type: 'L', x: 1 }] }) }));

      expect(() => source.outline('A')).toThrow('Glyph command is missing a coordinate');
    });
  });
});
