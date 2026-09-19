import type { OpentypeFont, OpentypePathCommand } from 'opentype.js';
import type { GlyphSource, PathCommand } from '../models/glyph-source.model';

const FALLBACK_CAP_HEIGHT_RATIO = 0.7;

export function createGlyphSource(font: OpentypeFont): GlyphSource {
  const unitsPerEm = font.unitsPerEm;
  return {
    unitsPerEm,
    capHeight: readCapHeight(font),
    hasGlyph: (char) => font.charToGlyphIndex(char) > 0,
    advance: (char) => font.charToGlyph(char).advanceWidth,
    kerning: (left, right) => font.getKerningValue(font.charToGlyph(left), font.charToGlyph(right)),
    outline: (char) => font.charToGlyph(char).getPath(0, 0, unitsPerEm).commands.map(toPathCommand),
  };
}

function readCapHeight(font: OpentypeFont): number {
  const declared = font.tables.os2?.sCapHeight;
  if (declared !== undefined && declared > 0) {
    return declared;
  }
  if (font.charToGlyphIndex('H') > 0) {
    return font.charToGlyph('H').getBoundingBox().y2;
  }
  return font.unitsPerEm * FALLBACK_CAP_HEIGHT_RATIO;
}

function toPathCommand(command: OpentypePathCommand): PathCommand {
  switch (command.type) {
    case 'M':
    case 'L':
      return { type: command.type, x: required(command.x), y: required(command.y) };
    case 'Q':
      return { type: 'Q', x1: required(command.x1), y1: required(command.y1), x: required(command.x), y: required(command.y) };
    case 'C':
      return {
        type: 'C',
        x1: required(command.x1),
        y1: required(command.y1),
        x2: required(command.x2),
        y2: required(command.y2),
        x: required(command.x),
        y: required(command.y),
      };
    case 'Z':
      return { type: 'Z' };
    default:
      throw new Error(`Unsupported glyph command: ${command.type}`);
  }
}

function required(value: number | undefined): number {
  if (value === undefined) {
    throw new Error('Glyph command is missing a coordinate');
  }
  return value;
}
