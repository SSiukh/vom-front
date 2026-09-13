import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { DashboardApiService } from './dashboard-api.service';

describe('DashboardApiService', () => {
  let service: DashboardApiService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/dashboard`;

  const summary = () => ({
    totalRevenue: 38640,
    totalExpenses: 24180,
    profit: 14460,
    sharedExpenses: null,
    orderCount: 42,
    revenueByDay: [{ date: '2026-08-01', revenue: 1200 }],
    expensesByCategory: [{ expenseTypeId: 't1', label: 'Доставка', amount: 5000 }],
    shipmentStatusBreakdown: [{ shipmentStatusId: 's1', label: 'Доставлено', count: 20 }],
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DashboardApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('requests the summary with no query params when unfiltered', () => {
    service.getSummary(null, null, null).subscribe();
    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('GET');
    req.flush(summary());
  });

  it('includes dateFrom/dateTo when provided', () => {
    service.getSummary('2026-08-01', '2026-08-22', null).subscribe();
    const req = httpMock.expectOne(`${baseUrl}?dateFrom=2026-08-01&dateTo=2026-08-22`);
    expect(req.request.method).toBe('GET');
    req.flush(summary());
  });

  it('includes brand when provided, alongside the date filters', () => {
    service.getSummary('2026-08-01', '2026-08-22', 'vom').subscribe();
    const req = httpMock.expectOne(`${baseUrl}?dateFrom=2026-08-01&dateTo=2026-08-22&brand=vom`);
    expect(req.request.method).toBe('GET');
    req.flush(summary());
  });
});
