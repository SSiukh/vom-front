import { Component, computed, input, output } from '@angular/core';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';

type PageItem = number | 'ellipsis';

@Component({
  selector: 'app-pagination',
  imports: [LucideChevronLeft, LucideChevronRight],
  templateUrl: './pagination.html',
  styleUrl: './pagination.css',
})
export class Pagination {
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly total = input.required<number>();

  readonly pageChange = output<number>();

  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  protected readonly rangeStart = computed(() =>
    this.total() === 0 ? 0 : (this.page() - 1) * this.pageSize() + 1,
  );
  protected readonly rangeEnd = computed(() => Math.min(this.page() * this.pageSize(), this.total()));

  protected readonly pageItems = computed<PageItem[]>(() => {
    const totalPages = this.totalPages();
    const current = this.page();

    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const items: PageItem[] = [1];
    if (current > 3) {
      items.push('ellipsis');
    }

    const start = Math.max(2, current - 1);
    const end = Math.min(totalPages - 1, current + 1);
    for (let i = start; i <= end; i++) {
      items.push(i);
    }

    if (current < totalPages - 2) {
      items.push('ellipsis');
    }
    items.push(totalPages);

    return items;
  });

  goToPage(page: number): void {
    if (page !== this.page() && page >= 1 && page <= this.totalPages()) {
      this.pageChange.emit(page);
    }
  }

  previous(): void {
    this.goToPage(this.page() - 1);
  }

  next(): void {
    this.goToPage(this.page() + 1);
  }
}
