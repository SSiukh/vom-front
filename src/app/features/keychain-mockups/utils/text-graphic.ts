import type { GlyphSource } from '../../sticker-generator/models/glyph-source.model';
import { layoutText } from '../../sticker-generator/utils/layout-sticker';
import {
  commandsBounds,
  commandsToPathData,
  transformCommands,
} from '../../sticker-generator/utils/path-data';
import type { TextGraphic } from '../models/keychain.model';

const FALLBACK_CAP_HEIGHT_RATIO = 0.7;

export interface TextGraphicResult {
  graphic: TextGraphic | null;
  missingCharacters: string[];
}

export function buildTextGraphic(text: string, glyphs: GlyphSource): TextGraphicResult {
  const run = layoutText(text, glyphs);
  const bounds = commandsBounds(run.commands);
  if (!bounds || bounds.maxX <= bounds.minX || bounds.maxY <= bounds.minY) {
    return { graphic: null, missingCharacters: run.missingCharacters };
  }
  const capHeight =
    glyphs.capHeight > 0 ? glyphs.capHeight : glyphs.unitsPerEm * FALLBACK_CAP_HEIGHT_RATIO;
  return {
    graphic: {
      paths: [commandsToPathData(transformCommands(run.commands, 1, -bounds.minX, -bounds.minY))],
      width: bounds.maxX - bounds.minX,
      height: bounds.maxY - bounds.minY,
      capHeight,
    },
    missingCharacters: run.missingCharacters,
  };
}
