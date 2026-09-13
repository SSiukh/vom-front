import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { environment } from '../../../../../environments/environment';
import { DictionariesService } from '../../../../core/dictionaries/dictionaries.service';
import { Dashboard } from './dashboard';

describe('Dashboard', () => {
  let fixture: ComponentFixture<Dashboard>;
  let el: HTMLElement;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/dashboard`;

  const summary = (overrides: Partial<Record<string, unknown>> = {}) => ({
    totalRevenue: 38640,
    totalExpenses: 24180,
    profit: 14460,
    realizedRevenue: 38640,
    pendingRevenue: 0,
    lostRevenue: 0,
    sharedExpenses: null,
    orderCount: 42,
    revenueByDay: [
      { date: '2026-08-01', revenue: 1200 },
      { date: '2026-08-02', revenue: 800 },
    ],
    expensesByCategory: [
      { expenseTypeId: 't1', label: 'Доставка', amount: 15000 },
      { expenseTypeId: 't2', label: 'Інше', amount: 9180 },
    ],
    shipmentStatusBreakdown: [
      { shipmentStatusId: 's1', label: 'Відправлено', count: 10 },
      { shipmentStatusId: 's2', label: 'Доставлено', count: 30 },
      { shipmentStatusId: 's3', label: 'Відмовлено', count: 2 },
    ],
    ...overrides,
  });

  const dictionariesStub = {
    shipmentStatuses: () => [
      { id: 's1', code: 'shipped', label: 'Відправлено' },
      { id: 's2', code: 'delivered', label: 'Доставлено' },
      { id: 's3', code: 'refused', label: 'Відмовлено' },
      { id: 's4', code: 'redirected', label: 'Переадресовано' },
    ],
  };

  const create = () => {
    TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideCharts(withDefaultRegisterables()),
        { provide: DictionariesService, useValue: dictionariesStub },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  };

  const flush = (overrides: Partial<Record<string, unknown>> = {}, url = baseUrl) => {
    httpMock.expectOne(url).flush(summary(overrides));
    fixture.detectChanges();
  };

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches the summary on init with no query params and renders the metric cards', () => {
    create();
    flush();

    const values = Array.from(el.querySelectorAll('.metric-value')).map((v) => v.textContent?.trim());
    expect(values).toEqual(['38640 ₴', '24180 ₴', '14460 ₴', '42']);
  });

  it('shows profit in the negative-styled class when profit is below zero', () => {
    create();
    flush({ profit: -500 });

    const profitValue = el.querySelectorAll('.metric-value')[2];
    expect(profitValue.classList.contains('metric-value--negative')).toBe(true);
  });

  it('computes and shows profit margin and average order value from real response fields', () => {
    create();
    flush();

    const hints = Array.from(el.querySelectorAll('.metric-card__hint')).map((h) => h.textContent?.trim());
    expect(hints).toContain('маржа 37.4%');
    expect(hints).toContain('середній чек 920 ₴');
  });

  it('hides the margin/average hints when their denominator is zero, instead of dividing by zero', () => {
    create();
    flush({ realizedRevenue: 0, orderCount: 0, profit: 0 });

    const hints = Array.from(el.querySelectorAll('.metric-card__hint')).map((h) => h.textContent?.trim());
    expect(hints.some((h) => h?.startsWith('маржа'))).toBe(false);
    expect(hints.some((h) => h?.startsWith('середній чек'))).toBe(false);
  });

  it('bases profit margin on realizedRevenue, not the gross totalRevenue', () => {
    create();
    flush({ totalRevenue: 100000, realizedRevenue: 10000, profit: 5000 });

    const hints = Array.from(el.querySelectorAll('.metric-card__hint')).map((h) => h.textContent?.trim());
    expect(hints).toContain('маржа 50%');
  });

  it('always shows a hint that profit is computed from realized revenue', () => {
    create();
    flush();

    expect(el.textContent).toContain('на основі реалізованого доходу');
  });

  it('shows realized/pending revenue hints under total revenue', () => {
    create();
    flush({ realizedRevenue: 12000, pendingRevenue: 6000 });

    const hints = Array.from(el.querySelectorAll('.metric-card__hint')).map((h) => h.textContent?.trim());
    expect(hints).toContain('реалізовано: 12000 ₴');
    expect(hints).toContain('в очікуванні: 6000 ₴');
  });

  it('shows no lost-revenue hint when nothing was refused', () => {
    create();
    flush({ lostRevenue: 0 });

    const hints = Array.from(el.querySelectorAll('.metric-card__hint')).map((h) => h.textContent?.trim());
    expect(hints.some((h) => h?.startsWith('втрачено'))).toBe(false);
  });

  it('shows the lost-revenue hint with its negative styling when lostRevenue is greater than zero', () => {
    create();
    flush({ lostRevenue: 900 });

    const hint = Array.from(el.querySelectorAll('.metric-card__hint')).find((h) =>
      h.textContent?.trim().startsWith('втрачено'),
    );
    expect(hint?.textContent?.trim()).toBe('втрачено: 900 ₴');
    expect(hint?.classList.contains('metric-card__hint--negative')).toBe(true);
  });

  it('resolves each shipment-status legend swatch color via the dictionary code, not the raw shipmentStatusId', () => {
    create();
    flush();

    const legends = el.querySelectorAll('.chart-legend');
    const shipmentLegend = legends[1];
    const swatches = Array.from(shipmentLegend.querySelectorAll('.chart-legend__swatch')) as HTMLElement[];

    expect(swatches[0].style.background).toBe('rgb(232, 135, 30)');
    expect(swatches[1].style.background).toBe('rgb(110, 162, 221)');
    expect(swatches[2].style.background).toBe('rgb(224, 117, 93)');
  });

  it('resolves the "redirected" status to its own yellow swatch color', () => {
    create();
    flush({
      shipmentStatusBreakdown: [{ shipmentStatusId: 's4', label: 'Переадресовано', count: 1 }],
    });

    const shipmentLegend = el.querySelectorAll('.chart-legend')[1];
    const swatch = shipmentLegend.querySelector('.chart-legend__swatch') as HTMLElement;
    expect(swatch.style.background).toBe('rgb(219, 184, 102)');
  });

  it('falls back to the default color for a shipmentStatusId with no matching dictionary entry, independently of a real neighboring status', () => {
    create();
    flush({
      shipmentStatusBreakdown: [
        { shipmentStatusId: 'unknown-id', label: 'Хз', count: 1 },
        { shipmentStatusId: 's2', label: 'Доставлено', count: 1 },
      ],
    });

    const shipmentLegend = el.querySelectorAll('.chart-legend')[1];
    const swatches = Array.from(shipmentLegend.querySelectorAll('.chart-legend__swatch')) as HTMLElement[];
    expect(swatches[0].style.background).toBe('rgb(232, 135, 30)');
    expect(swatches[1].style.background).toBe('rgb(110, 162, 221)');
  });

  it('shows an empty-data message instead of a chart when a breakdown array is empty', () => {
    create();
    flush({ revenueByDay: [], expensesByCategory: [], shipmentStatusBreakdown: [] });

    expect(el.textContent).toContain('Немає даних за обраний період');
    expect(el.textContent).toContain('Немає витрат за обраний період');
    expect(el.textContent).toContain('Немає замовлень за обраний період');
    expect(el.querySelectorAll('canvas').length).toBe(0);
  });

  it('renders a legend row per expense category with a percentage of the category total', () => {
    create();
    flush();

    const rows = Array.from(el.querySelectorAll('.chart-legend')[0].querySelectorAll('.chart-legend__item'));
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Доставка');
    expect(rows[0].textContent).toContain('15000 ₴');
    expect(rows[0].textContent).toContain('62%');
  });

  it('refetches with dateFrom/dateTo when the date filters change', () => {
    create();
    flush();

    const [fromInput, toInput] = Array.from(el.querySelectorAll('input[type="date"]')) as HTMLInputElement[];
    fromInput.value = '2026-08-01';
    fromInput.dispatchEvent(new Event('change'));
    flush({}, `${baseUrl}?dateFrom=2026-08-01`);

    toInput.value = '2026-08-22';
    toInput.dispatchEvent(new Event('change'));
    flush({}, `${baseUrl}?dateFrom=2026-08-01&dateTo=2026-08-22`);
  });

  it('refetches with brand=vom/m when the group filter chips are clicked, and drops it again on "Усі"', () => {
    create();
    flush();

    const [allChip, vomChip, mChip] = Array.from(
      el.querySelectorAll('.date-field .segmented-control__item'),
    ) as HTMLButtonElement[];

    vomChip.click();
    flush({}, `${baseUrl}?brand=vom`);
    expect(vomChip.classList.contains('segmented-control__item--active')).toBe(true);
    expect(allChip.classList.contains('segmented-control__item--active')).toBe(false);

    mChip.click();
    flush({}, `${baseUrl}?brand=m`);
    expect(mChip.classList.contains('segmented-control__item--active')).toBe(true);

    allChip.click();
    flush({}, baseUrl);
    expect(allChip.classList.contains('segmented-control__item--active')).toBe(true);
  });

  it('shows the shared-expenses hint next to expenses and profit only when a group filter is active', () => {
    create();
    flush({ sharedExpenses: 830 });

    const hints = Array.from(el.querySelectorAll('.metric-card__hint')).map((h) => h.textContent?.trim());
    expect(hints).toContain('спільні витрати: 830 ₴');
    expect(hints).toContain('без спільних витрат');
  });

  it('shows the shared-expenses hint even when sharedExpenses is exactly 0, not just when truthy', () => {
    create();
    flush({ sharedExpenses: 0 });

    const hints = Array.from(el.querySelectorAll('.metric-card__hint')).map((h) => h.textContent?.trim());
    expect(hints).toContain('спільні витрати: 0 ₴');
    expect(hints).toContain('без спільних витрат');
  });

  it('shows no shared-expenses hint when sharedExpenses is null (no group filter applied)', () => {
    create();
    flush();

    const hints = Array.from(el.querySelectorAll('.metric-card__hint')).map((h) => h.textContent?.trim());
    expect(hints.some((h) => h?.includes('спільні витрати'))).toBe(false);
    expect(hints).not.toContain('без спільних витрат');
  });

  it('shows an error message when the request fails', () => {
    create();
    httpMock.expectOne(baseUrl).flush('boom', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(el.querySelector('.error-text')?.textContent?.trim()).toBe('Не вдалося завантажити аналітику');
  });
});
