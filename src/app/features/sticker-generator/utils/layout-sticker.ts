import { CANVAS_WIDTH } from '../data/size-presets';
import type { GlyphSource, PathCommand } from '../models/glyph-source.model';
import type { SizePreset, StickerIcon, StickerLayout } from '../models/sticker.model';
import {
  commandsBounds,
  commandsToPathData,
  transformCommands,
  transformPathData,
  type Bounds,
} from './path-data';

export const ICON_TO_CAP_RATIO = 2;
export const GAP_TO_ICON_RATIO = 0.75;
export const PADDING_TO_HEIGHT_RATIO = 0.166;
const SPACE_TO_EM_RATIO = 0.25;
const FALLBACK_CAP_HEIGHT_RATIO = 0.7;

export interface LayoutOptions {
  text: string;
  glyphs: GlyphSource;
  icon: StickerIcon | null;
  preset: SizePreset;
}

interface TextRun {
  commands: PathCommand[];
  missingCharacters: string[];
}

export function layoutSticker(options: LayoutOptions): StickerLayout {
  const { glyphs, icon, preset } = options;
  const width = CANVAS_WIDTH;
  const height = (CANVAS_WIDTH * preset.height) / preset.width;
  const run = layoutText(options.text, glyphs);
  const textBounds = commandsBounds(run.commands);
  const capHeight = glyphs.capHeight > 0 ? glyphs.capHeight : glyphs.unitsPerEm * FALLBACK_CAP_HEIGHT_RATIO;

  const iconHeight = capHeight * ICON_TO_CAP_RATIO;
  const iconScale = icon ? iconHeight / icon.viewBoxHeight : 0;
  const iconWidth = icon ? icon.viewBoxWidth * iconScale : 0;
  const iconTop = textBodyCentre(textBounds, capHeight) - iconHeight / 2;
  const iconBounds: Bounds | null = icon ? { minX: 0, minY: iconTop, maxX: iconWidth, maxY: iconTop + iconHeight } : null;

  const textOffsetX = textBounds && icon ? iconWidth + iconHeight * GAP_TO_ICON_RATIO - textBounds.minX : 0;
  const shiftedTextBounds: Bounds | null = textBounds
    ? {
        minX: textBounds.minX + textOffsetX,
        minY: textBounds.minY,
        maxX: textBounds.maxX + textOffsetX,
        maxY: textBounds.maxY,
      }
    : null;
  const content = mergeBounds(iconBounds, shiftedTextBounds);
  const empty: StickerLayout = { width, height, artPaths: [], missingCharacters: run.missingCharacters };
  if (!content) {
    return empty;
  }

  const contentWidth = content.maxX - content.minX;
  const contentHeight = content.maxY - content.minY;
  if (contentWidth <= 0 || contentHeight <= 0) {
    return empty;
  }

  const padding = height * PADDING_TO_HEIGHT_RATIO;
  const scale = Math.min((width - 2 * padding) / contentWidth, (height - 2 * padding) / contentHeight);
  const tx = (width - contentWidth * scale) / 2 - content.minX * scale;
  const ty = (height - contentHeight * scale) / 2 - content.minY * scale;

  const artPaths: string[] = [];
  if (icon) {
    for (const path of icon.paths) {
      artPaths.push(transformPathData(path, iconScale * scale, tx, iconTop * scale + ty));
    }
  }
  if (textBounds) {
    artPaths.push(commandsToPathData(transformCommands(run.commands, scale, textOffsetX * scale + tx, ty)));
  }
  return { width, height, artPaths, missingCharacters: run.missingCharacters };
}

function layoutText(text: string, glyphs: GlyphSource): TextRun {
  const commands: PathCommand[] = [];
  const missing = new Set<string>();
  let cursor = 0;
  let previous: string | null = null;
  for (const char of Array.from(text.replace(/\s+/g, ' ').trim())) {
    if (char === ' ') {
      cursor += glyphs.hasGlyph(' ') ? glyphs.advance(' ') : glyphs.unitsPerEm * SPACE_TO_EM_RATIO;
      previous = null;
      continue;
    }
    if (!glyphs.hasGlyph(char)) {
      missing.add(char);
      continue;
    }
    if (previous !== null) {
      cursor += glyphs.kerning(previous, char);
    }
    commands.push(...transformCommands(glyphs.outline(char), 1, cursor, 0));
    cursor += glyphs.advance(char);
    previous = char;
  }
  return { commands, missingCharacters: [...missing] };
}

function textBodyCentre(bounds: Bounds | null, capHeight: number): number {
  if (!bounds) {
    return -capHeight / 2;
  }
  const top = Math.max(bounds.minY, -capHeight);
  const bottom = Math.min(bounds.maxY, 0);
  return top < bottom ? (top + bottom) / 2 : -capHeight / 2;
}

function mergeBounds(first: Bounds | null, second: Bounds | null): Bounds | null {
  if (!first || !second) {
    return first ?? second;
  }
  return {
    minX: Math.min(first.minX, second.minX),
    minY: Math.min(first.minY, second.minY),
    maxX: Math.max(first.maxX, second.maxX),
    maxY: Math.max(first.maxY, second.maxY),
  };
}
