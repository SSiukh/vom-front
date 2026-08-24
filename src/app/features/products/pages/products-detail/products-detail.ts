import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideChevronLeft, LucidePencil, LucideTrash2 } from '@lucide/angular';
import { DictionariesService } from '../../../../core/dictionaries/dictionaries.service';
import { ProductsApiService } from '../../../../core/api/products-api.service';
import { FEATURE_ROUTES } from '../../../../core/routes.constants';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import type { Product } from '../../models/product.model';

@Component({
  selector: 'app-products-detail',
  imports: [ConfirmDialog, LucideChevronLeft, LucidePencil, LucideTrash2],
  templateUrl: './products-detail.html',
  styleUrl: './products-detail.css',
})
export class ProductsDetail {
  private readonly productsApi = inject(ProductsApiService);
  private readonly dictionaries = inject(DictionariesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly productId = this.route.snapshot.paramMap.get('id')!;

  protected readonly product = signal<Product | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly confirmingDelete = signal(false);
  protected readonly deleting = signal(false);

  protected readonly typeLabel = computed(() => {
    const product = this.product();
    if (!product) {
      return '';
    }
    return this.dictionaries.productTypes().find((t) => t.id === product.typeId)?.label ?? '';
  });

  constructor() {
    this.load();
  }

  goBack(): void {
    this.router.navigateByUrl(FEATURE_ROUTES.products);
  }

  goToEdit(): void {
    this.router.navigateByUrl(`${FEATURE_ROUTES.products}/${this.productId}/edit`);
  }

  requestDelete(): void {
    this.confirmingDelete.set(true);
  }

  cancelDelete(): void {
    this.confirmingDelete.set(false);
  }

  confirmDelete(): void {
    if (this.deleting()) {
      return;
    }
    this.deleting.set(true);
    this.error.set(null);
    this.productsApi
      .delete(this.productId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.router.navigateByUrl(FEATURE_ROUTES.products);
        },
        error: () => {
          this.deleting.set(false);
          this.confirmingDelete.set(false);
          this.error.set('Не вдалося видалити товар');
        },
      });
  }

  private load(): void {
    this.loading.set(true);
    this.productsApi
      .get(this.productId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (product) => {
          this.loading.set(false);
          this.product.set(product);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Не вдалося завантажити дані товару');
        },
      });
  }
}
