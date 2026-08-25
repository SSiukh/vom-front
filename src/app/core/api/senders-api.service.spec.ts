import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { SendersApiService } from './senders-api.service';

describe('SendersApiService', () => {
  let service: SendersApiService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/senders`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SendersApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('gets a paginated list with page/pageSize query params', () => {
    service.list(2, 10).subscribe();
    const req = httpMock.expectOne(`${baseUrl}?page=2&pageSize=10`);
    expect(req.request.method).toBe('GET');
    req.flush({ items: [], total: 0 });
  });

  it('posts apiKey to /senders/verify', () => {
    service.verify('key-1').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/verify`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ apiKey: 'key-1' });
    req.flush({ fullName: 'Іван Іванов', phone: '+380501234567' });
  });

  it('posts apiKey/cityRef/warehouseRef to /senders', () => {
    service.create({ apiKey: 'key-1', cityRef: 'city-1', warehouseRef: 'wh-1' }).subscribe();
    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ apiKey: 'key-1', cityRef: 'city-1', warehouseRef: 'wh-1' });
    req.flush({
      id: '1',
      fullName: 'Іван Іванов',
      phone: '+380501234567',
      isActive: false,
      createdAt: '',
      updatedAt: '',
    });
  });

  it('patches /senders/:id/activate with an empty body', () => {
    service.activate('1').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/1/activate`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({});
    req.flush({ id: '1', fullName: 'a', phone: 'b', isActive: true, createdAt: '', updatedAt: '' });
  });

  it('patches /senders/:id/refresh with an empty body', () => {
    service.refresh('1').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/1/refresh`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({});
    req.flush({ id: '1', fullName: 'a', phone: 'b', isActive: false, createdAt: '', updatedAt: '' });
  });

  it('deactivates /senders/:id (DELETE verb, soft-deactivates server-side)', () => {
    service.deactivate('1').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('gets /senders/:id/addresses', () => {
    service.getAddresses('1').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/1/addresses`);
    expect(req.request.method).toBe('GET');
    req.flush([{ npAddressRef: 'ref-1', description: 'м. Київ, вул. Хрещатик, 1' }]);
  });

  it('patches /senders/:id/warehouse with cityRef/warehouseRef', () => {
    service.setWarehouse('1', { cityRef: 'city-1', warehouseRef: 'wh-1' }).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/1/warehouse`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ cityRef: 'city-1', warehouseRef: 'wh-1' });
    req.flush({ id: '1', fullName: 'a', phone: 'b', isActive: true, createdAt: '', updatedAt: '' });
  });
});
