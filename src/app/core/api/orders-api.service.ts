import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  BulkSyncStatusResult,
  CreateOrderPayload,
  Order,
  SetOrderStatusFlagsPayload,
  UpdateOrderPayload,
} from '../../features/orders/models/order.model';
import type { PaginatedResponse } from '../../shared/models/paginated-response.model';
import { REQUEST_TIMEOUT_MS } from '../interceptors/request-timeout.interceptor';

const SYNC_ALL_STATUSES_TIMEOUT_MS = 90_000;

@Injectable({ providedIn: 'root' })
export class OrdersApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/orders`;

  list(
    page: number,
    pageSize: number,
    dateFrom: string | null,
    dateTo: string | null,
  ): Observable<PaginatedResponse<Order>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (dateFrom) {
      params = params.set('dateFrom', dateFrom);
    }
    if (dateTo) {
      params = params.set('dateTo', dateTo);
    }
    return this.http.get<PaginatedResponse<Order>>(this.baseUrl, { params });
  }

  get(id: string): Observable<Order> {
    return this.http.get<Order>(`${this.baseUrl}/${id}`);
  }

  create(payload: CreateOrderPayload): Observable<Order> {
    return this.http.post<Order>(this.baseUrl, payload);
  }

  update(id: string, payload: UpdateOrderPayload): Observable<Order> {
    return this.http.patch<Order>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  setStatusFlags(id: string, payload: SetOrderStatusFlagsPayload): Observable<Order> {
    return this.http.patch<Order>(`${this.baseUrl}/${id}/status-flags`, payload);
  }

  syncAllStatuses(): Observable<BulkSyncStatusResult> {
    return this.http.patch<BulkSyncStatusResult>(`${this.baseUrl}/sync-statuses`, null, {
      context: new HttpContext().set(REQUEST_TIMEOUT_MS, SYNC_ALL_STATUSES_TIMEOUT_MS),
    });
  }
}
