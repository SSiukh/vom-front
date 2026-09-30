import {
  AREA_PADDING_RATIO,
  BLOCK_GAP_RATIO,
  MARK_MAX_HEIGHT_ALONE,
  MARK_MAX_HEIGHT_WITH_OTHERS,
  MARK_MAX_WIDTH_RATIO,
  MIN_EDGE_PADDING_RATIO,
  PHOTO_MAX_HEIGHT_WITH_OTHERS,
  TEXT_CAP_HEIGHT_RATIO,
  TEXT_CAP_HEIGHT_RATIO_ALONE,
  TEXT_MAX_WIDTH_RATIO,
  VERTICAL_PHOTO_SHARE,
} from '../data/keychain-config';
import type { ArtworkBounds, KeychainArtwork, PrintArea, TextGraphic, VectorGraphic } from '../models/keychain.model';
import { transformPathData } from '../../sticker-generator/utils/path-data';
import { transformPathAffine } from './transform-path-affine';

export type ArtworkOrientation = 'horizontal' | 'vertical';
type ArtworkBlockKind = 'photo' | 'mark' | 'text';

export interface ArtworkInput {
  area: PrintArea;
  photo: VectorGraphic | null;
  mark: VectorGraphic | null;
  text: TextGraphic | null;
  orientations?: Partial<Record<ArtworkBlockKind, ArtworkOrientation>>;
  scales?: Partial<Record<ArtworkBlockKind, number>>;
}

interface Graphic {
  width: number;
  height: number;
  paths: readonly string[];
  evenOddPaths?: readonly string[];
}

interface StackItem {
  kind: ArtworkBlockKind;
  graphic: Graphic;
  factor: number;
}

interface Block extends StackItem {
  scale: number;
}

const EMPTY: KeychainArtwork = { paths: [], evenOddPaths: [], bounds: null };

export function layoutArtwork(input: ArtworkInput): KeychainArtwork {
  const upright: StackItem[] = [];
  const rotated: StackItem[] = [];
  const candidates: [ArtworkBlockKind, VectorGraphic | TextGraphic | null][] = [
    ['photo', input.photo],
    ['mark', input.mark],
    ['text', input.text],
  ];
  for (const [kind, graphic] of candidates) {
    if (!isUsable(graphic)) {
      continue;
    }
    const item = { kind, graphic, factor: input.scales?.[kind] ?? 1 };
    (input.orientations?.[kind] === 'vertical' ? rotated : upright).push(item);
  }
  const { area } = input;
  if (rotated.length === 0) {
    return layoutStack(area, upright, area.width, false);
  }
  const uprightHeight = upright.length > 0 ? area.height * VERTICAL_PHOTO_SHARE : 0;
  const uprightPart =
    upright.length > 0 ? layoutStack({ ...area, height: uprightHeight }, upright, area.width, false) : EMPTY;
  const group: PrintArea = { x: area.x, y: area.y + uprightHeight, width: area.width, height: area.height - uprightHeight };
  const frame: PrintArea = { x: 0, y: 0, width: group.height, height: group.width };
  const rotatedPart = layoutStack(frame, rotated, group.width, true);
  const rotate = (path: string): string => transformPathAffine(path, [0, 1, -1, 0, group.x + group.width, group.y]);
  const rotatedBounds = rotatedPart.bounds
    ? {
        minX: group.x + group.width - rotatedPart.bounds.maxY,
        maxX: group.x + group.width - rotatedPart.bounds.minY,
        minY: group.y + rotatedPart.bounds.minX,
        maxY: group.y + rotatedPart.bounds.maxX,
      }
    : null;
  return {
    paths: [...uprightPart.paths, ...rotatedPart.paths.map(rotate)],
    evenOddPaths: [...uprightPart.evenOddPaths, ...rotatedPart.evenOddPaths.map(rotate)],
    bounds: uprightPart.bounds && rotatedBounds ? merge(uprightPart.bounds, rotatedBounds) : (uprightPart.bounds ?? rotatedBounds),
  };
}

