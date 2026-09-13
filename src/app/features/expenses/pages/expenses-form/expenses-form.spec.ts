import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { DictionariesService } from '../../../../core/dictionaries/dictionaries.service';
import { ExpensesForm } from './expenses-form';

describe('ExpensesForm', () => {
  let fixture: ComponentFixture<ExpensesForm>;
  let el: HTMLElement;
  let httpMock: HttpTestingController;
  let router: Router;
  const baseUrl = `${environment.apiUrl}/expenses`;

  const dictionariesStub = {
    expenseTypes: () => [
      { id: 't1', code: 'delivery', label: 'Доставка', requiresName: false },
      { id: 't2', code: 'other', label: 'Інше', requiresName: true },
    ],
  };

  const responseExpense = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: '9',
    typeId: 't1',
    name: null,
    amount: 150,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  });

  const create = (expenseId: string | null) => {
    TestBed.configureTestingModule({
      imports: [ExpensesForm],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: DictionariesService, useValue: dictionariesStub },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap(expenseId ? { id: expenseId } : {})) },
        },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(ExpensesForm);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  };

  const selectType = (id: string) => {
    const select = el.querySelector('#typeId') as HTMLSelectElement;
    select.value = id;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  const setInputValue = (id: string, value: string) => {
    const input = el.querySelector(`#${id}`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  afterEach(() => {
    httpMock.verify();
  });

  describe('create mode', () => {
    it('shows the "Нова витрата" title', () => {
      create(null);
      expect(el.querySelector('.page-title')?.textContent?.trim()).toBe('Нова витрата');
    });

    it('hides the name field for a type that does not require one, and enables save once a type is chosen', () => {
      create(null);
      const saveButton = el.querySelector('.btn-primary') as HTMLButtonElement;
      expect(saveButton.disabled).toBe(true);

      selectType('t1');
      expect(el.querySelector('#name')).toBeNull();
      expect(saveButton.disabled).toBe(false);

      setInputValue('amount', '150');
      expect(saveButton.disabled).toBe(false);
    });

    it('shows the name field and requires it for the "Інше" type', () => {
      create(null);
      selectType('t2');
      setInputValue('amount', '150');

      expect(el.querySelector('#name')).not.toBeNull();
      expect((el.querySelector('.btn-primary') as HTMLButtonElement).disabled).toBe(true);

      setInputValue('name', 'Ремонт принтера');
      expect((el.querySelector('.btn-primary') as HTMLButtonElement).disabled).toBe(false);
    });

    it('clears the name value when switching away from a requires-name type', () => {
      create(null);
      selectType('t2');
      setInputValue('name', 'Ремонт принтера');
      selectType('t1');

      expect(el.querySelector('#name')).toBeNull();
    });

    it('submits typeId+amount only for a plain type, and navigates to the list on success', () => {
      create(null);
      selectType('t1');
      setInputValue('amount', '150');

      (el.querySelector('.btn-primary') as HTMLButtonElement).click();

      const req = httpMock.expectOne(baseUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ typeId: 't1', amount: 150, brand: null });

      req.flush(responseExpense());
      expect(router.navigateByUrl).toHaveBeenCalledWith('/expenses');
    });

    it('includes name in the payload for the "Інше" type', () => {
      create(null);
      selectType('t2');
      setInputValue('name', 'Ремонт принтера');
      setInputValue('amount', '2800');

      (el.querySelector('.btn-primary') as HTMLButtonElement).click();

      const req = httpMock.expectOne(baseUrl);
      expect(req.request.body).toEqual({ typeId: 't2', name: 'Ремонт принтера', amount: 2800, brand: null });
      req.flush(responseExpense({ typeId: 't2', name: 'Ремонт принтера', amount: 2800 }));
    });

    it('defaults the group select to "Спільна" and includes the chosen brand in the payload', () => {
      create(null);
      selectType('t1');
      setInputValue('amount', '150');

      const brandSelect = el.querySelector('#brand') as HTMLSelectElement;
      expect(brandSelect.value).toBe('');

      brandSelect.value = 'vom';
      brandSelect.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      (el.querySelector('.btn-primary') as HTMLButtonElement).click();

      const req = httpMock.expectOne(baseUrl);
      expect(req.request.body).toEqual({ typeId: 't1', amount: 150, brand: 'vom' });
      req.flush(responseExpense({ brand: 'vom' }));
    });

    it('shows a plain string error message from the backend', () => {
      create(null);
      selectType('t1');
      setInputValue('amount', '150');

      (el.querySelector('.btn-primary') as HTMLButtonElement).click();
      httpMock.expectOne(baseUrl).flush({ message: 'Unknown expense type' }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();

      expect(el.querySelector('.error-text')?.textContent?.trim()).toBe('Unknown expense type');
    });

    it('navigates back to the list on breadcrumb click', () => {
      create(null);
      (el.querySelector('.breadcrumb') as HTMLButtonElement).click();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/expenses');
    });
  });

  describe('edit mode', () => {
    it('fetches and pre-fills the existing expense, including its group', () => {
      create('9');
      httpMock.expectOne(`${baseUrl}/9`).flush(responseExpense({ brand: 'm' }));
      fixture.detectChanges();

      expect(el.querySelector('.page-title')?.textContent?.trim()).toBe('Редагувати витрату');
      expect((el.querySelector('#typeId') as HTMLSelectElement).value).toBe('t1');
      expect((el.querySelector('#amount') as HTMLInputElement).value).toBe('150');
      expect((el.querySelector('#brand') as HTMLSelectElement).value).toBe('m');
    });

    it('pre-fills "Спільна" for an expense with no brand', () => {
      create('9');
      httpMock.expectOne(`${baseUrl}/9`).flush(responseExpense({ brand: null }));
      fixture.detectChanges();

      expect((el.querySelector('#brand') as HTMLSelectElement).value).toBe('');
    });

    it('PATCHes the updated payload and navigates to the list on success', () => {
      create('9');
      httpMock.expectOne(`${baseUrl}/9`).flush(responseExpense());
      fixture.detectChanges();
      setInputValue('amount', '200');

      (el.querySelector('.btn-primary') as HTMLButtonElement).click();

      const req = httpMock.expectOne(`${baseUrl}/9`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ typeId: 't1', amount: 200, brand: null });
      req.flush(responseExpense({ amount: 200 }));
      expect(router.navigateByUrl).toHaveBeenCalledWith('/expenses');
    });

    it('sends an explicit null to reset an expense back to "Спільна"', () => {
      create('9');
      httpMock.expectOne(`${baseUrl}/9`).flush(responseExpense({ brand: 'vom' }));
      fixture.detectChanges();

      const brandSelect = el.querySelector('#brand') as HTMLSelectElement;
      brandSelect.value = '';
      brandSelect.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      (el.querySelector('.btn-primary') as HTMLButtonElement).click();

      const req = httpMock.expectOne(`${baseUrl}/9`);
      expect(req.request.body).toEqual({ typeId: 't1', amount: 150, brand: null });
      req.flush(responseExpense({ brand: null }));
    });

    it('shows an error when the existing expense fails to load', () => {
      create('9');
      httpMock.expectOne(`${baseUrl}/9`).flush('boom', { status: 404, statusText: 'Not Found' });
      fixture.detectChanges();

      expect(el.querySelector('.error-text')?.textContent?.trim()).toBe('Не вдалося завантажити дані витрати');
    });
  });

  it('resets to a blank create form when navigating from edit back to create without recreating the component', () => {
    const paramMap = new Subject<ReturnType<typeof convertToParamMap>>();
    TestBed.configureTestingModule({
      imports: [ExpensesForm],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: DictionariesService, useValue: dictionariesStub },
        { provide: ActivatedRoute, useValue: { paramMap } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ExpensesForm);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;

    paramMap.next(convertToParamMap({ id: '9' }));
    httpMock.expectOne(`${baseUrl}/9`).flush(responseExpense({ typeId: 't2', name: 'Ремонт принтера', brand: 'vom' }));
    fixture.detectChanges();
    expect(el.querySelector('#name')).not.toBeNull();

    paramMap.next(convertToParamMap({}));
    fixture.detectChanges();

    expect(el.querySelector('.page-title')?.textContent?.trim()).toBe('Нова витрата');
    expect((el.querySelector('#typeId') as HTMLSelectElement).value).toBe('');
    expect(el.querySelector('#name')).toBeNull();
    expect((el.querySelector('#brand') as HTMLSelectElement).value).toBe('');
  });

  it('cancels the in-flight request for a stale id when navigation moves on before it resolves', () => {
    const paramMap = new Subject<ReturnType<typeof convertToParamMap>>();
    TestBed.configureTestingModule({
      imports: [ExpensesForm],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: DictionariesService, useValue: dictionariesStub },
        { provide: ActivatedRoute, useValue: { paramMap } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ExpensesForm);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;

    paramMap.next(convertToParamMap({ id: '9' }));
    const staleReq = httpMock.expectOne(`${baseUrl}/9`);

    paramMap.next(convertToParamMap({ id: '10' }));
    httpMock.expectOne(`${baseUrl}/10`).flush(responseExpense({ id: '10', amount: 500 }));
    fixture.detectChanges();

    expect(staleReq.cancelled).toBe(true);
    expect((el.querySelector('#amount') as HTMLInputElement).value).toBe('500');
  });
});
