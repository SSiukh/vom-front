import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideChevronLeft, LucideSave } from '@lucide/angular';
import { catchError, of, switchMap } from 'rxjs';
import { DictionariesService } from '../../../../core/dictionaries/dictionaries.service';
import { ExpensesApiService } from '../../../../core/api/expenses-api.service';
import { FEATURE_ROUTES } from '../../../../core/routes.constants';
import type { CreateExpensePayload } from '../../models/expense.model';

@Component({
  selector: 'app-expenses-form',
  imports: [ReactiveFormsModule, LucideChevronLeft, LucideSave],
  templateUrl: './expenses-form.html',
  styleUrl: './expenses-form.css',
})
export class ExpensesForm {
  private readonly fb = inject(FormBuilder);
  private readonly expensesApi = inject(ExpensesApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly dictionaries = inject(DictionariesService);

  private readonly expenseIdSignal = signal<string | null>(null);
  protected readonly isEditMode = computed(() => this.expenseIdSignal() !== null);

  protected readonly form = this.fb.nonNullable.group({
    typeId: ['', Validators.required],
    name: [''],
    amount: [0, [Validators.required, Validators.min(0)]],
  });

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  constructor() {
    this.form.controls.typeId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((typeId) => {
      this.onTypeChange(typeId);
    });

    this.route.paramMap
      .pipe(
        switchMap((params) => {
          const id = params.get('id');
          this.expenseIdSignal.set(id);
          if (!id) {
            this.resetForCreate();
            return of(null);
          }
          this.loading.set(true);
          this.errorMessage.set(null);
          return this.expensesApi.get(id).pipe(
            catchError(() => {
              this.loading.set(false);
              this.errorMessage.set('Не вдалося завантажити дані витрати');
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((expense) => {
        if (expense) {
          this.loading.set(false);
          this.form.patchValue({
            typeId: expense.typeId,
            name: expense.name ?? '',
            amount: expense.amount,
          });
        }
      });
  }

  goBack(): void {
    this.router.navigateByUrl(FEATURE_ROUTES.expenses);
  }

  requiresName(): boolean {
    const type = this.dictionaries.expenseTypes().find((t) => t.id === this.form.controls.typeId.value);
    return type?.requiresName ?? false;
  }

  canSubmit(): boolean {
    return this.form.valid && !this.saving();
  }

  submit(): void {
    if (!this.canSubmit()) {
      return;
    }
    this.errorMessage.set(null);
    this.saving.set(true);

    const raw = this.form.getRawValue();
    const payload: CreateExpensePayload = {
      typeId: raw.typeId,
      amount: raw.amount,
      ...(this.requiresName() && raw.name ? { name: raw.name } : {}),
    };

    const expenseId = this.expenseIdSignal();
    const request$ = expenseId ? this.expensesApi.update(expenseId, payload) : this.expensesApi.create(payload);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.router.navigateByUrl(FEATURE_ROUTES.expenses);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.errorMessage.set(this.resolveErrorMessage(error));
      },
    });
  }

  private onTypeChange(typeId: string): void {
    const control = this.form.controls.name;
    const type = this.dictionaries.expenseTypes().find((t) => t.id === typeId);
    if (type?.requiresName) {
      control.setValidators([Validators.required]);
    } else {
      control.clearValidators();
      control.setValue('');
    }
    control.updateValueAndValidity({ emitEvent: false });
  }

  private resetForCreate(): void {
    this.form.reset({ typeId: '', name: '', amount: 0 });
    this.errorMessage.set(null);
    this.saving.set(false);
    this.loading.set(false);
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
    return 'Не вдалося зберегти витрату';
  }
}
