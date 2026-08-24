import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { LucidePencil, LucidePlus, LucideTrash2 } from '@lucide/angular';
import { ExpensesApiService } from '../../../../core/api/expenses-api.service';
import { DictionariesService } from '../../../../core/dictionaries/dictionaries.service';
import { FEATURE_ROUTES } from '../../../../core/routes.constants';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import type { Expense } from '../../models/expense.model';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-expenses-list',
  imports: [DatePipe, Pagination, ConfirmDialog, LucidePlus, LucidePencil, LucideTrash2],
  templateUrl: './expenses-list.html',
  styleUrl: './expenses-list.css',
})
export class ExpensesList {
  private readonly expensesApi = inject(ExpensesApiService);
  protected readonly dictionaries = inject(DictionariesService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly expenses = signal<Expense[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = PAGE_SIZE;
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly pendingDeleteId = signal<string | null>(null);
  protected readonly deleting = signal(false);

  protected readonly typeLabelById = computed(() => {
    const map = new Map<string, string>();
    for (const type of this.dictionaries.expenseTypes()) {
      map.set(type.id, type.label);
    }
    return map;
  });

  protected readonly pendingDeleteExpense = computed(() => {
    const id = this.pendingDeleteId();
    return id ? (this.expenses().find((expense) => expense.id === id) ?? null) : null;
  });

  constructor() {
    this.load();
  }

  onPageChange(page: number): void {
    this.page.set(page);
    this.load();
  }

  goToCreate(): void {
    this.router.navigateByUrl(`${FEATURE_ROUTES.expenses}/new`);
  }

  goToEdit(expense: Expense): void {
    this.router.navigateByUrl(`${FEATURE_ROUTES.expenses}/${expense.id}/edit`);
  }

  typeLabel(expense: Expense): string {
    return this.typeLabelById().get(expense.typeId) ?? '';
  }

  deleteConfirmMessage(): string {
    const expense = this.pendingDeleteExpense();
    if (!expense) {
      return '';
    }
    const label = expense.name ?? this.typeLabel(expense);
    return `Витрату ${label} буде видалено. Цю дію неможливо скасувати.`;
  }

  requestDelete(expense: Expense): void {
    this.pendingDeleteId.set(expense.id);
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
    this.expensesApi
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
          this.error.set('Не вдалося видалити витрату');
        },
      });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.expensesApi
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
          this.expenses.set(response.items);
          this.total.set(response.total);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Не вдалося завантажити список витрат');
        },
      });
  }
}
