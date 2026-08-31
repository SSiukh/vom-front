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
    expect(hints).toEqual(['маржа 37.4%', 'середній чек 920 ₴']);
  });

  it('hides the margin/average hints when their denominator is zero, instead of dividing by zero', () => {
    create();
    flush({ totalRevenue: 0, orderCount: 0, profit: 0 });

    expect(el.querySelectorAll('.metric-card__hint').length).toBe(0);
  });

  it('resolves each shipment-status legend swatch color via the dictionary code, not the raw shipmentStatusId', () => {
    create();
    flush();

    const legends = el.querySelectorAll('.chart-legend');
    const shipmentLegend = legends[1];
    const swatches = Array.from(shipmentLegend.querySelectorAll('.chart-legend__swatch')) as HTMLElement[];

    expect(swatches[0].style.background).toBe('rgb(232, 135, 30)');
    expect(swatches[1].style.background).toBe('rgb(95, 174, 116)');
    expect(swatches[2].style.background).toBe('rgb(224, 117, 93)');
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
    expect(swatches[1].style.background).toBe('rgb(95, 174, 116)');
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

  it('shows an error message when the request fails', () => {
    create();
    httpMock.expectOne(baseUrl).flush('boom', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(el.querySelector('.error-text')?.textContent?.trim()).toBe('Не вдалося завантажити аналітику');
  });
});
