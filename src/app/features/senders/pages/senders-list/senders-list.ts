import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { LucidePlus, LucideRefreshCw, LucideTrash2, LucideUsers } from '@lucide/angular';
import { SendersApiService } from '../../../../core/api/senders-api.service';
import { FEATURE_ROUTES } from '../../../../core/routes.constants';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import type { Sender } from '../../models/sender.model';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-senders-list',
  imports: [Pagination, ConfirmDialog, LucidePlus, LucideRefreshCw, LucideTrash2, LucideUsers],
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
  protected readonly pendingDeleteId = signal<string | null>(null);
  protected readonly deleting = signal(false);

  protected readonly pendingDeleteSender = computed(() => {
    const id = this.pendingDeleteId();
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

  requestDelete(sender: Sender): void {
    this.pendingDeleteId.set(sender.id);
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
    this.sendersApi
      .delete(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.pendingDeleteId.set(null);
          this.load();
        },
        error: (error: unknown) => {
          this.deleting.set(false);
          this.error.set(this.resolveErrorMessage(error, 'Не вдалося видалити відправника'));
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
    return fallback;
  }
}
