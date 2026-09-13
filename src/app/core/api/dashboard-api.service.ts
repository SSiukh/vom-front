import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { DashboardSummary } from '../../features/dashboard/models/dashboard-summary.model';
import type { ProductBrand } from '../../shared/models/product-brand.model';

@Injectable({ providedIn: 'root' })
export class DashboardApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/dashboard`;

  getSummary(dateFrom: string | null, dateTo: string | null, brand: ProductBrand | null): Observable<DashboardSummary> {
    let params = new HttpParams();
    if (dateFrom) {
      params = params.set('dateFrom', dateFrom);
    }
    if (dateTo) {
      params = params.set('dateTo', dateTo);
    }
    if (brand) {
      params = params.set('brand', brand);
    }
    return this.http.get<DashboardSummary>(this.baseUrl, { params });
  }
}
