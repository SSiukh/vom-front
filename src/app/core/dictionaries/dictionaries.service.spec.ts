import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { DictionariesService } from './dictionaries.service';

describe('DictionariesService', () => {
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/dictionaries`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches every dictionary collection once on construction and caches it in signals', () => {
    const service = TestBed.inject(DictionariesService);

    httpMock
      .expectOne(`${baseUrl}/order-types`)
      .flush([{ id: '1', code: 'standard', label: 'Стандартне' }]);
    httpMock
      .expectOne(`${baseUrl}/shipment-types`)
      .flush([{ id: '1', code: 'np', label: 'Нова Пошта', isDefault: true }]);
    httpMock
      .expectOne(`${baseUrl}/product-types`)
      .flush([{ id: '1', code: 'sticker', label: 'Наклейка', isCustom: false }]);
    httpMock
      .expectOne(`${baseUrl}/payment-types`)
      .flush([{ id: '1', code: 'full', label: 'Повна оплата' }]);
    httpMock
      .expectOne(`${baseUrl}/expense-types`)
      .flush([{ id: '1', code: 'other', label: 'Інше', requiresName: true }]);
    httpMock
      .expectOne(`${baseUrl}/delivery-types`)
      .flush([{ id: '1', code: 'warehouse', label: 'Відділення' }]);
    httpMock
      .expectOne(`${baseUrl}/shipment-statuses`)
      .flush([{ id: '1', code: 'created', label: 'Створено' }]);

    expect(service.orderTypes()).toEqual([{ id: '1', code: 'standard', label: 'Стандартне' }]);
    expect(service.shipmentTypes()).toEqual([
      { id: '1', code: 'np', label: 'Нова Пошта', isDefault: true },
    ]);
    expect(service.productTypes()).toEqual([
      { id: '1', code: 'sticker', label: 'Наклейка', isCustom: false },
    ]);
    expect(service.paymentTypes()).toEqual([{ id: '1', code: 'full', label: 'Повна оплата' }]);
    expect(service.expenseTypes()).toEqual([
      { id: '1', code: 'other', label: 'Інше', requiresName: true },
    ]);
    expect(service.deliveryTypes()).toEqual([{ id: '1', code: 'warehouse', label: 'Відділення' }]);
    expect(service.shipmentStatuses()).toEqual([{ id: '1', code: 'created', label: 'Створено' }]);
  });

  it('falls back to an empty array when a dictionary request fails', () => {
    const service = TestBed.inject(DictionariesService);

    httpMock
      .expectOne(`${baseUrl}/order-types`)
      .flush('server error', { status: 500, statusText: 'Server Error' });
    httpMock.expectOne(`${baseUrl}/shipment-types`).flush([]);
    httpMock.expectOne(`${baseUrl}/product-types`).flush([]);
    httpMock.expectOne(`${baseUrl}/payment-types`).flush([]);
    httpMock.expectOne(`${baseUrl}/expense-types`).flush([]);
    httpMock.expectOne(`${baseUrl}/delivery-types`).flush([]);
    httpMock.expectOne(`${baseUrl}/shipment-statuses`).flush([]);

    expect(service.orderTypes()).toEqual([]);
    expect(service.hasError()).toBe(true);
  });

  it('does not set hasError when every dictionary loads successfully', () => {
    const service = TestBed.inject(DictionariesService);

    httpMock.expectOne(`${baseUrl}/order-types`).flush([]);
    httpMock.expectOne(`${baseUrl}/shipment-types`).flush([]);
    httpMock.expectOne(`${baseUrl}/product-types`).flush([]);
    httpMock.expectOne(`${baseUrl}/payment-types`).flush([]);
    httpMock.expectOne(`${baseUrl}/expense-types`).flush([]);
    httpMock.expectOne(`${baseUrl}/delivery-types`).flush([]);
    httpMock.expectOne(`${baseUrl}/shipment-statuses`).flush([]);

    expect(service.hasError()).toBe(false);
  });

  it('reload() clears hasError and re-fetches every collection', () => {
    const service = TestBed.inject(DictionariesService);

    httpMock
      .expectOne(`${baseUrl}/order-types`)
      .flush('server error', { status: 500, statusText: 'Server Error' });
    httpMock.expectOne(`${baseUrl}/shipment-types`).flush([]);
    httpMock.expectOne(`${baseUrl}/product-types`).flush([]);
    httpMock.expectOne(`${baseUrl}/payment-types`).flush([]);
    httpMock.expectOne(`${baseUrl}/expense-types`).flush([]);
    httpMock.expectOne(`${baseUrl}/delivery-types`).flush([]);
    httpMock.expectOne(`${baseUrl}/shipment-statuses`).flush([]);
    expect(service.hasError()).toBe(true);

    service.reload();

    httpMock
      .expectOne(`${baseUrl}/order-types`)
      .flush([{ id: '1', code: 'standard', label: 'Стандартне' }]);
    httpMock.expectOne(`${baseUrl}/shipment-types`).flush([]);
    httpMock.expectOne(`${baseUrl}/product-types`).flush([]);
    httpMock.expectOne(`${baseUrl}/payment-types`).flush([]);
    httpMock.expectOne(`${baseUrl}/expense-types`).flush([]);
    httpMock.expectOne(`${baseUrl}/delivery-types`).flush([]);
    httpMock.expectOne(`${baseUrl}/shipment-statuses`).flush([]);

    expect(service.hasError()).toBe(false);
    expect(service.orderTypes()).toEqual([{ id: '1', code: 'standard', label: 'Стандартне' }]);
  });
});
