import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { NovaPoshtaApiService } from './nova-poshta-api.service';

describe('NovaPoshtaApiService', () => {
  let service: NovaPoshtaApiService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/nova-poshta`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(NovaPoshtaApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('searches cities by query', () => {
    service.searchCities('Київ').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/cities?query=%D0%9A%D0%B8%D1%97%D0%B2`);
    expect(req.request.method).toBe('GET');
    req.flush([{ ref: 'c1', description: 'Київ' }]);
  });

  it('gets warehouses for a city', () => {
    service.getWarehouses('city-1').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/warehouses?cityRef=city-1`);
    expect(req.request.method).toBe('GET');
    req.flush([{ ref: 'w1', description: 'Відділення №1' }]);
  });

  it('gets streets for a city without a query', () => {
    service.getStreets('city-1').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/streets?cityRef=city-1`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('includes the query when searching streets', () => {
    service.getStreets('city-1', 'Хрещатик').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/streets?cityRef=city-1&query=%D0%A5%D1%80%D0%B5%D1%89%D0%B0%D1%82%D0%B8%D0%BA`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('gets postomats for a city', () => {
    service.getPostomats('city-1').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/postomats?cityRef=city-1`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
