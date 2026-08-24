import type { Product } from '../../../products/models/product.model';

export function computeItemSubtotal(
  quantity: number,
  price: number | null,
  isPromo: boolean,
  isCustom: boolean,
  product: Product | null,
): number {
  if (isCustom) {
    return (price ?? 0) * quantity;
  }
  if (!product) {
    return 0;
  }
  const unitPrice = isPromo && product.promoPrice !== null ? product.promoPrice : product.price;
  return unitPrice * quantity;
}
