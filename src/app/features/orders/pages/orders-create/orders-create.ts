import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  LucideBuilding,
  LucideCheck,
  LucideChevronLeft,
  LucideChevronRight,
  LucidePlus,
} from '@lucide/angular';
import { NovaPoshtaApiService } from '../../../../core/api/nova-poshta-api.service';
import { OrdersApiService } from '../../../../core/api/orders-api.service';
import { SendersApiService } from '../../../../core/api/senders-api.service';
import { DictionariesService } from '../../../../core/dictionaries/dictionaries.service';
import { FEATURE_ROUTES } from '../../../../core/routes.constants';
import type { Product } from '../../../products/models/product.model';
import type { Sender, SenderAddress } from '../../../senders/models/sender.model';
import { SearchableSelect, type SelectOption } from '../../../../shared/ui/searchable-select/searchable-select';
import type { CreateOrderPayload } from '../../models/order.model';
import { buildOrderItemPayload, createOrderItemFormGroup } from '../../order-item-form.util';
import { OrderItemCard, type OrderItemFormGroup } from './order-item-card/order-item-card';
import { computeItemSubtotal } from './order-item-subtotal.util';

type WizardStep = 1 | 2;
type DeliveryMethod = 'warehouse' | 'postomat';

@Component({
  selector: 'app-orders-create',
  imports: [
    ReactiveFormsModule,
    OrderItemCard,
    SearchableSelect,
    LucideChevronLeft,
    LucideChevronRight,
    LucidePlus,
    LucideCheck,
    LucideBuilding,
  ],
  templateUrl: './orders-create.html',
  styleUrl: './orders-create.css',
})
export class OrdersCreate {
  private readonly fb = inject(FormBuilder);
  private readonly ordersApi = inject(OrdersApiService);
  private readonly sendersApi = inject(SendersApiService);
  private readonly novaPoshtaApi = inject(NovaPoshtaApiService);
  protected readonly dictionaries = inject(DictionariesService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly step = signal<WizardStep>(1);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly itemProducts = signal<(Product | null)[]>([null]);

  protected readonly sendersLoading = signal(false);
  protected readonly activeSender = signal<Sender | null>(null);
  protected readonly senderAddresses = signal<SenderAddress[]>([]);
  protected readonly senderAddressesLoading = signal(false);

  protected readonly citiesLoading = signal(false);
  protected readonly cityOptions = signal<SelectOption[]>([]);
  protected readonly selectedCityLabel = signal<string | null>(null);
  protected readonly cityLookupError = signal<string | null>(null);

  protected readonly warehousesLoading = signal(false);
  protected readonly warehouseOptions = signal<SelectOption[]>([]);
  protected readonly selectedWarehouseLabel = signal<string | null>(null);
  protected readonly warehouseLookupError = signal<string | null>(null);
  private allWarehouses: SelectOption[] = [];

  protected readonly postomatsLoading = signal(false);
  protected readonly postomatOptions = signal<SelectOption[]>([]);
  protected readonly selectedPostomatLabel = signal<string | null>(null);
  protected readonly postomatLookupError = signal<string | null>(null);
  private allPostomats: SelectOption[] = [];

  protected readonly form = this.fb.group({
    shipmentTypeId: this.fb.nonNullable.control('', Validators.required),
    paymentTypeId: this.fb.nonNullable.control('', Validators.required),
    partialAmount: this.fb.control<number | null>(null),
    items: this.fb.array<OrderItemFormGroup>([createOrderItemFormGroup(this.fb)]),
    senderAddressRef: this.fb.nonNullable.control('', Validators.required),
    recipient: this.fb.group({
      phone: this.fb.nonNullable.control('', Validators.required),
      lastName: this.fb.nonNullable.control('', Validators.required),
      firstName: this.fb.nonNullable.control('', Validators.required),
      middleName: this.fb.nonNullable.control(''),
    }),
    deliveryTypeId: this.fb.nonNullable.control('', Validators.required),
    deliveryDetails: this.fb.group({
      cityRef: this.fb.nonNullable.control('', Validators.required),
      warehouseRef: this.fb.control<string | null>(null),
      postomatRef: this.fb.control<string | null>(null),
    }),
  });

  get items(): FormArray<OrderItemFormGroup> {
    return this.form.controls.items;
  }

  constructor() {
    effect(() => {
      const defaultType = this.dictionaries.shipmentTypes().find((t) => t.isDefault);
      if (defaultType && !this.form.controls.shipmentTypeId.value) {
        this.form.controls.shipmentTypeId.setValue(defaultType.id);
      }
    });

    this.form.controls.paymentTypeId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((id) => {
      this.onPaymentTypeChange(id);
    });
    this.form.controls.deliveryTypeId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((id) => {
      this.onDeliveryTypeChange(id);
    });

    this.loadActiveSender();
  }

  deliveryMethodCode(): DeliveryMethod | null {
    const id = this.form.controls.deliveryTypeId.value;
    const code = this.dictionaries.deliveryTypes().find((t) => t.id === id)?.code;
    return code === 'warehouse' || code === 'postomat' ? code : null;
  }

  paymentTypeCode(): string | null {
    const id = this.form.controls.paymentTypeId.value;
    return this.dictionaries.paymentTypes().find((t) => t.id === id)?.code ?? null;
  }

  selectDeliveryMethod(code: DeliveryMethod): void {
    const type = this.dictionaries.deliveryTypes().find((t) => t.code === code);
    if (type) {
      this.form.controls.deliveryTypeId.setValue(type.id);
    }
  }

  cityChosen(): boolean {
    return !!this.form.controls.deliveryDetails.controls.cityRef.value;
  }

  codAmountLabel(): string | null {
    const code = this.paymentTypeCode();
    if (code === 'cod') {
      return `До сплати при отриманні ${this.orderTotal()} ₴`;
    }
    if (code === 'partial') {
      const amount = this.form.controls.partialAmount.value;
      return amount !== null ? `Післяплата ${amount} ₴` : null;
    }
    return null;
  }

  orderTotal(): number {
    return this.items.controls.reduce((sum, group, index) => sum + this.itemSubtotal(group, index), 0);
  }

  orderQuantity(): number {
    return this.items.controls.reduce((sum, group) => sum + (group.getRawValue().quantity || 0), 0);
  }

  itemSubtotal(group: OrderItemFormGroup, index: number): number {
    const raw = group.getRawValue();
    const type = this.dictionaries.productTypes().find((t) => t.id === raw.productTypeId);
    return computeItemSubtotal(raw.quantity, raw.price, raw.isPromo, type?.isCustom ?? false, this.itemProducts()[index] ?? null);
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

  isStep1Valid(): boolean {
    return (
      this.form.controls.shipmentTypeId.valid &&
      this.form.controls.paymentTypeId.valid &&
      this.form.controls.partialAmount.valid &&
      this.items.valid
    );
  }

  isStep2Valid(): boolean {
    return (
      this.form.controls.senderAddressRef.valid &&
      this.form.controls.recipient.valid &&
      this.form.controls.deliveryTypeId.valid &&
      this.form.controls.deliveryDetails.valid &&
      this.activeSender() !== null
    );
  }

  goToStep2(): void {
    if (this.isStep1Valid()) {
      this.step.set(2);
    }
  }

  goToStep1(): void {
    this.step.set(1);
  }

  goBack(): void {
    this.router.navigateByUrl(FEATURE_ROUTES.orders);
  }

  onCitySearchTermChange(term: string): void {
    this.cityLookupError.set(null);
    const trimmed = term.trim();
    if (!trimmed) {
      this.cityOptions.set([]);
      return;
    }
    this.citiesLoading.set(true);
    this.novaPoshtaApi
      .searchCities(trimmed)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (options) => {
          this.citiesLoading.set(false);
          this.cityOptions.set(options.map((o) => ({ value: o.ref, label: o.description })));
        },
        error: () => {
          this.citiesLoading.set(false);
          this.cityLookupError.set('Не вдалося виконати пошук населеного пункту');
        },
      });
  }

