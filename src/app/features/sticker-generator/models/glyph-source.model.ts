export type PathCommand =
  | { type: 'M' | 'L'; x: number; y: number }
  | { type: 'Q'; x1: number; y1: number; x: number; y: number }
  | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: 'Z' };

export interface GlyphSource {
  readonly unitsPerEm: number;
  readonly capHeight: number;
  hasGlyph(char: string): boolean;
  advance(char: string): number;
  kerning(left: string, right: string): number;
  outline(char: string): PathCommand[];
}
