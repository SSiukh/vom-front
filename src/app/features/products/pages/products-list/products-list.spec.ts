import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { DictionariesService } from '../../../../core/dictionaries/dictionaries.service';
import { environment } from '../../../../../environments/environment';
import { ProductsList } from './products-list';

describe('ProductsList', () => {
  let fixture: ComponentFixture<ProductsList>;
  let el: HTMLElement;
  let httpMock: HttpTestingController;
  let router: Router;
  const baseUrl = `${environment.apiUrl}/products`;

  const product = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: '1',
    typeId: 't1',
    name: 'Кіт-космонавт',
    photoUrl: 'https://cdn.example.com/photo.png',
    price: 210,
    promoPrice: null,
    stockQuantity: 24,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  });

  const dictionariesStub = {
    productTypes: () => [
      { id: 't1', code: 'sticker', label: 'Наклейка', isCustom: false },
      { id: 't2', code: 'keychain', label: 'Брелок', isCustom: false },
      { id: 't3', code: 'custom-sticker', label: 'Кастомна наклейка', isCustom: true },
    ],
  };

  const create = () => {
    TestBed.configureTestingModule({
      imports: [ProductsList],
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
    fixture = TestBed.createComponent(ProductsList);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  };

  const flushList = (items: unknown[], total: number, page = 1, typeId?: string) => {
    const url = typeId
      ? `${baseUrl}?page=${page}&pageSize=10&typeId=${typeId}`
      : `${baseUrl}?page=${page}&pageSize=10`;
    httpMock.expectOne(url).flush({ items, total });
    fixture.detectChanges();
  };

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches page 1 unfiltered on init and renders a row per product', () => {
    create();
    flushList([product(), product({ id: '2', name: 'Ракета' })], 2);

    const rows = el.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
  });

  it('shows the empty state when there are no products', () => {
    create();
    flushList([], 0);

    expect(el.querySelector('.empty-state__title')?.textContent?.trim()).toBe('Товарів поки немає');
  });

  it('renders the type filter with only non-custom types plus "Усі"', () => {
    create();
    flushList([], 0);

    const labels = Array.from(el.querySelectorAll('.segmented-control__item')).map((b) =>
      b.textContent?.trim(),
    );
    expect(labels).toEqual(['Усі', 'Наклейка', 'Брелок']);
  });

  it('refetches with typeId when a filter segment is clicked, resetting to page 1', () => {
    create();
    flushList([], 0);

    const stickerButton = Array.from(el.querySelectorAll('.segmented-control__item')).find(
      (b) => b.textContent?.trim() === 'Наклейка',
    ) as HTMLButtonElement;
    stickerButton.click();

    flushList([product()], 1, 1, 't1');
  });

  it('shows the promo price when present, and a dash when absent', () => {
    create();
    flushList([product({ promoPrice: 180 }), product({ id: '2', promoPrice: null })], 2);

    const promoCells = el.querySelectorAll('.col-num .promo-price, .col-num .dash');
    expect(promoCells[0].textContent?.trim()).toBe('180 ₴');
    expect(promoCells[1].textContent?.trim()).toBe('—');
  });

  it('applies stock-zero/stock-low classes based on quantity', () => {
    create();
    flushList(
      [
        product({ id: '1', stockQuantity: 0 }),
        product({ id: '2', stockQuantity: 4 }),
        product({ id: '3', stockQuantity: 24 }),
      ],
      3,
    );

    const stockCells = Array.from(el.querySelectorAll('tbody tr')).map(
      (row) => row.querySelector('td:nth-child(6)') as HTMLElement,
    );
    expect(stockCells[0].classList.contains('stock-zero')).toBe(true);
    expect(stockCells[1].classList.contains('stock-low')).toBe(true);
    expect(stockCells[2].classList.contains('stock-zero')).toBe(false);
    expect(stockCells[2].classList.contains('stock-low')).toBe(false);
  });

  it('navigates to the detail page when clicking anywhere on the row', () => {
    create();
    flushList([product()], 1);

    (el.querySelector('tbody tr') as HTMLElement).click();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/products/1');
  });

  it('does not navigate to the detail page when clicking inside the Дії column', () => {
    create();
    flushList([product()], 1);

    (el.querySelector('.icon-action') as HTMLButtonElement).click();

    expect(router.navigateByUrl).not.toHaveBeenCalledWith('/products/1');
  });

  it('navigates to the edit page when the edit icon is clicked', () => {
    create();
    flushList([product()], 1);

    (el.querySelector('.icon-action') as HTMLButtonElement).click();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/products/1/edit');
  });

  it('navigates to the create page when "Додати товар" is clicked', () => {
    create();
    flushList([], 0);

    (el.querySelector('.btn-primary') as HTMLButtonElement).click();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/products/new');
  });

  it('deletes the product on confirm and reloads the list', () => {
    create();
    flushList([product()], 1);

    (el.querySelector('.icon-action--danger') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.dialog-message')?.textContent).toContain('Кіт-космонавт');

    (el.querySelector('.btn-destructive') as HTMLButtonElement).click();
    httpMock.expectOne(`${baseUrl}/1`).flush(null);
    flushList([], 0);

    expect(el.querySelector('.dialog-overlay')).toBeNull();
  });

  it('shows an error message when the list request fails', () => {
    create();
    httpMock.expectOne(`${baseUrl}?page=1&pageSize=10`).flush('boom', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(el.querySelector('.error-text')?.textContent?.trim()).toBe('Не вдалося завантажити список товарів');
  });
});
