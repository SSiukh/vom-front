import type { KeychainMark, MarkVariantKind } from '../models/keychain.model';

export const MARK_VARIANT_ORDER: readonly MarkVariantKind[] = ['combined', 'icon', 'text'];

export const MARK_VARIANT_LABELS: Record<MarkVariantKind, string> = {
  combined: 'Разом',
  icon: 'Значок',
  text: 'Напис',
};

export function availableVariants(mark: KeychainMark | null): MarkVariantKind[] {
  if (!mark) {
    return [];
  }
  return MARK_VARIANT_ORDER.filter((variant) => mark.variants[variant] !== undefined);
}

export function defaultVariant(mark: KeychainMark | null): MarkVariantKind | null {
  return availableVariants(mark)[0] ?? null;
}