function layoutStack(area: PrintArea, items: StackItem[], sizeBasis: number, reverse: boolean): KeychainArtwork {
  const padding = sizeBasis * AREA_PADDING_RATIO;
  const contentWidth = area.width - 2 * padding;
  const contentHeight = area.height - 2 * padding;
  if (items.length === 0 || contentWidth <= 0 || contentHeight <= 0) {
    return EMPTY;
  }
  const withOthers = items.length > 1;
  const crowded = withOthers && items.some((item) => item.kind === 'photo');
  const relaxed = items.some((item) => item.factor > 1);
  const edge = sizeBasis * MIN_EDGE_PADDING_RATIO;
  const heightLimit = relaxed ? area.height - 2 * edge : contentHeight;
  const widthLimit = relaxed ? area.width - 2 * edge : contentWidth;

  const blocks: Block[] = items.map((item) => {
    const base = baseScale(item, { contentWidth, contentHeight, withOthers, crowded });
    const scale = item.factor === 1 ? base : Math.min(base * item.factor, widthLimit / item.graphic.width);
    return { ...item, scale };
  });
  if (reverse) {
    blocks.reverse();
  }

  const gap = contentHeight * BLOCK_GAP_RATIO;
  const stackHeight = blocks.reduce((sum, block) => sum + block.graphic.height * block.scale, 0) + gap * (blocks.length - 1);
  const shrink = Math.min(1, heightLimit / stackHeight);
  let cursor = area.y + (area.height - stackHeight * shrink) / 2;
  const centreX = area.x + area.width / 2;
  const paths: string[] = [];
  const evenOddPaths: string[] = [];
  let bounds: ArtworkBounds | null = null;
  for (const block of blocks) {
    const scale = block.scale * shrink;
    const width = block.graphic.width * scale;
    const height = block.graphic.height * scale;
    const left = centreX - width / 2;
    for (const path of block.graphic.paths) {
      paths.push(transformPathData(path, scale, left, cursor));
    }
    for (const path of block.graphic.evenOddPaths ?? []) {
      evenOddPaths.push(transformPathData(path, scale, left, cursor));
    }
    bounds = merge(bounds, { minX: left, minY: cursor, maxX: left + width, maxY: cursor + height });
    cursor += height + gap * shrink;
  }
  return { paths, evenOddPaths, bounds };
}

function baseScale(
  item: StackItem,
  room: { contentWidth: number; contentHeight: number; withOthers: boolean; crowded: boolean },
): number {
  const { graphic } = item;
  const { contentWidth, contentHeight, withOthers, crowded } = room;
  switch (item.kind) {
    case 'photo':
      return Math.min(contentWidth / graphic.width, (contentHeight * (withOthers ? PHOTO_MAX_HEIGHT_WITH_OTHERS : 1)) / graphic.height);
    case 'mark':
      return Math.min(
        (contentWidth * MARK_MAX_WIDTH_RATIO) / graphic.width,
        (contentHeight * (crowded ? MARK_MAX_HEIGHT_WITH_OTHERS : MARK_MAX_HEIGHT_ALONE)) / graphic.height,
      );
    case 'text': {
      const text = graphic as TextGraphic;
      const capHeight = text.capHeight > 0 ? text.capHeight : text.height;
      const capTarget = contentHeight * (crowded ? TEXT_CAP_HEIGHT_RATIO : TEXT_CAP_HEIGHT_RATIO_ALONE);
      return Math.min(capTarget / capHeight, (contentWidth * TEXT_MAX_WIDTH_RATIO) / text.width);
    }
  }
}

function merge(current: ArtworkBounds | null, next: ArtworkBounds): ArtworkBounds {
  if (!current) {
    return next;
  }
  return {
    minX: Math.min(current.minX, next.minX),
    minY: Math.min(current.minY, next.minY),
    maxX: Math.max(current.maxX, next.maxX),
    maxY: Math.max(current.maxY, next.maxY),
  };
}

function isUsable<T extends { width: number; height: number }>(graphic: T | null): graphic is T {
  return graphic !== null && graphic.width > 0 && graphic.height > 0;
}
