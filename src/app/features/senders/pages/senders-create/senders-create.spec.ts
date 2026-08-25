import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { SendersCreate } from './senders-create';

describe('SendersCreate', () => {
  let fixture: ComponentFixture<SendersCreate>;
  let el: HTMLElement;
  let httpMock: HttpTestingController;
  let router: Router;
  const baseUrl = `${environment.apiUrl}/senders`;
  const novaPoshtaUrl = `${environment.apiUrl}/nova-poshta`;

  const create = () => {
    TestBed.configureTestingModule({
      imports: [SendersCreate],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(SendersCreate);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  };

  const setApiKey = (value: string) => {
    const input = el.querySelector('#apiKey') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  const verify = () => {
    setApiKey('key-123');
    (el.querySelector('.btn-ghost-accent') as HTMLButtonElement).click();
    httpMock.expectOne(`${baseUrl}/verify`).flush({ fullName: 'Іван Іванов', phone: '+380501234567' });
    fixture.detectChanges();
  };

  const selectAddress = () => {
    const component = fixture.debugElement.componentInstance as SendersCreate;
    component.onCitySelected({ value: 'city-1', label: 'Київ' });
    httpMock.expectOne(`${novaPoshtaUrl}/warehouses?cityRef=city-1`).flush([{ ref: 'wh-1', description: 'Відділення 1' }]);
    component.onWarehouseSelected({ value: 'wh-1', label: 'Відділення 1' });
    fixture.detectChanges();
  };

  afterEach(() => {
    httpMock.verify();
  });

  it('navigates back to the senders list on breadcrumb click', () => {
    create();
    (el.querySelector('.breadcrumb') as HTMLButtonElement).click();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/senders');
  });

  it('disables "Перевірити" until an API key is entered', () => {
    create();
    const button = el.querySelector('.btn-ghost-accent') as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    setApiKey('key-123');
    expect(button.disabled).toBe(false);
  });

  it('shows the success banner and locked contact fields after a successful verify, and disables the input', () => {
    create();
    verify();

    expect(el.querySelector('.success-banner')).not.toBeNull();
    const lockedValues = Array.from(el.querySelectorAll('.locked-field span')).map((s) => s.textContent?.trim());
    expect(lockedValues).toEqual(['Іван Іванов', '+380501234567']);
    expect((el.querySelector('#apiKey') as HTMLInputElement).disabled).toBe(true);
    expect(el.querySelector('.btn-ghost-accent')).toBeNull();
  });

  it('shows an error message when verification fails', () => {
    create();
    setApiKey('bad-key');

    (el.querySelector('.btn-ghost-accent') as HTMLButtonElement).click();
    httpMock.expectOne(`${baseUrl}/verify`).flush('err', { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(el.querySelector('.error-text')?.textContent?.trim()).toBe(
      'Не вдалося перевірити API ключ. Перевірте його правильність.',
    );
    expect(el.querySelector('.success-banner')).toBeNull();
  });

  it('shows a rate-limit message when verify is throttled (429)', () => {
    create();
    setApiKey('key-123');

    (el.querySelector('.btn-ghost-accent') as HTMLButtonElement).click();
    httpMock.expectOne(`${baseUrl}/verify`).flush('err', { status: 429, statusText: 'Too Many Requests' });
    fixture.detectChanges();

    expect(el.querySelector('.error-text')?.textContent?.trim()).toBe('Забагато спроб — спробуйте пізніше');
  });

  it('keeps "Зберегти" disabled after verification until a city and warehouse are chosen', () => {
    create();
    const saveButton = el.querySelector('.btn-primary') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);

    verify();
    expect(saveButton.disabled).toBe(true);

    const component = fixture.debugElement.componentInstance as SendersCreate;
    component.onCitySelected({ value: 'city-1', label: 'Київ' });
    httpMock.expectOne(`${novaPoshtaUrl}/warehouses?cityRef=city-1`).flush([{ ref: 'wh-1', description: 'Відділення 1' }]);
    fixture.detectChanges();
    expect(saveButton.disabled).toBe(true);

    component.onWarehouseSelected({ value: 'wh-1', label: 'Відділення 1' });
    fixture.detectChanges();
    expect(saveButton.disabled).toBe(false);
  });

  it('fetches warehouses after a city is selected', () => {
    create();
    verify();

    const component = fixture.debugElement.componentInstance as SendersCreate;
    component.onCitySelected({ value: 'city-1', label: 'Київ' });
    const req = httpMock.expectOne(`${novaPoshtaUrl}/warehouses?cityRef=city-1`);
    req.flush([{ ref: 'wh-1', description: 'Відділення 1' }]);
    fixture.detectChanges();

    expect(component['warehouseOptions']()).toEqual([{ value: 'wh-1', label: 'Відділення 1' }]);
  });

  it('saves the sender with the chosen address and navigates to the list on success', () => {
    create();
    verify();
    selectAddress();

    (el.querySelector('.btn-primary') as HTMLButtonElement).click();
    const req = httpMock.expectOne(baseUrl);
    expect(req.request.body).toEqual({ apiKey: 'key-123', cityRef: 'city-1', warehouseRef: 'wh-1' });
    req.flush({
      id: '1',
      fullName: 'Іван Іванов',
      phone: '+380501234567',
      isActive: false,
      createdAt: '',
      updatedAt: '',
    });

    expect(router.navigateByUrl).toHaveBeenCalledWith('/senders');
  });

  it('shows an error message when saving fails', () => {
    create();
    verify();
    selectAddress();

    (el.querySelector('.btn-primary') as HTMLButtonElement).click();
    httpMock.expectOne(baseUrl).flush('err', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(el.querySelector('.error-text')?.textContent?.trim()).toBe('Не вдалося зберегти відправника');
    expect(router.navigateByUrl).not.toHaveBeenCalledWith('/senders');
  });

  it('shows a rate-limit message when save is throttled (429)', () => {
    create();
    verify();
    selectAddress();

    (el.querySelector('.btn-primary') as HTMLButtonElement).click();
    httpMock.expectOne(baseUrl).flush('err', { status: 429, statusText: 'Too Many Requests' });
    fixture.detectChanges();

    expect(el.querySelector('.error-text')?.textContent?.trim()).toBe('Забагато спроб — спробуйте пізніше');
  });

  it('surfaces the backend message when the chosen warehouse fails server-side re-validation (400)', () => {
    create();
    verify();
    selectAddress();

    (el.querySelector('.btn-primary') as HTMLButtonElement).click();
    httpMock
      .expectOne(baseUrl)
      .flush({ message: 'Unknown warehouse for the given city' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(el.querySelector('.error-text')?.textContent?.trim()).toBe('Unknown warehouse for the given city');
  });
});
