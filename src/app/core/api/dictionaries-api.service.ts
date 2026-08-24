import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  DictionaryItem,
  ExpenseType,
  ProductType,
  ShipmentType,
} from '../../shared/models/dictionary-item.model';

@Injectable({ providedIn: 'root' })
export class DictionariesApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/dictionaries`;

  getOrderTypes(): Observable<DictionaryItem[]> {
    return this.http.get<DictionaryItem[]>(`${this.baseUrl}/order-types`);
  }

  getShipmentTypes(): Observable<ShipmentType[]> {
    return this.http.get<ShipmentType[]>(`${this.baseUrl}/shipment-types`);
  }

  getProductTypes(): Observable<ProductType[]> {
    return this.http.get<ProductType[]>(`${this.baseUrl}/product-types`);
  }

  getPaymentTypes(): Observable<DictionaryItem[]> {
    return this.http.get<DictionaryItem[]>(`${this.baseUrl}/payment-types`);
  }

  getExpenseTypes(): Observable<ExpenseType[]> {
    return this.http.get<ExpenseType[]>(`${this.baseUrl}/expense-types`);
  }

  getDeliveryTypes(): Observable<DictionaryItem[]> {
    return this.http.get<DictionaryItem[]>(`${this.baseUrl}/delivery-types`);
  }

  getShipmentStatuses(): Observable<DictionaryItem[]> {
    return this.http.get<DictionaryItem[]>(`${this.baseUrl}/shipment-statuses`);
  }
}
