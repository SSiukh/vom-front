import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import type { CreateOrderPayload } from '../../features/orders/models/order.model';
import { REQUEST_TIMEOUT_MS } from '../interceptors/request-timeout.interceptor';
import { OrdersApiService, type OrdersListFilters } from './orders-api.service';

describe('OrdersApiService', () => {
  let service: OrdersApiService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/orders`;

  const order = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: '1',
    shipmentTypeId: 'st1',
    paymentTypeId: 'pt1',
    partialAmount: null,
    totalAmount: 210,
    items: [],
    senderId: 's1',
    senderAddressRef: 'addr-1',
    recipient: { phone: '+380501234567', lastName: 'Іванов', firstName: 'Іван', middleName: null },
    deliveryTypeId: 'dt1',
    deliveryDetails: {
      cityRef: 'c1',
      warehouseRef: 'w1',
      streetRef: null,
      house: null,
      apartment: null,
      postomatRef: null,
    },
    npWaybillNumber: null,
    npWaybillRef: null,
    shipmentStatusId: null,
    isPacked: false,
    isOutOfStock: false,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  });

  const createPayload = (): CreateOrderPayload => ({
    shipmentTypeId: 'st1',
    paymentTypeId: 'pt1',
    items: [{ productTypeId: 'pt1', productId: 'p1', quantity: 2 }],
    senderId: 's1',
    senderAddressRef: 'addr-1',
    recipient: { phone: '+380501234567', lastName: 'Іванов', firstName: 'Іван' },
    deliveryTypeId: 'dt1',
    deliveryDetails: { cityRef: 'c1', warehouseRef: 'w1' },
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(OrdersApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  const noFilters = (): OrdersListFilters => ({
    dateFrom: null,
    dateTo: null,
    productTypeId: null,
    senderId: null,
    search: null,
  });

  it('gets a paginated list with page/pageSize and no filter params when unfiltered', () => {
    service.list(1, 10, noFilters()).subscribe();
    const req = httpMock.expectOne(`${baseUrl}?page=1&pageSize=10`);
    expect(req.request.method).toBe('GET');
    req.flush({ items: [], total: 0 });
  });

  it('includes dateFrom/dateTo when filtering', () => {
    service.list(1, 10, { ...noFilters(), dateFrom: '2026-01-01', dateTo: '2026-01-31' }).subscribe();
    const req = httpMock.expectOne(`${baseUrl}?page=1&pageSize=10&dateFrom=2026-01-01&dateTo=2026-01-31`);
    expect(req.request.method).toBe('GET');
    req.flush({ items: [], total: 0 });
  });

  it('includes productTypeId when filtering', () => {
    service.list(1, 10, { ...noFilters(), productTypeId: 't1' }).subscribe();
    const req = httpMock.expectOne(`${baseUrl}?page=1&pageSize=10&productTypeId=t1`);
    expect(req.request.method).toBe('GET');
    req.flush({ items: [], total: 0 });
  });

  it('includes senderId when filtering, and omits it entirely when null', () => {
    service.list(1, 10, { ...noFilters(), senderId: 's1' }).subscribe();
    const filtered = httpMock.expectOne(`${baseUrl}?page=1&pageSize=10&senderId=s1`);
    expect(filtered.request.method).toBe('GET');
    filtered.flush({ items: [], total: 0 });

    service.list(1, 10, noFilters()).subscribe();
    const unfiltered = httpMock.expectOne(`${baseUrl}?page=1&pageSize=10`);
    expect(unfiltered.request.params.has('senderId')).toBe(false);
    unfiltered.flush({ items: [], total: 0 });
  });

  it('sends search only when it is not empty', () => {
    service.list(1, 10, { ...noFilters(), search: 'Іваненко Іван' }).subscribe();
    const withSearch = httpMock.expectOne(
      `${baseUrl}?page=1&pageSize=10&search=%D0%86%D0%B2%D0%B0%D0%BD%D0%B5%D0%BD%D0%BA%D0%BE%20%D0%86%D0%B2%D0%B0%D0%BD`,
    );
    expect(withSearch.request.params.get('search')).toBe('Іваненко Іван');
    withSearch.flush({ items: [], total: 0 });

    service.list(1, 10, { ...noFilters(), search: '' }).subscribe();
    const emptySearch = httpMock.expectOne(`${baseUrl}?page=1&pageSize=10`);
    expect(emptySearch.request.params.has('search')).toBe(false);
    emptySearch.flush({ items: [], total: 0 });
  });

  it('combines every filter in one request', () => {
    service
      .list(2, 10, { dateFrom: '2026-01-01', dateTo: '2026-01-31', productTypeId: 't1', senderId: 's1', search: 'ivan' })
      .subscribe();
    const req = httpMock.expectOne(
      `${baseUrl}?page=2&pageSize=10&dateFrom=2026-01-01&dateTo=2026-01-31&productTypeId=t1&senderId=s1&search=ivan`,
    );
    expect(req.request.method).toBe('GET');
    req.flush({ items: [], total: 0 });
  });

  it('gets a single order by id', () => {
    service.get('1').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/1`);
    expect(req.request.method).toBe('GET');
    req.flush(order());
  });

  it('posts the create payload as JSON', () => {
    const payload = createPayload();
    service.create(payload).subscribe();
    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(order());
  });

  it('patches the update payload', () => {
    service.update('1', { items: [{ productTypeId: 'pt1', quantity: 3 }] }).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ items: [{ productTypeId: 'pt1', quantity: 3 }] });
    req.flush(order());
  });

  it('deletes /orders/:id', () => {
    service.delete('1').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('patches /orders/:id/status-flags with only the provided flags', () => {
    service.setStatusFlags('1', { isPacked: true }).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/1/status-flags`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ isPacked: true });
    req.flush(order({ isPacked: true }));
  });

  it('patches /orders/sync-statuses with no body and a longer request-timeout budget', () => {
    service.syncAllStatuses().subscribe();
    const req = httpMock.expectOne(`${baseUrl}/sync-statuses`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toBeNull();
    expect(req.request.context.get(REQUEST_TIMEOUT_MS)).toBe(90_000);
    req.flush({ totalOrders: 12, updatedCount: 5, unmappedCount: 1 });
  });
});
