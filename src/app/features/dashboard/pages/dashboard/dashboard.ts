import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { DashboardApiService } from '../../../../core/api/dashboard-api.service';
import { DictionariesService } from '../../../../core/dictionaries/dictionaries.service';
import { DateFieldTriggerDirective } from '../../../../shared/directives/date-field-trigger.directive';
import type { DashboardSummary, ShipmentStatusBreakdown } from '../../models/dashboard-summary.model';

const EXPENSE_CATEGORY_COLORS = ['#e8871e', '#c76a12', '#f3c98a', '#9a9d9f'];

const SHIPMENT_STATUS_COLORS: Record<string, string> = {
  shipped: '#e8871e',
  delivered: '#5fae74',
  received: '#9a9d9f',
  refused: '#e0755d',
};

const CHART_GRID_COLOR = '#3a3f44';
const CHART_TICK_COLOR = '#83878b';

@Component({
  selector: 'app-dashboard',
  imports: [BaseChartDirective, DateFieldTriggerDirective],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  private readonly dashboardApi = inject(DashboardApiService);
  private readonly dictionaries = inject(DictionariesService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly summary = signal<DashboardSummary | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly dateFrom = signal<string | null>(null);
  protected readonly dateTo = signal<string | null>(null);

  protected readonly averageOrderValue = computed(() => {
    const summary = this.summary();
    if (!summary || summary.orderCount === 0) {
      return null;
    }
    return Math.round(summary.totalRevenue / summary.orderCount);
  });

  protected readonly profitMargin = computed(() => {
    const summary = this.summary();
    if (!summary || summary.totalRevenue === 0) {
      return null;
    }
    return Math.round((summary.profit / summary.totalRevenue) * 1000) / 10;
  });

  protected readonly revenueChartData = computed<ChartConfiguration<'line'>['data']>(() => {
    const days = this.summary()?.revenueByDay ?? [];
    return {
      labels: days.map((day) => day.date),
      datasets: [
        {
          data: days.map((day) => day.revenue),
          label: 'Дохід',
          borderColor: '#e8871e',
          backgroundColor: 'rgba(232, 135, 30, 0.14)',
          pointBackgroundColor: '#e8871e',
          pointRadius: 2,
          fill: true,
          tension: 0.3,
        },
      ],
    };
  });

  protected readonly revenueChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: CHART_TICK_COLOR }, grid: { color: CHART_GRID_COLOR } },
      y: { ticks: { color: CHART_TICK_COLOR }, grid: { color: CHART_GRID_COLOR } },
    },
  };

  protected readonly expensesChartData = computed<ChartConfiguration<'doughnut'>['data']>(() => {
    const categories = this.summary()?.expensesByCategory ?? [];
    return {
      labels: categories.map((category) => category.label),
      datasets: [
        {
          data: categories.map((category) => category.amount),
          backgroundColor: categories.map((_, index) => EXPENSE_CATEGORY_COLORS[index % EXPENSE_CATEGORY_COLORS.length]),
        },
      ],
    };
  });

  protected readonly shipmentStatusChartData = computed<ChartConfiguration<'doughnut'>['data']>(() => {
    const statuses = this.summary()?.shipmentStatusBreakdown ?? [];
    return {
      labels: statuses.map((status) => status.label),
      datasets: [
        {
          data: statuses.map((status) => status.count),
          backgroundColor: statuses.map((status) => this.shipmentStatusColor(status)),
        },
      ],
    };
  });

  protected readonly doughnutOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: { legend: { display: false } },
  };

  protected readonly expenseLegend = computed(() => this.buildLegend(this.summary()?.expensesByCategory ?? [], (c) => c.amount, EXPENSE_CATEGORY_COLORS));

  protected readonly shipmentStatusLegend = computed(() =>
    this.buildLegend(this.summary()?.shipmentStatusBreakdown ?? [], (s) => s.count, null, (s) => this.shipmentStatusColor(s)),
  );

  constructor() {
    this.load();
  }

  onDateFromChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.dateFrom.set(value || null);
    this.load();
  }

  onDateToChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.dateTo.set(value || null);
    this.load();
  }

  private shipmentStatusColor(status: ShipmentStatusBreakdown): string {
    const code = this.dictionaries.shipmentStatuses().find((s) => s.id === status.shipmentStatusId)?.code;
    return SHIPMENT_STATUS_COLORS[code ?? ''] ?? '#e8871e';
  }

  private buildLegend<T extends { label: string }>(
    items: T[],
    valueOf: (item: T) => number,
    palette: string[] | null,
    colorOf?: (item: T) => string,
  ): { label: string; value: number; percentage: number; color: string }[] {
    const total = items.reduce((sum, item) => sum + valueOf(item), 0);
    return items.map((item, index) => ({
      label: item.label,
      value: valueOf(item),
      percentage: total > 0 ? Math.round((valueOf(item) / total) * 1000) / 10 : 0,
      color: colorOf ? colorOf(item) : (palette?.[index % palette.length] ?? '#e8871e'),
    }));
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.dashboardApi
      .getSummary(this.dateFrom(), this.dateTo())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary) => {
          this.loading.set(false);
          this.summary.set(summary);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Не вдалося завантажити аналітику');
        },
      });
  }
}
