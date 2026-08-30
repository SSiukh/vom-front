import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { ProductsApiService } from './products-api.service';

describe('ProductsApiService', () => {
  let service: ProductsApiService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/products`;

  const product = () => ({
    id: '1',
    typeId: 't1',
    name: 'Кіт-космонавт',
    photoUrl: 'https://cdn.example.com/photo.png',
    price: 210,
    promoPrice: null,
    stockQuantity: 24,
    createdAt: '',
    updatedAt: '',
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProductsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('gets a paginated list with page/pageSize and no typeId/name when not filtering', () => {
    service.list(1, 10, null, null).subscribe();
    const req = httpMock.expectOne(`${baseUrl}?page=1&pageSize=10`);
    expect(req.request.method).toBe('GET');
    req.flush({ items: [], total: 0 });
  });

  it('includes typeId in the query when filtering', () => {
    service.list(2, 10, 't1', null).subscribe();
    const req = httpMock.expectOne(`${baseUrl}?page=2&pageSize=10&typeId=t1`);
    expect(req.request.method).toBe('GET');
    req.flush({ items: [], total: 0 });
  });

  it('includes name in the query when searching', () => {
    service.list(1, 10, null, 'кіт').subscribe();
    const req = httpMock.expectOne(`${baseUrl}?page=1&pageSize=10&name=%D0%BA%D1%96%D1%82`);
    expect(req.request.method).toBe('GET');
    req.flush({ items: [], total: 0 });
  });

  it('includes both typeId and name when both filters are active', () => {
    service.list(1, 10, 't1', 'кіт').subscribe();
    const req = httpMock.expectOne(`${baseUrl}?page=1&pageSize=10&typeId=t1&name=%D0%BA%D1%96%D1%82`);
    expect(req.request.method).toBe('GET');
    req.flush({ items: [], total: 0 });
  });

  it('gets a single product by id', () => {
    service.get('1').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/1`);
    expect(req.request.method).toBe('GET');
    req.flush(product());
  });

  it('posts FormData to /products for create', () => {
    const formData = new FormData();
    formData.append('name', 'Кіт-космонавт');
    service.create(formData).subscribe();
    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBe(formData);
    req.flush(product());
  });

  it('patches FormData to /products/:id for update', () => {
    const formData = new FormData();
    formData.append('name', 'Кіт-космонавт 2');
    service.update('1', formData).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toBe(formData);
    req.flush(product());
  });

  it('deletes /products/:id', () => {
    service.delete('1').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
