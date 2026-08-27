import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { LucideCalendar, LucideCircleAlert, LucidePackageCheck, LucidePackageOpen, LucidePlus } from '@lucide/angular';
import { OrdersApiService } from '../../../../core/api/orders-api.service';
import { DictionariesService } from '../../../../core/dictionaries/dictionaries.service';
import { FEATURE_ROUTES } from '../../../../core/routes.constants';
import { DateFieldTriggerDirective } from '../../../../shared/directives/date-field-trigger.directive';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import type { Order } from '../../models/order.model';

const PAGE_SIZE = 10;

type SortOrder = 'newest' | 'oldest';

@Component({
  selector: 'app-orders-list',
  imports: [
    DatePipe,
    Pagination,
    DateFieldTriggerDirective,
    LucidePlus,
    LucideCalendar,
    LucidePackageOpen,
    LucidePackageCheck,
    LucideCircleAlert,
  ],
  templateUrl: './orders-list.html',
  styleUrl: './orders-list.css',
})
export class OrdersList {
  private readonly ordersApi = inject(OrdersApiService);
  protected readonly dictionaries = inject(DictionariesService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly orders = signal<Order[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = PAGE_SIZE;
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly dateFrom = signal<string | null>(null);
  protected readonly dateTo = signal<string | null>(null);
  protected readonly sortOrder = signal<SortOrder>('newest');

  protected readonly hasActiveFilters = computed(() => this.dateFrom() !== null || this.dateTo() !== null);

  protected readonly canSort = computed(() => this.total() <= this.pageSize);

  protected readonly displayedOrders = computed(() => {
    const orders = this.orders();
    return this.canSort() && this.sortOrder() === 'oldest' ? [...orders].reverse() : orders;
  });

  protected readonly paymentTypeLabelById = computed(() => {
    const map = new Map<string, string>();
    for (const type of this.dictionaries.paymentTypes()) {
      map.set(type.id, type.label);
    }
    return map;
  });

  constructor() {
    this.load();
  }

  onDateFromChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.dateFrom.set(value || null);
    this.page.set(1);
    this.load();
  }

  onDateToChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.dateTo.set(value || null);
    this.page.set(1);
    this.load();
  }

  setSortOrder(order: SortOrder): void {
    this.sortOrder.set(order);
  }

  resetFilters(): void {
    this.dateFrom.set(null);
    this.dateTo.set(null);
    this.sortOrder.set('newest');
    this.page.set(1);
    this.load();
  }

  onPageChange(page: number): void {
    this.page.set(page);
    this.load();
  }

  goToCreate(): void {
    this.router.navigateByUrl(`${FEATURE_ROUTES.orders}/new`);
  }

  goToDetail(order: Order): void {
    this.router.navigateByUrl(`${FEATURE_ROUTES.orders}/${order.id}`);
  }

  onRowSpaceKey(event: Event, order: Order): void {
    event.preventDefault();
    this.goToDetail(order);
  }

  itemsSummary(order: Order): string {
    return order.items.map((item) => `${item.nameSnapshot} ×${item.quantity}`).join(', ');
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.ordersApi
      .list(this.page(), this.pageSize, this.dateFrom(), this.dateTo())
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
          this.orders.set(response.items);
          this.total.set(response.total);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Не вдалося завантажити список замовлень');
        },
      });
  }
}
