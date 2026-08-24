import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { environment } from '../../../../../../environments/environment';
import type { Product } from '../../../../products/models/product.model';
import type { ProductType } from '../../../../../shared/models/dictionary-item.model';
import { OrderItemCard, type OrderItemFormGroup } from './order-item-card';

describe('OrderItemCard', () => {
  let fixture: ComponentFixture<OrderItemCard>;
  let el: HTMLElement;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/products`;

  const productTypes: ProductType[] = [
    { id: 't1', code: 'sticker', label: 'Наклейка', isCustom: false },
    { id: 't2', code: 'custom_sticker', label: 'Кастомна наклейка', isCustom: true },
  ];

  const createForm = (): OrderItemFormGroup =>
    new FormGroup({
      productTypeId: new FormControl('', { nonNullable: true }),
      productId: new FormControl<string | null>(null),
      name: new FormControl('', { nonNullable: true }),
      price: new FormControl<number | null>(null),
      quantity: new FormControl(1, { nonNullable: true }),
      isPromo: new FormControl(false, { nonNullable: true }),
    });

  const create = (index = 0, canRemove = true) => {
    TestBed.configureTestingModule({
      imports: [OrderItemCard],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(OrderItemCard);
    fixture.componentRef.setInput('form', createForm());
    fixture.componentRef.setInput('productTypes', productTypes);
    fixture.componentRef.setInput('index', index);
    fixture.componentRef.setInput('canRemove', canRemove);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  };

  const createHydrated = (form: OrderItemFormGroup, initialProduct: Product | null = null) => {
    TestBed.configureTestingModule({
      imports: [OrderItemCard],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(OrderItemCard);
    fixture.componentRef.setInput('form', form);
    fixture.componentRef.setInput('productTypes', productTypes);
    fixture.componentRef.setInput('index', 0);
    fixture.componentRef.setInput('initialProduct', initialProduct);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  };

  afterEach(() => {
    httpMock.verify();
  });

  it('shows the item label with a 1-based index', () => {
    create(2);
    expect(el.querySelector('.item-card__label')?.textContent?.trim()).toBe('Товар 3');
  });

  it('hides the remove button when canRemove is false', () => {
    create(0, false);
    expect(el.querySelector('.icon-action--danger')).toBeNull();
  });

  it('emits removed when the remove button is clicked', () => {
    create();
    const removed = vi.fn();
    fixture.componentInstance.removed.subscribe(removed);

    (el.querySelector('.icon-action--danger') as HTMLButtonElement).click();

    expect(removed).toHaveBeenCalled();
  });

  it('shows name/price inputs and no product search for a custom product type', () => {
    create();
    fixture.componentInstance.form().controls.productTypeId.setValue('t2');
    fixture.detectChanges();

    expect(el.querySelector('app-searchable-select')).toBeNull();
    expect(el.querySelector('input[formcontrolname="name"]')).not.toBeNull();
    expect(el.querySelector('input[formcontrolname="price"]')).not.toBeNull();
  });

  it('fetches and shows catalog products for a non-custom product type', () => {
    create();
    fixture.componentInstance.form().controls.productTypeId.setValue('t1');
    fixture.detectChanges();

    httpMock
      .expectOne(`${baseUrl}?page=1&pageSize=100&typeId=t1`)
      .flush({
        items: [
          { id: 'p1', typeId: 't1', name: 'Кіт', photoUrl: '', price: 100, promoPrice: null, stockQuantity: 5 },
        ],
        total: 1,
      });
    fixture.detectChanges();

    expect(fixture.componentInstance['productOptions']()).toEqual([{ value: 'p1', label: 'Кіт' }]);
  });

  it('sets productId and selectedProduct when a product is picked', () => {
    create();
    fixture.componentInstance.form().controls.productTypeId.setValue('t1');
    fixture.detectChanges();
    httpMock.expectOne(`${baseUrl}?page=1&pageSize=100&typeId=t1`).flush({
      items: [{ id: 'p1', typeId: 't1', name: 'Кіт', photoUrl: '', price: 100, promoPrice: 80, stockQuantity: 5 }],
      total: 1,
    });
    fixture.detectChanges();

    fixture.componentInstance.onProductSelected({ value: 'p1', label: 'Кіт' });
    fixture.detectChanges();

    expect(fixture.componentInstance.form().controls.productId.value).toBe('p1');
    expect(fixture.componentInstance['selectedProduct']()?.name).toBe('Кіт');
  });

  it('computes the subtotal for a catalog product, respecting the promo checkbox', () => {
    create();
    fixture.componentInstance.form().controls.productTypeId.setValue('t1');
    fixture.detectChanges();
    httpMock.expectOne(`${baseUrl}?page=1&pageSize=100&typeId=t1`).flush({
      items: [{ id: 'p1', typeId: 't1', name: 'Кіт', photoUrl: '', price: 100, promoPrice: 80, stockQuantity: 5 }],
      total: 1,
    });
    fixture.detectChanges();
    fixture.componentInstance.onProductSelected({ value: 'p1', label: 'Кіт' });
    fixture.componentInstance.form().controls.quantity.setValue(3);
    fixture.detectChanges();

    expect(el.querySelector('.item-card__subtotal')?.textContent?.trim()).toBe('300 ₴');

    const checkbox = el.querySelector('.checkbox-input') as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(el.querySelector('.item-card__subtotal')?.textContent?.trim()).toBe('240 ₴');
  });

  it('hides the promo checkbox when the selected product has no promo price', () => {
    create();
    fixture.componentInstance.form().controls.productTypeId.setValue('t1');
    fixture.detectChanges();
    httpMock.expectOne(`${baseUrl}?page=1&pageSize=100&typeId=t1`).flush({
      items: [{ id: 'p1', typeId: 't1', name: 'Кіт', photoUrl: '', price: 100, promoPrice: null, stockQuantity: 5 }],
      total: 1,
    });
    fixture.detectChanges();
    fixture.componentInstance.onProductSelected({ value: 'p1', label: 'Кіт' });
    fixture.detectChanges();

    expect(el.querySelector('.checkbox-input')).toBeNull();
  });

  it('computes the subtotal for a custom item from the price field', () => {
    create();
    const form = fixture.componentInstance.form();
    form.controls.productTypeId.setValue('t2');
    fixture.detectChanges();
    form.controls.price.setValue(45);
    form.controls.quantity.setValue(2);
    fixture.detectChanges();

    expect(el.querySelector('.item-card__subtotal')?.textContent?.trim()).toBe('90 ₴');
  });

  it('shows a stock hint for a selected catalog product and a no-stock-deduction hint for a custom item', () => {
    create();
    const form = fixture.componentInstance.form();
    form.controls.productTypeId.setValue('t2');
    fixture.detectChanges();
    expect(el.querySelector('.item-card__hint')?.textContent).toContain('не списується зі складу');

    form.controls.productTypeId.setValue('t1');
    fixture.detectChanges();
    httpMock.expectOne(`${baseUrl}?page=1&pageSize=100&typeId=t1`).flush({
      items: [{ id: 'p1', typeId: 't1', name: 'Кіт', photoUrl: '', price: 100, promoPrice: null, stockQuantity: 9 }],
      total: 1,
    });
    fixture.detectChanges();
    expect(el.querySelector('.item-card__hint')?.textContent).toContain('Оберіть товар');

    fixture.componentInstance.onProductSelected({ value: 'p1', label: 'Кіт' });
    form.controls.quantity.setValue(4);
    fixture.detectChanges();
    expect(el.querySelector('.item-card__hint')?.textContent).toContain('−4 шт (залишок 9)');
  });

  it('filters product options client-side as the user types a search term', () => {
    create();
    fixture.componentInstance.form().controls.productTypeId.setValue('t1');
    fixture.detectChanges();
    httpMock.expectOne(`${baseUrl}?page=1&pageSize=100&typeId=t1`).flush({
      items: [
        { id: 'p1', typeId: 't1', name: 'Кіт', photoUrl: '', price: 100, promoPrice: null, stockQuantity: 5 },
        { id: 'p2', typeId: 't1', name: 'Собака', photoUrl: '', price: 90, promoPrice: null, stockQuantity: 5 },
      ],
      total: 2,
    });
    fixture.detectChanges();

    fixture.componentInstance.onSearchTermChange('кіт');
    expect(fixture.componentInstance['productOptions']()).toEqual([{ value: 'p1', label: 'Кіт' }]);
  });

  it('hydrates a pre-filled catalog item from initialProduct without wiping productId, fetching a fresh product list for search', () => {
    const form = createForm();
    form.patchValue({ productTypeId: 't1', productId: 'p1', quantity: 3, isPromo: true });
    const initialProduct: Product = {
      id: 'p1',
      typeId: 't1',
      name: 'Кіт',
      photoUrl: 'https://cdn.example.com/cat.png',
      price: 100,
      promoPrice: 80,
      stockQuantity: 9,
      createdAt: '',
      updatedAt: '',
    };

    createHydrated(form, initialProduct);

    expect(form.controls.productId.value).toBe('p1');
    expect(el.querySelector('.item-card__subtotal')?.textContent?.trim()).toBe('240 ₴');
    expect(el.querySelector('.item-card__photo img')).not.toBeNull();

    httpMock.expectOne(`${baseUrl}?page=1&pageSize=100&typeId=t1`).flush({ items: [initialProduct], total: 1 });
    expect(fixture.componentInstance['productOptions']()).toEqual([{ value: 'p1', label: 'Кіт' }]);
  });

  it('hydrates a pre-filled custom item from its saved name/price without touching them', () => {
    const form = createForm();
    form.patchValue({ productTypeId: 't2', name: 'Кастомна наклейка «Пес»', price: 65, quantity: 2 });

    createHydrated(form, null);

    expect(form.controls.name.value).toBe('Кастомна наклейка «Пес»');
    expect(form.controls.price.value).toBe(65);
    expect(el.querySelector('.item-card__subtotal')?.textContent?.trim()).toBe('130 ₴');
    expect(el.querySelector('app-searchable-select')).toBeNull();
  });

  it('seeds selectedProduct from initialProduct even when it only arrives after the component has already mounted', () => {
    const form = createForm();
    form.patchValue({ productTypeId: 't1', productId: 'p1', quantity: 2 });

    createHydrated(form, null);
    httpMock.expectOne(`${baseUrl}?page=1&pageSize=100&typeId=t1`).flush({ items: [], total: 0 });
    fixture.detectChanges();
    expect(el.querySelector('.item-card__subtotal')?.textContent?.trim()).toBe('0 ₴');

    const lateProduct: Product = {
      id: 'p1',
      typeId: 't1',
      name: 'Кіт',
      photoUrl: 'https://cdn.example.com/cat.png',
      price: 100,
      promoPrice: null,
      stockQuantity: 9,
      createdAt: '',
      updatedAt: '',
    };
    fixture.componentRef.setInput('initialProduct', lateProduct);
    fixture.detectChanges();

    expect(el.querySelector('.item-card__subtotal')?.textContent?.trim()).toBe('200 ₴');
    expect(el.querySelector('.item-card__photo img')).not.toBeNull();
  });

  it('does not let a late-arriving initialProduct override a product the user has already actively picked', () => {
    const form = createForm();
    form.patchValue({ productTypeId: 't1', productId: 'p1', quantity: 1 });

    createHydrated(form, null);
    httpMock.expectOne(`${baseUrl}?page=1&pageSize=100&typeId=t1`).flush({
      items: [{ id: 'p2', typeId: 't1', name: 'Собака', photoUrl: '', price: 50, promoPrice: null, stockQuantity: 3 }],
      total: 1,
    });
    fixture.detectChanges();

    fixture.componentInstance.onProductSelected({ value: 'p2', label: 'Собака' });
    fixture.detectChanges();
    expect(el.querySelector('.item-card__subtotal')?.textContent?.trim()).toBe('50 ₴');

    const staleProduct: Product = {
      id: 'p1',
      typeId: 't1',
      name: 'Кіт',
      photoUrl: '',
      price: 100,
      promoPrice: null,
      stockQuantity: 9,
      createdAt: '',
      updatedAt: '',
    };
    fixture.componentRef.setInput('initialProduct', staleProduct);
    fixture.detectChanges();

    expect(el.querySelector('.item-card__subtotal')?.textContent?.trim()).toBe('50 ₴');
  });
});
