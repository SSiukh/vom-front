import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { CrmApiService, type CrmTableFilters } from './crm-api.service';

describe('CrmApiService', () => {
  let service: CrmApiService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/crm`;

  const baseFilters = (): CrmTableFilters => ({
    dateFrom: null,
    dateTo: null,
    productTypeId: null,
    shipmentStatusId: null,
    sortOrder: 'desc',
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CrmApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('requests the table with page/pageSize/sortOrder and no optional filters when unset', () => {
    service.list(1, 10, baseFilters()).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/table?page=1&pageSize=10&sortOrder=desc`);
    expect(req.request.method).toBe('GET');
    req.flush({ items: [], total: 0, totalAmountSum: 0 });
  });

  it('includes every optional filter when set', () => {
    service
      .list(2, 10, {
        dateFrom: '2026-08-01',
        dateTo: '2026-08-22',
        productTypeId: 'pt1',
        shipmentStatusId: 'ss1',
        sortOrder: 'asc',
      })
      .subscribe();
    const req = httpMock.expectOne(
      `${baseUrl}/table?page=2&pageSize=10&sortOrder=asc&dateFrom=2026-08-01&dateTo=2026-08-22&productTypeId=pt1&shipmentStatusId=ss1`,
    );
    expect(req.request.method).toBe('GET');
    req.flush({ items: [], total: 0, totalAmountSum: 0 });
  });
});
