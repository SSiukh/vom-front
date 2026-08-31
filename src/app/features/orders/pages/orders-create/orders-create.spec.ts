import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { DictionariesService } from '../../../../core/dictionaries/dictionaries.service';
import { OrdersCreate } from './orders-create';

describe('OrdersCreate', () => {
  let fixture: ComponentFixture<OrdersCreate>;
  let el: HTMLElement;
  let httpMock: HttpTestingController;
  let router: Router;

  const sendersUrl = `${environment.apiUrl}/senders`;
  const ordersUrl = `${environment.apiUrl}/orders`;
  const novaPoshtaUrl = `${environment.apiUrl}/nova-poshta`;
  const productsUrl = `${environment.apiUrl}/products`;

  const dictionariesStub = {
    shipmentTypes: () => [
      { id: 'st-parcel', code: 'parcel', label: 'Посилка', isDefault: false },
      { id: 'st-docs', code: 'documents', label: 'Документи', isDefault: true },
    ],
    paymentTypes: () => [
      { id: 'pt-full', code: 'full', label: 'повна оплата' },
      { id: 'pt-cod', code: 'cod', label: 'післяплата' },
      { id: 'pt-partial', code: 'partial', label: 'часткова оплата' },
    ],
    productTypes: () => [
      { id: 'prt-sticker', code: 'sticker', label: 'Наклейка', isCustom: false },
      { id: 'prt-custom', code: 'custom_sticker', label: 'Кастомна наклейка', isCustom: true },
    ],
    deliveryTypes: () => [
      { id: 'dt-warehouse', code: 'warehouse', label: 'Відділення' },
      { id: 'dt-address', code: 'address', label: 'Адреса' },
      { id: 'dt-postomat', code: 'postomat', label: 'Поштомат' },
    ],
  };

  const sender = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: 's1',
    fullName: 'Іванов Іван',
    phone: '+380501234567',
    isActive: true,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  });

  const create = () => {
    TestBed.configureTestingModule({
      imports: [OrdersCreate],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: DictionariesService, useValue: dictionariesStub },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(OrdersCreate);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  };

  const flushActiveSender = (senderOverrides: Partial<Record<string, unknown>> = {}) => {
    httpMock.expectOne(`${sendersUrl}?page=1&pageSize=100`).flush({ items: [sender(senderOverrides)], total: 1 });
    fixture.detectChanges();
  };

  const flushNoActiveSender = () => {
    httpMock.expectOne(`${sendersUrl}?page=1&pageSize=100`).flush({ items: [], total: 0 });
    fixture.detectChanges();
  };

  const flushAddresses = (addresses: unknown[] = [{ npAddressRef: 'addr-1', description: 'Склад №1' }]) => {
    httpMock.expectOne(`${sendersUrl}/s1/addresses`).flush(addresses);
    fixture.detectChanges();
  };

  afterEach(() => {
    httpMock.verify();
  });

  it('defaults the shipment type to the dictionary entry marked isDefault', () => {
    create();
    flushActiveSender();
    flushAddresses();

    expect((el.querySelector('#shipmentTypeId') as HTMLSelectElement).value).toBe('st-docs');
  });

  it('starts with a single item row and keeps at least one row', () => {
    create();
    flushActiveSender();
    flushAddresses();

    expect(el.querySelectorAll('app-order-item-card').length).toBe(1);
    expect(el.querySelector('.icon-action--danger')).toBeNull();
  });

  it('adds a new item row when "Додати товар" is clicked', () => {
    create();
    flushActiveSender();
    flushAddresses();

    (el.querySelector('.wizard-main .btn-ghost') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelectorAll('app-order-item-card').length).toBe(2);
  });

  const selectValue = (select: HTMLSelectElement, value: string) => {
    select.value = value;
    select.dispatchEvent(new Event('change'));
  };

  const inputValue = (input: HTMLInputElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };

  it('disables "Далі" until step 1 is valid, and advances to step 2 once it is', () => {
    create();
    flushActiveSender();
    flushAddresses();

    const nextButton = () => Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Далі'))!;
    expect(nextButton().disabled).toBe(true);

    selectValue(el.querySelector('#paymentTypeId') as HTMLSelectElement, 'pt-full');
    fixture.detectChanges();
    selectValue(el.querySelector('select[formcontrolname="productTypeId"]') as HTMLSelectElement, 'prt-custom');
    fixture.detectChanges();
    inputValue(el.querySelector('input[formcontrolname="name"]') as HTMLInputElement, 'Кастом');
    inputValue(el.querySelector('input[formcontrolname="price"]') as HTMLInputElement, '50');
    fixture.detectChanges();

    expect(nextButton().disabled).toBe(false);
    nextButton().click();
    fixture.detectChanges();

    expect(el.querySelector('.sender-card')).not.toBeNull();
  });

  it('shows the partial-amount field only for the "часткова оплата" payment type', () => {
    create();
    flushActiveSender();
    flushAddresses();

    expect(el.querySelector('#partialAmount')).toBeNull();

    selectValue(el.querySelector('#paymentTypeId') as HTMLSelectElement, 'pt-partial');
    fixture.detectChanges();

    expect(el.querySelector('#partialAmount')).not.toBeNull();
  });

  it('shows a fallback message and blocks step 2 when there is no active sender', () => {
    create();
    flushNoActiveSender();

    const component = fixture.debugElement.componentInstance as OrdersCreate;
    expect(component.isStep2Valid()).toBe(false);
    component['step'].set(2);
    fixture.detectChanges();

    expect(el.querySelector('.empty-state--inline')?.textContent).toContain('Немає активного відправника');
  });

  it('auto-fills the sender address once loaded, with no picker shown', () => {
    create();
    flushActiveSender();
    flushAddresses([{ npAddressRef: 'addr-1', description: 'Склад №1' }]);

    const component = fixture.debugElement.componentInstance as OrdersCreate;
    component['step'].set(2);
    fixture.detectChanges();

    expect(component['form'].controls.senderAddressRef.value).toBe('addr-1');
    expect(el.querySelector('#senderAddressRef')).toBeNull();
    expect(el.querySelector('.locked-field span')?.textContent?.trim()).toBe('Склад №1');
  });

  it('shows a hint instead of a locked field when the sender has no address', () => {
    create();
    flushActiveSender();
    flushAddresses([]);

    const component = fixture.debugElement.componentInstance as OrdersCreate;
    component['step'].set(2);
    fixture.detectChanges();

    expect(component['form'].controls.senderAddressRef.value).toBe('');
    expect(el.querySelector('.locked-field')).toBeNull();
    expect(el.querySelector('.field-hint')?.textContent).toContain('немає збереженої адреси');
  });

  it('normalizes a pasted phone number to +380XXXXXXXXX', () => {
    create();
    flushActiveSender();
    flushAddresses();
    const component = fixture.debugElement.componentInstance as OrdersCreate;
    component['step'].set(2);
    fixture.detectChanges();

    const phoneInput = el.querySelector('#phone') as HTMLInputElement;
    const pasteEvent = new Event('paste', { cancelable: true }) as ClipboardEvent;
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: { getData: () => '+38 (050) 123-45-67' },
    });
    phoneInput.dispatchEvent(pasteEvent);
    fixture.detectChanges();

    expect(component['form'].controls.recipient.controls.phone.value).toBe('+380501234567');
  });

  it('normalizes a manually typed phone number once the field loses focus', () => {
    create();
    flushActiveSender();
    flushAddresses();
    const component = fixture.debugElement.componentInstance as OrdersCreate;
    component['step'].set(2);
    fixture.detectChanges();

    const phoneInput = el.querySelector('#phone') as HTMLInputElement;
    phoneInput.value = '0501234567';
    phoneInput.dispatchEvent(new Event('input'));
    phoneInput.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(component['form'].controls.recipient.controls.phone.value).toBe('+380501234567');
  });

  it('does not offer the unsupported "Адреса" (door-to-door) delivery method', () => {
    create();
    flushActiveSender();
    flushAddresses();
    const component = fixture.debugElement.componentInstance as OrdersCreate;
    component['step'].set(2);
    fixture.detectChanges();

    const labels = Array.from(el.querySelectorAll('.delivery-method__option')).map((b) => b.textContent?.trim());
    expect(labels).toEqual(['Відділення', 'Поштомат']);
  });

  it('switches conditional delivery-detail fields based on the selected delivery method', () => {
    create();
    flushActiveSender();
    flushAddresses();
    const component = fixture.debugElement.componentInstance as OrdersCreate;
    component['step'].set(2);
    fixture.detectChanges();

    const deliveryButton = (label: string) =>
      Array.from(el.querySelectorAll('.delivery-method__option')).find((b) =>
        b.textContent?.includes(label),
      ) as HTMLButtonElement;

    deliveryButton('Відділення').click();
    fixture.detectChanges();
    expect(el.querySelector('.field--warehouse')).not.toBeNull();
    expect(el.querySelector('.field--postomat')).toBeNull();

    deliveryButton('Поштомат').click();
    fixture.detectChanges();
    expect(el.querySelector('.field--warehouse')).toBeNull();
    expect(el.querySelector('.field--postomat')).not.toBeNull();
    expect(component['form'].controls.deliveryTypeId.value).toBe('dt-postomat');
  });

  it('fetches warehouses and postomats after a city is selected', () => {
    create();
    flushActiveSender();
    flushAddresses();
    const component = fixture.debugElement.componentInstance as OrdersCreate;
    component['step'].set(2);
    fixture.detectChanges();

    component.onCitySelected({ value: 'city-1', label: 'Київ' });

    httpMock.expectOne(`${novaPoshtaUrl}/warehouses?cityRef=city-1`).flush([{ ref: 'w1', description: 'Відділення 1' }]);
    httpMock.expectOne(`${novaPoshtaUrl}/postomats?cityRef=city-1`).flush([{ ref: 'p1', description: 'Поштомат 1' }]);
    fixture.detectChanges();

    expect(component['warehouseOptions']()).toEqual([{ value: 'w1', label: 'Відділення 1' }]);
    expect(component['postomatOptions']()).toEqual([{ value: 'p1', label: 'Поштомат 1' }]);
  });

  it('keeps warehouse and postomat lookup failures in separate signals, so one does not hide the other', () => {
    create();
    flushActiveSender();
    flushAddresses();
    const component = fixture.debugElement.componentInstance as OrdersCreate;
    component['step'].set(2);
    fixture.detectChanges();

    component.onCitySelected({ value: 'city-1', label: 'Київ' });

    httpMock
      .expectOne(`${novaPoshtaUrl}/warehouses?cityRef=city-1`)
      .flush('boom', { status: 500, statusText: 'Server Error' });
    httpMock
      .expectOne(`${novaPoshtaUrl}/postomats?cityRef=city-1`)
      .flush('boom', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(component['warehouseLookupError']()).toBe('Не вдалося завантажити перелік відділень');
    expect(component['postomatLookupError']()).toBe('Не вдалося завантажити перелік поштоматів');
  });

  it('does not call the cities search endpoint for a blank search term', () => {
    create();
    flushActiveSender();
    flushAddresses();
    const component = fixture.debugElement.componentInstance as OrdersCreate;
    component['step'].set(2);
    fixture.detectChanges();

    component.onCitySearchTermChange('   ');

    httpMock.expectNone(`${novaPoshtaUrl}/cities?query=`);
  });

  it('blocks step 2 when the recipient phone is not a valid +380XXXXXXXXX shape', () => {
    create();
    flushActiveSender();
    flushAddresses();
    const component = fixture.debugElement.componentInstance as OrdersCreate;
    component['step'].set(2);
    fixture.detectChanges();

    component['form'].controls.recipient.setValue({
      phone: '050',
      lastName: 'Петренко',
      firstName: 'Петро',
      middleName: '',
    });
    component.selectDeliveryMethod('warehouse');
    component.onCitySelected({ value: 'city-1', label: 'Київ' });
    httpMock.expectOne(`${novaPoshtaUrl}/warehouses?cityRef=city-1`).flush([{ ref: 'w1', description: 'Відділення 1' }]);
    httpMock.expectOne(`${novaPoshtaUrl}/postomats?cityRef=city-1`).flush([]);
    component.onWarehouseSelected({ value: 'w1', label: 'Відділення 1' });
    fixture.detectChanges();

    expect(component.isStep2Valid()).toBe(false);
  });

  it('submits the built payload and navigates to the orders list on success', () => {
    create();
    flushActiveSender();
    flushAddresses();
    const component = fixture.debugElement.componentInstance as OrdersCreate;

    component['form'].controls.paymentTypeId.setValue('pt-full');
    component.items.at(0).controls.productTypeId.setValue('prt-custom');
    fixture.detectChanges();
    httpMock.expectNone(`${productsUrl}?page=1&pageSize=100&typeId=prt-sticker`);
    component.items.at(0).controls.name.setValue('Кастом');
    component.items.at(0).controls.price.setValue(50);
    component.items.at(0).controls.quantity.setValue(2);

    component['step'].set(2);
    fixture.detectChanges();
    component['form'].controls.recipient.setValue({
      phone: '+380501234567',
      lastName: 'Петренко',
      firstName: 'Петро',
      middleName: '',
    });
    component.selectDeliveryMethod('warehouse');
    component.onCitySelected({ value: 'city-1', label: 'Київ' });
    httpMock.expectOne(`${novaPoshtaUrl}/warehouses?cityRef=city-1`).flush([{ ref: 'w1', description: 'Відділення 1' }]);
    httpMock.expectOne(`${novaPoshtaUrl}/postomats?cityRef=city-1`).flush([]);
    component.onWarehouseSelected({ value: 'w1', label: 'Відділення 1' });
    fixture.detectChanges();

    expect(component.isStep2Valid()).toBe(true);
    component.submit();

    const req = httpMock.expectOne(ordersUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      shipmentTypeId: 'st-docs',
      paymentTypeId: 'pt-full',
      items: [{ productTypeId: 'prt-custom', name: 'Кастом', price: 50, quantity: 2 }],
      senderId: 's1',
      senderAddressRef: 'addr-1',
      recipient: { phone: '+380501234567', lastName: 'Петренко', firstName: 'Петро' },
      deliveryTypeId: 'dt-warehouse',
      deliveryDetails: { cityRef: 'city-1', warehouseRef: 'w1' },
    });
    req.flush({ id: 'o1' });

    expect(router.navigateByUrl).toHaveBeenCalledWith('/orders');
  });

  it('shows the server error message on a failed submission', () => {
    create();
    flushActiveSender();
    flushAddresses();
    const component = fixture.debugElement.componentInstance as OrdersCreate;

    component['form'].controls.paymentTypeId.setValue('pt-full');
    component.items.at(0).controls.productTypeId.setValue('prt-custom');
    fixture.detectChanges();
    component.items.at(0).controls.name.setValue('Кастом');
    component.items.at(0).controls.price.setValue(50);
    component['step'].set(2);
    component['form'].controls.recipient.setValue({
      phone: '+380501234567',
      lastName: 'Петренко',
      firstName: 'Петро',
      middleName: '',
    });
    component.selectDeliveryMethod('warehouse');
    component.onCitySelected({ value: 'city-1', label: 'Київ' });
    httpMock.expectOne(`${novaPoshtaUrl}/warehouses?cityRef=city-1`).flush([{ ref: 'w1', description: 'Відділення 1' }]);
    httpMock.expectOne(`${novaPoshtaUrl}/postomats?cityRef=city-1`).flush([]);
    component.onWarehouseSelected({ value: 'w1', label: 'Відділення 1' });
    fixture.detectChanges();

    component.submit();
    httpMock
      .expectOne(ordersUrl)
      .flush({ message: 'Not enough stock for product "Кіт"' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(el.querySelector('.error-text')?.textContent?.trim()).toBe('Not enough stock for product "Кіт"');
  });
});
