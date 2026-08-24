import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { CrmTableResponse } from '../../features/crm/models/crm-row.model';

export interface CrmTableFilters {
  dateFrom: string | null;
  dateTo: string | null;
  productTypeId: string | null;
  shipmentStatusId: string | null;
  sortOrder: 'asc' | 'desc';
}

@Injectable({ providedIn: 'root' })
export class CrmApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/crm`;

  list(page: number, pageSize: number, filters: CrmTableFilters): Observable<CrmTableResponse> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize).set('sortOrder', filters.sortOrder);
    if (filters.dateFrom) {
      params = params.set('dateFrom', filters.dateFrom);
    }
    if (filters.dateTo) {
      params = params.set('dateTo', filters.dateTo);
    }
    if (filters.productTypeId) {
      params = params.set('productTypeId', filters.productTypeId);
    }
    if (filters.shipmentStatusId) {
      params = params.set('shipmentStatusId', filters.shipmentStatusId);
    }
    return this.http.get<CrmTableResponse>(`${this.baseUrl}/table`, { params });
  }
}
