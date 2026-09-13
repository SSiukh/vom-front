import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
  LucideCalendar,
  LucideCircleAlert,
  LucidePackageCheck,
  LucidePackageOpen,
  LucidePlus,
  LucideRefreshCw,
} from '@lucide/angular';
import { OrdersApiService } from '../../../../core/api/orders-api.service';
import { DictionariesService } from '../../../../core/dictionaries/dictionaries.service';
import { FEATURE_ROUTES } from '../../../../core/routes.constants';
import { DateFieldTriggerDirective } from '../../../../shared/directives/date-field-trigger.directive';
import { CopyableText } from '../../../../shared/ui/copyable-text/copyable-text';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import { shipmentStatusBadgeClass } from '../../../../shared/utils/shipment-status-badge.util';
import type { BulkSyncStatusResult, Order } from '../../models/order.model';

const PAGE_SIZE = 10;

type SortOrder = 'newest' | 'oldest';

@Component({
  selector: 'app-orders-list',
  imports: [
    DatePipe,
    Pagination,
    DateFieldTriggerDirective,
    CopyableText,
    LucidePlus,
    LucideCalendar,
    LucidePackageOpen,
    LucidePackageCheck,
    LucideCircleAlert,
    LucideRefreshCw,
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
  protected readonly productTypeId = signal<string | null>(null);
  protected readonly sortOrder = signal<SortOrder>('newest');
  protected readonly syncing = signal(false);
  protected readonly syncResultMessage = signal<string | null>(null);

  protected readonly hasActiveFilters = computed(
    () => this.dateFrom() !== null || this.dateTo() !== null || this.productTypeId() !== null,
  );

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

  onProductTypeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.productTypeId.set(value || null);
    this.page.set(1);
    this.load();
  }

  setSortOrder(order: SortOrder): void {
    this.sortOrder.set(order);
  }

  resetFilters(): void {
    this.dateFrom.set(null);
    this.dateTo.set(null);
    this.productTypeId.set(null);
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

  onRowClick(event: Event, order: Order): void {
    if ((event.target as HTMLElement).closest('.copyable-text')) {
      return;
    }
    this.goToDetail(order);
  }

  onRowSpaceKey(event: Event, order: Order): void {
    if ((event.target as HTMLElement).closest('.copyable-text')) {
      return;
    }
    event.preventDefault();
    this.goToDetail(order);
  }

  itemsSummary(order: Order): string {
    return order.items.map((item) => `${item.nameSnapshot} ×${item.quantity}`).join(', ');
  }

  statusLabel(order: Order): string | null {
    if (!order.shipmentStatusId) {
      return null;
    }
    return this.dictionaries.shipmentStatuses().find((s) => s.id === order.shipmentStatusId)?.label ?? null;
  }

  statusBadgeClass(order: Order): string {
    const code = this.dictionaries.shipmentStatuses().find((s) => s.id === order.shipmentStatusId)?.code;
    return shipmentStatusBadgeClass(code);
  }

  syncAllStatuses(): void {
    if (this.syncing()) {
      return;
    }
    this.syncing.set(true);
    this.error.set(null);
    this.syncResultMessage.set(null);
    this.ordersApi
      .syncAllStatuses()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.syncing.set(false);
          this.syncResultMessage.set(this.buildSyncResultMessage(result));
          this.load();
        },
        error: (error: unknown) => {
          this.syncing.set(false);
          this.error.set(this.resolveSyncErrorMessage(error));
        },
      });
  }

  private buildSyncResultMessage(result: BulkSyncStatusResult): string {
    if (result.totalOrders === 0) {
      return 'Немає замовлень з номером ЕН для синхронізації';
    }
    const base = `Оновлено ${result.updatedCount} із ${result.totalOrders} замовлень`;
    return result.unmappedCount > 0 ? `${base}, ${result.unmappedCount} не вдалося визначити` : base;
  }

  private resolveSyncErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 429) {
      return 'Забагато спроб — спробуйте пізніше';
    }
    return 'Не вдалося синхронізувати статуси замовлень';
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.ordersApi
      .list(this.page(), this.pageSize, this.dateFrom(), this.dateTo(), this.productTypeId())
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
