import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { LucidePencil, LucidePlus, LucideSearch, LucideTrash2 } from '@lucide/angular';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { DictionariesService } from '../../../../core/dictionaries/dictionaries.service';
import { ProductsApiService } from '../../../../core/api/products-api.service';
import { FEATURE_ROUTES } from '../../../../core/routes.constants';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import type { Product } from '../../models/product.model';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

@Component({
  selector: 'app-products-list',
  imports: [Pagination, ConfirmDialog, LucidePlus, LucidePencil, LucideTrash2, LucideSearch],
  templateUrl: './products-list.html',
  styleUrl: './products-list.css',
})
export class ProductsList {
  private readonly productsApi = inject(ProductsApiService);
  protected readonly dictionaries = inject(DictionariesService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly products = signal<Product[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = PAGE_SIZE;
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly selectedTypeId = signal<string | null>(null);
  protected readonly searchTerm = signal('');
  protected readonly stockSortOrder = signal<'asc' | 'desc' | null>(null);
  protected readonly pendingDeleteId = signal<string | null>(null);
  protected readonly deleting = signal(false);

  private readonly searchTermChanges = new Subject<string>();

  protected readonly filterableTypes = computed(() => this.dictionaries.productTypes().filter((t) => !t.isCustom));

  protected readonly hasActiveFilters = computed(
    () => this.selectedTypeId() !== null || this.searchTerm().trim() !== '',
  );

  protected readonly typeLabelById = computed(() => {
    const map = new Map<string, string>();
    for (const type of this.dictionaries.productTypes()) {
      map.set(type.id, type.label);
    }
    return map;
  });

  protected readonly pendingDeleteProduct = computed(() => {
    const id = this.pendingDeleteId();
    return id ? (this.products().find((p) => p.id === id) ?? null) : null;
  });

  constructor() {
    this.load();
    this.searchTermChanges
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((term) => {
        this.searchTerm.set(term);
        this.page.set(1);
        this.load();
      });
  }

  onSearchTermChange(event: Event): void {
    this.searchTermChanges.next((event.target as HTMLInputElement).value);
  }

  selectType(typeId: string | null): void {
    if (this.selectedTypeId() === typeId) {
      return;
    }
    this.selectedTypeId.set(typeId);
    this.page.set(1);
    this.load();
  }

  setStockSortOrder(order: 'asc' | 'desc' | null): void {
    if (this.stockSortOrder() === order) {
      return;
    }
    this.stockSortOrder.set(order);
    this.page.set(1);
    this.load();
  }

  onPageChange(page: number): void {
    this.page.set(page);
    this.load();
  }

  goToCreate(): void {
    this.router.navigateByUrl(`${FEATURE_ROUTES.products}/new`);
  }

  goToDetail(product: Product): void {
    this.router.navigateByUrl(`${FEATURE_ROUTES.products}/${product.id}`);
  }

  goToEdit(product: Product): void {
    this.router.navigateByUrl(`${FEATURE_ROUTES.products}/${product.id}/edit`);
  }

  onRowClick(event: Event, product: Product): void {
    if ((event.target as HTMLElement).closest('.col-actions')) {
      return;
    }
    this.goToDetail(product);
  }

  onRowSpaceKey(event: Event, product: Product): void {
    if ((event.target as HTMLElement).closest('.col-actions')) {
      return;
    }
    event.preventDefault();
    this.goToDetail(product);
  }

  stockClass(product: Product): string {
    if (product.stockQuantity <= 0) {
      return 'stock-zero';
    }
    if (product.stockQuantity < 10) {
      return 'stock-low';
    }
    return '';
  }

  cardAccentClass(product: Product): string {
    if (product.stockQuantity <= 0) {
      return 'entity-card--danger';
    }
    if (product.stockQuantity < 10) {
      return 'entity-card--warning';
    }
    return '';
  }

  requestDelete(product: Product): void {
    this.pendingDeleteId.set(product.id);
  }

  cancelDelete(): void {
    this.pendingDeleteId.set(null);
  }

  confirmDelete(): void {
    const id = this.pendingDeleteId();
    if (!id || this.deleting()) {
      return;
    }
    this.deleting.set(true);
    this.error.set(null);
    this.productsApi
      .delete(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.pendingDeleteId.set(null);
          this.load();
        },
        error: () => {
          this.deleting.set(false);
          this.error.set('Не вдалося видалити товар');
        },
      });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.productsApi
      .list(
        this.page(),
        this.pageSize,
        this.selectedTypeId(),
        this.searchTerm().trim() || null,
        this.stockSortOrder(),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const totalPages = Math.max(1, Math.ceil(response.total / this.pageSize));
          if (this.page() > totalPages) {
            this.page.set(totalPages);
            this.load();
            return;
          }
          this.loading.set(false);
          this.products.set(response.items);
          this.total.set(response.total);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Не вдалося завантажити список товарів');
        },
      });
  }
}
