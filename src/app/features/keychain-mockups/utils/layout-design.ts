import type {
  PrintArea,
  KeychainArtwork,
  TextGraphic,
  VectorGraphic,
  ArtworkBounds,
} from '../models/keychain.model';
import type {
  DesignRect,
  DesignSlot,
  KeychainDesign,
  SlotAccept,
} from '../models/keychain-design.model';
import { transformPathData } from '../../sticker-generator/utils/path-data';
import { transformPathAffine } from './transform-path-affine';

type Graphic = VectorGraphic | TextGraphic;

interface DesignLayoutInput {
  design: KeychainDesign;
  area: PrintArea;
  photo: VectorGraphic | null;
  mark: VectorGraphic | null;
  text: TextGraphic | null;
  markSlotId: string | null;
  textSlotId: string | null;
  scales: { photo: number; mark: number; text: number };
}

interface Placement {
  graphic: Graphic;
  rect: DesignRect;
  rotated: boolean;
  factor: number;
}

function emptyArtwork(): KeychainArtwork {
  return { paths: [], evenOddPaths: [], bounds: null };
}

export function resolveSlots(
  design: KeychainDesign,
  markSlotId: string | null,
  textSlotId: string | null,
): {
  mark: DesignSlot | null;
  text: DesignSlot | null;
} {
  const text = slotAccepting(design, 'text', textSlotId, null);
  const mark = slotAccepting(design, 'mark', markSlotId, text);
  return { mark, text };
}

export function slotsAccepting(design: KeychainDesign, accept: SlotAccept): readonly DesignSlot[] {
  return design.slots.filter((slot) => slot.accepts.includes(accept));
}

export function layoutDesign(input: DesignLayoutInput): KeychainArtwork {
  const { design, area } = input;
  const { mark, text } = resolveSlots(design, input.markSlotId, input.textSlotId);
  const placements: Placement[] = [];
  if (input.photo && design.photo) {
    placements.push({
      graphic: input.photo,
      rect: design.photo,
      rotated: design.photoRotated,
      factor: input.scales.photo,
    });
  }
  const markWins = Boolean(input.mark && mark && text === mark);
  if (input.mark && mark) {
    placements.push({
      graphic: input.mark,
      rect: mark.rect,
      rotated: mark.rotated,
      factor: input.scales.mark,
    });
  }
  if (input.text && text && !markWins) {
    placements.push({
      graphic: input.text,
      rect: text.rect,
      rotated: text.rotated,
      factor: input.scales.text,
    });
  }
  if (placements.length === 0) {
    return emptyArtwork();
  }
  const toArea = fitContainer(design.container, area);
  const paths: string[] = [];
  const evenOddPaths: string[] = [];
  let bounds: ArtworkBounds | null = null;
  for (const placement of placements) {
    const placed = placeGraphic(placement, toArea, area);
    paths.push(...placed.paths);
    evenOddPaths.push(...placed.evenOddPaths);
    bounds = merge(bounds, placed.bounds);
  }
  return { paths, evenOddPaths, bounds };
}

function slotAccepting(
  design: KeychainDesign,
  accept: SlotAccept,
  preferredId: string | null,
  avoid?: DesignSlot | null,
): DesignSlot | null {
  const candidates = slotsAccepting(design, accept);
  const preferred = candidates.find((slot) => slot.id === preferredId);
  if (preferred) {
    return preferred;
  }
  return candidates.find((slot) => slot !== avoid) ?? candidates[0] ?? null;
}

interface Transform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

function fitContainer(container: DesignRect, area: PrintArea): Transform {
  const scale = Math.min(area.width / container.width, area.height / container.height);
  return {
    scale,
    offsetX: area.x + (area.width - container.width * scale) / 2 - container.x * scale,
    offsetY: area.y + (area.height - container.height * scale) / 2 - container.y * scale,
  };
}

function placeGraphic(
  placement: Placement,
  toArea: Transform,
  area: PrintArea,
): { paths: string[]; evenOddPaths: string[]; bounds: ArtworkBounds } {
  const { graphic, rect, rotated, factor } = placement;
  const slotLeft = rect.x * toArea.scale + toArea.offsetX;
  const slotTop = rect.y * toArea.scale + toArea.offsetY;
  const slotWidth = rect.width * toArea.scale;
  const slotHeight = rect.height * toArea.scale;
  const effectiveWidth = rotated ? graphic.height : graphic.width;
  const effectiveHeight = rotated ? graphic.width : graphic.height;
  const fit = Math.min(slotWidth / effectiveWidth, slotHeight / effectiveHeight);
  const limit = Math.min(area.width / effectiveWidth, area.height / effectiveHeight);
  const scale = Math.min(fit * factor, limit);
  const width = effectiveWidth * scale;
  const height = effectiveHeight * scale;
  const centreX = clamp(
    slotLeft + slotWidth / 2,
    area.x + width / 2,
    area.x + area.width - width / 2,
  );
  const centreY = clamp(
    slotTop + slotHeight / 2,
    area.y + height / 2,
    area.y + area.height - height / 2,
  );
  const transform = rotated
    ? (path: string): string =>
        transformPathAffine(path, [
          0,
          scale,
          -scale,
          0,
          centreX + (graphic.height * scale) / 2,
          centreY - (graphic.width * scale) / 2,
        ])
    : (path: string): string =>
        transformPathData(
          path,
          scale,
          centreX - (graphic.width * scale) / 2,
          centreY - (graphic.height * scale) / 2,
        );
  return {
    paths: graphic.paths.map(transform),
    evenOddPaths: 'evenOddPaths' in graphic ? (graphic.evenOddPaths ?? []).map(transform) : [],
    bounds: {
      minX: centreX - width / 2,
      minY: centreY - height / 2,
      maxX: centreX + width / 2,
      maxY: centreY + height / 2,
    },
  };
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
