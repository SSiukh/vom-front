import { Injectable, inject, signal, type WritableSignal } from '@angular/core';
import { catchError, of, type Observable } from 'rxjs';
import { DictionariesApiService } from '../api/dictionaries-api.service';
import type {
  DictionaryItem,
  ExpenseType,
  ProductType,
  ShipmentType,
} from '../../shared/models/dictionary-item.model';

@Injectable({ providedIn: 'root' })
export class DictionariesService {
  private readonly api = inject(DictionariesApiService);

  private readonly shipmentTypesSignal = signal<ShipmentType[]>([]);
  private readonly productTypesSignal = signal<ProductType[]>([]);
  private readonly paymentTypesSignal = signal<DictionaryItem[]>([]);
  private readonly expenseTypesSignal = signal<ExpenseType[]>([]);
  private readonly deliveryTypesSignal = signal<DictionaryItem[]>([]);
  private readonly shipmentStatusesSignal = signal<DictionaryItem[]>([]);
  private readonly hasErrorSignal = signal(false);

  readonly shipmentTypes = this.shipmentTypesSignal.asReadonly();
  readonly productTypes = this.productTypesSignal.asReadonly();
  readonly paymentTypes = this.paymentTypesSignal.asReadonly();
  readonly expenseTypes = this.expenseTypesSignal.asReadonly();
  readonly deliveryTypes = this.deliveryTypesSignal.asReadonly();
  readonly shipmentStatuses = this.shipmentStatusesSignal.asReadonly();
  readonly hasError = this.hasErrorSignal.asReadonly();

  constructor() {
    this.loadAll();
  }

  reload(): void {
    this.hasErrorSignal.set(false);
    this.loadAll();
  }

  private loadAll(): void {
    this.load(this.api.getShipmentTypes(), this.shipmentTypesSignal);
    this.load(this.api.getProductTypes(), this.productTypesSignal);
    this.load(this.api.getPaymentTypes(), this.paymentTypesSignal);
    this.load(this.api.getExpenseTypes(), this.expenseTypesSignal);
    this.load(this.api.getDeliveryTypes(), this.deliveryTypesSignal);
    this.load(this.api.getShipmentStatuses(), this.shipmentStatusesSignal);
  }

  private load<T>(request$: Observable<T[]>, target: WritableSignal<T[]>): void {
    request$
      .pipe(
        catchError(() => {
          this.hasErrorSignal.set(true);
          return of([] as T[]);
        }),
      )
      .subscribe((items) => target.set(items));
  }
}
