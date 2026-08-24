import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideChevronLeft, LucideCircleCheck, LucideLock, LucideSearchCheck } from '@lucide/angular';
import { SendersApiService } from '../../../../core/api/senders-api.service';
import { FEATURE_ROUTES } from '../../../../core/routes.constants';
import type { SenderVerificationResult } from '../../models/sender.model';

@Component({
  selector: 'app-senders-create',
  imports: [ReactiveFormsModule, LucideCircleCheck, LucideChevronLeft, LucideLock, LucideSearchCheck],
  templateUrl: './senders-create.html',
  styleUrl: './senders-create.css',
})
export class SendersCreate {
  private readonly fb = inject(FormBuilder);
  private readonly sendersApi = inject(SendersApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly form = this.fb.nonNullable.group({
    apiKey: ['', Validators.required],
  });

  protected readonly verifying = signal(false);
  protected readonly saving = signal(false);
  protected readonly verifiedContact = signal<SenderVerificationResult | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  goBack(): void {
    this.router.navigateByUrl(FEATURE_ROUTES.senders);
  }

  verify(): void {
    if (this.form.invalid || this.verifying()) {
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

  save(): void {
    if (!this.verifiedContact() || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.errorMessage.set(null);

    this.sendersApi
      .create(this.form.getRawValue().apiKey)
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

  private resolveErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse && error.status === 429) {
      return 'Забагато спроб — спробуйте пізніше';
    }
    return fallback;
  }
}
