import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { LucideMapPin, LucidePlus, LucideRefreshCw, LucideUserX, LucideUsers } from '@lucide/angular';
import { SendersApiService } from '../../../../core/api/senders-api.service';
import { FEATURE_ROUTES } from '../../../../core/routes.constants';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import type { Sender, SetSenderWarehousePayload } from '../../models/sender.model';
import { SetWarehouseDialog } from './set-warehouse-dialog/set-warehouse-dialog';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-senders-list',
  imports: [
    Pagination,
    ConfirmDialog,
    SetWarehouseDialog,
    LucideMapPin,
    LucidePlus,
    LucideRefreshCw,
    LucideUserX,
    LucideUsers,
  ],
  templateUrl: './senders-list.html',
  styleUrl: './senders-list.css',
})
export class SendersList {
  private readonly sendersApi = inject(SendersApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly senders = signal<Sender[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = PAGE_SIZE;
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly refreshingId = signal<string | null>(null);
  protected readonly activatingId = signal<string | null>(null);
  protected readonly pendingDeactivateId = signal<string | null>(null);
  protected readonly deactivating = signal(false);
  protected readonly pendingWarehouseId = signal<string | null>(null);
  protected readonly settingWarehouse = signal(false);
  protected readonly warehouseErrorMessage = signal<string | null>(null);

  protected readonly pendingDeactivateSender = computed(() => {
    const id = this.pendingDeactivateId();
    return id ? (this.senders().find((sender) => sender.id === id) ?? null) : null;
  });

  protected readonly pendingWarehouseSender = computed(() => {
    const id = this.pendingWarehouseId();
    return id ? (this.senders().find((sender) => sender.id === id) ?? null) : null;
  });

  constructor() {
    this.load();
  }

  onPageChange(page: number): void {
    this.page.set(page);
    this.load();
  }

  goToCreate(): void {
    this.router.navigateByUrl(`${FEATURE_ROUTES.senders}/new`);
  }

  activate(sender: Sender): void {
    if (sender.isActive || this.activatingId() !== null) {
      return;
    }
    this.activatingId.set(sender.id);
    this.error.set(null);
    this.sendersApi
      .activate(sender.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.activatingId.set(null);
          this.load();
        },
        error: (error: unknown) => {
          this.activatingId.set(null);
          this.error.set(this.resolveErrorMessage(error, 'Не вдалося активувати відправника'));
        },
      });
  }

  refresh(sender: Sender): void {
    if (this.refreshingId() !== null) {
      return;
    }
    this.refreshingId.set(sender.id);
    this.error.set(null);
    this.sendersApi
      .refresh(sender.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.refreshingId.set(null);
          this.senders.update((list) => list.map((s) => (s.id === updated.id ? updated : s)));
        },
        error: (error: unknown) => {
          this.refreshingId.set(null);
          this.error.set(this.resolveErrorMessage(error, 'Не вдалося оновити дані відправника'));
        },
      });
  }

  requestDeactivate(sender: Sender): void {
    this.pendingDeactivateId.set(sender.id);
  }

  cancelDeactivate(): void {
    this.pendingDeactivateId.set(null);
  }

  confirmDeactivate(): void {
    const id = this.pendingDeactivateId();
    if (!id || this.deactivating()) {
      return;
    }
    this.deactivating.set(true);
    this.error.set(null);
    this.sendersApi
      .deactivate(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deactivating.set(false);
          this.pendingDeactivateId.set(null);
          this.load();
        },
        error: (error: unknown) => {
          this.deactivating.set(false);
          this.error.set(this.resolveErrorMessage(error, 'Не вдалося деактивувати відправника'));
        },
      });
  }

  requestSetWarehouse(sender: Sender): void {
    this.warehouseErrorMessage.set(null);
    this.pendingWarehouseId.set(sender.id);
  }

  cancelSetWarehouse(): void {
    this.pendingWarehouseId.set(null);
  }

  confirmSetWarehouse(payload: SetSenderWarehousePayload): void {
    const id = this.pendingWarehouseId();
    if (!id || this.settingWarehouse()) {
      return;
    }
    this.settingWarehouse.set(true);
    this.warehouseErrorMessage.set(null);
    this.sendersApi
      .setWarehouse(id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.settingWarehouse.set(false);
          this.pendingWarehouseId.set(null);
          this.senders.update((list) => list.map((s) => (s.id === updated.id ? updated : s)));
        },
        error: (error: unknown) => {
          this.settingWarehouse.set(false);
          this.warehouseErrorMessage.set(
            this.resolveErrorMessage(error, 'Не вдалося змінити відділення відправки'),
          );
        },
      });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.sendersApi
      .list(this.page(), this.pageSize)
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
          this.senders.set(response.items);
          this.total.set(response.total);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Не вдалося завантажити список відправників');
        },
      });
  }

  private resolveErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse && error.status === 429) {
      return 'Забагато спроб — спробуйте пізніше';
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
    return fallback;
  }
}
