import type { KeychainMark } from '../models/keychain.model';
import { availableVariants, defaultVariant, MARK_VARIANT_LABELS } from './mark-variants';

const combined: KeychainMark = { id: 'a', label: 'A', variants: { icon: 'i.svg', text: 't.svg', combined: 'c.svg' } };
const iconOnly: KeychainMark = { id: 'b', label: 'B', variants: { icon: 'i.svg' } };
const textOnly: KeychainMark = { id: 'c', label: 'C', variants: { text: 't.svg' } };

describe('availableVariants', () => {
  it('lists combined, icon and text in that order when all three exist', () => {
    expect(availableVariants(combined)).toEqual(['combined', 'icon', 'text']);
  });

  it('lists only the variant that exists for a single-purpose mark', () => {
    expect(availableVariants(iconOnly)).toEqual(['icon']);
    expect(availableVariants(textOnly)).toEqual(['text']);
  });

  it('returns nothing for no mark', () => {
    expect(availableVariants(null)).toEqual([]);
  });
});

describe('defaultVariant', () => {
  it('prefers combined when it exists', () => {
    expect(defaultVariant(combined)).toBe('combined');
  });

  it('falls back to whichever single variant a mark has', () => {
    expect(defaultVariant(iconOnly)).toBe('icon');
    expect(defaultVariant(textOnly)).toBe('text');
  });

  it('returns null for no mark', () => {
    expect(defaultVariant(null)).toBeNull();
  });
});

describe('MARK_VARIANT_LABELS', () => {
  it('labels every variant kind in Ukrainian', () => {
    expect(MARK_VARIANT_LABELS).toEqual({ combined: 'Разом', icon: 'Значок', text: 'Напис' });
  });
});
