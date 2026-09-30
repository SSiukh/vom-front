import type { ContentScale } from '../../sticker-generator/models/sticker.model';

export const KEYCHAIN_SCALES: readonly ContentScale[] = [
  { id: 'xs', label: 'XS', factor: 0.8 },
  { id: 's', label: 'S', factor: 1 },
  { id: 'm', label: 'M', factor: 1.15 },
  { id: 'l', label: 'L', factor: 1.3 },
  { id: 'xl', label: 'XL', factor: 1.5 },
];

export const DEFAULT_KEYCHAIN_SCALE_ID = 'l';

export const KEYCHAIN_TEXT_SCALES: readonly ContentScale[] = [
  { id: 'xs', label: 'XS', factor: 0.52 },
  { id: 's', label: 'S', factor: 0.715 },
  { id: 'm', label: 'M', factor: 0.91 },
  { id: 'l', label: 'L', factor: 1.105 },
  { id: 'xl', label: 'XL', factor: 1.3 },
];

export const DEFAULT_KEYCHAIN_TEXT_SCALE_ID = 'm';
