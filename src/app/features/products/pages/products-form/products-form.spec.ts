import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { DictionariesService } from '../../../../core/dictionaries/dictionaries.service';
import { environment } from '../../../../../environments/environment';
import { ProductsForm } from './products-form';

describe('ProductsForm', () => {
  let fixture: ComponentFixture<ProductsForm>;
  let el: HTMLElement;
  let httpMock: HttpTestingController;
  let router: Router;
  const baseUrl = `${environment.apiUrl}/products`;

  const dictionariesStub = {
    productTypes: () => [
      { id: 't1', code: 'sticker', label: 'Наклейка', isCustom: false },
      { id: 't2', code: 'keychain', label: 'Брелок', isCustom: false },
    ],
  };

  const responseProduct = (overrides: Partial<Record<string, unknown>> = {}) => ({
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

  const create = (productId: string | null) => {
    TestBed.configureTestingModule({
      imports: [ProductsForm],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: DictionariesService, useValue: dictionariesStub },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap(productId ? { id: productId } : {})) },
        },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(ProductsForm);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  };

  const fillRequiredFields = () => {
    const typeSelect = el.querySelector('#typeId') as HTMLSelectElement;
    typeSelect.value = 't1';
    typeSelect.dispatchEvent(new Event('change'));

    const setValue = (id: string, value: string) => {
      const input = el.querySelector(`#${id}`) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    setValue('name', 'Кіт-космонавт');
    setValue('price', '210');
    setValue('stockQuantity', '24');
    fixture.detectChanges();
  };

  const attachFile = () => {
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    fixture.componentInstance.onFileSelected({ target: { files: [file] } } as unknown as Event);
    fixture.detectChanges();
  };

  afterEach(() => {
    httpMock.verify();
  });

  describe('create mode', () => {
    it('shows the "Новий товар" title and no breadcrumb-triggered fetch', () => {
      create(null);
      expect(el.querySelector('.page-title')?.textContent?.trim()).toBe('Новий товар');
    });

    it('keeps save disabled until required fields are filled and a photo is attached', () => {
      create(null);
      const saveButton = el.querySelector('.btn-primary') as HTMLButtonElement;
      expect(saveButton.disabled).toBe(true);

      fillRequiredFields();
      expect(saveButton.disabled).toBe(true);

      attachFile();
      expect(saveButton.disabled).toBe(false);
    });

    it('shows an image preview after a file is selected via the input', () => {
      create(null);
      attachFile();

      expect(el.querySelector('.dropzone__preview img')).not.toBeNull();
      expect(el.querySelector('.dropzone__filename')?.textContent?.trim()).toBe('photo.png');
    });

    it('accepts a dropped file via onDrop', () => {
      create(null);
      const file = new File(['x'], 'dropped.png', { type: 'image/png' });
      fixture.componentInstance.onDrop({
        preventDefault: () => undefined,
        dataTransfer: { files: [file] },
      } as unknown as DragEvent);
      fixture.detectChanges();

      expect(el.querySelector('.dropzone__filename')?.textContent?.trim()).toBe('dropped.png');
    });

    it('submits FormData with all fields (promoPrice omitted) and navigates to the detail page', () => {
      create(null);
      fillRequiredFields();
      attachFile();

      (el.querySelector('.btn-primary') as HTMLButtonElement).click();

      const req = httpMock.expectOne(baseUrl);
      expect(req.request.method).toBe('POST');
      const body = req.request.body as FormData;
      expect(body.get('typeId')).toBe('t1');
      expect(body.get('name')).toBe('Кіт-космонавт');
      expect(body.get('price')).toBe('210');
      expect(body.get('stockQuantity')).toBe('24');
      expect(body.get('promoPrice')).toBeNull();
      expect((body.get('photo') as File).name).toBe('photo.png');

      req.flush(responseProduct());
      expect(router.navigateByUrl).toHaveBeenCalledWith('/products/9');
    });

    it('includes promoPrice in FormData when provided', () => {
      create(null);
      fillRequiredFields();
      attachFile();
      const promoInput = el.querySelector('#promoPrice') as HTMLInputElement;
      promoInput.value = '180';
      promoInput.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      (el.querySelector('.btn-primary') as HTMLButtonElement).click();

      const req = httpMock.expectOne(baseUrl);
      expect((req.request.body as FormData).get('promoPrice')).toBe('180');
      req.flush(responseProduct({ promoPrice: 180 }));
    });

    it('shows each validation message when the backend returns an array', () => {
      create(null);
      fillRequiredFields();
      attachFile();

      (el.querySelector('.btn-primary') as HTMLButtonElement).click();
      httpMock
        .expectOne(baseUrl)
        .flush({ message: ['price must not be less than 0', 'name should not be empty'] }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();

      expect(el.querySelector('.error-text')?.textContent?.trim()).toBe(
        'price must not be less than 0; name should not be empty',
      );
    });

    it('shows a plain string error message from the backend', () => {
      create(null);
      fillRequiredFields();
      attachFile();

      (el.querySelector('.btn-primary') as HTMLButtonElement).click();
      httpMock
        .expectOne(baseUrl)
        .flush(
          { message: 'Cannot create or edit a catalog product with the custom product type' },
          { status: 400, statusText: 'Bad Request' },
        );
      fixture.detectChanges();

      expect(el.querySelector('.error-text')?.textContent?.trim()).toBe(
        'Cannot create or edit a catalog product with the custom product type',
      );
    });

    it('navigates back to the list on breadcrumb click', () => {
      create(null);
      (el.querySelector('.breadcrumb') as HTMLButtonElement).click();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/products');
    });
  });

  describe('edit mode', () => {
    it('fetches and pre-fills the existing product, and shows its photo without requiring a new one', () => {
      create('9');
      httpMock.expectOne(`${baseUrl}/9`).flush(responseProduct());
      fixture.detectChanges();

      expect(el.querySelector('.page-title')?.textContent?.trim()).toBe('Редагувати товар');
      expect((el.querySelector('#name') as HTMLInputElement).value).toBe('Кіт-космонавт');
      expect((el.querySelector('#price') as HTMLInputElement).value).toBe('210');
      expect(el.querySelector('.dropzone__preview img')?.getAttribute('src')).toBe(
        'https://cdn.example.com/photo.png',
      );

      const saveButton = el.querySelector('.btn-primary') as HTMLButtonElement;
      expect(saveButton.disabled).toBe(false);
    });

    it('PATCHes without a photo field when no new file was selected', () => {
      create('9');
      httpMock.expectOne(`${baseUrl}/9`).flush(responseProduct());
      fixture.detectChanges();

      (el.querySelector('.btn-primary') as HTMLButtonElement).click();

      const req = httpMock.expectOne(`${baseUrl}/9`);
      expect(req.request.method).toBe('PATCH');
      expect((req.request.body as FormData).get('photo')).toBeNull();
      req.flush(responseProduct());
      expect(router.navigateByUrl).toHaveBeenCalledWith('/products/9');
    });

    it('includes the new photo when one is selected during edit', () => {
      create('9');
      httpMock.expectOne(`${baseUrl}/9`).flush(responseProduct());
      fixture.detectChanges();
      attachFile();

      (el.querySelector('.btn-primary') as HTMLButtonElement).click();

      const req = httpMock.expectOne(`${baseUrl}/9`);
      expect(((req.request.body as FormData).get('photo') as File).name).toBe('photo.png');
      req.flush(responseProduct());
    });

    it('shows an error when the existing product fails to load', () => {
      create('9');
      httpMock.expectOne(`${baseUrl}/9`).flush('boom', { status: 404, statusText: 'Not Found' });
      fixture.detectChanges();

      expect(el.querySelector('.error-text')?.textContent?.trim()).toBe('Не вдалося завантажити дані товару');
    });
  });

  it('reloads fresh data for a different product when the route param changes without recreating the component', () => {
    const paramMap = new Subject<ReturnType<typeof convertToParamMap>>();
    TestBed.configureTestingModule({
      imports: [ProductsForm],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: DictionariesService, useValue: dictionariesStub },
        { provide: ActivatedRoute, useValue: { paramMap } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProductsForm);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;

    paramMap.next(convertToParamMap({ id: '9' }));
    httpMock.expectOne(`${baseUrl}/9`).flush(responseProduct({ id: '9', name: 'Кіт-космонавт' }));
    fixture.detectChanges();
    expect((el.querySelector('#name') as HTMLInputElement).value).toBe('Кіт-космонавт');

    paramMap.next(convertToParamMap({ id: '10' }));
    httpMock.expectOne(`${baseUrl}/10`).flush(responseProduct({ id: '10', name: 'Ракета' }));
    fixture.detectChanges();
    expect((el.querySelector('#name') as HTMLInputElement).value).toBe('Ракета');
  });

  it('cancels the in-flight request for a stale id when navigation moves on before it resolves', () => {
    const paramMap = new Subject<ReturnType<typeof convertToParamMap>>();
    TestBed.configureTestingModule({
      imports: [ProductsForm],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: DictionariesService, useValue: dictionariesStub },
        { provide: ActivatedRoute, useValue: { paramMap } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProductsForm);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;

    paramMap.next(convertToParamMap({ id: '9' }));
    const staleReq = httpMock.expectOne(`${baseUrl}/9`);

    paramMap.next(convertToParamMap({ id: '10' }));
    httpMock.expectOne(`${baseUrl}/10`).flush(responseProduct({ id: '10', name: 'Ракета' }));
    fixture.detectChanges();

    expect(staleReq.cancelled).toBe(true);
    expect((el.querySelector('#name') as HTMLInputElement).value).toBe('Ракета');
  });

  it('resets to a blank create form when navigating from edit back to create without recreating the component', () => {
    const paramMap = new Subject<ReturnType<typeof convertToParamMap>>();
    TestBed.configureTestingModule({
      imports: [ProductsForm],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: DictionariesService, useValue: dictionariesStub },
        { provide: ActivatedRoute, useValue: { paramMap } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProductsForm);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;

    paramMap.next(convertToParamMap({ id: '9' }));
    httpMock.expectOne(`${baseUrl}/9`).flush(responseProduct({ id: '9', name: 'Кіт-космонавт' }));
    fixture.detectChanges();

    paramMap.next(convertToParamMap({}));
    fixture.detectChanges();

    expect(el.querySelector('.page-title')?.textContent?.trim()).toBe('Новий товар');
    expect((el.querySelector('#name') as HTMLInputElement).value).toBe('');
    expect(el.querySelector('.dropzone__preview')).toBeNull();
  });
});
