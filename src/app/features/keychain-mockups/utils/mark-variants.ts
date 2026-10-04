import type { KeychainMark, MarkVariantKind } from '../models/keychain.model';

const MARK_VARIANT_ORDER: readonly MarkVariantKind[] = ['icon', 'text', 'combined'];

export const MARK_VARIANT_LABELS: Record<MarkVariantKind, string> = {
  combined: 'Іконка + текст',
  icon: 'Іконка',
  text: 'Текст',
};

export function availableVariants(mark: KeychainMark | null): MarkVariantKind[] {
  if (!mark) {
    return [];
  }
  return MARK_VARIANT_ORDER.filter((variant) => mark.variants[variant] !== undefined);
}

export function defaultVariant(mark: KeychainMark | null): MarkVariantKind | null {
  const variants = availableVariants(mark);
  return variants.includes('combined') ? 'combined' : (variants[0] ?? null);
}
