import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { AddressOption } from '../../features/orders/models/address-option.model';

@Injectable({ providedIn: 'root' })
export class NovaPoshtaApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/nova-poshta`;

  searchCities(query: string): Observable<AddressOption[]> {
    const params = new HttpParams().set('query', query);
    return this.http.get<AddressOption[]>(`${this.baseUrl}/cities`, { params });
  }

  getWarehouses(cityRef: string): Observable<AddressOption[]> {
    const params = new HttpParams().set('cityRef', cityRef);
    return this.http.get<AddressOption[]>(`${this.baseUrl}/warehouses`, { params });
  }

  getStreets(cityRef: string, query?: string): Observable<AddressOption[]> {
    let params = new HttpParams().set('cityRef', cityRef);
    if (query) {
      params = params.set('query', query);
    }
    return this.http.get<AddressOption[]>(`${this.baseUrl}/streets`, { params });
  }

  getPostomats(cityRef: string): Observable<AddressOption[]> {
    const params = new HttpParams().set('cityRef', cityRef);
    return this.http.get<AddressOption[]>(`${this.baseUrl}/postomats`, { params });
  }
}
