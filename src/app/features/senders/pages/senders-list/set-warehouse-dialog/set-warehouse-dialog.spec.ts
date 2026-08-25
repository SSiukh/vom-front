import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../../../../environments/environment';
import { SetWarehouseDialog } from './set-warehouse-dialog';

describe('SetWarehouseDialog', () => {
  let fixture: ComponentFixture<SetWarehouseDialog>;
  let component: SetWarehouseDialog;
  let el: HTMLElement;
  let httpMock: HttpTestingController;
  const novaPoshtaUrl = `${environment.apiUrl}/nova-poshta`;

  const create = () => {
    TestBed.configureTestingModule({
      imports: [SetWarehouseDialog],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SetWarehouseDialog);
    component = fixture.componentInstance;
  };

  const setOpen = (open: boolean) => {
    fixture.componentRef.setInput('open', open);
    fixture.detectChanges();
  };

  const selectCityAndWarehouse = () => {
    component.onCitySelected({ value: 'city-1', label: 'Київ' });
    httpMock.expectOne(`${novaPoshtaUrl}/warehouses?cityRef=city-1`).flush([{ ref: 'wh-1', description: 'Відділення №1' }]);
    component.onWarehouseSelected({ value: 'wh-1', label: 'Відділення №1' });
    fixture.detectChanges();
  };

  afterEach(() => {
    httpMock.verify();
  });

  it('renders nothing when closed', () => {
    create();
    setOpen(false);
    el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.dialog-overlay')).toBeNull();
  });

  it('shows the dialog with the sender name when open', () => {
    create();
    fixture.componentRef.setInput('senderName', 'ФОП Волошин О.М.');
    setOpen(true);
    el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.dialog-overlay')).not.toBeNull();
    expect(el.querySelector('.dialog-message')?.textContent?.trim()).toBe('ФОП Волошин О.М.');
  });

  it('keeps "Зберегти" disabled until both a city and a warehouse are chosen', () => {
    create();
    setOpen(true);
    el = fixture.nativeElement as HTMLElement;
    const saveButton = el.querySelector('.btn-primary') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);

    component.onCitySelected({ value: 'city-1', label: 'Київ' });
    httpMock.expectOne(`${novaPoshtaUrl}/warehouses?cityRef=city-1`).flush([{ ref: 'wh-1', description: 'Відділення №1' }]);
    fixture.detectChanges();
    expect(saveButton.disabled).toBe(true);

    component.onWarehouseSelected({ value: 'wh-1', label: 'Відділення №1' });
    fixture.detectChanges();
    expect(saveButton.disabled).toBe(false);
  });

  it('emits saved with the chosen cityRef/warehouseRef', () => {
    create();
    setOpen(true);
    el = fixture.nativeElement as HTMLElement;
    const emitted: unknown[] = [];
    component.saved.subscribe((value) => emitted.push(value));

    selectCityAndWarehouse();
    (el.querySelector('.btn-primary') as HTMLButtonElement).click();

    expect(emitted).toEqual([{ cityRef: 'city-1', warehouseRef: 'wh-1' }]);
  });

  it('emits cancelled when "Скасувати" is clicked', () => {
    create();
    setOpen(true);
    el = fixture.nativeElement as HTMLElement;
    const emitted: unknown[] = [];
    component.cancelled.subscribe(() => emitted.push(true));

    (el.querySelector('.btn-ghost') as HTMLButtonElement).click();

    expect(emitted).toEqual([true]);
  });

  it('resets its selection each time it re-opens', () => {
    create();
    setOpen(true);
    el = fixture.nativeElement as HTMLElement;
    selectCityAndWarehouse();
    expect((el.querySelector('.btn-primary') as HTMLButtonElement).disabled).toBe(false);

    setOpen(false);
    setOpen(true);

    expect((el.querySelector('.btn-primary') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows a lookup error and disables the warehouse select until a city is chosen', () => {
    create();
    setOpen(true);
    el = fixture.nativeElement as HTMLElement;

    component.onCitySearchTermChange('boom');
    httpMock.expectOne(`${novaPoshtaUrl}/cities?query=boom`).flush('err', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(el.querySelector('.error-text')?.textContent).toContain('Не вдалося виконати пошук');
  });

  it('shows the passed-in errorMessage input', () => {
    create();
    fixture.componentRef.setInput('errorMessage', 'Unknown warehouse for the given city');
    setOpen(true);
    el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.error-text')?.textContent?.trim()).toBe('Unknown warehouse for the given city');
  });
});
