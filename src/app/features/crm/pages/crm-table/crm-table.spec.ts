import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { DictionariesService } from '../../../../core/dictionaries/dictionaries.service';
import { CrmTable } from './crm-table';

describe('CrmTable', () => {
  let fixture: ComponentFixture<CrmTable>;
  let el: HTMLElement;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/crm/table`;

  const dictionariesStub = {
    paymentTypes: () => [{ id: 'pt1', code: 'cod', label: 'Післяплата' }],
    productTypes: () => [
      { id: 'prt1', code: 'sticker', label: 'Наклейка', isCustom: false },
      { id: 'prt2', code: 'keychain', label: 'Брелок', isCustom: false },
    ],
    shipmentStatuses: () => [
      { id: 'ss1', code: 'shipped', label: 'Відправлено' },
      { id: 'ss2', code: 'delivered', label: 'Доставлено' },
      { id: 'ss3', code: 'received', label: 'Отримано' },
      { id: 'ss4', code: 'refused', label: 'Відмовлено' },
    ],
  };

  const row = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: '1',
    createdAt: '2026-08-22T09:14:00.000Z',
    npWaybillNumber: '20450182773641',
    paymentTypeId: 'pt1',
    recipientFullName: 'Коваленко Ірина С.',
    recipientPhone: '+380501234567',
    totalAmount: 300,
    shipmentStatusId: 'ss1',
    productTypeIds: ['prt1'],
    ...overrides,
  });

  const create = () => {
    TestBed.configureTestingModule({
      imports: [CrmTable],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: DictionariesService, useValue: dictionariesStub },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CrmTable);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  };

  const flushList = (items: unknown[], total: number, totalAmountSum: number, url = `${baseUrl}?page=1&pageSize=10&sortOrder=desc`) => {
    httpMock.expectOne(url).flush({ items, total, totalAmountSum });
    fixture.detectChanges();
  };

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches page 1 with the default sort on init and renders a row per result', () => {
    create();
    flushList([row(), row({ id: '2' })], 2, 600);

    expect(el.querySelectorAll('tbody tr').length).toBe(2);
  });

  it('shows the empty state with no create affordance when there are no results', () => {
    create();
    flushList([], 0, 0);

    expect(el.querySelector('.empty-state__title')?.textContent?.trim()).toBe('Нічого не знайдено');
    expect(el.querySelector('.empty-state .btn-primary')).toBeNull();
  });

  it('renders date, waybill, payment, recipient, joined product types, amount and a status badge', () => {
    create();
    flushList([row({ productTypeIds: ['prt1', 'prt2'] })], 1, 300);

    const cells = Array.from(el.querySelectorAll('tbody td')).map((td) => td.textContent?.trim());
    expect(cells[0]).toBe('22.08.2026');
    expect(cells[1]).toBe('20450182773641');
    expect(cells[2]).toBe('Післяплата');
    expect(cells[3]).toBe('Коваленко Ірина С.');
    expect(cells[4]).toBe('+380501234567');
    expect(cells[5]).toBe('Наклейка, Брелок');
    expect(cells[6]).toBe('300 ₴');
    expect(el.querySelector('.status-badge')?.textContent?.trim()).toBe('Відправлено');
    expect(el.querySelector('.status-badge')?.classList.contains('badge-info')).toBe(true);
  });

  it('shows a dash instead of a badge when shipmentStatusId is null', () => {
    create();
    flushList([row({ shipmentStatusId: null })], 1, 300);

    expect(el.querySelector('.status-badge')).toBeNull();
    expect(el.querySelector('tbody .dash')?.textContent?.trim()).toBe('—');
  });

  it('shows a dash for a missing waybill number', () => {
    create();
    flushList([row({ npWaybillNumber: null })], 1, 300);

    expect(el.querySelector('.waybill-number')?.textContent?.trim()).toBe('—');
  });

  it('shows the totals bar reflecting the full filtered set, not just the current page', () => {
    create();
    flushList([row()], 42, 38640);

    expect(el.querySelector('.crm-totals')?.textContent).toContain('42');
    expect(el.querySelector('.crm-totals__amount')?.textContent?.trim()).toBe('38640 ₴');
  });

  it('refetches page 1 with dateFrom/dateTo when the date filters change', () => {
    create();
    flushList([], 0, 0);

    const [fromInput, toInput] = Array.from(el.querySelectorAll('input[type="date"]')) as HTMLInputElement[];
    fromInput.value = '2026-08-01';
    fromInput.dispatchEvent(new Event('change'));
    flushList([], 0, 0, `${baseUrl}?page=1&pageSize=10&sortOrder=desc&dateFrom=2026-08-01`);

    toInput.value = '2026-08-22';
    toInput.dispatchEvent(new Event('change'));
    flushList([], 0, 0, `${baseUrl}?page=1&pageSize=10&sortOrder=desc&dateFrom=2026-08-01&dateTo=2026-08-22`);
  });

  it('refetches with productTypeId and shipmentStatusId when those filters change', () => {
    create();
    flushList([], 0, 0);

    const productSelect = el.querySelector('#productTypeId') as HTMLSelectElement;
    productSelect.value = 'prt1';
    productSelect.dispatchEvent(new Event('change'));
    flushList([], 0, 0, `${baseUrl}?page=1&pageSize=10&sortOrder=desc&productTypeId=prt1`);

    const statusSelect = el.querySelector('#shipmentStatusId') as HTMLSelectElement;
    statusSelect.value = 'ss2';
    statusSelect.dispatchEvent(new Event('change'));
    flushList([], 0, 0, `${baseUrl}?page=1&pageSize=10&sortOrder=desc&productTypeId=prt1&shipmentStatusId=ss2`);
  });

  it('refetches page 1 from the server with the new sortOrder when the sort toggle is clicked', () => {
    create();
    flushList([], 0, 0);

    const oldestButton = Array.from(el.querySelectorAll('.segmented-control__item')).find(
      (b) => b.textContent?.trim() === 'Старі',
    ) as HTMLButtonElement;
    oldestButton.click();

    flushList([], 0, 0, `${baseUrl}?page=1&pageSize=10&sortOrder=asc`);
  });

  it('requests the next page when pagination is used', () => {
    create();
    flushList(
      Array.from({ length: 10 }, (_, i) => row({ id: `${i}` })),
      25,
      1000,
    );

    const pageTwoButton = Array.from(el.querySelectorAll('.pagination-box')).find((b) => b.textContent?.trim() === '2') as HTMLButtonElement;
    pageTwoButton.click();

    flushList(
      Array.from({ length: 10 }, (_, i) => row({ id: `${i + 10}` })),
      25,
      1000,
      `${baseUrl}?page=2&pageSize=10&sortOrder=desc`,
    );
    expect(el.querySelectorAll('tbody tr').length).toBe(10);
  });

  it('shows an error message when the request fails', () => {
    create();
    httpMock.expectOne(`${baseUrl}?page=1&pageSize=10&sortOrder=desc`).flush('boom', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(el.querySelector('.error-text')?.textContent?.trim()).toBe('Не вдалося завантажити зведену таблицю');
  });
});
