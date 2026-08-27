import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { DictionariesService } from '../../../../core/dictionaries/dictionaries.service';
import { OrdersDetail } from './orders-detail';

describe('OrdersDetail', () => {
  let fixture: ComponentFixture<OrdersDetail>;
  let el: HTMLElement;
  let httpMock: HttpTestingController;
  let router: Router;
  const ordersUrl = `${environment.apiUrl}/orders`;
  const sendersUrl = `${environment.apiUrl}/senders`;

  const dictionariesStub = {
    shipmentTypes: () => [{ id: 'st1', code: 'documents', label: 'Документи' }],
    paymentTypes: () => [{ id: 'pt1', code: 'cod', label: 'Післяплата' }],
    deliveryTypes: () => [{ id: 'dt1', code: 'warehouse', label: 'Відділення' }],
    productTypes: () => [{ id: 'prt1', code: 'sticker', label: 'Наклейка', isCustom: false }],
    shipmentStatuses: () => [
      { id: 'ss-shipped', code: 'shipped', label: 'Відправлено' },
      { id: 'ss-delivered', code: 'delivered', label: 'Доставлено' },
      { id: 'ss-received', code: 'received', label: 'Отримано' },
      { id: 'ss-refused', code: 'refused', label: 'Відмовлено' },
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
    isPacked: false,
    isOutOfStock: false,
    createdAt: '2026-08-22T09:14:00.000Z',
    updatedAt: '2026-08-22T09:14:00.000Z',
    ...overrides,
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
      imports: [OrdersDetail],
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
    fixture = TestBed.createComponent(OrdersDetail);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  };

  const flushOrder = (overrides: Partial<Record<string, unknown>> = {}) => {
    httpMock.expectOne(`${ordersUrl}/9`).flush(order(overrides));
    fixture.detectChanges();
  };

  const flushSenderLookups = () => {
    httpMock.expectOne(`${sendersUrl}?page=1&pageSize=100`).flush({ items: [sender()], total: 1 });
    httpMock.expectOne(`${sendersUrl}/s1/addresses`).flush([{ npAddressRef: 'addr-1', description: 'Склад №1' }]);
    fixture.detectChanges();
  };

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches the order and renders shipment/payment/item/recipient fields', () => {
    create();
    flushOrder();
    flushSenderLookups();

    expect(el.querySelector('.page-title')?.textContent).toContain('20450182773641');
    expect(el.querySelectorAll('.detail-row-value')[0].textContent?.trim()).toBe('Документи');
    expect(el.querySelectorAll('.detail-row-value')[1].textContent?.trim()).toBe('Післяплата');
    expect(el.querySelector('.data-table tbody')?.textContent).toContain('Наклейка');
    expect(el.querySelector('.data-table tbody')?.textContent).toContain('Наклейка «Кіт»');
    expect(el.querySelector('.data-table tbody')?.textContent).toContain('300 ₴');
  });

  it('shows the sender name/phone and resolved sender-address label once loaded', () => {
    create();
    flushOrder();
    flushSenderLookups();

    const senderPanel = Array.from(el.querySelectorAll('.info-panel')).find((p) =>
      p.querySelector('.field-label')?.textContent?.trim() === 'Відправник',
    );
    expect(senderPanel?.textContent).toContain('ФОП Волошин О.М.');
    expect(senderPanel?.textContent).toContain('+380671112233');
    expect(senderPanel?.textContent).toContain('Склад №1');
  });

  it('falls back to the raw address ref when no matching sender address is found', () => {
    create();
    flushOrder();
    httpMock.expectOne(`${sendersUrl}?page=1&pageSize=100`).flush({ items: [sender()], total: 1 });
    httpMock.expectOne(`${sendersUrl}/s1/addresses`).flush([]);
    fixture.detectChanges();

    const senderPanel = Array.from(el.querySelectorAll('.info-panel')).find((p) =>
      p.querySelector('.field-label')?.textContent?.trim() === 'Відправник',
    );
    expect(senderPanel?.textContent).toContain('addr-1');
  });

  it.each([
    ['ss-shipped', 'Відправлено', 'badge-info'],
    ['ss-delivered', 'Доставлено', 'status-badge--success'],
    ['ss-received', 'Отримано', 'status-badge--muted'],
    ['ss-refused', 'Відмовлено', 'status-badge--danger'],
  ])('renders the %s status as "%s" with class %s', (statusId, label, expectedClass) => {
    create();
    flushOrder({ shipmentStatusId: statusId });
    flushSenderLookups();

    const badge = el.querySelector('.order-status-badge');
    expect(badge?.textContent?.trim()).toBe(label);
    expect(badge?.classList.contains(expectedClass)).toBe(true);
  });

  it('shows no status badge when shipmentStatusId is null', () => {
    create();
    flushOrder({ shipmentStatusId: null });
    flushSenderLookups();

    expect(el.querySelector('.order-status-badge')).toBeNull();
  });

  it('renders the isPacked/isOutOfStock checkboxes reflecting the loaded order', () => {
    create();
    flushOrder({ isPacked: true, isOutOfStock: false });
    flushSenderLookups();

    const checkboxes = Array.from(el.querySelectorAll('.status-flags input[type="checkbox"]')) as HTMLInputElement[];
    expect(checkboxes[0].checked).toBe(true);
    expect(checkboxes[1].checked).toBe(false);
  });

  it('toggles isPacked via PATCH /orders/:id/status-flags and reflects the server response', () => {
    create();
    flushOrder({ isPacked: false });
    flushSenderLookups();

    const [packedCheckbox] = Array.from(el.querySelectorAll('.status-flags input[type="checkbox"]')) as HTMLInputElement[];
    packedCheckbox.click();

    const req = httpMock.expectOne(`${ordersUrl}/9/status-flags`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ isPacked: true });
    req.flush(order({ isPacked: true }));
    fixture.detectChanges();

    expect((el.querySelectorAll('.status-flags input[type="checkbox"]')[0] as HTMLInputElement).checked).toBe(true);
  });

  it('toggles isOutOfStock independently from isPacked', () => {
    create();
    flushOrder({ isPacked: true, isOutOfStock: false });
    flushSenderLookups();

    const [, outOfStockCheckbox] = Array.from(el.querySelectorAll('.status-flags input[type="checkbox"]')) as HTMLInputElement[];
    outOfStockCheckbox.click();

    const req = httpMock.expectOne(`${ordersUrl}/9/status-flags`);
    expect(req.request.body).toEqual({ isOutOfStock: true });
    req.flush(order({ isPacked: true, isOutOfStock: true }));
  });

  it('shows an error and does not flip the checkbox state when the status-flags update fails', () => {
    create();
    flushOrder({ isPacked: false });
    flushSenderLookups();

    const [packedCheckbox] = Array.from(el.querySelectorAll('.status-flags input[type="checkbox"]')) as HTMLInputElement[];
    packedCheckbox.click();
    httpMock.expectOne(`${ordersUrl}/9/status-flags`).flush('boom', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(el.querySelector('.status-flags')?.parentElement?.querySelector('.error-text')?.textContent?.trim()).toBe(
      'Не вдалося оновити статус замовлення',
    );
    expect((el.querySelectorAll('.status-flags input[type="checkbox"]')[0] as HTMLInputElement).checked).toBe(false);
  });

  it('shows a rate-limit message when a status-flags update is throttled (429)', () => {
    create();
    flushOrder({ isPacked: false });
    flushSenderLookups();

    const [packedCheckbox] = Array.from(el.querySelectorAll('.status-flags input[type="checkbox"]')) as HTMLInputElement[];
    packedCheckbox.click();
    httpMock
      .expectOne(`${ordersUrl}/9/status-flags`)
      .flush('err', { status: 429, statusText: 'Too Many Requests' });
    fixture.detectChanges();

    expect(el.querySelector('.status-flags')?.parentElement?.querySelector('.error-text')?.textContent?.trim()).toBe(
      'Забагато спроб — спробуйте пізніше',
    );
  });

  it('ignores a second toggle click while one is already in flight', () => {
    create();
    flushOrder({ isPacked: false, isOutOfStock: false });
    flushSenderLookups();

    const [packedCheckbox, outOfStockCheckbox] = Array.from(
      el.querySelectorAll('.status-flags input[type="checkbox"]'),
    ) as HTMLInputElement[];
    packedCheckbox.click();
    outOfStockCheckbox.click();

    httpMock.expectOne(`${ordersUrl}/9/status-flags`).flush(order({ isPacked: true }));
    httpMock.expectNone(`${ordersUrl}/9/status-flags`);
  });

  it('shows an error message when loading the order fails', () => {
    create();
    httpMock.expectOne(`${ordersUrl}/9`).flush('boom', { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(el.querySelector('.error-text')?.textContent?.trim()).toBe('Не вдалося завантажити дані замовлення');
  });

  it('navigates to the edit page on "Редагувати"', () => {
    create();
    flushOrder();
    flushSenderLookups();

    (el.querySelector('.btn-ghost') as HTMLButtonElement).click();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/orders/9/edit');
  });

  it('navigates back to the list on breadcrumb click', () => {
    create();
    flushOrder();
    flushSenderLookups();

    (el.querySelector('.breadcrumb') as HTMLButtonElement).click();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/orders');
  });

  it('builds a delete-confirm message mentioning waybill cancellation and itemized restock', () => {
    create();
    flushOrder();
    flushSenderLookups();

    (el.querySelector('.btn-outline-danger') as HTMLButtonElement).click();
    fixture.detectChanges();

    const message = el.querySelector('.dialog-message')?.textContent ?? '';
    expect(message).toContain('20450182773641');
    expect(message).toContain('скасовано в Новій Пошті');
    expect(message).toContain('Наклейка «Кіт» +3 шт');
  });

  it('omits the waybill-cancellation clause when no waybill exists, and the restock clause when no stock-tracked items exist', () => {
    create();
    flushOrder({
      npWaybillNumber: null,
      items: [{ productId: null, productTypeId: 'prt1', nameSnapshot: 'Кастом', photoUrlSnapshot: null, price: 50, isPromo: false, quantity: 1, subtotal: 50 }],
    });
    flushSenderLookups();

    (el.querySelector('.btn-outline-danger') as HTMLButtonElement).click();
    fixture.detectChanges();

    const message = el.querySelector('.dialog-message')?.textContent ?? '';
    expect(message).not.toContain('Нової Пошті');
    expect(message).not.toContain('повернуться на склад');
  });

  it('deletes the order on confirm and navigates back to the list', () => {
    create();
    flushOrder();
    flushSenderLookups();

    (el.querySelector('.btn-outline-danger') as HTMLButtonElement).click();
    fixture.detectChanges();
    (el.querySelector('.btn-destructive') as HTMLButtonElement).click();
    httpMock.expectOne(`${ordersUrl}/9`).flush(null);

    expect(router.navigateByUrl).toHaveBeenCalledWith('/orders');
  });

  it('shows a distinct message and stays on the page when delete returns 502 (order deleted, NP waybill cleanup failed)', () => {
    create();
    flushOrder();
    flushSenderLookups();

    (el.querySelector('.btn-outline-danger') as HTMLButtonElement).click();
    fixture.detectChanges();
    (el.querySelector('.btn-destructive') as HTMLButtonElement).click();
    httpMock.expectOne(`${ordersUrl}/9`).flush('boom', { status: 502, statusText: 'Bad Gateway' });
    fixture.detectChanges();

    expect(router.navigateByUrl).not.toHaveBeenCalledWith('/orders');
    expect(el.querySelector('.error-text')?.textContent).toContain('видалено з системи');
    expect(el.querySelector('.error-text')?.textContent).toContain('Скасуйте ЕН вручну');
  });

  it('closes the dialog without deleting on cancel', () => {
    create();
    flushOrder();
    flushSenderLookups();

    (el.querySelector('.btn-outline-danger') as HTMLButtonElement).click();
    fixture.detectChanges();
    (el.querySelector('.dialog-actions .btn-ghost') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelector('.dialog-overlay')).toBeNull();
    httpMock.expectNone(`${ordersUrl}/9`);
  });

  it('reloads a fresh order when the route param changes without the component being recreated', () => {
    const paramMap = new Subject<ReturnType<typeof convertToParamMap>>();
    TestBed.configureTestingModule({
      imports: [OrdersDetail],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: DictionariesService, useValue: dictionariesStub },
        { provide: ActivatedRoute, useValue: { paramMap } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(OrdersDetail);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;

    paramMap.next(convertToParamMap({ id: '9' }));
    httpMock.expectOne(`${ordersUrl}/9`).flush(order({ id: '9', npWaybillNumber: 'EN-9' }));
    fixture.detectChanges();
    httpMock.expectOne(`${sendersUrl}?page=1&pageSize=100`).flush({ items: [sender()], total: 1 });
    httpMock.expectOne(`${sendersUrl}/s1/addresses`).flush([]);
    fixture.detectChanges();
    expect(el.querySelector('.page-title')?.textContent).toContain('EN-9');

    paramMap.next(convertToParamMap({ id: '10' }));
    httpMock.expectOne(`${ordersUrl}/10`).flush(order({ id: '10', npWaybillNumber: 'EN-10' }));
    fixture.detectChanges();
    httpMock.expectOne(`${sendersUrl}?page=1&pageSize=100`).flush({ items: [sender()], total: 1 });
    httpMock.expectOne(`${sendersUrl}/s1/addresses`).flush([]);
    fixture.detectChanges();
    expect(el.querySelector('.page-title')?.textContent).toContain('EN-10');
  });

  it('cancels the in-flight request for a stale id when navigation moves on before it resolves', () => {
    const paramMap = new Subject<ReturnType<typeof convertToParamMap>>();
    TestBed.configureTestingModule({
      imports: [OrdersDetail],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: DictionariesService, useValue: dictionariesStub },
        { provide: ActivatedRoute, useValue: { paramMap } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(OrdersDetail);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;

    paramMap.next(convertToParamMap({ id: '9' }));
    const staleReq = httpMock.expectOne(`${ordersUrl}/9`);

    paramMap.next(convertToParamMap({ id: '10' }));
    httpMock.expectOne(`${ordersUrl}/10`).flush(order({ id: '10', npWaybillNumber: 'EN-10' }));
    fixture.detectChanges();
    httpMock.expectOne(`${sendersUrl}?page=1&pageSize=100`).flush({ items: [sender()], total: 1 });
    httpMock.expectOne(`${sendersUrl}/s1/addresses`).flush([]);
    fixture.detectChanges();

    expect(staleReq.cancelled).toBe(true);
    expect(el.querySelector('.page-title')?.textContent).toContain('EN-10');
  });
});
