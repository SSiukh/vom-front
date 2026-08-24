import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideListChecks } from '@lucide/angular';
import { CrmApiService } from '../../../../core/api/crm-api.service';
import { DictionariesService } from '../../../../core/dictionaries/dictionaries.service';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import { shipmentStatusBadgeClass } from '../../../../shared/utils/shipment-status-badge.util';
import type { CrmRow } from '../../models/crm-row.model';

const PAGE_SIZE = 10;

type SortOrder = 'asc' | 'desc';

@Component({
  selector: 'app-crm-table',
  imports: [DatePipe, Pagination, LucideListChecks],
  templateUrl: './crm-table.html',
  styleUrl: './crm-table.css',
})
export class CrmTable {
  private readonly crmApi = inject(CrmApiService);
  protected readonly dictionaries = inject(DictionariesService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly rows = signal<CrmRow[]>([]);
  protected readonly total = signal(0);
  protected readonly totalAmountSum = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = PAGE_SIZE;
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly dateFrom = signal<string | null>(null);
  protected readonly dateTo = signal<string | null>(null);
  protected readonly productTypeId = signal<string | null>(null);
  protected readonly shipmentStatusId = signal<string | null>(null);
  protected readonly sortOrder = signal<SortOrder>('desc');

  protected readonly paymentTypeLabelById = computed(() => {
    const map = new Map<string, string>();
    for (const type of this.dictionaries.paymentTypes()) {
      map.set(type.id, type.label);
    }
    return map;
  });

  protected readonly productTypeLabelById = computed(() => {
    const map = new Map<string, string>();
    for (const type of this.dictionaries.productTypes()) {
      map.set(type.id, type.label);
    }
    return map;
  });

  protected readonly shipmentStatusLabelById = computed(() => {
    const map = new Map<string, string>();
    for (const status of this.dictionaries.shipmentStatuses()) {
      map.set(status.id, status.label);
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

  onShipmentStatusChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.shipmentStatusId.set(value || null);
    this.page.set(1);
    this.load();
  }

  setSortOrder(order: SortOrder): void {
    if (this.sortOrder() === order) {
      return;
    }
    this.sortOrder.set(order);
    this.page.set(1);
    this.load();
  }

  onPageChange(page: number): void {
    this.page.set(page);
    this.load();
  }

  paymentTypeLabel(row: CrmRow): string {
    return this.paymentTypeLabelById().get(row.paymentTypeId) ?? '';
  }

  productTypesLabel(row: CrmRow): string {
    return row.productTypeIds
      .map((id) => this.productTypeLabelById().get(id) ?? '')
      .filter((label) => label)
      .join(', ');
  }

  shipmentStatusLabel(row: CrmRow): string | null {
    if (!row.shipmentStatusId) {
      return null;
    }
    return this.shipmentStatusLabelById().get(row.shipmentStatusId) ?? null;
  }

  shipmentStatusClass(row: CrmRow): string {
    const code = this.dictionaries.shipmentStatuses().find((s) => s.id === row.shipmentStatusId)?.code;
    return shipmentStatusBadgeClass(code);
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.crmApi
      .list(this.page(), this.pageSize, {
        dateFrom: this.dateFrom(),
        dateTo: this.dateTo(),
        productTypeId: this.productTypeId(),
        shipmentStatusId: this.shipmentStatusId(),
        sortOrder: this.sortOrder(),
      })
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
          this.rows.set(response.items);
          this.total.set(response.total);
          this.totalAmountSum.set(response.totalAmountSum);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Не вдалося завантажити зведену таблицю');
        },
      });
  }
}
