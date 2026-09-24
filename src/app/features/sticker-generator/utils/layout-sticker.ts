import { CANVAS_WIDTH } from '../data/size-presets';
import type { GlyphSource, PathCommand } from '../models/glyph-source.model';
import type {
  ColorStickerIcon,
  SizePreset,
  StickerGradient,
  StickerIcon,
  StickerLayer,
  StickerLayout,
} from '../models/sticker.model';
import {
  commandsBounds,
  commandsToPathData,
  formatNumber,
  transformCommands,
  transformPathData,
  type Bounds,
} from './path-data';

export const ICON_TO_CAP_RATIO = 2;
export const GAP_TO_ICON_RATIO = 0.75;
export const PADDING_TO_HEIGHT_RATIO = 0.166;
export const MIN_PADDING_TO_HEIGHT_RATIO = 0.08;
const SPACE_TO_EM_RATIO = 0.25;
const FALLBACK_CAP_HEIGHT_RATIO = 0.7;

export interface LayoutOptions {
  text: string;
  glyphs: GlyphSource;
  icon: StickerIcon | null;
  preset: SizePreset;
  contentScale?: number;
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
  const empty: StickerLayout = { width, height, layers: [], gradients: [], missingCharacters: run.missingCharacters };
  if (!content) {
    return empty;
  }

  const contentWidth = content.maxX - content.minX;
  const contentHeight = content.maxY - content.minY;
  if (contentWidth <= 0 || contentHeight <= 0) {
    return empty;
  }

  const padding = height * PADDING_TO_HEIGHT_RATIO;
  const fitScale = Math.min((width - 2 * padding) / contentWidth, (height - 2 * padding) / contentHeight);
  const minPadding = height * MIN_PADDING_TO_HEIGHT_RATIO;
  const maxScale = Math.min((width - 2 * minPadding) / contentWidth, (height - 2 * minPadding) / contentHeight);
  const scale = Math.min(fitScale * (options.contentScale ?? 1), maxScale);
  const tx = (width - contentWidth * scale) / 2 - content.minX * scale;
  const ty = (height - contentHeight * scale) / 2 - content.minY * scale;

  const layers: StickerLayer[] = [];
  const gradients: StickerGradient[] = [];
  const iconTransform = { scale: iconScale * scale, dx: tx, dy: iconTop * scale + ty };
  if (icon?.kind === 'mono') {
    for (const path of icon.paths) {
      layers.push({ d: transformPathData(path, iconTransform.scale, iconTransform.dx, iconTransform.dy), fill: null });
    }
  }
  if (icon?.kind === 'color') {
    const ids = new Map<string, string>();
    for (const gradient of icon.gradients) {
      const [a, b, c, d, e, f] = gradient.matrix;
      const k = iconTransform.scale;
      const matrix = [k * a, k * b, k * c, k * d, k * e + iconTransform.dx, k * f + iconTransform.dy] as const;
      const id = `${icon.id}-${gradient.key}-${hashOf(matrix.map(formatNumber).join(' '))}`;
      ids.set(gradient.key, id);
      gradients.push({ type: 'radial', id, cx: gradient.cx, cy: gradient.cy, r: gradient.r, matrix, stops: gradient.stops });
    }
    for (const layer of icon.layers) {
      const d = transformPathData(layer.d, iconTransform.scale, iconTransform.dx, iconTransform.dy);
      const fill = layer.paint.type === 'color' ? layer.paint.color : `url(#${ids.get(layer.paint.key) ?? ''})`;
      layers.push({ d, fill });
    }
  }
  if (textBounds) {
    const d = commandsToPathData(transformCommands(run.commands, scale, textOffsetX * scale + tx, ty));
    layers.push({ d, fill: textFill(icon, gradients) });
  }
  return { width, height, layers, gradients, missingCharacters: run.missingCharacters };
}

function textFill(icon: StickerIcon | null, gradients: StickerGradient[]): string | null {
  if (icon?.kind !== 'color') {
    return null;
  }
  return icon.textPaint.type === 'color' ? icon.textPaint.color : addTextGradient(icon, icon.textPaint.stops, gradients);
}

function addTextGradient(icon: ColorStickerIcon, stops: StickerGradient['stops'], gradients: StickerGradient[]): string {
  const id = `${icon.id}-text`;
  gradients.push({ type: 'linear', id, x1: 0, y1: 1, x2: 1, y2: 0, stops });
  return `url(#${id})`;
}

function hashOf(text: string): string {
  let hash = 5381;
  for (const char of text) {
    hash = ((hash << 5) + hash + char.charCodeAt(0)) | 0;
  }
  return (hash >>> 0).toString(36);
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
