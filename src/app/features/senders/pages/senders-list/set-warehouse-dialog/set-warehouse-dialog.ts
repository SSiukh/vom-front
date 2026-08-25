import { Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NovaPoshtaApiService } from '../../../../../core/api/nova-poshta-api.service';
import { SearchableSelect, type SelectOption } from '../../../../../shared/ui/searchable-select/searchable-select';
import type { SetSenderWarehousePayload } from '../../../models/sender.model';

@Component({
  selector: 'app-set-warehouse-dialog',
  imports: [SearchableSelect],
  templateUrl: './set-warehouse-dialog.html',
  styleUrl: './set-warehouse-dialog.css',
})
export class SetWarehouseDialog {
  private readonly novaPoshtaApi = inject(NovaPoshtaApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly open = input.required<boolean>();
  readonly senderName = input<string | null>(null);
  readonly saving = input(false);
  readonly errorMessage = input<string | null>(null);

  readonly saved = output<SetSenderWarehousePayload>();
  readonly cancelled = output<void>();

  protected readonly citiesLoading = signal(false);
  protected readonly cityOptions = signal<SelectOption[]>([]);
  protected readonly selectedCityLabel = signal<string | null>(null);
  protected readonly cityLookupError = signal<string | null>(null);
  private cityRef = signal<string | null>(null);

  protected readonly warehousesLoading = signal(false);
  protected readonly warehouseOptions = signal<SelectOption[]>([]);
  protected readonly selectedWarehouseLabel = signal<string | null>(null);
  protected readonly warehouseLookupError = signal<string | null>(null);
  private warehouseRef = signal<string | null>(null);
  private allWarehouses: SelectOption[] = [];

  constructor() {
    effect(() => {
      if (this.open()) {
        this.reset();
      }
    });
  }

  cityChosen(): boolean {
    return this.cityRef() !== null;
  }

  canSave(): boolean {
    return this.cityRef() !== null && this.warehouseRef() !== null;
  }

  onCitySearchTermChange(term: string): void {
    this.cityLookupError.set(null);
    const trimmed = term.trim();
    if (!trimmed) {
      this.cityOptions.set([]);
      return;
    }
    this.citiesLoading.set(true);
    this.novaPoshtaApi
      .searchCities(trimmed)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (options) => {
          this.citiesLoading.set(false);
          this.cityOptions.set(options.map((o) => ({ value: o.ref, label: o.description })));
        },
        error: () => {
          this.citiesLoading.set(false);
          this.cityLookupError.set('Не вдалося виконати пошук населеного пункту');
        },
      });
  }

  onCitySelected(option: SelectOption): void {
    this.selectedCityLabel.set(option.label);
    this.cityRef.set(option.value);
    this.warehouseRef.set(null);
    this.selectedWarehouseLabel.set(null);
    this.loadWarehouses(option.value);
  }

  onWarehouseSearchTermChange(term: string): void {
    this.warehouseOptions.set(this.filterOptions(this.allWarehouses, term));
  }

  onWarehouseSelected(option: SelectOption): void {
    this.selectedWarehouseLabel.set(option.label);
    this.warehouseRef.set(option.value);
  }

  save(): void {
    const cityRef = this.cityRef();
    const warehouseRef = this.warehouseRef();
    if (!cityRef || !warehouseRef) {
      return;
    }
    this.saved.emit({ cityRef, warehouseRef });
  }

  cancel(): void {
    this.cancelled.emit();
  }

  private reset(): void {
    this.citiesLoading.set(false);
    this.cityOptions.set([]);
    this.selectedCityLabel.set(null);
    this.cityLookupError.set(null);
    this.cityRef.set(null);

    this.warehousesLoading.set(false);
    this.warehouseOptions.set([]);
    this.selectedWarehouseLabel.set(null);
    this.warehouseLookupError.set(null);
    this.warehouseRef.set(null);
    this.allWarehouses = [];
  }

  private loadWarehouses(cityRef: string): void {
    this.warehousesLoading.set(true);
    this.warehouseLookupError.set(null);
    this.novaPoshtaApi
      .getWarehouses(cityRef)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (options) => {
          this.warehousesLoading.set(false);
          this.allWarehouses = options.map((o) => ({ value: o.ref, label: o.description }));
          this.warehouseOptions.set(this.allWarehouses);
        },
        error: () => {
          this.warehousesLoading.set(false);
          this.warehouseLookupError.set('Не вдалося завантажити перелік відділень');
        },
      });
  }

  private filterOptions(options: SelectOption[], term: string): SelectOption[] {
    const normalized = term.trim().toLowerCase();
    if (!normalized) {
      return options;
    }
    return options.filter((o) => o.label.toLowerCase().includes(normalized));
  }
}
