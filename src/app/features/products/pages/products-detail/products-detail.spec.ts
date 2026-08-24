import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { DictionariesService } from '../../../../core/dictionaries/dictionaries.service';
import { environment } from '../../../../../environments/environment';
import { ProductsDetail } from './products-detail';

describe('ProductsDetail', () => {
  let fixture: ComponentFixture<ProductsDetail>;
  let el: HTMLElement;
  let httpMock: HttpTestingController;
  let router: Router;
  const baseUrl = `${environment.apiUrl}/products`;

  const dictionariesStub = {
    productTypes: () => [{ id: 't1', code: 'sticker', label: 'Наклейка', isCustom: false }],
  };

  const product = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: '9',
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

  const create = () => {
    TestBed.configureTestingModule({
      imports: [ProductsDetail],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: DictionariesService, useValue: dictionariesStub },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '9' }) } } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(ProductsDetail);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  };

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches the product and renders its fields', () => {
    create();
    httpMock.expectOne(`${baseUrl}/9`).flush(product());
    fixture.detectChanges();

    expect(el.querySelector('.page-title')?.textContent?.trim()).toBe('Кіт-космонавт');
    expect(el.querySelector('.badge-info')?.textContent?.trim()).toBe('Наклейка');
    expect(el.querySelector('.detail-row-value')?.textContent?.trim()).toBe('210 ₴');
  });

  it('shows the "Акція" badge and green promo price only when a promo price exists', () => {
    create();
    httpMock.expectOne(`${baseUrl}/9`).flush(product({ promoPrice: 180 }));
    fixture.detectChanges();

    expect(el.querySelector('.status-badge--success')?.textContent?.trim()).toBe('Акція');
    expect(el.querySelector('.promo-price')?.textContent?.trim()).toBe('180 ₴');
  });

  it('shows a dash for promo price and no "Акція" badge when absent', () => {
    create();
    httpMock.expectOne(`${baseUrl}/9`).flush(product({ promoPrice: null }));
    fixture.detectChanges();

    expect(el.querySelector('.status-badge--success')).toBeNull();
    expect(el.querySelector('.dash')?.textContent?.trim()).toBe('—');
  });

  it('shows an error message when loading fails', () => {
    create();
    httpMock.expectOne(`${baseUrl}/9`).flush('boom', { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(el.querySelector('.error-text')?.textContent?.trim()).toBe('Не вдалося завантажити дані товару');
  });

  it('navigates to the edit page on "Редагувати"', () => {
    create();
    httpMock.expectOne(`${baseUrl}/9`).flush(product());
    fixture.detectChanges();

    (el.querySelector('.btn-ghost') as HTMLButtonElement).click();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/products/9/edit');
  });

  it('navigates back to the list on breadcrumb click', () => {
    create();
    httpMock.expectOne(`${baseUrl}/9`).flush(product());
    fixture.detectChanges();

    (el.querySelector('.breadcrumb') as HTMLButtonElement).click();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/products');
  });

  it('deletes the product on confirm and navigates back to the list', () => {
    create();
    httpMock.expectOne(`${baseUrl}/9`).flush(product());
    fixture.detectChanges();

    (el.querySelector('.btn-outline-danger') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.dialog-message')?.textContent).toContain('Кіт-космонавт');

    (el.querySelector('.btn-destructive') as HTMLButtonElement).click();
    httpMock.expectOne(`${baseUrl}/9`).flush(null);

    expect(router.navigateByUrl).toHaveBeenCalledWith('/products');
  });

  it('closes the dialog without deleting on cancel', () => {
    create();
    httpMock.expectOne(`${baseUrl}/9`).flush(product());
    fixture.detectChanges();

    (el.querySelector('.btn-outline-danger') as HTMLButtonElement).click();
    fixture.detectChanges();
    (el.querySelector('.dialog-actions .btn-ghost') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelector('.dialog-overlay')).toBeNull();
    httpMock.expectNone(`${baseUrl}/9`);
  });
});
