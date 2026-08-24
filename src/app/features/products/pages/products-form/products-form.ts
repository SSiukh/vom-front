import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideChevronLeft, LucideCloudUpload, LucideSave } from '@lucide/angular';
import { catchError, of, switchMap } from 'rxjs';
import { DictionariesService } from '../../../../core/dictionaries/dictionaries.service';
import { ProductsApiService } from '../../../../core/api/products-api.service';
import { FEATURE_ROUTES } from '../../../../core/routes.constants';

@Component({
  selector: 'app-products-form',
  imports: [ReactiveFormsModule, LucideChevronLeft, LucideCloudUpload, LucideSave],
  templateUrl: './products-form.html',
  styleUrl: './products-form.css',
})
export class ProductsForm {
  private readonly fb = inject(FormBuilder);
  private readonly productsApi = inject(ProductsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly dictionaries = inject(DictionariesService);

  private readonly productIdSignal = signal<string | null>(null);
  protected readonly isEditMode = computed(() => this.productIdSignal() !== null);

  protected readonly form = this.fb.nonNullable.group({
    typeId: ['', Validators.required],
    name: ['', Validators.required],
    price: [0, [Validators.required, Validators.min(0)]],
    promoPrice: this.fb.control<number | null>(null),
    stockQuantity: [0, [Validators.required, Validators.min(0)]],
  });

  protected readonly filterableTypes = computed(() => this.dictionaries.productTypes().filter((t) => !t.isCustom));

  protected readonly selectedFile = signal<File | null>(null);
  protected readonly photoPreviewUrl = signal<string | null>(null);
  protected readonly isDragOver = signal(false);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  private objectUrl: string | null = null;

  constructor() {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          const id = params.get('id');
          this.productIdSignal.set(id);
          if (!id) {
            this.resetForCreate();
            return of(null);
          }
          this.loading.set(true);
          this.errorMessage.set(null);
          return this.productsApi.get(id).pipe(
            catchError(() => {
              this.loading.set(false);
              this.errorMessage.set('Не вдалося завантажити дані товару');
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((product) => {
        if (product) {
          this.loading.set(false);
          this.form.patchValue({
            typeId: product.typeId,
            name: product.name,
            price: product.price,
            promoPrice: product.promoPrice,
            stockQuantity: product.stockQuantity,
          });
          this.photoPreviewUrl.set(product.photoUrl);
        }
      });

    this.destroyRef.onDestroy(() => {
      if (this.objectUrl) {
        URL.revokeObjectURL(this.objectUrl);
      }
    });
  }

  goBack(): void {
    this.router.navigateByUrl(FEATURE_ROUTES.products);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.setFile(file);
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.setFile(file);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(true);
  }

  onDragLeave(): void {
    this.isDragOver.set(false);
  }

  canSubmit(): boolean {
    return this.form.valid && (this.isEditMode() || this.selectedFile() !== null) && !this.saving();
  }

  submit(): void {
    if (!this.canSubmit()) {
      return;
    }
    this.errorMessage.set(null);
    this.saving.set(true);

    const formData = new FormData();
    const value = this.form.getRawValue();
    formData.append('typeId', value.typeId);
    formData.append('name', value.name);
    formData.append('price', String(value.price));
    if (value.promoPrice !== null) {
      formData.append('promoPrice', String(value.promoPrice));
    }
    formData.append('stockQuantity', String(value.stockQuantity));
    const file = this.selectedFile();
    if (file) {
      formData.append('photo', file);
    }

    const productId = this.productIdSignal();
    const request$ = productId ? this.productsApi.update(productId, formData) : this.productsApi.create(formData);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (product) => {
        this.saving.set(false);
        this.router.navigateByUrl(`${FEATURE_ROUTES.products}/${product.id}`);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.errorMessage.set(this.resolveErrorMessage(error));
      },
    });
  }

  private setFile(file: File): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
    }
    const url = URL.createObjectURL(file);
    this.objectUrl = url;
    this.selectedFile.set(file);
    this.photoPreviewUrl.set(url);
  }

  private resetForCreate(): void {
    this.form.reset({ typeId: '', name: '', price: 0, promoPrice: null, stockQuantity: 0 });
    this.selectedFile.set(null);
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    this.photoPreviewUrl.set(null);
    this.errorMessage.set(null);
    this.saving.set(false);
    this.loading.set(false);
    this.isDragOver.set(false);
  }

  private resolveErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as { message?: string | string[] } | null;
      if (Array.isArray(body?.message)) {
        return body.message.join('; ');
      }
      if (typeof body?.message === 'string') {
        return body.message;
      }
    }
    return 'Не вдалося зберегти товар';
  }
}
