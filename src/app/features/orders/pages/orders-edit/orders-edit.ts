import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideChevronLeft, LucideLock, LucideTriangleAlert } from '@lucide/angular';
import { catchError, of, switchMap } from 'rxjs';
import { OrdersApiService } from '../../../../core/api/orders-api.service';
import { ProductsApiService } from '../../../../core/api/products-api.service';
import { SendersApiService } from '../../../../core/api/senders-api.service';
import { DictionariesService } from '../../../../core/dictionaries/dictionaries.service';
import { FEATURE_ROUTES } from '../../../../core/routes.constants';
import type { Product } from '../../../products/models/product.model';
import type { Sender, SenderAddress } from '../../../senders/models/sender.model';
import type { Order, UpdateOrderPayload } from '../../models/order.model';
import { buildOrderItemPayload, createOrderItemFormGroup } from '../../order-item-form.util';
import { OrderItemCard, type OrderItemFormGroup } from '../orders-create/order-item-card/order-item-card';
import { computeItemSubtotal } from '../orders-create/order-item-subtotal.util';

@Component({
  selector: 'app-orders-edit',
  imports: [ReactiveFormsModule, OrderItemCard, LucideChevronLeft, LucideLock, LucideTriangleAlert],
  templateUrl: './orders-edit.html',
  styleUrl: './orders-edit.css',
})
export class OrdersEdit {
  private readonly fb = inject(FormBuilder);
  private readonly ordersApi = inject(OrdersApiService);
  private readonly sendersApi = inject(SendersApiService);
  private readonly productsApi = inject(ProductsApiService);
  protected readonly dictionaries = inject(DictionariesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private orderId = '';

  protected readonly order = signal<Order | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected readonly itemProducts = signal<(Product | null)[]>([]);

  protected readonly senderInfo = signal<Sender | null>(null);
  protected readonly senderAddressLabel = signal<string | null>(null);

  protected readonly form = this.fb.group({
    shipmentTypeId: this.fb.nonNullable.control('', Validators.required),
    paymentTypeId: this.fb.nonNullable.control('', Validators.required),
    partialAmount: this.fb.control<number | null>(null),
    items: this.fb.array<OrderItemFormGroup>([]),
  });

  get items(): FormArray<OrderItemFormGroup> {
    return this.form.controls.items;
  }

  constructor() {
    this.form.controls.paymentTypeId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((id) => {
      this.onPaymentTypeChange(id);
    });

    this.route.paramMap
      .pipe(
        switchMap((params) => {
          this.orderId = params.get('id') ?? '';
          this.loading.set(true);
          this.error.set(null);
          return this.ordersApi.get(this.orderId).pipe(
            catchError(() => {
              this.loading.set(false);
              this.error.set('Не вдалося завантажити дані замовлення');
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((order) => {
        if (order) {
          this.loading.set(false);
          this.hydrateForm(order);
          this.order.set(order);
          this.loadSenderInfo(order.senderId, order.senderAddressRef);
        }
      });
  }

  goBack(): void {
    this.router.navigateByUrl(`${FEATURE_ROUTES.orders}/${this.orderId}`);
  }

  paymentTypeCode(): string | null {
    const id = this.form.controls.paymentTypeId.value;
    return this.dictionaries.paymentTypes().find((t) => t.id === id)?.code ?? null;
  }

  orderTotal(): number {
    return this.items.controls.reduce((sum, group, index) => sum + this.itemSubtotal(group, index), 0);
  }

  itemSubtotal(group: OrderItemFormGroup, index: number): number {
    const raw = group.getRawValue();
    const type = this.dictionaries.productTypes().find((t) => t.id === raw.productTypeId);
    const isCustom = type?.isCustom ?? false;
    const product = this.itemProducts()[index] ?? null;
    return computeItemSubtotal(raw.quantity, raw.price, raw.isPromo, isCustom, product);
  }

  addItem(): void {
    this.items.push(createOrderItemFormGroup(this.fb));
    this.itemProducts.update((products) => [...products, null]);
  }

  removeItem(index: number): void {
    if (this.items.length <= 1) {
      return;
    }
    this.items.removeAt(index);
    this.itemProducts.update((products) => products.filter((_, i) => i !== index));
  }

  onItemProductChange(index: number, product: Product | null): void {
    this.itemProducts.update((products) => products.map((p, i) => (i === index ? product : p)));
  }

  isFormValid(): boolean {
    return (
      this.form.controls.shipmentTypeId.valid &&
      this.form.controls.paymentTypeId.valid &&
      this.form.controls.partialAmount.valid &&
      this.items.valid
    );
  }

  save(): void {
    if (!this.isFormValid() || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);

    const raw = this.form.getRawValue();
    const payload: UpdateOrderPayload = {
      shipmentTypeId: raw.shipmentTypeId,
      paymentTypeId: raw.paymentTypeId,
      ...(this.paymentTypeCode() === 'partial' && raw.partialAmount !== null
        ? { partialAmount: raw.partialAmount }
        : {}),
      items: this.items.controls.map((group) => buildOrderItemPayload(group, this.dictionaries.productTypes())),
    };

    this.ordersApi
      .update(this.orderId, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.router.navigateByUrl(`${FEATURE_ROUTES.orders}/${this.orderId}`);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(this.resolveErrorMessage(error));
        },
      });
  }

  private hydrateForm(order: Order): void {
    this.form.controls.shipmentTypeId.setValue(order.shipmentTypeId);
    this.form.controls.paymentTypeId.setValue(order.paymentTypeId);
    this.onPaymentTypeChange(order.paymentTypeId);
    this.form.controls.partialAmount.setValue(order.partialAmount);

    while (this.items.length > 0) {
      this.items.removeAt(0);
    }
    this.itemProducts.set(order.items.map(() => null));

    for (const item of order.items) {
      const itemForm = createOrderItemFormGroup(this.fb);
      itemForm.patchValue({
        productTypeId: item.productTypeId,
        productId: item.productId,
        name: item.productId ? '' : item.nameSnapshot,
        price: item.productId ? null : item.price,
        quantity: item.quantity,
        isPromo: item.isPromo,
      });
      this.items.push(itemForm);
    }

    for (const item of order.items) {
      if (item.productId) {
        this.loadItemProduct(item.productId);
      }
    }
  }

  private loadItemProduct(productId: string): void {
    this.productsApi
      .get(productId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (product) => {
          this.itemProducts.update((products) =>
            this.items.controls.map((group, i) =>
              group.controls.productId.value === productId ? product : (products[i] ?? null),
            ),
          );
        },
        error: () => {
          this.itemProducts.update((products) =>
            this.items.controls.map((group, i) => (group.controls.productId.value === productId ? null : (products[i] ?? null))),
          );
        },
      });
  }

  private onPaymentTypeChange(paymentTypeId: string): void {
    const code = this.dictionaries.paymentTypes().find((t) => t.id === paymentTypeId)?.code;
    const control = this.form.controls.partialAmount;
    if (code === 'partial') {
      control.setValidators([Validators.required, Validators.min(0)]);
    } else {
      control.clearValidators();
      control.setValue(null);
    }
    control.updateValueAndValidity({ emitEvent: false });
  }

  private loadSenderInfo(senderId: string, senderAddressRef: string): void {
    this.sendersApi
      .list(1, 100)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.senderInfo.set(response.items.find((sender) => sender.id === senderId) ?? null);
        },
        error: () => {
          this.senderInfo.set(null);
        },
      });
    this.sendersApi
      .getAddresses(senderId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (addresses: SenderAddress[]) => {
          const match = addresses.find((address) => address.npAddressRef === senderAddressRef);
          this.senderAddressLabel.set(match?.description ?? null);
        },
        error: () => {
          this.senderAddressLabel.set(null);
        },
      });
  }

  private resolveErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 429) {
      return 'Забагато спроб — спробуйте пізніше';
    }
    if (error instanceof HttpErrorResponse && error.status === 502) {
      return 'Замовлення оновлено, але виникла помилка при оновленні ЕН у Новій Пошті. Перевірте ЕН вручну.';
    }
    if (error instanceof HttpErrorResponse && error.status === 400) {
      const message = error.error?.message;
      if (typeof message === 'string') {
        return message;
      }
      if (Array.isArray(message) && message.length > 0) {
        return message[0];
      }
    }
    return 'Не вдалося зберегти замовлення';
  }
}
