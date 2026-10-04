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

interface InkBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const PATH_COMMAND = /([MLHVCQZ])([^MLHVCQZ]*)/g;
const PATH_NUMBER = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
const inkBoxes = new WeakMap<Graphic, InkBox>();

function inkBoxOf(graphic: Graphic): InkBox {
  const cached = inkBoxes.get(graphic);
  if (cached) {
    return cached;
  }
  const box = measureInk(graphic.paths);
  const result = box ?? { minX: 0, minY: 0, maxX: graphic.width, maxY: graphic.height };
  inkBoxes.set(graphic, result);
  return result;
}

function measureInk(paths: readonly string[]): InkBox | null {
  let box: InkBox | null = null;
  const include = (x: number, y: number): void => {
    box = box
      ? {
          minX: Math.min(box.minX, x),
          minY: Math.min(box.minY, y),
          maxX: Math.max(box.maxX, x),
          maxY: Math.max(box.maxY, y),
        }
      : { minX: x, minY: y, maxX: x, maxY: y };
  };
  for (const path of paths) {
    let x = 0;
    let y = 0;
    for (const [, command, args] of path.matchAll(PATH_COMMAND)) {
      const numbers = (args ?? '').match(PATH_NUMBER)?.map(Number) ?? [];
      if (command === 'H') {
        for (const value of numbers) {
          x = value;
          include(x, y);
        }
      } else if (command === 'V') {
        for (const value of numbers) {
          y = value;
          include(x, y);
        }
      } else if (command !== 'Z') {
        for (let index = 0; index + 1 < numbers.length; index += 2) {
          x = numbers[index] ?? x;
          y = numbers[index + 1] ?? y;
          include(x, y);
        }
      }
    }
  }
  return box;
}

/** factor is relative to the zone: 1 fills the zone, smaller values draw it smaller. */
export interface MarkPlacement {
  graphic: VectorGraphic;
  factor: number;
}

interface DesignLayoutInput {
  design: KeychainDesign;
  area: PrintArea;
  photo: VectorGraphic | null;
  marks: Readonly<Partial<Record<string, MarkPlacement>>>;
  text: TextGraphic | null;
  textSlotId: string | null;
  scales: { photo: number; text: number };
}

interface Placement {
  graphic: Graphic;
  rect: DesignRect;
  rotated: boolean;
  factor: number;
  metal: boolean;
}

function emptyArtwork(): KeychainArtwork {
  return { paths: [], evenOddPaths: [], metalPaths: [], metalEvenOddPaths: [], bounds: null };
}

export function resolveTextSlot(
  design: KeychainDesign,
  textSlotId: string | null,
): DesignSlot | null {
  return slotAccepting(design, 'text', textSlotId, null);
}

export function slotsAccepting(design: KeychainDesign, accept: SlotAccept): readonly DesignSlot[] {
  return design.slots.filter((slot) => slot.accepts.includes(accept));
}

export function layoutDesign(input: DesignLayoutInput): KeychainArtwork {
  const { design, area } = input;
  const text = resolveTextSlot(design, input.textSlotId);
  const placements: Placement[] = [];
  if (input.photo && design.photo) {
    placements.push({
      graphic: input.photo,
      rect: design.photo,
      rotated: design.photoRotated,
      factor: input.scales.photo,
      metal: false,
    });
  }
  const markSlots = slotsAccepting(design, 'mark');
  for (const slot of markSlots) {
    const mark = input.marks[slot.id];
    if (mark) {
      placements.push({
        graphic: mark.graphic,
        rect: slot.rect,
        rotated: slot.rotated,
        factor: mark.factor * (slot.scaleFactor ?? 1),
        metal: slot.metal ?? false,
      });
    }
  }
  const markWins = markSlots.some((slot) => slot === text && input.marks[slot.id] !== undefined);
  if (input.text && text && !markWins) {
    placements.push({
      graphic: input.text,
      rect: text.rect,
      rotated: text.rotated,
      factor: input.scales.text,
      metal: false,
    });
  }
  if (placements.length === 0) {
    return emptyArtwork();
  }
  const toArea = fitContainer(design.container, area, design.fit);
  const paths: string[] = [];
  const evenOddPaths: string[] = [];
  const metalPaths: string[] = [];
  const metalEvenOddPaths: string[] = [];
  let bounds: ArtworkBounds | null = null;
  for (const placement of placements) {
    const placed = placeGraphic(placement, toArea, area);
    if (placement.metal) {
      metalPaths.push(...placed.paths);
      metalEvenOddPaths.push(...placed.evenOddPaths);
    } else {
      paths.push(...placed.paths);
      evenOddPaths.push(...placed.evenOddPaths);
    }
    bounds = merge(bounds, placed.bounds);
  }
  return { paths, evenOddPaths, metalPaths, metalEvenOddPaths, bounds };
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
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
}

function fitContainer(
  container: DesignRect,
  area: PrintArea,
  fit: KeychainDesign['fit'],
): Transform {
  if (fit === 'stretch') {
    const scaleX = area.width / container.width;
    const scaleY = area.height / container.height;
    return {
      scaleX,
      scaleY,
      offsetX: area.x - container.x * scaleX,
      offsetY: area.y - container.y * scaleY,
    };
  }
  const scale = Math.min(area.width / container.width, area.height / container.height);
  return {
    scaleX: scale,
    scaleY: scale,
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
  const ink = inkBoxOf(graphic);
  const inkWidth = ink.maxX - ink.minX;
  const inkHeight = ink.maxY - ink.minY;
  const inkCentreX = (ink.minX + ink.maxX) / 2;
  const inkCentreY = (ink.minY + ink.maxY) / 2;
  const slotLeft = rect.x * toArea.scaleX + toArea.offsetX;
  const slotTop = rect.y * toArea.scaleY + toArea.offsetY;
  const slotWidth = rect.width * toArea.scaleX;
  const slotHeight = rect.height * toArea.scaleY;
  const effectiveWidth = rotated ? inkHeight : inkWidth;
  const effectiveHeight = rotated ? inkWidth : inkHeight;
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
          centreX + scale * inkCentreY,
          centreY - scale * inkCentreX,
        ])
    : (path: string): string =>
        transformPathData(path, scale, centreX - scale * inkCentreX, centreY - scale * inkCentreY);
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
