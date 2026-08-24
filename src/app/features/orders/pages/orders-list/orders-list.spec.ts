import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { DictionariesService } from '../../../../core/dictionaries/dictionaries.service';
import { OrdersList } from './orders-list';

describe('OrdersList', () => {
  let fixture: ComponentFixture<OrdersList>;
  let el: HTMLElement;
  let httpMock: HttpTestingController;
  let router: Router;
  const baseUrl = `${environment.apiUrl}/orders`;

  const order = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: '1',
    shipmentTypeId: 'st1',
    paymentTypeId: 'pt1',
    partialAmount: null,
    totalAmount: 630,
    items: [{ productId: 'p1', productTypeId: 't1', nameSnapshot: 'Наклейка «Кіт»', quantity: 3 }],
    senderId: 's1',
    senderAddressRef: 'addr-1',
    recipient: { phone: '+380501234567', lastName: 'Коваленко', firstName: 'Ірина', middleName: null },
    deliveryTypeId: 'dt1',
    deliveryDetails: { cityRef: 'c1', warehouseRef: 'w1', streetRef: null, house: null, apartment: null, postomatRef: null },
    npWaybillNumber: '20450182773641',
    npWaybillRef: null,
    shipmentStatusId: null,
    createdAt: '2026-08-22T10:00:00.000Z',
    updatedAt: '2026-08-22T10:00:00.000Z',
    ...overrides,
  });

  const dictionariesStub = {
    paymentTypes: () => [
      { id: 'pt1', code: 'cod', label: 'Післяплата' },
      { id: 'pt2', code: 'full', label: 'Повна оплата' },
    ],
  };

  const create = () => {
    TestBed.configureTestingModule({
      imports: [OrdersList],
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
    fixture = TestBed.createComponent(OrdersList);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  };

  const flushList = (items: unknown[], total: number, url = `${baseUrl}?page=1&pageSize=10`) => {
    httpMock.expectOne(url).flush({ items, total });
    fixture.detectChanges();
  };

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches page 1 unfiltered on init and renders a row per order', () => {
    create();
    flushList([order(), order({ id: '2' })], 2);

    expect(el.querySelectorAll('tbody tr').length).toBe(2);
  });

  it('shows the empty state when there are no orders', () => {
    create();
    flushList([], 0);

    expect(el.querySelector('.empty-state__title')?.textContent?.trim()).toBe('Замовлень поки немає');
  });

  it('renders waybill, recipient, phone, items summary, payment and total', () => {
    create();
    flushList([order()], 1);

    const row = el.querySelector('tbody tr') as HTMLElement;
    const cells = Array.from(row.querySelectorAll('td')).map((td) => td.textContent?.replace(/\s+/g, ' ').trim());
    expect(cells[0]).toBe('20450182773641');
    expect(cells[2]).toBe('Коваленко Ірина');
    expect(cells[3]).toBe('+380501234567');
    expect(cells[4]).toBe('Наклейка «Кіт» ×3');
    expect(cells[5]).toBe('Післяплата');
    expect(cells[6]).toBe('630 ₴');
  });

  it('shows a dash for a missing waybill number', () => {
    create();
    flushList([order({ npWaybillNumber: null })], 1);

    expect(el.querySelector('.waybill-number')?.textContent?.trim()).toBe('—');
  });

  it('navigates to the detail page when a row is clicked', () => {
    create();
    flushList([order()], 1);

    (el.querySelector('tbody tr') as HTMLElement).click();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/orders/1');
  });

  it('navigates to the create page when "Створити замовлення" is clicked', () => {
    create();
    flushList([], 0);

    (el.querySelector('.btn-primary') as HTMLButtonElement).click();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/orders/new');
  });

  it('refetches with dateFrom/dateTo when the date filters change, resetting to page 1', () => {
    create();
    flushList([], 0);

    const [fromInput, toInput] = Array.from(el.querySelectorAll('input[type="date"]')) as HTMLInputElement[];
    fromInput.value = '2026-08-01';
    fromInput.dispatchEvent(new Event('change'));
    flushList([], 0, `${baseUrl}?page=1&pageSize=10&dateFrom=2026-08-01`);

    toInput.value = '2026-08-22';
    toInput.dispatchEvent(new Event('change'));
    flushList([], 0, `${baseUrl}?page=1&pageSize=10&dateFrom=2026-08-01&dateTo=2026-08-22`);
  });

  it('shows the reset button only when a filter is active, and clears filters on click', () => {
    create();
    flushList([], 0);
    expect(el.querySelector('.filters-row__reset')).toBeNull();

    const [fromInput] = Array.from(el.querySelectorAll('input[type="date"]')) as HTMLInputElement[];
    fromInput.value = '2026-08-01';
    fromInput.dispatchEvent(new Event('change'));
    flushList([], 0, `${baseUrl}?page=1&pageSize=10&dateFrom=2026-08-01`);

    const resetButton = el.querySelector('.filters-row__reset') as HTMLButtonElement;
    expect(resetButton).not.toBeNull();
    resetButton.click();
    flushList([], 0);
    expect(el.querySelector('.filters-row__reset')).toBeNull();
  });

  it('reverses the row order client-side when "Старі" sort is selected', () => {
    create();
    flushList([order({ id: '1', npWaybillNumber: 'EN-1' }), order({ id: '2', npWaybillNumber: 'EN-2' })], 2);

    const sortButtons = Array.from(el.querySelectorAll('.segmented-control__item')) as HTMLButtonElement[];
    const oldestButton = sortButtons.find((b) => b.textContent?.trim() === 'Старі') as HTMLButtonElement;
    oldestButton.click();
    fixture.detectChanges();

    const waybills = Array.from(el.querySelectorAll('.waybill-number')).map((n) => n.textContent?.trim());
    expect(waybills).toEqual(['EN-2', 'EN-1']);
  });

  it('requests the next page when pagination is used', () => {
    create();
    flushList(
      Array.from({ length: 10 }, (_, i) => order({ id: `${i}` })),
      25,
    );

    const pageTwoButton = Array.from(el.querySelectorAll('.pagination-box')).find(
      (b) => b.textContent?.trim() === '2',
    ) as HTMLButtonElement;
    pageTwoButton.click();

    flushList(
      Array.from({ length: 10 }, (_, i) => order({ id: `${i + 10}` })),
      25,
      `${baseUrl}?page=2&pageSize=10`,
    );
    expect(el.querySelectorAll('tbody tr').length).toBe(10);
  });

  it('clamps back to the last valid page when the current page becomes empty', () => {
    create();
    flushList([], 0);

    const [fromInput] = Array.from(el.querySelectorAll('input[type="date"]')) as HTMLInputElement[];
    fromInput.value = '2026-08-01';
    fromInput.dispatchEvent(new Event('change'));
    httpMock.expectOne(`${baseUrl}?page=1&pageSize=10&dateFrom=2026-08-01`).flush({ items: [order()], total: 25 });
    fixture.detectChanges();

    const pageThreeButton = Array.from(el.querySelectorAll('.pagination-box')).find(
      (b) => b.textContent?.trim() === '3',
    ) as HTMLButtonElement;
    pageThreeButton.click();
    httpMock
      .expectOne(`${baseUrl}?page=3&pageSize=10&dateFrom=2026-08-01`)
      .flush({ items: [order()], total: 5 });
    fixture.detectChanges();

    httpMock.expectOne(`${baseUrl}?page=1&pageSize=10&dateFrom=2026-08-01`).flush({ items: [order()], total: 5 });
    fixture.detectChanges();

    expect(el.querySelectorAll('tbody tr').length).toBe(1);
  });

  it('hides the sort toggle once there is more than one page of results', () => {
    create();
    flushList(
      Array.from({ length: 10 }, (_, i) => order({ id: `${i}` })),
      25,
    );

    const labels = Array.from(el.querySelectorAll('.segmented-control__item')).map((b) => b.textContent?.trim());
    expect(labels).not.toContain('Старі');
  });

  it('shows an error message when the list request fails', () => {
    create();
    httpMock.expectOne(`${baseUrl}?page=1&pageSize=10`).flush('boom', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(el.querySelector('.error-text')?.textContent?.trim()).toBe('Не вдалося завантажити список замовлень');
  });
});
