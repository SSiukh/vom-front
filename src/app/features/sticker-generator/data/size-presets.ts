import type { SizePreset } from '../models/sticker.model';

export const CANVAS_WIDTH = 1000;

export const SIZE_PRESETS: readonly SizePreset[] = [
  { id: '10x2', width: 10, height: 2 },
  { id: '13x2', width: 13, height: 2 },
  { id: '16x3', width: 16, height: 3 },
  { id: '18x4', width: 18, height: 4 },
  { id: '20x4', width: 20, height: 4 },
  { id: '22x5', width: 22, height: 5 },
  { id: '25x5', width: 25, height: 5 },
];

export const DEFAULT_SIZE_PRESET_ID = '18x4';
