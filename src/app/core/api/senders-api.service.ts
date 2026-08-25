import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  CreateSenderPayload,
  Sender,
  SenderAddress,
  SenderVerificationResult,
  SetSenderWarehousePayload,
} from '../../features/senders/models/sender.model';
import type { PaginatedResponse } from '../../shared/models/paginated-response.model';

@Injectable({ providedIn: 'root' })
export class SendersApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/senders`;

  list(page: number, pageSize: number): Observable<PaginatedResponse<Sender>> {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<PaginatedResponse<Sender>>(this.baseUrl, { params });
  }

  verify(apiKey: string): Observable<SenderVerificationResult> {
    return this.http.post<SenderVerificationResult>(`${this.baseUrl}/verify`, { apiKey });
  }

  create(payload: CreateSenderPayload): Observable<Sender> {
    return this.http.post<Sender>(this.baseUrl, payload);
  }

  activate(id: string): Observable<Sender> {
    return this.http.patch<Sender>(`${this.baseUrl}/${id}/activate`, {});
  }

  refresh(id: string): Observable<Sender> {
    return this.http.patch<Sender>(`${this.baseUrl}/${id}/refresh`, {});
  }

  deactivate(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  getAddresses(id: string): Observable<SenderAddress[]> {
    return this.http.get<SenderAddress[]>(`${this.baseUrl}/${id}/addresses`);
  }

  setWarehouse(id: string, payload: SetSenderWarehousePayload): Observable<Sender> {
    return this.http.patch<Sender>(`${this.baseUrl}/${id}/warehouse`, payload);
  }
}