  onCitySelected(option: SelectOption): void {
    this.selectedCityLabel.set(option.label);
    const details = this.form.controls.deliveryDetails.controls;
    details.cityRef.setValue(option.value);
    details.warehouseRef.setValue(null);
    details.postomatRef.setValue(null);
    this.selectedWarehouseLabel.set(null);
    this.selectedPostomatLabel.set(null);
    this.loadWarehouses(option.value);
    this.loadPostomats(option.value);
  }

  onWarehouseSearchTermChange(term: string): void {
    this.warehouseOptions.set(this.filterOptions(this.allWarehouses, term));
  }

  onWarehouseSelected(option: SelectOption): void {
    this.selectedWarehouseLabel.set(option.label);
    this.form.controls.deliveryDetails.controls.warehouseRef.setValue(option.value);
  }

  onPostomatSearchTermChange(term: string): void {
    this.postomatOptions.set(this.filterOptions(this.allPostomats, term));
  }

  onPostomatSelected(option: SelectOption): void {
    this.selectedPostomatLabel.set(option.label);
    this.form.controls.deliveryDetails.controls.postomatRef.setValue(option.value);
  }

  submit(): void {
    if (!this.isStep1Valid() || !this.isStep2Valid() || this.saving()) {
      return;
    }
    const activeSender = this.activeSender();
    if (!activeSender) {
      return;
    }
    this.saving.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();
    const payload: CreateOrderPayload = {
      shipmentTypeId: raw.shipmentTypeId,
      paymentTypeId: raw.paymentTypeId,
      ...(this.paymentTypeCode() === 'partial' && raw.partialAmount !== null
        ? { partialAmount: raw.partialAmount }
        : {}),
      items: this.items.controls.map((group) => buildOrderItemPayload(group, this.dictionaries.productTypes())),
      senderId: activeSender.id,
      senderAddressRef: raw.senderAddressRef,
      recipient: {
        phone: raw.recipient.phone,
        lastName: raw.recipient.lastName,
        firstName: raw.recipient.firstName,
        ...(raw.recipient.middleName ? { middleName: raw.recipient.middleName } : {}),
      },
      deliveryTypeId: raw.deliveryTypeId,
      deliveryDetails: this.buildDeliveryDetailsPayload(raw.deliveryDetails),
    };

    this.ordersApi
      .create(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.router.navigateByUrl(FEATURE_ROUTES.orders);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  private buildDeliveryDetailsPayload(
    raw: ReturnType<OrdersCreate['form']['controls']['deliveryDetails']['getRawValue']>,
  ): CreateOrderPayload['deliveryDetails'] {
    return {
      cityRef: raw.cityRef,
      ...(raw.warehouseRef ? { warehouseRef: raw.warehouseRef } : {}),
      ...(raw.postomatRef ? { postomatRef: raw.postomatRef } : {}),
    };
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

  private onDeliveryTypeChange(deliveryTypeId: string): void {
    const code = this.dictionaries.deliveryTypes().find((t) => t.id === deliveryTypeId)?.code;
    const controls = this.form.controls.deliveryDetails.controls;

    controls.warehouseRef.clearValidators();
    controls.postomatRef.clearValidators();

    if (code === 'warehouse') {
      controls.warehouseRef.setValidators([Validators.required]);
    } else if (code === 'postomat') {
      controls.postomatRef.setValidators([Validators.required]);
    }

    for (const control of Object.values(controls)) {
      control.updateValueAndValidity({ emitEvent: false });
    }
  }

  private loadActiveSender(): void {
    this.sendersLoading.set(true);
    this.sendersApi
      .list(1, 100)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.sendersLoading.set(false);
          const active = response.items.find((s) => s.isActive) ?? null;
          this.activeSender.set(active);
          if (active) {
            this.loadSenderAddresses(active.id);
          }
        },
        error: () => {
          this.sendersLoading.set(false);
        },
      });
  }

