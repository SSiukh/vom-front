import type { StickerDocument } from './sticker.model';

export interface MockupSticker {
  id: number;
  label: string;
  presetId: string;
  presetWidth: number;
  presetHeight: number;
  fileName: string;
  document: StickerDocument;
}

export interface MockupSize {
  width: number;
  height: number;
}

export interface MockupPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}
