import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { Product } from '../../features/products/models/product.model';
import type { PaginatedResponse } from '../../shared/models/paginated-response.model';

@Injectable({ providedIn: 'root' })
export class ProductsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/products`;

  list(page: number, pageSize: number, typeId: string | null): Observable<PaginatedResponse<Product>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (typeId) {
      params = params.set('typeId', typeId);
    }
    return this.http.get<PaginatedResponse<Product>>(this.baseUrl, { params });
  }

  get(id: string): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/${id}`);
  }

  create(formData: FormData): Observable<Product> {
    return this.http.post<Product>(this.baseUrl, formData);
  }

  update(id: string, formData: FormData): Observable<Product> {
    return this.http.patch<Product>(`${this.baseUrl}/${id}`, formData);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
