import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import type { CreateOrderPayload } from '../../features/orders/models/order.model';
import { OrdersApiService } from './orders-api.service';

describe('OrdersApiService', () => {
  let service: OrdersApiService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/orders`;

  const order = () => ({
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
    createdAt: '',
    updatedAt: '',
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

  it('gets a paginated list with page/pageSize and no date params when unfiltered', () => {
    service.list(1, 10, null, null).subscribe();
    const req = httpMock.expectOne(`${baseUrl}?page=1&pageSize=10`);
    expect(req.request.method).toBe('GET');
    req.flush({ items: [], total: 0 });
  });

  it('includes dateFrom/dateTo when filtering', () => {
    service.list(1, 10, '2026-01-01', '2026-01-31').subscribe();
    const req = httpMock.expectOne(`${baseUrl}?page=1&pageSize=10&dateFrom=2026-01-01&dateTo=2026-01-31`);
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
});
