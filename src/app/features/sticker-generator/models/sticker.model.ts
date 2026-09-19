export type StickerIconId = 'instagram' | 'tiktok' | 'telegram';

export type IconChoice = 'none' | StickerIconId;

export interface SizePreset {
  id: string;
  width: number;
  height: number;
}

export interface StickerIcon {
  id: StickerIconId;
  label: string;
  viewBoxWidth: number;
  viewBoxHeight: number;
  paths: readonly string[];
}

export interface StickerFont {
  id: string;
  label: string;
  url: string;
}

export interface StickerLayout {
  width: number;
  height: number;
  artPaths: string[];
  missingCharacters: string[];
}

export interface StickerDocument {
  width: number;
  height: number;
  cornerRadius: number;
  background: string;
  artwork: string;
  artPaths: readonly string[];
}
