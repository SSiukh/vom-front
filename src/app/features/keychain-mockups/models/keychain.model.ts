export type KeychainFamily = 'leather' | 'metal' | 'subleather';

export type InkBlend = 'multiply' | 'source-over';

export interface PrintArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface KeychainType {
  id: string;
  label: string;
  family: KeychainFamily;
  imageUrl: string;
  printArea: PrintArea;
  inkColor: string;
  inkBlend: InkBlend;
  inkOpacity?: number;
}

export type MarkVariantKind = 'icon' | 'text' | 'combined';

export interface KeychainMark {
  id: string;
  label: string;
  variants: Partial<Record<MarkVariantKind, string>>;
}

export interface VectorGraphic {
  width: number;
  height: number;
  paths: readonly string[];
  evenOddPaths?: readonly string[];
}

export interface TextGraphic {
  paths: readonly string[];
  width: number;
  height: number;
  capHeight: number;
}

export interface ArtworkBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface KeychainArtwork {
  paths: string[];
  evenOddPaths: string[];
  metalPaths?: string[];
  metalEvenOddPaths?: string[];
  bounds: ArtworkBounds | null;
}
