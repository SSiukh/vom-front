import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import type { CreateExpensePayload } from '../../features/expenses/models/expense.model';
import { ExpensesApiService } from './expenses-api.service';

describe('ExpensesApiService', () => {
  let service: ExpensesApiService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/expenses`;

  const expense = () => ({
    id: '1',
    typeId: 't1',
    name: null,
    amount: 150,
    createdAt: '',
    updatedAt: '',
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ExpensesApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('gets a paginated list with page/pageSize', () => {
    service.list(1, 10).subscribe();
    const req = httpMock.expectOne(`${baseUrl}?page=1&pageSize=10`);
    expect(req.request.method).toBe('GET');
    req.flush({ items: [expense()], total: 1 });
  });

  it('gets a single expense by id', () => {
    service.get('1').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/1`);
    expect(req.request.method).toBe('GET');
    req.flush(expense());
  });

  it('posts the create payload as JSON', () => {
    const payload: CreateExpensePayload = { typeId: 't1', amount: 150 };
    service.create(payload).subscribe();
    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(expense());
  });

  it('patches the update payload', () => {
    service.update('1', { amount: 200 }).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ amount: 200 });
    req.flush(expense());
  });

  it('deletes /expenses/:id', () => {
    service.delete('1').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
