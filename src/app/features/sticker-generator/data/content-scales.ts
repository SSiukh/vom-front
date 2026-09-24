import type { ContentScale } from '../models/sticker.model';

export const CONTENT_SCALES: readonly ContentScale[] = [
  { id: 'xs', label: 'XS', factor: 0.7 },
  { id: 's', label: 'S', factor: 0.85 },
  { id: 'm', label: 'M', factor: 1 },
  { id: 'l', label: 'L', factor: 1.1 },
  { id: 'xl', label: 'XL', factor: 1.2 },
];

export const DEFAULT_CONTENT_SCALE_ID = 'm';
