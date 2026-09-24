export type StickerIconId = 'instagram' | 'tiktok' | 'telegram' | 'instagram-color' | 'tiktok-color';

export type IconChoice = 'none' | StickerIconId;

export interface SizePreset {
  id: string;
  width: number;
  height: number;
}

export interface ContentScale {
  id: string;
  label: string;
  factor: number;
}

export interface GradientStop {
  offset: number;
  color: string;
  opacity: number;
}

export type GradientMatrix = readonly [number, number, number, number, number, number];

export interface LinearGradient {
  type: 'linear';
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stops: readonly GradientStop[];
}

export interface RadialGradient {
  type: 'radial';
  id: string;
  cx: number;
  cy: number;
  r: number;
  matrix: GradientMatrix;
  stops: readonly GradientStop[];
}

export type StickerGradient = LinearGradient | RadialGradient;

export type IconPaint = { type: 'color'; color: string } | { type: 'gradient'; key: string };

export interface IconLayer {
  d: string;
  paint: IconPaint;
}

export interface IconGradient {
  key: string;
  cx: number;
  cy: number;
  r: number;
  matrix: GradientMatrix;
  stops: readonly GradientStop[];
}

export type TextPaint =
  | { type: 'color'; color: string }
  | { type: 'gradient'; stops: readonly GradientStop[]; contrastColor: string };

interface StickerIconBase {
  id: StickerIconId;
  label: string;
  viewBoxWidth: number;
  viewBoxHeight: number;
}

export interface MonoStickerIcon extends StickerIconBase {
  kind: 'mono';
  paths: readonly string[];
}

export interface ColorStickerIcon extends StickerIconBase {
  kind: 'color';
  layers: readonly IconLayer[];
  gradients: readonly IconGradient[];
  textPaint: TextPaint;
}

export type StickerIcon = MonoStickerIcon | ColorStickerIcon;

export interface StickerFont {
  id: string;
  label: string;
  url: string;
}

export interface StickerLayer {
  d: string;
  fill: string | null;
}

export interface StickerLayout {
  width: number;
  height: number;
  layers: StickerLayer[];
  gradients: StickerGradient[];
  missingCharacters: string[];
}

export interface DocumentLayer {
  d: string;
  fill: string;
}

export interface StickerDocument {
  width: number;
  height: number;
  cornerRadius: number;
  background: string;
  layers: readonly DocumentLayer[];
  gradients: readonly StickerGradient[];
}
