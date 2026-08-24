import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { CreateExpensePayload, Expense, UpdateExpensePayload } from '../../features/expenses/models/expense.model';
import type { PaginatedResponse } from '../../shared/models/paginated-response.model';

@Injectable({ providedIn: 'root' })
export class ExpensesApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/expenses`;

  list(page: number, pageSize: number): Observable<PaginatedResponse<Expense>> {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<PaginatedResponse<Expense>>(this.baseUrl, { params });
  }

  get(id: string): Observable<Expense> {
    return this.http.get<Expense>(`${this.baseUrl}/${id}`);
  }

  create(payload: CreateExpensePayload): Observable<Expense> {
    return this.http.post<Expense>(this.baseUrl, payload);
  }

  update(id: string, payload: UpdateExpensePayload): Observable<Expense> {
    return this.http.patch<Expense>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
