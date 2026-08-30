import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { AbstractControl, ValidationErrors } from '@angular/forms';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideChevronLeft, LucideCircleCheck, LucideLock, LucideSearchCheck } from '@lucide/angular';
import { NovaPoshtaApiService } from '../../../../core/api/nova-poshta-api.service';
import { SendersApiService } from '../../../../core/api/senders-api.service';
import { FEATURE_ROUTES } from '../../../../core/routes.constants';
import { SearchableSelect, type SelectOption } from '../../../../shared/ui/searchable-select/searchable-select';
import type { CreateSenderPayload, SenderVerificationResult } from '../../models/sender.model';

function cityAndWarehouseTogether(control: AbstractControl): ValidationErrors | null {
  const cityRef = control.get('cityRef')?.value;
  const warehouseRef = control.get('warehouseRef')?.value;
  return !!cityRef === !!warehouseRef ? null : { addressIncomplete: true };
}

@Component({
  selector: 'app-senders-create',
  imports: [
    ReactiveFormsModule,
    SearchableSelect,
    LucideCircleCheck,
    LucideChevronLeft,
    LucideLock,
    LucideSearchCheck,
  ],
  templateUrl: './senders-create.html',
  styleUrl: './senders-create.css',
})
export class SendersCreate {
  private readonly fb = inject(FormBuilder);
  private readonly sendersApi = inject(SendersApiService);
  private readonly novaPoshtaApi = inject(NovaPoshtaApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly form = this.fb.nonNullable.group(
    {
      apiKey: ['', Validators.required],
      cityRef: [''],
      warehouseRef: [''],
    },
    { validators: cityAndWarehouseTogether },
  );

  protected readonly verifying = signal(false);
  protected readonly saving = signal(false);
  protected readonly verifiedContact = signal<SenderVerificationResult | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly citiesLoading = signal(false);
  protected readonly cityOptions = signal<SelectOption[]>([]);
  protected readonly selectedCityLabel = signal<string | null>(null);
  protected readonly cityLookupError = signal<string | null>(null);

  protected readonly warehousesLoading = signal(false);
  protected readonly warehouseOptions = signal<SelectOption[]>([]);
  protected readonly selectedWarehouseLabel = signal<string | null>(null);
  protected readonly warehouseLookupError = signal<string | null>(null);
  private allWarehouses: SelectOption[] = [];

  goBack(): void {
    this.router.navigateByUrl(FEATURE_ROUTES.senders);
  }

  verify(): void {
    if (this.form.controls.apiKey.invalid || this.verifying()) {
      return;
    }
    this.errorMessage.set(null);
    this.verifying.set(true);

    this.sendersApi
      .verify(this.form.getRawValue().apiKey)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.verifying.set(false);
          this.verifiedContact.set(result);
          this.form.controls.apiKey.disable();
        },
        error: (error: unknown) => {
          this.verifying.set(false);
          this.errorMessage.set(
            this.resolveErrorMessage(error, 'Не вдалося перевірити API ключ. Перевірте його правильність.'),
          );
        },
      });
  }

  cityChosen(): boolean {
    return !!this.form.controls.cityRef.value;
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
    this.form.controls.cityRef.setValue(option.value);
    this.form.controls.warehouseRef.setValue('');
    this.selectedWarehouseLabel.set(null);
    this.loadWarehouses(option.value);
  }

  onWarehouseSearchTermChange(term: string): void {
    this.warehouseOptions.set(this.filterOptions(this.allWarehouses, term));
  }

  onWarehouseSelected(option: SelectOption): void {
    this.selectedWarehouseLabel.set(option.label);
    this.form.controls.warehouseRef.setValue(option.value);
  }

  save(): void {
    if (!this.verifiedContact() || this.form.invalid || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();
    const payload: CreateSenderPayload =
      raw.cityRef && raw.warehouseRef
        ? { apiKey: raw.apiKey, cityRef: raw.cityRef, warehouseRef: raw.warehouseRef }
        : { apiKey: raw.apiKey };
    this.sendersApi
      .create(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.router.navigateByUrl(FEATURE_ROUTES.senders);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.errorMessage.set(this.resolveErrorMessage(error, 'Не вдалося зберегти відправника'));
        },
      });
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

  private resolveErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse && error.status === 429) {
      return 'Забагато спроб — спробуйте пізніше';
    }
    if (error instanceof HttpErrorResponse && error.status === 400) {
      const message = error.error?.message;
      if (typeof message === 'string') {
        return message;
      }
      if (Array.isArray(message) && message.length > 0) {
        return message[0];
      }
    }
    return fallback;
  }
}
