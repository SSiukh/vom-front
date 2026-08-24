import { DestroyRef, Component, type OnInit, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideInfo, LucideTrash2 } from '@lucide/angular';
import { ProductsApiService } from '../../../../../core/api/products-api.service';
import type { Product } from '../../../../products/models/product.model';
import type { ProductType } from '../../../../../shared/models/dictionary-item.model';
import { SearchableSelect, type SelectOption } from '../../../../../shared/ui/searchable-select/searchable-select';
import { computeItemSubtotal } from '../order-item-subtotal.util';

export interface OrderItemFormControls {
  productTypeId: FormControl<string>;
  productId: FormControl<string | null>;
  name: FormControl<string>;
  price: FormControl<number | null>;
  quantity: FormControl<number>;
  isPromo: FormControl<boolean>;
}

export type OrderItemFormGroup = FormGroup<OrderItemFormControls>;

const PRODUCTS_FETCH_PAGE_SIZE = 100;

@Component({
  selector: 'app-order-item-card',
  imports: [ReactiveFormsModule, SearchableSelect, LucideTrash2, LucideInfo],
  templateUrl: './order-item-card.html',
  styleUrl: './order-item-card.css',
})
export class OrderItemCard implements OnInit {
  private readonly productsApi = inject(ProductsApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = input.required<OrderItemFormGroup>();
  readonly productTypes = input.required<ProductType[]>();
  readonly index = input.required<number>();
  readonly canRemove = input(true);
  readonly initialProduct = input<Product | null>(null);

  readonly removed = output<void>();
  readonly productChange = output<Product | null>();

  protected readonly selectedProduct = signal<Product | null>(null);
  protected readonly productsLoading = signal(false);
  protected readonly productOptions = signal<SelectOption[]>([]);
  private allProducts: Product[] = [];
  private userPickedProduct = false;

  constructor() {
    effect(() => {
      const seeded = this.initialProduct();
      if (seeded && !this.userPickedProduct) {
        this.selectedProduct.set(seeded);
      }
    });
  }

  protected isCustomType(): boolean {
    const type = this.productTypes().find((t) => t.id === this.form().controls.productTypeId.value);
    return type?.isCustom ?? false;
  }

  protected subtotal(): number {
    const { quantity, price, isPromo } = this.form().getRawValue();
    return computeItemSubtotal(quantity, price, isPromo, this.isCustomType(), this.selectedProduct());
  }

  ngOnInit(): void {
    const initialTypeId = this.form().controls.productTypeId.value;
    if (initialTypeId) {
      this.applyTypeValidators(initialTypeId);
      if (!this.isCustomType()) {
        this.loadProducts(initialTypeId);
      }
    }
    this.form()
      .controls.productTypeId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((typeId) => {
        this.onTypeChange(typeId);
      });
  }

  remove(): void {
    this.removed.emit();
  }

  onSearchTermChange(term: string): void {
    const normalized = term.trim().toLowerCase();
    const filtered = normalized
      ? this.allProducts.filter((p) => p.name.toLowerCase().includes(normalized))
      : this.allProducts;
    this.productOptions.set(filtered.map((p) => ({ value: p.id, label: p.name })));
  }

  onProductSelected(option: SelectOption): void {
    this.userPickedProduct = true;
    const product = this.allProducts.find((p) => p.id === option.value) ?? null;
    this.selectedProduct.set(product);
    this.form().controls.productId.setValue(option.value);
    if (!product?.promoPrice) {
      this.form().controls.isPromo.setValue(false);
    }
    this.productChange.emit(product);
  }

  onPromoToggle(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.form().controls.isPromo.setValue(checked);
  }

  private onTypeChange(typeId: string): void {
    this.userPickedProduct = true;
    this.selectedProduct.set(null);
    this.form().controls.productId.setValue(null);
    this.allProducts = [];
    this.productOptions.set([]);
    this.productChange.emit(null);

    this.applyTypeValidators(typeId);

    if (typeId && !this.isCustomType()) {
      this.loadProducts(typeId);
    }
  }

  private applyTypeValidators(typeId: string): void {
    const controls = this.form().controls;
    const type = this.productTypes().find((t) => t.id === typeId);
    const isCustom = type?.isCustom ?? false;

    if (isCustom) {
      controls.name.setValidators([Validators.required]);
      controls.price.setValidators([Validators.required, Validators.min(0)]);
      controls.productId.clearValidators();
      controls.isPromo.setValue(false);
    } else {
      controls.name.clearValidators();
      controls.name.setValue('');
      controls.price.clearValidators();
      controls.price.setValue(null);
      controls.productId.setValidators([Validators.required]);
    }
    controls.name.updateValueAndValidity({ emitEvent: false });
    controls.price.updateValueAndValidity({ emitEvent: false });
    controls.productId.updateValueAndValidity({ emitEvent: false });
  }

  private loadProducts(typeId: string): void {
    this.productsLoading.set(true);
    this.productsApi
      .list(1, PRODUCTS_FETCH_PAGE_SIZE, typeId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.productsLoading.set(false);
          this.allProducts = response.items;
          this.productOptions.set(response.items.map((p) => ({ value: p.id, label: p.name })));
        },
        error: () => {
          this.productsLoading.set(false);
        },
      });
  }
}
