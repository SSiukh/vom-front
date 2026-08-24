import type { FormBuilder } from '@angular/forms';
import { Validators } from '@angular/forms';
import type { ProductType } from '../../shared/models/dictionary-item.model';
import type { OrderItemFormGroup } from './pages/orders-create/order-item-card/order-item-card';
import type { CreateOrderItemPayload } from './models/order.model';

export function createOrderItemFormGroup(fb: FormBuilder): OrderItemFormGroup {
  return fb.group({
    productTypeId: fb.nonNullable.control('', Validators.required),
    productId: fb.control<string | null>(null),
    name: fb.nonNullable.control(''),
    price: fb.control<number | null>(null),
    quantity: fb.nonNullable.control(1, [Validators.required, Validators.min(1)]),
    isPromo: fb.nonNullable.control(false),
  });
}

export function buildOrderItemPayload(
  group: OrderItemFormGroup,
  productTypes: ProductType[],
): CreateOrderItemPayload {
  const raw = group.getRawValue();
  const type = productTypes.find((t) => t.id === raw.productTypeId);
  if (type?.isCustom) {
    return {
      productTypeId: raw.productTypeId,
      name: raw.name,
      price: raw.price ?? 0,
      quantity: raw.quantity,
    };
  }
  return {
    productTypeId: raw.productTypeId,
    productId: raw.productId ?? undefined,
    quantity: raw.quantity,
    isPromo: raw.isPromo,
  };
}
