declare module 'opentype.js' {
  export interface OpentypePathCommand {
    type: string;
    x?: number;
    y?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
  }

  export interface OpentypePath {
    commands: OpentypePathCommand[];
  }

  export interface OpentypeBoundingBox {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }

  export interface OpentypeGlyph {
    index: number;
    advanceWidth: number;
    getPath(x: number, y: number, fontSize: number): OpentypePath;
    getBoundingBox(): OpentypeBoundingBox;
  }

  export interface OpentypeFont {
    unitsPerEm: number;
    tables: { os2?: { sCapHeight?: number } };
    charToGlyph(char: string): OpentypeGlyph;
    charToGlyphIndex(char: string): number;
    getKerningValue(left: OpentypeGlyph, right: OpentypeGlyph): number;
  }

  export function parse(buffer: ArrayBuffer): OpentypeFont;
}

declare module 'opentype.js/dist/opentype.mjs' {
  export * from 'opentype.js';
}