  private loadSenderAddresses(senderId: string): void {
    this.senderAddressesLoading.set(true);
    this.sendersApi
      .getAddresses(senderId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (addresses) => {
          this.senderAddressesLoading.set(false);
          this.senderAddresses.set(addresses);
        },
        error: () => {
          this.senderAddressesLoading.set(false);
        },
      });
  }

  private loadWarehouses(cityRef: string): void {
    this.warehousesLoading.set(true);
    this.warehouseLookupError.set(null);
    this.novaPoshtaApi
      .getWarehouses(cityRef)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (options) => {
          this.warehousesLoading.set(false);
          this.allWarehouses = options.map((o) => ({ value: o.ref, label: o.description }));
          this.warehouseOptions.set(this.allWarehouses);
        },
        error: () => {
          this.warehousesLoading.set(false);
          this.warehouseLookupError.set('Не вдалося завантажити перелік відділень');
        },
      });
  }

  private loadPostomats(cityRef: string): void {
    this.postomatsLoading.set(true);
    this.postomatLookupError.set(null);
    this.novaPoshtaApi
      .getPostomats(cityRef)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (options) => {
          this.postomatsLoading.set(false);
          this.allPostomats = options.map((o) => ({ value: o.ref, label: o.description }));
          this.postomatOptions.set(this.allPostomats);
        },
        error: () => {
          this.postomatsLoading.set(false);
          this.postomatLookupError.set('Не вдалося завантажити перелік поштоматів');
        },
      });
  }

  private filterOptions(options: SelectOption[], term: string): SelectOption[] {
    const normalized = term.trim().toLowerCase();
    if (!normalized) {
      return options;
    }
    return options.filter((o) => o.label.toLowerCase().includes(normalized));
  }

  private resolveErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 429) {
      return 'Забагато спроб — спробуйте пізніше';
    }
    if (error instanceof HttpErrorResponse && error.status === 502) {
      return 'Замовлення створено, але виникла помилка при створенні ЕН у Новій Пошті. Перевірте замовлення та ЕН вручну.';
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
    return 'Не вдалося створити замовлення';
  }
}
