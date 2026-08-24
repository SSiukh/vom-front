import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { DictionariesApiService } from './dictionaries-api.service';

describe('DictionariesApiService', () => {
  let service: DictionariesApiService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/dictionaries`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DictionariesApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('gets /dictionaries/order-types', () => {
    service.getOrderTypes().subscribe();
    const req = httpMock.expectOne(`${baseUrl}/order-types`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: '1', code: 'standard', label: 'Стандартне' }]);
  });

  it('gets /dictionaries/shipment-types', () => {
    service.getShipmentTypes().subscribe();
    const req = httpMock.expectOne(`${baseUrl}/shipment-types`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: '1', code: 'np', label: 'Нова Пошта', isDefault: true }]);
  });

  it('gets /dictionaries/product-types', () => {
    service.getProductTypes().subscribe();
    const req = httpMock.expectOne(`${baseUrl}/product-types`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: '1', code: 'sticker', label: 'Наклейка', isCustom: false }]);
  });

  it('gets /dictionaries/payment-types', () => {
    service.getPaymentTypes().subscribe();
    const req = httpMock.expectOne(`${baseUrl}/payment-types`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: '1', code: 'full', label: 'Повна оплата' }]);
  });

  it('gets /dictionaries/expense-types', () => {
    service.getExpenseTypes().subscribe();
    const req = httpMock.expectOne(`${baseUrl}/expense-types`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: '1', code: 'other', label: 'Інше', requiresName: true }]);
  });

  it('gets /dictionaries/delivery-types', () => {
    service.getDeliveryTypes().subscribe();
    const req = httpMock.expectOne(`${baseUrl}/delivery-types`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: '1', code: 'warehouse', label: 'Відділення' }]);
  });

  it('gets /dictionaries/shipment-statuses', () => {
    service.getShipmentStatuses().subscribe();
    const req = httpMock.expectOne(`${baseUrl}/shipment-statuses`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: '1', code: 'created', label: 'Створено' }]);
  });
});
