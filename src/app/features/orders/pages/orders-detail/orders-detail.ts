import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideChevronLeft, LucidePencil, LucideTrash2 } from '@lucide/angular';
import { catchError, of, switchMap } from 'rxjs';
import { OrdersApiService } from '../../../../core/api/orders-api.service';
import { SendersApiService } from '../../../../core/api/senders-api.service';
import { DictionariesService } from '../../../../core/dictionaries/dictionaries.service';
import { FEATURE_ROUTES } from '../../../../core/routes.constants';
import type { Sender } from '../../../senders/models/sender.model';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { CopyableText } from '../../../../shared/ui/copyable-text/copyable-text';
import { shipmentStatusBadgeClass } from '../../../../shared/utils/shipment-status-badge.util';
import type { Order, SetOrderStatusFlagsPayload } from '../../models/order.model';

type StatusFlag = keyof SetOrderStatusFlagsPayload;

const SENDERS_FETCH_PAGE_SIZE = 100;

@Component({
  selector: 'app-orders-detail',
  imports: [DatePipe, ConfirmDialog, CopyableText, LucideChevronLeft, LucidePencil, LucideTrash2],
  templateUrl: './orders-detail.html',
  styleUrl: './orders-detail.css',
})
export class OrdersDetail {
  private readonly ordersApi = inject(OrdersApiService);
  private readonly sendersApi = inject(SendersApiService);
  protected readonly dictionaries = inject(DictionariesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private orderId = '';

  protected readonly order = signal<Order | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly confirmingDelete = signal(false);
  protected readonly deleting = signal(false);
  protected readonly updatingFlag = signal<StatusFlag | null>(null);
  protected readonly flagsError = signal<string | null>(null);

  protected readonly senderInfo = signal<Sender | null>(null);
  protected readonly senderAddressLabel = signal<string | null>(null);

  constructor() {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          this.orderId = params.get('id') ?? '';
          this.loading.set(true);
          this.error.set(null);
          return this.ordersApi.get(this.orderId).pipe(
            catchError(() => {
              this.loading.set(false);
              this.error.set('Не вдалося завантажити дані замовлення');
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((order) => {
        if (order) {
          this.loading.set(false);
          this.order.set(order);
          this.loadSenderInfo(order.senderId, order.senderAddressRef);
        }
      });
  }

  goBack(): void {
    this.router.navigateByUrl(FEATURE_ROUTES.orders);
  }

  goToEdit(): void {
    this.router.navigateByUrl(`${FEATURE_ROUTES.orders}/${this.orderId}/edit`);
  }

  shipmentTypeLabel(): string {
    return this.dictionaries.shipmentTypes().find((t) => t.id === this.order()?.shipmentTypeId)?.label ?? '';
  }

  paymentTypeLabel(): string {
    return this.dictionaries.paymentTypes().find((t) => t.id === this.order()?.paymentTypeId)?.label ?? '';
  }

  deliveryTypeLabel(): string {
    return this.dictionaries.deliveryTypes().find((t) => t.id === this.order()?.deliveryTypeId)?.label ?? '';
  }

  productTypeLabel(productTypeId: string): string {
    return this.dictionaries.productTypes().find((t) => t.id === productTypeId)?.label ?? '';
  }

  statusLabel(): string | null {
    const id = this.order()?.shipmentStatusId;
    if (!id) {
      return null;
    }
    return this.dictionaries.shipmentStatuses().find((s) => s.id === id)?.label ?? null;
  }

  statusBadgeClass(): string {
    const id = this.order()?.shipmentStatusId;
    const code = this.dictionaries.shipmentStatuses().find((s) => s.id === id)?.code;
    return shipmentStatusBadgeClass(code);
  }

  toggleFlag(flag: StatusFlag, event: Event): void {
    const order = this.order();
    const checkbox = event.target as HTMLInputElement;
    if (!order || this.updatingFlag() !== null) {
      checkbox.checked = order?.[flag] ?? checkbox.checked;
      return;
    }
    const previousValue = order[flag];
    this.updatingFlag.set(flag);
    this.flagsError.set(null);
    this.ordersApi
      .setStatusFlags(this.orderId, { [flag]: !previousValue })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.updatingFlag.set(null);
          this.order.set(updated);
          checkbox.checked = updated[flag];
        },
        error: (error: unknown) => {
          this.updatingFlag.set(null);
          this.flagsError.set(this.resolveFlagsErrorMessage(error));
          checkbox.checked = previousValue;
        },
      });
  }

  private resolveFlagsErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 429) {
      return 'Забагато спроб — спробуйте пізніше';
    }
    return 'Не вдалося оновити статус замовлення';
  }

  deleteConfirmMessage(): string {
    const order = this.order();
    if (!order) {
      return '';
    }
    const waybillPart = order.npWaybillNumber
      ? `ЕН ${order.npWaybillNumber} буде видалено з системи та скасовано в Новій Пошті.`
      : 'Замовлення буде видалено з системи.';
    const restockItems = order.items.filter((item) => item.productId !== null);
    if (restockItems.length === 0) {
      return waybillPart;
    }
    const restockList = restockItems.map((item) => `${item.nameSnapshot} +${item.quantity} шт`).join(', ');
    return `${waybillPart} Товари повернуться на склад: ${restockList}.`;
  }

  requestDelete(): void {
    this.confirmingDelete.set(true);
  }

  cancelDelete(): void {
    this.confirmingDelete.set(false);
  }

  confirmDelete(): void {
    if (this.deleting()) {
      return;
    }
    this.deleting.set(true);
    this.error.set(null);
    this.ordersApi
      .delete(this.orderId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.router.navigateByUrl(FEATURE_ROUTES.orders);
        },
        error: (error: unknown) => {
          this.deleting.set(false);
          this.confirmingDelete.set(false);
          this.error.set(this.resolveDeleteErrorMessage(error));
        },
      });
  }

  private resolveDeleteErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 429) {
      return 'Забагато спроб — спробуйте пізніше';
    }
    if (error instanceof HttpErrorResponse && error.status === 502) {
      return 'Замовлення видалено з системи, але виникла помилка при скасуванні ЕН у Новій Пошті. Скасуйте ЕН вручну.';
    }
    return 'Не вдалося видалити замовлення';
  }

  private loadSenderInfo(senderId: string, senderAddressRef: string): void {
    this.sendersApi
      .list(1, SENDERS_FETCH_PAGE_SIZE)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.senderInfo.set(response.items.find((sender) => sender.id === senderId) ?? null);
        },
        error: () => {
          this.senderInfo.set(null);
        },
      });
    this.sendersApi
      .getAddresses(senderId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (addresses) => {
          const match = addresses.find((address) => address.npAddressRef === senderAddressRef);
          this.senderAddressLabel.set(match?.description ?? null);
        },
        error: () => {
          this.senderAddressLabel.set(null);
        },
      });
  }
}
