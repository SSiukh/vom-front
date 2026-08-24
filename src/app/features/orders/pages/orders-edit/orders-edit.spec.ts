import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { DictionariesService } from '../../../../core/dictionaries/dictionaries.service';
import { OrdersEdit } from './orders-edit';

describe('OrdersEdit', () => {
  let fixture: ComponentFixture<OrdersEdit>;
  let el: HTMLElement;
  let httpMock: HttpTestingController;
  let router: Router;
  const ordersUrl = `${environment.apiUrl}/orders`;
  const sendersUrl = `${environment.apiUrl}/senders`;
  const productsUrl = `${environment.apiUrl}/products`;

  const dictionariesStub = {
    shipmentTypes: () => [
      { id: 'st1', code: 'documents', label: 'Документи' },
      { id: 'st2', code: 'parcel', label: 'Посилка' },
    ],
    paymentTypes: () => [
      { id: 'pt1', code: 'cod', label: 'Післяплата' },
      { id: 'pt2', code: 'partial', label: 'Часткова оплата' },
    ],
    productTypes: () => [
      { id: 'prt1', code: 'sticker', label: 'Наклейка', isCustom: false },
      { id: 'prt2', code: 'custom_sticker', label: 'Кастомна наклейка', isCustom: true },
    ],
  };

  const order = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: '9',
    shipmentTypeId: 'st1',
    paymentTypeId: 'pt1',
    partialAmount: null,
    totalAmount: 300,
    items: [
      {
        productId: 'p1',
        productTypeId: 'prt1',
        nameSnapshot: 'Наклейка «Кіт»',
        photoUrlSnapshot: 'https://cdn.example.com/cat.png',
        price: 100,
        isPromo: false,
        quantity: 3,
        subtotal: 300,
      },
    ],
    senderId: 's1',
    senderAddressRef: 'addr-1',
    recipient: { phone: '+380501234567', lastName: 'Петренко', firstName: 'Петро', middleName: null },
    deliveryTypeId: 'dt1',
    deliveryDetails: { cityRef: 'city-1', warehouseRef: 'w1', streetRef: null, house: null, apartment: null, postomatRef: null },
    npWaybillNumber: '20450182773641',
    npWaybillRef: 'ref-1',
    shipmentStatusId: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  });

  const product = () => ({
    id: 'p1',
    typeId: 'prt1',
    name: 'Наклейка «Кіт»',
    photoUrl: 'https://cdn.example.com/cat.png',
    price: 100,
    promoPrice: 80,
    stockQuantity: 12,
    createdAt: '',
    updatedAt: '',
  });

  const sender = () => ({
    id: 's1',
    fullName: 'ФОП Волошин О.М.',
    phone: '+380671112233',
    isActive: true,
    createdAt: '',
    updatedAt: '',
  });

  const create = () => {
    TestBed.configureTestingModule({
      imports: [OrdersEdit],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: DictionariesService, useValue: dictionariesStub },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '9' })) } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(OrdersEdit);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  };

  const flushAll = (orderOverrides: Partial<Record<string, unknown>> = {}) => {
    httpMock.expectOne(`${ordersUrl}/9`).flush(order(orderOverrides));
    fixture.detectChanges();
    httpMock.expectOne(`${productsUrl}/p1`).flush(product());
    httpMock.expectOne(`${productsUrl}?page=1&pageSize=100&typeId=prt1`).flush({ items: [product()], total: 1 });
    httpMock.expectOne(`${sendersUrl}?page=1&pageSize=100`).flush({ items: [sender()], total: 1 });
    httpMock.expectOne(`${sendersUrl}/s1/addresses`).flush([{ npAddressRef: 'addr-1', description: 'Склад №1' }]);
    fixture.detectChanges();
  };

  afterEach(() => {
    httpMock.verify();
  });

  it('hydrates the form and item hint from the loaded order', () => {
    create();
    flushAll();

    expect((el.querySelector('#shipmentTypeId') as HTMLSelectElement).value).toBe('st1');
    expect((el.querySelector('#paymentTypeId') as HTMLSelectElement).value).toBe('pt1');
    expect(el.querySelector('.item-card__subtotal')?.textContent?.trim()).toBe('300 ₴');
    expect(el.querySelector('.item-card__photo img')).not.toBeNull();
  });

  it('shows locked read-only sender/recipient/delivery info with lock icons, no editable controls', () => {
    create();
    flushAll();

    const lockedFields = el.querySelectorAll('.locked-field');
    expect(lockedFields.length).toBeGreaterThan(0);
    expect(Array.from(lockedFields).some((f) => f.textContent?.includes('ФОП Волошин'))).toBe(true);
    expect(Array.from(lockedFields).some((f) => f.textContent?.includes('Склад №1'))).toBe(true);
    expect(Array.from(lockedFields).some((f) => f.textContent?.includes('Петренко Петро'))).toBe(true);
  });

  it('shows the partial-amount field only for the partial payment type', () => {
    create();
    flushAll();
    expect(el.querySelector('#partialAmount')).toBeNull();

    const select = el.querySelector('#paymentTypeId') as HTMLSelectElement;
    select.value = 'pt2';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(el.querySelector('#partialAmount')).not.toBeNull();
  });

  it('shows an error message when loading the order fails', () => {
    create();
    httpMock.expectOne(`${ordersUrl}/9`).flush('boom', { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(el.querySelector('.error-text')?.textContent?.trim()).toBe('Не вдалося завантажити дані замовлення');
  });

  it('navigates back to the detail page on "Скасувати" and on breadcrumb click', () => {
    create();
    flushAll();

    (el.querySelector('.breadcrumb') as HTMLButtonElement).click();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/orders/9');
  });

  it('adds and removes item rows, keeping at least one', () => {
    create();
    flushAll();

    expect(el.querySelectorAll('app-order-item-card').length).toBe(1);
    (el.querySelector('.order-edit-main .btn-ghost') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelectorAll('app-order-item-card').length).toBe(2);

    expect(el.querySelector('.icon-action--danger')).not.toBeNull();
  });

  it('submits an UpdateOrderPayload with the current shipment/payment/partial/items values and navigates to detail on success', () => {
    create();
    flushAll();

    const saveButton = () => Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Зберегти')!;
    expect(saveButton().disabled).toBe(false);
    saveButton().click();

    const req = httpMock.expectOne(`${ordersUrl}/9`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({
      shipmentTypeId: 'st1',
      paymentTypeId: 'pt1',
      items: [{ productTypeId: 'prt1', productId: 'p1', quantity: 3, isPromo: false }],
    });
    req.flush(order());

    expect(router.navigateByUrl).toHaveBeenCalledWith('/orders/9');
  });

  it('shows a distinct message on a 502 (order updated, NP waybill update failed) without navigating away', () => {
    create();
    flushAll();

    (Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Зберегти') as HTMLButtonElement).click();
    httpMock.expectOne(`${ordersUrl}/9`).flush('boom', { status: 502, statusText: 'Bad Gateway' });
    fixture.detectChanges();

    expect(router.navigateByUrl).not.toHaveBeenCalledWith('/orders/9');
    expect(el.querySelector('.error-text')?.textContent).toContain('оновлено, але виникла помилка');
  });

  it('shows the server 400 validation message when saving fails', () => {
    create();
    flushAll();

    (Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Зберегти') as HTMLButtonElement).click();
    httpMock
      .expectOne(`${ordersUrl}/9`)
      .flush({ message: 'Not enough stock for product "Кіт"' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(el.querySelector('.error-text')?.textContent?.trim()).toBe('Not enough stock for product "Кіт"');
  });
});
